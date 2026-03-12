import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../middleware/error-handler.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DependencyResolution {
  sortedTables: string[];
  circularDependencies: string[][];
  selfReferences: string[];
  graph: Record<string, string[]>;
}

// ── Resolve Table Order (Topological Sort) ───────────────────────────────────

export async function resolveTableOrder(
  projectId: string,
): Promise<DependencyResolution> {
  // Verify project
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) throw new NotFoundError('Project');

  // Get all relationships
  const relationships = await prisma.relationshipMetadata.findMany({
    where: {
      sourceTable: { projectId },
    },
    include: {
      sourceTable: {
        select: { tableName: true },
      },
      targetTable: {
        select: { tableName: true },
      },
    },
  });

  // Get all tables
  const allTables = await prisma.tableMetadata.findMany({
    where: { projectId },
    select: { tableName: true },
  });

  const tableNames = new Set(allTables.map((t) => t.tableName));
  const selfReferences: string[] = [];

  // Build adjacency list: child (source/FK holder) depends on parent (target/PK holder)
  // graph[child] = [parent1, parent2, ...]
  const graph: Record<string, string[]> = {};
  const inDegree: Record<string, number> = {};

  // Initialize all tables
  for (const name of tableNames) {
    graph[name] = [];
    inDegree[name] = 0;
  }

  for (const rel of relationships) {
    const child = rel.sourceTable.tableName;
    const parent = rel.targetTable.tableName;

    // Self-references: note but skip from graph
    if (child === parent) {
      if (!selfReferences.includes(child)) {
        selfReferences.push(child);
      }
      continue;
    }

    // child depends on parent — parent must come first
    if (!graph[child].includes(parent)) {
      graph[child].push(parent);
      inDegree[child] = (inDegree[child] || 0) + 1;
    }
  }

  // Kahn's algorithm for topological sort
  const queue: string[] = [];
  const sorted: string[] = [];

  // Start with tables that have no dependencies (inDegree = 0)
  for (const name of tableNames) {
    if (inDegree[name] === 0) {
      queue.push(name);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    // Find all tables that depend on current
    for (const [child, parents] of Object.entries(graph)) {
      if (parents.includes(current)) {
        inDegree[child]--;
        if (inDegree[child] === 0) {
          queue.push(child);
        }
      }
    }
  }

  // Detect circular dependencies: any table not in sorted list
  const circularDependencies: string[][] = [];
  const remaining = [...tableNames].filter((t) => !sorted.includes(t));

  if (remaining.length > 0) {
    // Group circular dependencies into cycles
    const visited = new Set<string>();

    for (const start of remaining) {
      if (visited.has(start)) continue;

      const cycle: string[] = [];
      let current: string | undefined = start;

      while (current && !visited.has(current)) {
        visited.add(current);
        cycle.push(current);

        // Follow the dependency chain
        const currentDeps: string[] = graph[current]?.filter((d: string) => remaining.includes(d)) || [];
        current = currentDeps.find((d: string) => !visited.has(d)) || undefined;
      }

      if (cycle.length > 1) {
        circularDependencies.push(cycle);
      }
    }

    // Add remaining tables at the end (they have circular deps but still need migration)
    sorted.push(...remaining);
  }

  return {
    sortedTables: sorted,
    circularDependencies,
    selfReferences,
    graph,
  };
}
