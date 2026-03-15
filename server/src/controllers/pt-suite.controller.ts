/**
 * Performance Testing Suite — Controller
 * Handles API collections, chains, scenarios, load test runs, and AI analysis.
 */

import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';
import { AIProviderFactory } from '../services/ai/ai-provider.factory.js';
import { calculateSmartMaxTokens } from '../services/ai/ai-response-cache.js';
import {
  buildPtAnalysisPrompt,
  buildPtChainAnalysisPrompt,
  buildPtAssertionSuggestionPrompt,
} from '../services/ai/prompt-templates/pt-analysis.prompt.js';
import {
  parseSwaggerSpec,
  executeChainSteps,
  startLoadTest,
  signalStop,
  seedDemoData,
} from '../services/pt-suite.service.js';

// ── Helper: parse AI JSON with fence stripping ──────────────────────────────

function parseAIJson(content: string): unknown {
  let cleaned = content.trim();
  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)```\s*$/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  return JSON.parse(cleaned);
}

function p(req: Request, key: string): string {
  return req.params[key] as string;
}

// ============================================================================
// SWAGGER PARSING
// ============================================================================

export const parseSwagger = asyncHandler(async (req: Request, res: Response) => {
  const { specText, name } = req.body as { specText: string; name?: string };

  if (!specText || typeof specText !== 'string') {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'specText (string) is required' },
    });
    return;
  }

  try {
    const parsed = parseSwaggerSpec(specText);

    // Create collection + endpoints in DB
    const collection = await prisma.ptApiCollection.create({
      data: {
        name: name || parsed.title,
        description: parsed.description,
        baseUrl: parsed.baseUrl,
        swaggerSpec: specText.length <= 100000 ? specText : null,
        endpoints: {
          create: parsed.endpoints.map(ep => ({
            name: ep.name,
            method: ep.method,
            path: ep.path,
            description: ep.description,
            headers: ep.headers.length > 0 ? JSON.stringify(ep.headers) : null,
            queryParams: ep.queryParams.length > 0 ? JSON.stringify(ep.queryParams) : null,
            bodyType: ep.bodyType,
            bodyTemplate: ep.bodyTemplate,
            tags: ep.tags.length > 0 ? JSON.stringify(ep.tags) : null,
          })),
        },
      },
      include: { endpoints: true },
    });

    res.json({
      success: true,
      data: {
        collection,
        parsed: {
          title: parsed.title,
          version: parsed.version,
          baseUrl: parsed.baseUrl,
          endpointCount: parsed.endpoints.length,
        },
      },
    });
  } catch (err) {
    logger.error('Swagger parse failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(400).json({
      success: false,
      error: { code: 'PARSE_ERROR', message: `Failed to parse spec: ${err instanceof Error ? err.message : String(err)}` },
    });
  }
});

// ============================================================================
// COLLECTIONS CRUD
// ============================================================================

export const listCollections = asyncHandler(async (_req: Request, res: Response) => {
  const collections = await prisma.ptApiCollection.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { endpoints: true, chains: true } } },
  });
  res.json({ success: true, data: collections });
});

export const getCollection = asyncHandler(async (req: Request, res: Response) => {
  const id = p(req, 'id');
  const collection = await prisma.ptApiCollection.findUniqueOrThrow({
    where: { id },
    include: {
      endpoints: { orderBy: { createdAt: 'asc' } },
      chains: { include: { _count: { select: { steps: true } } } },
    },
  });
  res.json({ success: true, data: collection });
});

export const createCollection = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, baseUrl, authConfig, headers, variables } = req.body;

  if (!name || !baseUrl) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'name and baseUrl are required' },
    });
    return;
  }

  const s = (v: unknown): string | null => v == null ? null : (typeof v === 'string' ? v : JSON.stringify(v));

  const collection = await prisma.ptApiCollection.create({
    data: {
      name,
      description: description || null,
      baseUrl,
      authConfig: s(authConfig),
      headers: s(headers),
      variables: s(variables),
    },
  });

  res.status(201).json({ success: true, data: collection });
});

export const updateCollection = asyncHandler(async (req: Request, res: Response) => {
  const id = p(req, 'id');
  const { name, description, baseUrl, authConfig, headers, variables } = req.body;

  const s = (v: unknown): string | null => v == null ? null : (typeof v === 'string' ? v : JSON.stringify(v));

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (baseUrl !== undefined) data.baseUrl = baseUrl;
  if (authConfig !== undefined) data.authConfig = s(authConfig);
  if (headers !== undefined) data.headers = s(headers);
  if (variables !== undefined) data.variables = s(variables);

  const collection = await prisma.ptApiCollection.update({ where: { id }, data });
  res.json({ success: true, data: collection });
});

export const deleteCollection = asyncHandler(async (req: Request, res: Response) => {
  const id = p(req, 'id');
  await prisma.ptApiCollection.delete({ where: { id } });
  res.json({ success: true, data: { deleted: true } });
});

// ============================================================================
// ENDPOINTS CRUD
// ============================================================================

export const createEndpoint = asyncHandler(async (req: Request, res: Response) => {
  const collectionId = p(req, 'collectionId');
  const { name, method, path, description, headers, queryParams, bodyType, bodyTemplate, tags } = req.body;

  if (!name || !method || !path) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'name, method, and path are required' },
    });
    return;
  }

  const s = (v: unknown): string | null => v == null ? null : (typeof v === 'string' ? v : JSON.stringify(v));

  const endpoint = await prisma.ptApiEndpoint.create({
    data: {
      collectionId,
      name,
      method: (method as string).toUpperCase(),
      path,
      description: description || null,
      headers: s(headers),
      queryParams: s(queryParams),
      bodyType: bodyType || 'none',
      bodyTemplate: s(bodyTemplate),
      tags: s(tags),
    },
  });

  res.status(201).json({ success: true, data: endpoint });
});

export const updateEndpoint = asyncHandler(async (req: Request, res: Response) => {
  const id = p(req, 'id');
  const { name, method, path, description, headers, queryParams, bodyType, bodyTemplate, tags } = req.body;

  const s = (v: unknown): string | null => v == null ? null : (typeof v === 'string' ? v : JSON.stringify(v));

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (method !== undefined) data.method = (method as string).toUpperCase();
  if (path !== undefined) data.path = path;
  if (description !== undefined) data.description = description;
  if (headers !== undefined) data.headers = s(headers);
  if (queryParams !== undefined) data.queryParams = s(queryParams);
  if (bodyType !== undefined) data.bodyType = bodyType;
  if (bodyTemplate !== undefined) data.bodyTemplate = s(bodyTemplate);
  if (tags !== undefined) data.tags = s(tags);

  const endpoint = await prisma.ptApiEndpoint.update({ where: { id }, data });
  res.json({ success: true, data: endpoint });
});

export const deleteEndpoint = asyncHandler(async (req: Request, res: Response) => {
  const id = p(req, 'id');
  await prisma.ptApiEndpoint.delete({ where: { id } });
  res.json({ success: true, data: { deleted: true } });
});

// ============================================================================
// CHAINS CRUD
// ============================================================================

export const listChains = asyncHandler(async (_req: Request, res: Response) => {
  const chains = await prisma.ptApiChain.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      collection: { select: { id: true, name: true, baseUrl: true } },
      _count: { select: { steps: true, scenarios: true } },
    },
  });
  res.json({ success: true, data: chains });
});

export const getChain = asyncHandler(async (req: Request, res: Response) => {
  const id = p(req, 'id');
  const chain = await prisma.ptApiChain.findUniqueOrThrow({
    where: { id },
    include: {
      collection: { select: { id: true, name: true, baseUrl: true } },
      steps: { orderBy: { sortOrder: 'asc' }, include: { endpoint: { select: { id: true, name: true } } } },
      scenarios: { orderBy: { createdAt: 'desc' } },
    },
  });
  res.json({ success: true, data: chain });
});

export const createChain = asyncHandler(async (req: Request, res: Response) => {
  const { collectionId, name, description } = req.body;

  if (!collectionId || !name) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'collectionId and name are required' },
    });
    return;
  }

  const chain = await prisma.ptApiChain.create({
    data: { collectionId, name, description: description || null },
  });

  res.status(201).json({ success: true, data: chain });
});

export const updateChain = asyncHandler(async (req: Request, res: Response) => {
  const id = p(req, 'id');
  const { name, description } = req.body;

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;

  const chain = await prisma.ptApiChain.update({ where: { id }, data });
  res.json({ success: true, data: chain });
});

export const deleteChain = asyncHandler(async (req: Request, res: Response) => {
  const id = p(req, 'id');
  await prisma.ptApiChain.delete({ where: { id } });
  res.json({ success: true, data: { deleted: true } });
});

// ============================================================================
// CHAIN STEPS CRUD
// ============================================================================

export const addStep = asyncHandler(async (req: Request, res: Response) => {
  const chainId = p(req, 'chainId');
  const { endpointId, name, method, url, headers, body, extractors, assertions, preScript, postScript, thinkTimeSec } = req.body;

  if (!name || !method || !url) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'name, method, and url are required' },
    });
    return;
  }

  // Get max sortOrder for this chain
  const maxStep = await prisma.ptChainStep.findFirst({
    where: { chainId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });
  const nextOrder = (maxStep?.sortOrder ?? 0) + 1;

  const s = (v: unknown): string | null => v == null ? null : (typeof v === 'string' ? v : JSON.stringify(v));

  const step = await prisma.ptChainStep.create({
    data: {
      chainId,
      endpointId: endpointId || null,
      sortOrder: nextOrder,
      name,
      method: (method as string).toUpperCase(),
      url,
      headers: s(headers),
      body: s(body),
      extractors: s(extractors),
      assertions: s(assertions),
      preScript: preScript || null,
      postScript: postScript || null,
      thinkTimeSec: thinkTimeSec ?? 0,
    },
  });

  res.status(201).json({ success: true, data: step });
});

export const updateStep = asyncHandler(async (req: Request, res: Response) => {
  const id = p(req, 'id');
  const { name, method, url, headers, body, extractors, assertions, preScript, postScript, thinkTimeSec, isEnabled, endpointId } = req.body;

  const s = (v: unknown): string | null => v == null ? null : (typeof v === 'string' ? v : JSON.stringify(v));

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (method !== undefined) data.method = (method as string).toUpperCase();
  if (url !== undefined) data.url = url;
  if (headers !== undefined) data.headers = s(headers);
  if (body !== undefined) data.body = s(body);
  if (extractors !== undefined) data.extractors = s(extractors);
  if (assertions !== undefined) data.assertions = s(assertions);
  if (preScript !== undefined) data.preScript = preScript;
  if (postScript !== undefined) data.postScript = postScript;
  if (thinkTimeSec !== undefined) data.thinkTimeSec = thinkTimeSec;
  if (isEnabled !== undefined) data.isEnabled = isEnabled;
  if (endpointId !== undefined) data.endpointId = endpointId || null;

  const step = await prisma.ptChainStep.update({ where: { id }, data });
  res.json({ success: true, data: step });
});

export const deleteStep = asyncHandler(async (req: Request, res: Response) => {
  const id = p(req, 'id');
  await prisma.ptChainStep.delete({ where: { id } });
  res.json({ success: true, data: { deleted: true } });
});

export const reorderSteps = asyncHandler(async (req: Request, res: Response) => {
  const chainId = p(req, 'chainId');
  const { stepIds } = req.body as { stepIds: string[] };

  if (!stepIds || !Array.isArray(stepIds)) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'stepIds (string[]) is required' },
    });
    return;
  }

  // Update sort order for each step
  await prisma.$transaction(
    stepIds.map((stepId: string, index: number) =>
      prisma.ptChainStep.update({
        where: { id: stepId },
        data: { sortOrder: index + 1 },
      }),
    ),
  );

  const steps = await prisma.ptChainStep.findMany({
    where: { chainId },
    orderBy: { sortOrder: 'asc' },
  });

  res.json({ success: true, data: steps });
});

// ============================================================================
// CHAIN EXECUTION (single test run)
// ============================================================================

export const executeChain = asyncHandler(async (req: Request, res: Response) => {
  const chainId = p(req, 'chainId');
  const { variables } = req.body as { variables?: Record<string, string> };

  const chain = await prisma.ptApiChain.findUniqueOrThrow({
    where: { id: chainId },
    include: {
      steps: { where: { isEnabled: true }, orderBy: { sortOrder: 'asc' } },
      collection: { select: { baseUrl: true } },
    },
  });

  if (chain.steps.length === 0) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'Chain has no enabled steps' },
    });
    return;
  }

  const results = await executeChainSteps(
    chain.steps.map(s => ({
      name: s.name,
      method: s.method,
      url: s.url,
      headers: s.headers,
      body: s.body,
      extractors: s.extractors,
      assertions: s.assertions,
      thinkTimeSec: s.thinkTimeSec,
      isEnabled: s.isEnabled,
    })),
    chain.collection.baseUrl,
    variables ?? {},
  );

  const totalLatency = results.reduce((sum, r) => sum + r.latencyMs, 0);
  const totalErrors = results.filter(r => r.error || r.statusCode >= 400).length;
  const allAssertions = results.flatMap(r => r.assertionResults);

  res.json({
    success: true,
    data: {
      chainId,
      chainName: chain.name,
      stepResults: results,
      summary: {
        totalSteps: results.length,
        totalLatencyMs: totalLatency,
        avgLatencyMs: results.length > 0 ? totalLatency / results.length : 0,
        totalErrors,
        assertionsPassed: allAssertions.filter(a => a.passed).length,
        assertionsFailed: allAssertions.filter(a => !a.passed).length,
      },
    },
  });
});

// ============================================================================
// SCENARIOS CRUD
// ============================================================================

export const listScenarios = asyncHandler(async (_req: Request, res: Response) => {
  const scenarios = await prisma.ptLoadScenario.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      chain: { select: { id: true, name: true, collection: { select: { id: true, name: true } } } },
      _count: { select: { runs: true } },
    },
  });
  res.json({ success: true, data: scenarios });
});

export const createScenario = asyncHandler(async (req: Request, res: Response) => {
  const {
    chainId, name, description, pattern, peakVU, rampUpSec, steadyStateSec, rampDownSec,
    thinkTimeSec, pacingSec, timeoutMs, maxErrorPct, slaThresholds, customRampSteps,
  } = req.body;

  if (!chainId || !name) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'chainId and name are required' },
    });
    return;
  }

  const s = (v: unknown): string | null => v == null ? null : (typeof v === 'string' ? v : JSON.stringify(v));

  const scenario = await prisma.ptLoadScenario.create({
    data: {
      chainId,
      name,
      description: description || null,
      pattern: pattern || 'ramp',
      peakVU: peakVU ?? 10,
      rampUpSec: rampUpSec ?? 30,
      steadyStateSec: steadyStateSec ?? 60,
      rampDownSec: rampDownSec ?? 10,
      thinkTimeSec: thinkTimeSec ?? 1,
      pacingSec: pacingSec ?? 0,
      timeoutMs: timeoutMs ?? 30000,
      maxErrorPct: maxErrorPct ?? 10,
      slaThresholds: s(slaThresholds),
      customRampSteps: s(customRampSteps),
    },
  });

  res.status(201).json({ success: true, data: scenario });
});

export const updateScenario = asyncHandler(async (req: Request, res: Response) => {
  const id = p(req, 'id');
  const {
    name, description, pattern, peakVU, rampUpSec, steadyStateSec, rampDownSec,
    thinkTimeSec, pacingSec, timeoutMs, maxErrorPct, slaThresholds, customRampSteps,
  } = req.body;

  const s = (v: unknown): string | null => v == null ? null : (typeof v === 'string' ? v : JSON.stringify(v));

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (pattern !== undefined) data.pattern = pattern;
  if (peakVU !== undefined) data.peakVU = peakVU;
  if (rampUpSec !== undefined) data.rampUpSec = rampUpSec;
  if (steadyStateSec !== undefined) data.steadyStateSec = steadyStateSec;
  if (rampDownSec !== undefined) data.rampDownSec = rampDownSec;
  if (thinkTimeSec !== undefined) data.thinkTimeSec = thinkTimeSec;
  if (pacingSec !== undefined) data.pacingSec = pacingSec;
  if (timeoutMs !== undefined) data.timeoutMs = timeoutMs;
  if (maxErrorPct !== undefined) data.maxErrorPct = maxErrorPct;
  if (slaThresholds !== undefined) data.slaThresholds = s(slaThresholds);
  if (customRampSteps !== undefined) data.customRampSteps = s(customRampSteps);

  const scenario = await prisma.ptLoadScenario.update({ where: { id }, data });
  res.json({ success: true, data: scenario });
});

export const deleteScenario = asyncHandler(async (req: Request, res: Response) => {
  const id = p(req, 'id');
  await prisma.ptLoadScenario.delete({ where: { id } });
  res.json({ success: true, data: { deleted: true } });
});

// ============================================================================
// TEST RUNS
// ============================================================================

export const startRun = asyncHandler(async (req: Request, res: Response) => {
  const { scenarioId } = req.body;

  if (!scenarioId) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'scenarioId is required' },
    });
    return;
  }

  // Validate scenario exists
  const scenario = await prisma.ptLoadScenario.findUniqueOrThrow({
    where: { id: scenarioId as string },
    include: { chain: { include: { _count: { select: { steps: true } } } } },
  });

  // Create run record
  const run = await prisma.ptTestRun.create({
    data: {
      scenarioId: scenarioId as string,
      status: 'running',
    },
  });

  // Start load test in background (non-blocking)
  startLoadTest(scenarioId as string, run.id).catch(err => {
    logger.error(`Background load test failed for run ${run.id}`, {
      error: err instanceof Error ? err.message : String(err),
    });
  });

  res.status(201).json({
    success: true,
    data: {
      runId: run.id,
      scenarioId,
      scenarioName: scenario.name,
      chainName: scenario.chain.name,
      status: 'running',
      config: {
        pattern: scenario.pattern,
        peakVU: scenario.peakVU,
        duration: scenario.rampUpSec + scenario.steadyStateSec + scenario.rampDownSec,
      },
    },
  });
});

export const listRuns = asyncHandler(async (_req: Request, res: Response) => {
  const runs = await prisma.ptTestRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 50,
    include: {
      scenario: {
        select: {
          id: true,
          name: true,
          pattern: true,
          peakVU: true,
          chain: { select: { id: true, name: true } },
        },
      },
      _count: { select: { metrics: true, stepMetrics: true } },
    },
  });
  res.json({ success: true, data: runs });
});

export const getRun = asyncHandler(async (req: Request, res: Response) => {
  const id = p(req, 'id');
  const run = await prisma.ptTestRun.findUniqueOrThrow({
    where: { id },
    include: {
      scenario: {
        include: {
          chain: { select: { id: true, name: true, collection: { select: { id: true, name: true } } } },
        },
      },
      stepMetrics: { orderBy: { avgLatencyMs: 'desc' } },
      metrics: { orderBy: { timestamp: 'asc' } },
    },
  });
  res.json({ success: true, data: run });
});

export const stopRun = asyncHandler(async (req: Request, res: Response) => {
  const runId = p(req, 'runId');

  const run = await prisma.ptTestRun.findUniqueOrThrow({
    where: { id: runId },
    select: { status: true },
  });

  if (run.status !== 'running') {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: `Run is not running (status: ${run.status})` },
    });
    return;
  }

  const stopped = signalStop(runId);

  if (stopped) {
    await prisma.ptTestRun.update({
      where: { id: runId },
      data: { status: 'stopped', completedAt: new Date() },
    });
  }

  res.json({ success: true, data: { stopped, runId } });
});

// ============================================================================
// SSE LIVE METRICS STREAM
// ============================================================================

export const streamMetrics = asyncHandler(async (req: Request, res: Response) => {
  const runId = p(req, 'runId');

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let lastTimestamp = new Date(0);
  let isActive = true;

  // Handle client disconnect
  req.on('close', () => {
    isActive = false;
  });

  const poll = async () => {
    while (isActive) {
      try {
        // Fetch new metrics since last poll
        const newMetrics = await prisma.ptTestMetric.findMany({
          where: {
            runId,
            timestamp: { gt: lastTimestamp },
          },
          orderBy: { timestamp: 'asc' },
        });

        for (const metric of newMetrics) {
          res.write(`data: ${JSON.stringify({
            type: 'metric',
            data: {
              timestamp: metric.timestamp,
              activeVU: metric.activeVU,
              requestCount: metric.requestCount,
              errorCount: metric.errorCount,
              avgLatencyMs: metric.avgLatencyMs,
              p95LatencyMs: metric.p95LatencyMs,
              p99LatencyMs: metric.p99LatencyMs,
              tps: metric.tps,
            },
          })}\n\n`);
          lastTimestamp = metric.timestamp;
        }

        // Check if run is done
        const currentRun = await prisma.ptTestRun.findUnique({
          where: { id: runId },
          select: { status: true, totalRequests: true, totalErrors: true, avgLatencyMs: true, p95LatencyMs: true, errorRate: true },
        });

        if (currentRun && (currentRun.status === 'completed' || currentRun.status === 'stopped' || currentRun.status === 'failed')) {
          res.write(`data: ${JSON.stringify({
            type: 'done',
            data: {
              status: currentRun.status,
              totalRequests: currentRun.totalRequests,
              totalErrors: currentRun.totalErrors,
              avgLatencyMs: currentRun.avgLatencyMs,
              p95LatencyMs: currentRun.p95LatencyMs,
              errorRate: currentRun.errorRate,
            },
          })}\n\n`);
          break;
        }

        // Wait 1 second before next poll
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        logger.error('SSE metrics poll error', { error: err instanceof Error ? err.message : String(err) });
        break;
      }
    }

    res.end();
  };

  poll().catch(() => res.end());
});

// ============================================================================
// AI REPORT GENERATION
// ============================================================================

export const generateReport = asyncHandler(async (req: Request, res: Response) => {
  const runId = p(req, 'runId');

  const run = await prisma.ptTestRun.findUniqueOrThrow({
    where: { id: runId },
    include: {
      scenario: true,
      stepMetrics: true,
      metrics: { orderBy: { timestamp: 'asc' } },
    },
  });

  if (run.status !== 'completed' && run.status !== 'stopped') {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: `Run must be completed or stopped (current: ${run.status})` },
    });
    return;
  }

  // Build time series highlights
  let timeSeriesHighlights = '';
  if (run.metrics.length > 0) {
    const firstMetric = run.metrics[0];
    const lastMetric = run.metrics[run.metrics.length - 1];
    const peakLatencyMetric = run.metrics.reduce(
      (max, m) => m.avgLatencyMs > max.avgLatencyMs ? m : max,
      run.metrics[0],
    );
    const peakTpsMetric = run.metrics.reduce(
      (max, m) => m.tps > max.tps ? m : max,
      run.metrics[0],
    );

    timeSeriesHighlights = [
      `Test duration: ${run.metrics.length} seconds of data`,
      `First interval: ${firstMetric.activeVU} VUs, ${firstMetric.avgLatencyMs.toFixed(0)}ms avg latency, ${firstMetric.tps.toFixed(1)} TPS`,
      `Last interval: ${lastMetric.activeVU} VUs, ${lastMetric.avgLatencyMs.toFixed(0)}ms avg latency, ${lastMetric.tps.toFixed(1)} TPS`,
      `Peak latency at: ${peakLatencyMetric.avgLatencyMs.toFixed(0)}ms with ${peakLatencyMetric.activeVU} VUs`,
      `Peak TPS at: ${peakTpsMetric.tps.toFixed(1)} with ${peakTpsMetric.activeVU} VUs`,
      run.metrics.length > 10
        ? `Latency trend: ${run.metrics.slice(0, 3).map(m => m.avgLatencyMs.toFixed(0)).join(',')}ms (start) -> ${run.metrics.slice(-3).map(m => m.avgLatencyMs.toFixed(0)).join(',')}ms (end)`
        : '',
    ].filter(Boolean).join('\n');
  }

  const messages = buildPtAnalysisPrompt({
    scenario: {
      name: run.scenario.name,
      pattern: run.scenario.pattern,
      peakVU: run.scenario.peakVU,
      duration: run.scenario.rampUpSec + run.scenario.steadyStateSec + run.scenario.rampDownSec,
    },
    summary: {
      totalRequests: run.totalRequests,
      totalErrors: run.totalErrors,
      avgLatencyMs: run.avgLatencyMs,
      p50: run.p50LatencyMs,
      p95: run.p95LatencyMs,
      p99: run.p99LatencyMs,
      maxLatencyMs: run.maxLatencyMs,
      peakTps: run.peakTps,
      avgTps: run.avgTps,
      errorRate: run.errorRate,
    },
    stepMetrics: run.stepMetrics.map(sm => ({
      stepName: sm.stepName,
      method: sm.method,
      url: sm.url,
      avgLatency: sm.avgLatencyMs,
      p95: sm.p95LatencyMs,
      p99: sm.p99LatencyMs,
      totalCalls: sm.totalCalls,
      totalErrors: sm.totalErrors,
      errorRate: sm.totalCalls > 0 ? (sm.totalErrors / sm.totalCalls) * 100 : 0,
    })),
    timeSeriesHighlights,
  });

  const provider = await AIProviderFactory.getTracked({
    module: 'pt-suite',
    endpoint: '/pt-suite/report',
  });

  const promptText = messages.map(m => m.content).join('\n');
  const smartMax = calculateSmartMaxTokens(promptText, 8192, 2048);

  const response = await provider.chat({
    messages,
    temperature: 0.2,
    maxTokens: smartMax,
    jsonMode: true,
  });

  let analysis: unknown;
  try {
    analysis = parseAIJson(response.content);
  } catch {
    analysis = {
      executiveSummary: response.content.slice(0, 500),
      riskLevel: 'Unknown',
      bottlenecks: [],
      recommendations: [],
      capacityEstimate: {},
      slaCompliance: [],
    };
  }

  // Save analysis to run
  await prisma.ptTestRun.update({
    where: { id: runId },
    data: {
      aiAnalysis: JSON.stringify(analysis),
      reportData: JSON.stringify({
        analysis,
        generatedAt: new Date().toISOString(),
        model: response.model,
      }),
    },
  });

  res.json({
    success: true,
    data: {
      runId,
      analysis,
      usage: response.usage,
      model: response.model,
    },
  });
});

// ============================================================================
// AI: ANALYZE CHAIN
// ============================================================================

export const aiAnalyzeChain = asyncHandler(async (req: Request, res: Response) => {
  const { chainId } = req.body;

  if (!chainId) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'chainId is required' },
    });
    return;
  }

  const chain = await prisma.ptApiChain.findUniqueOrThrow({
    where: { id: chainId as string },
    include: {
      steps: { orderBy: { sortOrder: 'asc' } },
      collection: { select: { baseUrl: true } },
    },
  });

  const messages = buildPtChainAnalysisPrompt({
    chainName: chain.name,
    collectionBaseUrl: chain.collection.baseUrl,
    steps: chain.steps.map(s => ({
      name: s.name,
      method: s.method,
      url: s.url,
      hasBody: !!s.body,
      extractors: s.extractors ? JSON.parse(s.extractors) as Array<{ name: string; source: string; path: string }> : [],
      assertions: s.assertions ? JSON.parse(s.assertions) as Array<{ type: string; target: string; operator: string; value: string }> : [],
      thinkTimeSec: s.thinkTimeSec,
    })),
  });

  const provider = await AIProviderFactory.getTracked({
    module: 'pt-suite',
    endpoint: '/pt-suite/analyze-chain',
  });

  const promptText = messages.map(m => m.content).join('\n');
  const smartMax = calculateSmartMaxTokens(promptText, 4096, 1500);

  const response = await provider.chat({
    messages,
    temperature: 0.2,
    maxTokens: smartMax,
    jsonMode: true,
  });

  let analysis: unknown;
  try {
    analysis = parseAIJson(response.content);
  } catch {
    analysis = { overallScore: 0, issues: [], suggestedImprovements: [response.content.slice(0, 500)] };
  }

  res.json({
    success: true,
    data: {
      chainId,
      chainName: chain.name,
      analysis,
      usage: response.usage,
      model: response.model,
    },
  });
});

// ============================================================================
// AI: SUGGEST ASSERTIONS
// ============================================================================

export const aiSuggestAssertions = asyncHandler(async (req: Request, res: Response) => {
  const { stepId, sampleResponse } = req.body;

  if (!stepId) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'stepId is required' },
    });
    return;
  }

  const step = await prisma.ptChainStep.findUniqueOrThrow({
    where: { id: stepId as string },
  });

  const messages = buildPtAssertionSuggestionPrompt({
    stepName: step.name,
    method: step.method,
    url: step.url,
    bodyTemplate: step.body,
    sampleResponse: (sampleResponse as string) || null,
  });

  const provider = await AIProviderFactory.getTracked({
    module: 'pt-suite',
    endpoint: '/pt-suite/suggest-assertions',
  });

  const promptText = messages.map(m => m.content).join('\n');
  const smartMax = calculateSmartMaxTokens(promptText, 4096, 1500);

  const response = await provider.chat({
    messages,
    temperature: 0.3,
    maxTokens: smartMax,
    jsonMode: true,
  });

  let suggestions: unknown;
  try {
    suggestions = parseAIJson(response.content);
  } catch {
    suggestions = { assertions: [], reasoning: response.content.slice(0, 500) };
  }

  res.json({
    success: true,
    data: {
      stepId,
      stepName: step.name,
      suggestions,
      usage: response.usage,
      model: response.model,
    },
  });
});

// ============================================================================
// DEMO DATA SEED
// ============================================================================

export const seedDemo = asyncHandler(async (_req: Request, res: Response) => {
  const result = await seedDemoData();
  res.json({
    success: true,
    data: {
      message: 'Demo data seeded successfully',
      ...result,
    },
  });
});
