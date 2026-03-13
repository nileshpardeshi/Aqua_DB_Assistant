import { useMutation } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { trackAIUsage } from '@/lib/ai-usage-tracker';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DocColumnInfo {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  defaultValue?: string | null;
  description: string;
  sensitivity: 'none' | 'pii' | 'financial' | 'confidential';
  example?: string;
}

export interface DocIndexInfo {
  name: string;
  columns: string[];
  type: string;
  isUnique: boolean;
  purpose: string;
}

export interface DocConstraintInfo {
  name: string;
  type: string;
  columns: string[];
  description: string;
}

export interface DocTableInfo {
  name: string;
  schema?: string;
  description: string;
  category: string;
  estimatedVolume?: string;
  columns: DocColumnInfo[];
  indexes: DocIndexInfo[];
  constraints: DocConstraintInfo[];
  usageNotes?: string;
}

export interface DocRelationshipInfo {
  name: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  type: string;
  description: string;
  cascadeRule?: string;
  businessRule?: string;
}

export interface DocGlossaryItem {
  term: string;
  definition: string;
}

export interface DocumentationResult {
  projectOverview: {
    title: string;
    description: string;
    dialect: string;
    totalTables: number;
    totalRelationships: number;
    designPatterns: string[];
    namingConventions: string;
  };
  tables: DocTableInfo[];
  relationships: DocRelationshipInfo[];
  dataFlowDiagram: string;
  securityNotes: string[];
  maintenanceNotes: string[];
  glossary: DocGlossaryItem[];
}

