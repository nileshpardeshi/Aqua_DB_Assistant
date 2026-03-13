import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { analyzeJPAQuery } from '../services/jpa-analyzer.service.js';
import { convertDialect as convertDialectService } from '../services/dialect-converter.service.js';
import { sqlParserService } from '../services/sql-parser/index.js';
import { detectDialectWithScores } from '../services/sql-parser/dialect-detector.js';
import {
  parseMultipleFiles,
  loadSampleFiles,
  type ExtractedJPAQuery,
} from '../services/jpa-query-parser.service.js';
import { AIProviderFactory } from '../services/ai/ai-provider.factory.js';
import { calculateSmartMaxTokens } from '../services/ai/ai-response-cache.js';
import { logger } from '../config/logger.js';

// ── Helper: parse AI JSON with fence stripping ───────────────────────────────

function parseAIJson(content: string): unknown {
  let cleaned = content.trim();
  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)```\s*$/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  return JSON.parse(cleaned);
}

// ---------- Analyze JPA Query ----------

export const analyzeJPA = asyncHandler(async (req: Request, res: Response) => {
  const { jpql, dialect, entityContext, dataVolumes } = req.body as {
    jpql: string;
    dialect: string;
    entityContext?: string;
    dataVolumes?: number[];
  };

  if (!jpql || !dialect) {
    res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'jpql and dialect are required',
      },
    });
    return;
  }

  const result = await analyzeJPAQuery({
    jpql,
    dialect,
    entityContext,
    dataVolumes,
  });

  res.json({
    success: true,
    data: result,
  });
});

// ---------- Parse JPA Files (extract queries) ----------

export const parseJPAFiles = asyncHandler(async (req: Request, res: Response) => {
  const { files } = req.body as {
    files: { name: string; content: string }[];
  };

  if (!files || !Array.isArray(files) || files.length === 0) {
    res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'files array is required with at least one file',
      },
    });
    return;
  }

  const results = parseMultipleFiles(files);

  res.json({
    success: true,
    data: results,
  });
});

// ---------- Load Sample JPA Files ----------

export const getSampleJPAFiles = asyncHandler(async (_req: Request, res: Response) => {
  const samples = await loadSampleFiles();

  res.json({
    success: true,
    data: samples,
  });
});

// ---------- Batch Analyze JPA Queries ----------

export const batchAnalyzeJPA = asyncHandler(async (req: Request, res: Response) => {
  const { queries, dialect, entityContext } = req.body as {
    queries: ExtractedJPAQuery[];
    dialect: string;
    entityContext?: string;
  };

  if (!queries || queries.length === 0 || !dialect) {
    res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'queries array and dialect are required',
      },
    });
    return;
  }

  // Build a single AI prompt for all queries (batch analysis)
  const queryList = queries
    .filter((q) => q.type !== 'criteria')
    .map(
      (q, i) =>
        `### Query ${i + 1}: ${q.className}.${q.methodName}()\n` +
        `Type: ${q.type.toUpperCase()}\n` +
        `\`\`\`jpql\n${q.query}\n\`\`\``,
    )
    .join('\n\n');

  const systemPrompt = `You are an expert JPA/JPQL/HQL performance analyst. Analyze a batch of JPA queries and for EACH query provide:
1. The equivalent SQL translation for the target dialect
2. Performance estimates at 1K, 100K, 1M, 10M rows
3. Issues detected (N+1, cartesian products, missing indexes, full scans, etc.)
4. Specific optimization recommendations

Performance rating benchmarks: <50ms = "good", <200ms = "acceptable", <500ms = "warning", >=500ms = "critical"

You MUST respond with valid JSON. No text outside the JSON object.`;

  const userContent = `Analyze these ${queries.filter((q) => q.type !== 'criteria').length} JPA queries for the **${dialect}** database.\n\n${queryList}\n\n${
    entityContext ? `**Entity Context:**\n\`\`\`java\n${entityContext}\n\`\`\`\n\n` : ''
  }Respond with JSON:
{
  "results": [
    {
      "queryId": "the query id",
      "methodName": "method name",
      "sqlTranslation": "translated SQL",
      "performanceEstimates": [
        { "rows": "1K", "estimatedTimeMs": 5, "scanType": "Index Seek", "joinsUsed": 0, "memoryMB": 0.1, "rating": "good" },
        { "rows": "100K", "estimatedTimeMs": 50, "scanType": "...", "joinsUsed": 0, "memoryMB": 1, "rating": "good" },
        { "rows": "1M", "estimatedTimeMs": 200, "scanType": "...", "joinsUsed": 0, "memoryMB": 10, "rating": "acceptable" },
        { "rows": "10M", "estimatedTimeMs": 2000, "scanType": "...", "joinsUsed": 0, "memoryMB": 50, "rating": "critical" }
      ],
      "issues": [
        { "severity": "critical|warning|info", "title": "...", "description": "...", "impact": "..." }
      ],
      "recommendations": [
        { "title": "...", "description": "...", "before": "original code", "after": "improved code", "estimatedImprovement": "..." }
      ],
      "overallRating": "good|acceptable|warning|critical",
      "executionPlan": "Brief description of how the DB would execute this"
    }
  ],
  "summary": "Overall batch analysis summary with key findings"
}`;

  try {
    const provider = await AIProviderFactory.getTracked({
      module: 'jpa-lab',
      endpoint: '/tools/jpa-batch-analyze',
    });

    const smartMax = calculateSmartMaxTokens(queryList, 16384, 4096);
    const response = await provider.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.2,
      maxTokens: smartMax,
      jsonMode: true,
    });

    let data: unknown;
    try {
      data = parseAIJson(response.content);
    } catch {
      data = { results: [], summary: response.content };
    }

    res.json({
      success: true,
      data: {
        analysis: data,
        usage: response.usage,
        model: response.model,
      },
    });
  } catch (err) {
    logger.error('Batch JPA analysis failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
});

// ---------- Convert SQL ----------

export const convertSQL = asyncHandler(async (req: Request, res: Response) => {
  const { sql, sourceDialect, targetDialect } = req.body as {
    sql: string;
    sourceDialect: string;
    targetDialect: string;
  };

  if (!sql || !sourceDialect || !targetDialect) {
    res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'sql, sourceDialect, and targetDialect are required',
      },
    });
    return;
  }

  const result = convertDialectService(sql, sourceDialect, targetDialect);

  res.json({
    success: true,
    data: result,
  });
});

// ---------- Validate SQL ----------

export const validateSQL = asyncHandler(async (req: Request, res: Response) => {
  const { sql, dialect } = req.body as {
    sql: string;
    dialect?: string;
  };

  if (!sql) {
    res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'sql is required',
      },
    });
    return;
  }

  const parseResult = sqlParserService.parseSQL(sql, dialect);
  const hasErrors = parseResult.errors.some((e) => e.severity === 'error');

  res.json({
    success: true,
    data: {
      valid: !hasErrors,
      errors: parseResult.errors.map((e) => e.message),
      tablesFound: parseResult.tables.length,
      dialect: parseResult.dialect,
    },
  });
});

// ---------- Detect Dialect ----------

export const detectDialect = asyncHandler(async (req: Request, res: Response) => {
  const { sql } = req.body as { sql: string };

  if (!sql) {
    res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'sql is required',
      },
    });
    return;
  }

  const result = detectDialectWithScores(sql);

  res.json({
    success: true,
    data: result,
  });
});
