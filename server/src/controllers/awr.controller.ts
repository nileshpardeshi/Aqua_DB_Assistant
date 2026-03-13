import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { parseReport, detectReportType, type ReportType } from '../services/awr/report-parser.service.js';
import { buildAWRAnalysisPrompt } from '../services/ai/prompt-templates/awr-analysis.prompt.js';
import { buildIncidentAnalysisPrompt } from '../services/ai/prompt-templates/incident-analysis.prompt.js';
import { AIProviderFactory } from '../services/ai/ai-provider.factory.js';
import { calculateSmartMaxTokens } from '../services/ai/ai-response-cache.js';
import { buildUnifiedTimeline, compressTimelineForAI } from '../services/awr/incident-timeline.service.js';
import { logger } from '../config/logger.js';

// ── Helper: parse AI JSON with fence stripping ──────────────────────────────

function parseAIJson(content: string): unknown {
  let cleaned = content.trim();
  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)```\s*$/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  return JSON.parse(cleaned);
}

// ── Parse Report ────────────────────────────────────────────────────────────

export const parseReportEndpoint = asyncHandler(async (req: Request, res: Response) => {
  const { content, fileName, forceType } = req.body as {
    content: string;
    fileName?: string;
    forceType?: ReportType;
  };

  if (!content || typeof content !== 'string') {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'content (string) is required' },
    });
    return;
  }

  const result = parseReport(content, fileName, forceType);

  res.json({
    success: true,
    data: result,
  });
});

// ── Detect Report Type ──────────────────────────────────────────────────────

export const detectType = asyncHandler(async (req: Request, res: Response) => {
  const { content, fileName } = req.body as { content: string; fileName?: string };

  if (!content) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'content is required' },
    });
    return;
  }

  const detection = detectReportType(content, fileName);

  res.json({
    success: true,
    data: detection,
  });
});

// ── Analyze Report (Parse + AI) ─────────────────────────────────────────────

export const analyzeReport = asyncHandler(async (req: Request, res: Response) => {
  const { content, fileName, forceType, focusAreas } = req.body as {
    content: string;
    fileName?: string;
    forceType?: ReportType;
    focusAreas?: string[];
  };

  if (!content || typeof content !== 'string') {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'content (string) is required' },
    });
    return;
  }

  const lineCount = content.split('\n').length;
  const aiStartTime = Date.now();

  // Step 1: Parse report into structured metrics
  const parseResult = parseReport(content, fileName, forceType);

  // Step 2: Build AI prompt from structured metrics
  const messages = buildAWRAnalysisPrompt(parseResult.metrics, focusAreas);

  // Step 3: Call AI
  try {
    const provider = await AIProviderFactory.getTracked({
      module: 'awr-analyzer',
      endpoint: '/tools/awr-analyze',
    });

    const promptText = messages.map(m => m.content).join('\n');
    const smartMax = calculateSmartMaxTokens(promptText, 16384, 4096);

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
      analysis = { summary: { healthScore: 0, healthRating: 'critical', headline: 'Failed to parse AI response', keyFindings: [response.content.slice(0, 500)], timeRange: '' }, rootCause: [], sqlAnalysis: [], waitEventAnalysis: [], recommendations: [], indexRecommendations: [] };
    }

    const analysisTimeMs = Date.now() - aiStartTime;

    res.json({
      success: true,
      data: {
        parseResult: {
          reportType: parseResult.reportType,
          database: parseResult.database,
          fileSizeKB: parseResult.fileSizeKB,
          parseTimeMs: parseResult.parseTimeMs,
          fromCache: parseResult.fromCache,
          sectionsFound: parseResult.metrics.sectionsFound,
          lineCount,
        },
        metrics: parseResult.metrics,
        analysis,
        usage: response.usage,
        model: response.model,
        analysisTimeMs,
      },
    });
  } catch (err) {
    logger.error('AWR analysis failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
});

// ── Compare Two Reports ─────────────────────────────────────────────────────

export const compareReports = asyncHandler(async (req: Request, res: Response) => {
  const { reportA, reportB } = req.body as {
    reportA: { content: string; fileName?: string };
    reportB: { content: string; fileName?: string };
  };

  if (!reportA?.content || !reportB?.content) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'Both reportA.content and reportB.content are required' },
    });
    return;
  }

  const parseA = parseReport(reportA.content, reportA.fileName);
  const parseB = parseReport(reportB.content, reportB.fileName);

  const provider = await AIProviderFactory.getTracked({
    module: 'awr-analyzer',
    endpoint: '/tools/awr-compare',
  });

  const metricsA = JSON.stringify(parseA.metrics, null, 0).slice(0, 4000);
  const metricsB = JSON.stringify(parseB.metrics, null, 0).slice(0, 4000);

  const response = await provider.chat({
    messages: [
      {
        role: 'system',
        content: `You are an expert database performance engineer. Compare two database performance reports and identify what changed between them. Focus on improvements, regressions, and persistent issues. Respond with valid JSON only.`,
      },
      {
        role: 'user',
        content: `Compare these two reports:\n\n## Report A (${reportA.fileName || 'Before'})\n${metricsA}\n\n## Report B (${reportB.fileName || 'After'})\n${metricsB}\n\nRespond with JSON:\n{
  "comparison": {
    "overallVerdict": "improved|regressed|unchanged|mixed",
    "healthScoreBefore": 0,
    "healthScoreAfter": 0,
    "headline": "One-line summary",
    "improvements": [{"area": "...", "description": "...", "before": "...", "after": "..."}],
    "regressions": [{"area": "...", "description": "...", "before": "...", "after": "..."}],
    "persistent": [{"area": "...", "description": "..."}],
    "recommendations": ["..."]
  }
}`,
      },
    ],
    temperature: 0.2,
    maxTokens: 4096,
    jsonMode: true,
  });

  let comparison: unknown;
  try {
    comparison = parseAIJson(response.content);
  } catch {
    comparison = { comparison: { overallVerdict: 'unknown', headline: response.content.slice(0, 500) } };
  }

  res.json({
    success: true,
    data: {
      reportA: { reportType: parseA.reportType, database: parseA.database, fileSizeKB: parseA.fileSizeKB },
      reportB: { reportType: parseB.reportType, database: parseB.database, fileSizeKB: parseB.fileSizeKB },
      comparison,
      usage: response.usage,
      model: response.model,
    },
  });
});

// ── Incident Time-Machine Analysis ──────────────────────────────────────────

export const analyzeIncident = asyncHandler(async (req: Request, res: Response) => {
  const { sources, incidentWindow, incidentDescription, focusAreas } = req.body as {
    sources: Array<{ content: string; fileName?: string; forceType?: ReportType }>;
    incidentWindow?: { start?: string; end?: string };
    incidentDescription?: string;
    focusAreas?: string[];
  };

  if (!sources || !Array.isArray(sources) || sources.length === 0) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'sources array with at least one item is required' },
    });
    return;
  }

  // Validate each source has content
  for (let i = 0; i < sources.length; i++) {
    if (!sources[i].content || typeof sources[i].content !== 'string') {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: `sources[${i}].content (string) is required` },
      });
      return;
    }
  }

  const aiStartTime = Date.now();
  const totalLines = sources.reduce((sum, s) => sum + s.content.split('\n').length, 0);
  const totalSizeKB = sources.reduce((sum, s) => sum + Math.round(s.content.length / 1024), 0);

  try {
    // Step 1: Parse all sources in parallel
    const parsedSources = sources.map((src) => ({
      parseResult: parseReport(src.content, src.fileName, src.forceType),
      fileName: src.fileName || `source-${Math.random().toString(36).slice(2, 8)}`,
    }));

    // Step 2: Build unified timeline
    const timeline = buildUnifiedTimeline(parsedSources, incidentWindow);

    // Step 3: Compress timeline for AI
    const compressedTimeline = compressTimelineForAI(timeline, 12000);

    // Step 4: Build AI prompt and call AI
    const messages = buildIncidentAnalysisPrompt(
      compressedTimeline,
      incidentDescription,
      focusAreas,
    );

    const promptText = messages.map((m) => m.content).join('\n');
    const smartMax = calculateSmartMaxTokens(promptText, 16384, 4096);

    const provider = await AIProviderFactory.getTracked({
      module: 'incident-time-machine',
      endpoint: '/tools/awr/incident-analyze',
    });

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
        incidentSummary: { severity: 'high', headline: 'Failed to parse AI response', duration: 'Unknown', affectedSystems: [], database: 'Unknown' },
        timeline: [],
        rootCause: { primaryCause: 'Analysis failed', confidence: 'low', explanation: response.content.slice(0, 500), evidence: [], causalChain: [] },
        correlations: [],
        impact: {},
        remediation: { immediateFix: { description: 'Manual review required' }, preventiveMeasures: [], rollbackSteps: [] },
        lessonsLearned: [],
      };
    }

    const analysisTimeMs = Date.now() - aiStartTime;

    res.json({
      success: true,
      data: {
        timeline: {
          events: timeline.events,
          sources: timeline.sources,
          timeRange: timeline.timeRange,
          totalEventsBeforeDedup: timeline.totalEventsBeforeDedup,
          totalEventsAfterDedup: timeline.totalEventsAfterDedup,
          compressionRatio: timeline.compressionRatio,
        },
        analysis,
        tokenOptimization: {
          totalInputSizeKB: totalSizeKB,
          compressedContextChars: compressedTimeline.length,
          estimatedTokensSaved: Math.round((totalSizeKB * 1024 / 4) - (compressedTimeline.length / 4)),
          compressionRatio: timeline.compressionRatio,
        },
        usage: response.usage,
        model: response.model,
        analysisTimeMs,
        totalLines,
      },
    });
  } catch (err) {
    logger.error('Incident Time-Machine analysis failed', {
      error: err instanceof Error ? err.message : String(err),
      sourceCount: sources.length,
    });
    throw err;
  }
});