export interface GenerateDocConfig {
  projectId: string;
  dialect: string;
  projectName: string;
  additionalContext?: string;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyResponse = Record<string, any>;

export function useGenerateDocumentation() {
  return useMutation({
    mutationFn: async (input: GenerateDocConfig) => {
      const response = await apiClient.post('/ai/docs/generate', input);
      const raw = response as unknown as AnyResponse;
      trackAIUsage({ usage: raw.usage, model: raw.model }, 'docs');
      return raw.documentation as DocumentationResult;
    },
  });
}

// ── Export Helpers ─────────────────────────────────────────────────────────────

export function generateMarkdown(doc: DocumentationResult): string {
  let md = '';

  // Title
  md += `# ${doc.projectOverview.title}\n\n`;
  md += `${doc.projectOverview.description}\n\n`;
  md += `| Property | Value |\n|----------|-------|\n`;
  md += `| **Dialect** | ${doc.projectOverview.dialect} |\n`;
  md += `| **Tables** | ${doc.projectOverview.totalTables} |\n`;
  md += `| **Relationships** | ${doc.projectOverview.totalRelationships} |\n`;
  md += `| **Naming Convention** | ${doc.projectOverview.namingConventions} |\n\n`;

  // Design Patterns
  if (doc.projectOverview.designPatterns.length > 0) {
    md += `## Design Patterns\n\n`;
    doc.projectOverview.designPatterns.forEach((p) => {
      md += `- ${p}\n`;
    });
    md += '\n';
  }

  // Tables
  md += `## Tables\n\n`;
  for (const table of doc.tables) {
    md += `### ${table.name}\n\n`;
    md += `> ${table.description}\n\n`;
    md += `- **Category:** ${table.category}\n`;
    if (table.estimatedVolume) md += `- **Estimated Volume:** ${table.estimatedVolume}\n`;
    if (table.schema) md += `- **Schema:** ${table.schema}\n`;
    md += '\n';

    // Columns
    md += `#### Columns\n\n`;
    md += `| Column | Type | Nullable | PK | FK | Description |\n`;
    md += `|--------|------|----------|----|----|-------------|\n`;
    for (const col of table.columns) {
      md += `| \`${col.name}\` | ${col.dataType} | ${col.nullable ? 'Yes' : 'No'} | ${col.isPrimaryKey ? 'Yes' : ''} | ${col.isForeignKey ? 'Yes' : ''} | ${col.description} |\n`;
    }
    md += '\n';

    // Indexes
    if (table.indexes.length > 0) {
      md += `#### Indexes\n\n`;
      md += `| Name | Columns | Type | Unique | Purpose |\n`;
      md += `|------|---------|------|--------|--------|\n`;
      for (const idx of table.indexes) {
        md += `| \`${idx.name}\` | ${idx.columns.join(', ')} | ${idx.type} | ${idx.isUnique ? 'Yes' : 'No'} | ${idx.purpose} |\n`;
      }
      md += '\n';
    }

    // Constraints
    if (table.constraints.length > 0) {
      md += `#### Constraints\n\n`;
      for (const con of table.constraints) {
        md += `- **${con.name}** (${con.type}): ${con.description}\n`;
      }
      md += '\n';
    }

    if (table.usageNotes) {
      md += `> **Usage Notes:** ${table.usageNotes}\n\n`;
    }
    md += '---\n\n';
  }

  // Relationships
  if (doc.relationships.length > 0) {
    md += `## Relationships\n\n`;
    md += `| Relationship | Source | Target | Type | Description |\n`;
    md += `|-------------|--------|--------|------|-------------|\n`;
    for (const rel of doc.relationships) {
      md += `| \`${rel.name}\` | ${rel.sourceTable}.${rel.sourceColumn} | ${rel.targetTable}.${rel.targetColumn} | ${rel.type} | ${rel.description} |\n`;
    }
    md += '\n';
  }

  // Data Flow
  if (doc.dataFlowDiagram) {
    md += `## Data Flow\n\n${doc.dataFlowDiagram}\n\n`;
  }

  // Security Notes
  if (doc.securityNotes.length > 0) {
    md += `## Security Considerations\n\n`;
    doc.securityNotes.forEach((n) => { md += `- ${n}\n`; });
    md += '\n';
  }

  // Maintenance Notes
  if (doc.maintenanceNotes.length > 0) {
    md += `## Maintenance Guidelines\n\n`;
    doc.maintenanceNotes.forEach((n) => { md += `- ${n}\n`; });
    md += '\n';
  }

  // Glossary
  if (doc.glossary.length > 0) {
    md += `## Glossary\n\n`;
    md += `| Term | Definition |\n|------|------------|\n`;
    doc.glossary.forEach((g) => {
      md += `| **${g.term}** | ${g.definition} |\n`;
    });
    md += '\n';
  }

  md += `---\n\n*Generated by Aqua DB Copilot on ${new Date().toLocaleString()}*\n`;
  return md;
}

export function generateHTML(doc: DocumentationResult): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(doc.projectOverview.title)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; line-height: 1.6; max-width: 1100px; margin: 0 auto; padding: 40px 24px; background: #fff; }
  h1 { font-size: 2rem; color: #0891b2; margin-bottom: 8px; border-bottom: 3px solid #0891b2; padding-bottom: 12px; }
  h2 { font-size: 1.4rem; color: #0e7490; margin: 32px 0 16px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
  h3 { font-size: 1.15rem; color: #155e75; margin: 24px 0 8px; }
  h4 { font-size: 0.95rem; color: #334155; margin: 16px 0 8px; }
  p { margin: 8px 0; color: #475569; }
  code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 0.875rem; color: #0891b2; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0 24px; font-size: 0.875rem; }
  th { background: #f8fafc; color: #475569; font-weight: 600; text-align: left; padding: 10px 12px; border: 1px solid #e2e8f0; }
  td { padding: 8px 12px; border: 1px solid #e2e8f0; color: #334155; }
  tr:nth-child(even) td { background: #f8fafc; }
  .overview-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin: 16px 0; }
  .overview-card { background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 16px; }
  .overview-card .label { font-size: 0.75rem; color: #0891b2; font-weight: 600; text-transform: uppercase; }
  .overview-card .value { font-size: 1.5rem; font-weight: 700; color: #0e7490; margin-top: 4px; }
  .category-badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; }
  .cat-Core { background: #dbeafe; color: #1e40af; }
  .cat-Reference { background: #fef3c7; color: #92400e; }
  .cat-Junction { background: #ede9fe; color: #5b21b6; }
  .cat-Audit { background: #fce7f3; color: #9d174d; }
  .cat-Configuration { background: #d1fae5; color: #065f46; }
  .sensitivity-pii { color: #dc2626; font-weight: 600; }
  .sensitivity-financial { color: #d97706; font-weight: 600; }
  .sensitivity-confidential { color: #7c3aed; font-weight: 600; }
  blockquote { border-left: 4px solid #0891b2; padding: 12px 16px; background: #f0fdfa; margin: 12px 0; color: #0e7490; border-radius: 0 8px 8px 0; }
  .note-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; margin: 12px 0; }
  .note-box.security { background: #fef2f2; border-color: #fecaca; }
  .note-box.maintenance { background: #f0fdf4; border-color: #bbf7d0; }
  ul { padding-left: 24px; margin: 8px 0; }
  li { margin: 4px 0; color: #475569; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 32px 0; }
  .footer { text-align: center; color: #94a3b8; font-size: 0.8rem; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
  @media print {
    body { padding: 20px; max-width: 100%; }
    h2 { page-break-before: auto; }
    table { page-break-inside: avoid; }
  }
</style>
</head>
<body>
`;

  // Header
  html += `<h1>${esc(doc.projectOverview.title)}</h1>\n`;
  html += `<p>${esc(doc.projectOverview.description)}</p>\n`;
  html += `<div class="overview-grid">\n`;
  html += `  <div class="overview-card"><div class="label">Dialect</div><div class="value">${esc(doc.projectOverview.dialect)}</div></div>\n`;
  html += `  <div class="overview-card"><div class="label">Tables</div><div class="value">${doc.projectOverview.totalTables}</div></div>\n`;
  html += `  <div class="overview-card"><div class="label">Relationships</div><div class="value">${doc.projectOverview.totalRelationships}</div></div>\n`;
  html += `</div>\n`;

  // Design Patterns
  if (doc.projectOverview.designPatterns.length > 0) {
    html += `<h2>Design Patterns</h2>\n<ul>\n`;
    doc.projectOverview.designPatterns.forEach((p) => { html += `  <li>${esc(p)}</li>\n`; });
    html += `</ul>\n`;
  }

  // Tables
  html += `<h2>Table Reference</h2>\n`;
  for (const table of doc.tables) {
    const catClass = `cat-${table.category.split(' ')[0]}`;
    html += `<h3>${esc(table.name)} <span class="category-badge ${catClass}">${esc(table.category)}</span></h3>\n`;
    html += `<blockquote>${esc(table.description)}</blockquote>\n`;
    if (table.estimatedVolume) html += `<p><strong>Volume:</strong> ${esc(table.estimatedVolume)}</p>\n`;

    // Columns table
    html += `<h4>Columns</h4>\n`;
    html += `<table><thead><tr><th>Column</th><th>Type</th><th>Nullable</th><th>PK</th><th>FK</th><th>Sensitivity</th><th>Description</th></tr></thead><tbody>\n`;
    for (const col of table.columns) {
      const sensClass = col.sensitivity !== 'none' ? `sensitivity-${col.sensitivity}` : '';
      html += `<tr><td><code>${esc(col.name)}</code></td><td>${esc(col.dataType)}</td><td>${col.nullable ? 'Yes' : 'No'}</td><td>${col.isPrimaryKey ? '✓' : ''}</td><td>${col.isForeignKey ? '✓' : ''}</td><td class="${sensClass}">${col.sensitivity !== 'none' ? col.sensitivity.toUpperCase() : '—'}</td><td>${esc(col.description)}</td></tr>\n`;
    }
    html += `</tbody></table>\n`;

    // Indexes
    if (table.indexes.length > 0) {
      html += `<h4>Indexes</h4>\n<table><thead><tr><th>Name</th><th>Columns</th><th>Type</th><th>Unique</th><th>Purpose</th></tr></thead><tbody>\n`;
      for (const idx of table.indexes) {
        html += `<tr><td><code>${esc(idx.name)}</code></td><td>${esc(idx.columns.join(', '))}</td><td>${esc(idx.type)}</td><td>${idx.isUnique ? 'Yes' : 'No'}</td><td>${esc(idx.purpose)}</td></tr>\n`;
      }
      html += `</tbody></table>\n`;
    }

    if (table.usageNotes) {
      html += `<div class="note-box"><strong>Usage Notes:</strong> ${esc(table.usageNotes)}</div>\n`;
    }
    html += `<hr />\n`;
  }

  // Relationships
  if (doc.relationships.length > 0) {
    html += `<h2>Relationships</h2>\n`;
    html += `<table><thead><tr><th>Name</th><th>Source</th><th>Target</th><th>Type</th><th>Description</th></tr></thead><tbody>\n`;
    for (const rel of doc.relationships) {
      html += `<tr><td><code>${esc(rel.name)}</code></td><td>${esc(rel.sourceTable)}.${esc(rel.sourceColumn)}</td><td>${esc(rel.targetTable)}.${esc(rel.targetColumn)}</td><td>${esc(rel.type)}</td><td>${esc(rel.description)}</td></tr>\n`;
    }
    html += `</tbody></table>\n`;
  }

  // Data Flow
  if (doc.dataFlowDiagram) {
    html += `<h2>Data Flow</h2>\n<p>${esc(doc.dataFlowDiagram)}</p>\n`;
  }

  // Security
  if (doc.securityNotes.length > 0) {
    html += `<h2>Security Considerations</h2>\n`;
    doc.securityNotes.forEach((n) => { html += `<div class="note-box security">⚠ ${esc(n)}</div>\n`; });
  }

  // Maintenance
  if (doc.maintenanceNotes.length > 0) {
    html += `<h2>Maintenance Guidelines</h2>\n`;
    doc.maintenanceNotes.forEach((n) => { html += `<div class="note-box maintenance">🔧 ${esc(n)}</div>\n`; });
  }

  // Glossary
  if (doc.glossary.length > 0) {
    html += `<h2>Glossary</h2>\n<table><thead><tr><th>Term</th><th>Definition</th></tr></thead><tbody>\n`;
    doc.glossary.forEach((g) => { html += `<tr><td><strong>${esc(g.term)}</strong></td><td>${esc(g.definition)}</td></tr>\n`; });
    html += `</tbody></table>\n`;
  }

  html += `<div class="footer">Generated by Aqua DB Copilot — ${new Date().toLocaleString()}</div>\n`;
  html += `</body>\n</html>`;
  return html;
}
