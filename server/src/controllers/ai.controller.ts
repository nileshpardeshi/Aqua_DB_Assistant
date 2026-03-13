import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { AIProviderFactory } from '../services/ai/ai-provider.factory.js';
import { AIContextBuilder } from '../services/ai/ai-context.builder.js';
import { buildSchemaDesignPrompt } from '../services/ai/prompt-templates/schema-design.prompt.js';
import { buildQueryOptimizationPrompt } from '../services/ai/prompt-templates/query-optimization.prompt.js';
import { buildNLToSQLPrompt } from '../services/ai/prompt-templates/natural-language-to-sql.prompt.js';
import { buildQueryExplanationPrompt } from '../services/ai/prompt-templates/query-explanation.prompt.js';
import { buildSchemaReviewPrompt } from '../services/ai/prompt-templates/schema-review.prompt.js';
import { buildIndexRecommendationPrompt } from '../services/ai/prompt-templates/index-recommendation.prompt.js';
import { buildPartitionRecommendationPrompt } from '../services/ai/prompt-templates/partition-recommendation.prompt.js';
import { buildTriggerAnalysisPrompt } from '../services/ai/prompt-templates/trigger-analysis.prompt.js';
import { buildSyntheticDataPrompt } from '../services/ai/prompt-templates/synthetic-data.prompt.js';
import { buildQueryPlannerPrompt } from '../services/ai/prompt-templates/query-planner-simulation.prompt.js';
import { buildDataDistributionPrompt } from '../services/ai/prompt-templates/data-distribution-simulation.prompt.js';
import { buildDocumentationPrompt } from '../services/ai/prompt-templates/documentation-generator.prompt.js';
import { buildMigrationAssessmentPrompt } from '../services/ai/prompt-templates/migration-assessment.prompt.js';
import { buildMigrationScriptGeneratorPrompt } from '../services/ai/prompt-templates/migration-script-generator.prompt.js';
import { buildColumnMappingPrompt } from '../services/ai/prompt-templates/column-mapping.prompt.js';
import { buildDialectValidationPrompt } from '../services/ai/prompt-templates/dialect-validation.prompt.js';
import { buildSchemaEvolutionImpactPrompt } from '../services/ai/prompt-templates/schema-evolution-impact.prompt.js';
import { calculateSmartMaxTokens } from '../services/ai/ai-response-cache.js';
import { optimizeSqlForTokens } from '../services/ai/sql-token-optimizer.js';
import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';

/**
 * Safely parse AI response content as JSON.
 * AI models often wrap JSON in markdown code fences (```json...```).
 * This strips those fences before parsing.
 */
function parseAIJson(content: string): unknown {
  // Strip markdown code fences: ```json ... ``` or ``` ... ```
  let cleaned = content.trim();
  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)```\s*$/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }
  return JSON.parse(cleaned);
}

// ---------- Chat (SSE Streaming) ----------

export const chat = asyncHandler(async (req: Request, res: Response) => {
  const { messages, projectId, temperature, maxTokens } = req.body as {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    projectId?: string;
    temperature?: number;
    maxTokens?: number;
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'messages array is required' },
    });
    return;
  }

  const provider = await AIProviderFactory.getTracked({ module: 'chat', endpoint: '/ai/chat', projectId });

  // If a projectId is provided, prepend schema context as a system message
  let contextMessages = [...messages];
  if (projectId) {
    try {
      const schemaContext = await AIContextBuilder.buildSchemaContext(projectId);
      const contextMsg = {
        role: 'system' as const,
        content: `Here is the database schema for reference:\n\n${schemaContext}`,
      };
      // Insert schema context after any existing system messages
      const firstNonSystem = contextMessages.findIndex(
        (m) => m.role !== 'system',
      );
      if (firstNonSystem === -1) {
        contextMessages.push(contextMsg);
      } else {
        contextMessages.splice(firstNonSystem, 0, contextMsg);
      }
    } catch (err) {
      logger.warn('Failed to load schema context for chat', { projectId, error: err instanceof Error ? err.message : String(err) });
    }
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  try {
    const stream = provider.chatStream({
      messages: contextMessages,
      temperature,
      maxTokens,
    });

    let fullContent = '';

    for await (const chunk of stream) {
      fullContent += chunk;
      res.write(`data: ${JSON.stringify({ type: 'delta', content: chunk })}\n\n`);
    }

    // Send the final completion event
    res.write(
      `data: ${JSON.stringify({ type: 'done', content: fullContent })}\n\n`,
    );

    // Save conversation if projectId is provided
    if (projectId) {
      try {
        const lastUserMsg = messages.filter((m) => m.role === 'user').pop();
        const title =
          lastUserMsg?.content.slice(0, 100) || 'AI Conversation';

        await prisma.aIConversation.create({
          data: {
            projectId,
            title,
            context: 'chat',
            messages: {
              create: [
                ...messages.map((m) => ({
                  role: m.role,
                  content: m.content,
                })),
                {
                  role: 'assistant',
                  content: fullContent,
                },
              ],
            },
          },
        });
      } catch (saveErr) {
        logger.warn('Failed to save AI conversation', {
          error:
            saveErr instanceof Error ? saveErr.message : String(saveErr),
        });
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    const errMsg =
      error instanceof Error ? error.message : 'AI provider error';
    res.write(
      `data: ${JSON.stringify({ type: 'error', content: errMsg })}\n\n`,
    );
    res.end();
  }
});

// ---------- Schema Design Suggestion ----------

export const suggestSchema = asyncHandler(
  async (req: Request, res: Response) => {
    const { description, dialect, projectId } = req.body as {
      description: string;
      dialect: string;
      projectId?: string;
    };

    if (!description || !dialect) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'description and dialect are required',
        },
      });
      return;
    }

    let existingSchema: string | undefined;
    if (projectId) {
      existingSchema = await AIContextBuilder.buildSchemaContext(projectId);
    }

    const messages = buildSchemaDesignPrompt(
      description,
      dialect,
      existingSchema,
    );

    const provider = await AIProviderFactory.getTracked({ module: 'schema', endpoint: '/ai/schema/suggest', projectId });
    const response = await provider.chat({
      messages,
      temperature: 0.3,
      maxTokens: 8192,
      jsonMode: true,
    });

    let data: unknown;
    try {
      data = parseAIJson(response.content);
    } catch {
      data = { rawResponse: response.content };
    }

    res.json({
      success: true,
      data: {
        suggestion: data,
        usage: response.usage,
        model: response.model,
      },
    });
  },
);

// ---------- Query Optimization ----------

export const optimizeQuery = asyncHandler(
  async (req: Request, res: Response) => {
    const { sql, dialect, projectId, explainPlan } = req.body as {
      sql: string;
      dialect: string;
      projectId: string;
      explainPlan?: string;
    };

    if (!sql || !dialect || !projectId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'sql, dialect, and projectId are required',
        },
      });
      return;
    }

    let schemaContext: string | undefined;
    try {
      schemaContext = await AIContextBuilder.buildQueryContext(projectId, sql);
    } catch (err) {
      logger.warn('Failed to load schema context for optimize', { projectId, error: err instanceof Error ? err.message : String(err) });
    }

    const messages = buildQueryOptimizationPrompt(
      sql,
      dialect,
      schemaContext ?? '',
      explainPlan,
    );

    const smartMax = calculateSmartMaxTokens(sql, 4096, 1500);
    const provider = await AIProviderFactory.getTracked({ module: 'query', endpoint: '/ai/query/optimize', projectId });
    const response = await provider.chat({
      messages,
      temperature: 0.2,
      maxTokens: smartMax,
      jsonMode: true,
    });

    let data: unknown;
    try {
      data = parseAIJson(response.content);
    } catch {
      data = { rawResponse: response.content };
    }

    res.json({
      success: true,
      data: {
        optimization: data,
        usage: response.usage,
        model: response.model,
      },
    });
  },
);

// ---------- Natural Language to SQL ----------

export const generateSQL = asyncHandler(
  async (req: Request, res: Response) => {
    const { naturalLanguage, dialect, projectId } = req.body as {
      naturalLanguage: string;
      dialect: string;
      projectId: string;
    };

    if (!naturalLanguage || !dialect || !projectId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'naturalLanguage, dialect, and projectId are required',
        },
      });
      return;
    }

    let schemaContext = '';
    try {
      schemaContext = await AIContextBuilder.buildSchemaContext(projectId, {
        maxTokens: 800,
      });
    } catch (err) {
      logger.warn('Failed to load schema context for generate', { projectId, error: err instanceof Error ? err.message : String(err) });
    }

    const messages = buildNLToSQLPrompt(
      naturalLanguage,
      dialect,
      schemaContext,
    );

    const smartMax = calculateSmartMaxTokens(naturalLanguage, 1500, 800);
    const provider = await AIProviderFactory.getTracked({ module: 'query', endpoint: '/ai/query/generate', projectId });
    const response = await provider.chat({
      messages,
      temperature: 0.2,
      maxTokens: smartMax,
      jsonMode: true,
    });

    let data: unknown;
    try {
      data = parseAIJson(response.content);
    } catch {
      data = { rawResponse: response.content };
    }

    res.json({
      success: true,
      data: {
        result: data,
        usage: response.usage,
        model: response.model,
      },
    });
  },
);

// ---------- Query Explanation ----------

export const explainQuery = asyncHandler(
  async (req: Request, res: Response) => {
    const { sql, dialect, projectId } = req.body as {
      sql: string;
      dialect: string;
      projectId?: string;
    };

    if (!sql || !dialect) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'sql and dialect are required',
        },
      });
      return;
    }

    let schemaContext: string | undefined;
    if (projectId) {
      try {
        schemaContext = await AIContextBuilder.buildQueryContext(projectId, sql);
      } catch (err) {
        logger.warn('Failed to load schema context for explain', { projectId, error: err instanceof Error ? err.message : String(err) });
      }
    }

    const messages = buildQueryExplanationPrompt(sql, dialect, schemaContext);

    const smartMax = calculateSmartMaxTokens(sql, 2048, 1200);
    const provider = await AIProviderFactory.getTracked({ module: 'query', endpoint: '/ai/query/explain', projectId });
    const response = await provider.chat({
      messages,
      temperature: 0.2,
      maxTokens: smartMax,
      jsonMode: true,
    });

    let data: unknown;
    try {
      data = parseAIJson(response.content);
    } catch {
      data = { rawResponse: response.content };
    }

    res.json({
      success: true,
      data: {
        explanation: data,
        usage: response.usage,
        model: response.model,
      },
    });
  },
);

// ---------- Schema Review ----------

export const reviewSchema = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId, dialect } = req.body as {
      projectId: string;
      dialect: string;
    };

    if (!projectId || !dialect) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'projectId and dialect are required',
        },
      });
      return;
    }

    const schemaContext = await AIContextBuilder.buildSchemaContext(projectId);

    if (schemaContext.startsWith('-- No tables found')) {
      res.status(400).json({
        success: false,
        error: {
          code: 'NO_SCHEMA',
          message:
            'No tables found in this project. Import a schema first before requesting a review.',
        },
      });
      return;
    }

    const messages = buildSchemaReviewPrompt(schemaContext, dialect);

    const provider = await AIProviderFactory.getTracked({ module: 'schema', endpoint: '/ai/schema/review', projectId });
    const response = await provider.chat({
      messages,
      temperature: 0.3,
      maxTokens: 8192,
      jsonMode: true,
    });

    let data: unknown;
    try {
      data = parseAIJson(response.content);
    } catch {
      data = { rawResponse: response.content };
    }

    res.json({
      success: true,
      data: {
        review: data,
        usage: response.usage,
        model: response.model,
      },
    });
  },
);

// ---------- Index Recommendations ----------

export const recommendIndexes = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId, dialect, queryPatterns } = req.body as {
      projectId: string;
      dialect: string;
      queryPatterns?: string[];
    };

    if (!projectId || !dialect) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'projectId and dialect are required',
        },
      });
      return;
    }

    const schemaContext = await AIContextBuilder.buildSchemaContext(projectId);

    if (schemaContext.startsWith('-- No tables found')) {
      res.status(400).json({
        success: false,
        error: {
          code: 'NO_SCHEMA',
          message:
            'No tables found in this project. Import a schema first before requesting index recommendations.',
        },
      });
      return;
    }

    // If no query patterns provided, try to load recent saved queries
    let patterns = queryPatterns ?? [];
    if (patterns.length === 0) {
      try {
        const recentQueries = await prisma.savedQuery.findMany({
          where: { projectId },
          orderBy: { updatedAt: 'desc' },
          take: 10,
          select: { sql: true },
        });
        patterns = recentQueries.map((q) => q.sql);
      } catch {
        // Ignore - we can still recommend without query patterns
      }
    }

    const messages = buildIndexRecommendationPrompt(
      schemaContext,
      patterns,
      dialect,
    );

    const provider = await AIProviderFactory.getTracked({ module: 'performance', endpoint: '/ai/performance/recommend-indexes', projectId });
    const response = await provider.chat({
      messages,
      temperature: 0.2,
      maxTokens: 8192,
      jsonMode: true,
    });

    let data: unknown;
    try {
      data = parseAIJson(response.content);
    } catch {
      data = { rawResponse: response.content };
    }

    res.json({
      success: true,
      data: {
        recommendations: data,
        usage: response.usage,
        model: response.model,
      },
    });
  },
);

// ---------- Partition Recommendations ----------

export const recommendPartitions = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId, dialect, queryPatterns, dataVolume } = req.body as {
      projectId: string;
      dialect: string;
      queryPatterns?: string[];
      dataVolume?: string;
    };

    if (!projectId || !dialect) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'projectId and dialect are required',
        },
      });
      return;
    }

    const schemaContext = await AIContextBuilder.buildSchemaContext(projectId);

    if (schemaContext.startsWith('-- No tables found')) {
      res.status(400).json({
        success: false,
        error: {
          code: 'NO_SCHEMA',
          message:
            'No tables found in this project. Import a schema first before requesting partition recommendations.',
        },
      });
      return;
    }

    let patterns = queryPatterns ?? [];
    if (patterns.length === 0) {
      try {
        const recentQueries = await prisma.savedQuery.findMany({
          where: { projectId },
          orderBy: { updatedAt: 'desc' },
          take: 10,
          select: { sql: true },
        });
        patterns = recentQueries.map((q) => q.sql);
      } catch {
        // Ignore - we can still recommend without query patterns
      }
    }

    const messages = buildPartitionRecommendationPrompt(
      schemaContext,
      patterns,
      dialect,
      dataVolume,
    );

    const provider = await AIProviderFactory.getTracked({ module: 'performance', endpoint: '/ai/performance/recommend-partitions', projectId });
    const response = await provider.chat({
      messages,
      temperature: 0.2,
      maxTokens: 8192,
      jsonMode: true,
    });

    let data: unknown;
    try {
      data = parseAIJson(response.content);
    } catch {
      data = { rawResponse: response.content };
    }

    res.json({
      success: true,
      data: {
        recommendations: data,
        usage: response.usage,
        model: response.model,
      },
    });
  },
);

// ---------- Trigger Analysis ----------

export const analyzeTrigger = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId, tableId, triggerName, timing, event, triggerBody, description, dialect } =
      req.body as {
        projectId: string;
        tableId: string;
        triggerName: string;
        timing: string;
        event: string;
        triggerBody: string;
        description?: string;
        dialect: string;
      };

    if (!projectId || !tableId || !triggerName || !triggerBody || !dialect) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'projectId, tableId, triggerName, triggerBody, and dialect are required',
        },
      });
      return;
    }

    const table = await prisma.tableMetadata.findUnique({
      where: { id: tableId },
      include: { columns: { orderBy: { ordinalPosition: 'asc' } } },
    });

    if (!table) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Table not found' },
      });
      return;
    }

    const triggerMessages = buildTriggerAnalysisPrompt({
      triggerName,
      timing: timing || 'BEFORE',
      event: event || 'INSERT',
      triggerBody,
      tableName: table.tableName,
      tableColumns: table.columns.map((c) => `${c.columnName} ${c.dataType}`),
      dialect,
      description,
    });

    const provider = await AIProviderFactory.getTracked({ module: 'schema', endpoint: '/ai/schema/trigger-analysis', projectId });
    const triggerResponse = await provider.chat({
      messages: triggerMessages,
      temperature: 0.3,
      maxTokens: 4096,
      jsonMode: true,
    });

    let analysis: unknown;
    try {
      analysis = JSON.parse(triggerResponse.content);
    } catch {
      analysis = { rawResponse: triggerResponse.content };
    }

    res.json({
      success: true,
      data: {
        analysis,
        usage: triggerResponse.usage,
        model: triggerResponse.model,
      },
    });
  },
);

// ---------- Synthetic Data Generation ----------

export const generateSyntheticData = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId, dialect, selectedTables, rowCount, distributionConfig } =
      req.body as {
        projectId: string;
        dialect: string;
        selectedTables: string[];
        rowCount: number;
        distributionConfig?: {
          type: 'uniform' | 'gaussian' | 'zipf' | 'realistic';
          params?: Record<string, unknown>;
        };
      };

    if (!projectId || !dialect || !selectedTables?.length || !rowCount) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message:
            'projectId, dialect, selectedTables, and rowCount are required',
        },
      });
      return;
    }

    const schemaContext = await AIContextBuilder.buildSchemaContext(projectId);

    if (schemaContext.startsWith('-- No tables found')) {
      res.status(400).json({
        success: false,
        error: {
          code: 'NO_SCHEMA',
          message:
            'No tables found in this project. Import a schema first.',
        },
      });
      return;
    }

    const syntheticMessages = buildSyntheticDataPrompt(
      schemaContext,
      selectedTables,
      rowCount,
      dialect,
      distributionConfig,
    );

    const provider = await AIProviderFactory.getTracked({ module: 'datagen', endpoint: '/ai/datagen/synthetic-scripts', projectId });
    const syntheticResponse = await provider.chat({
      messages: syntheticMessages,
      temperature: 0.3,
      maxTokens: 16384,
      jsonMode: true,
    });

    let generation: unknown;
    try {
      generation = JSON.parse(syntheticResponse.content);
    } catch {
      generation = { rawResponse: syntheticResponse.content };
    }

    res.json({
      success: true,
      data: {
        generation,
        usage: syntheticResponse.usage,
        model: syntheticResponse.model,
      },
    });
  },
);

// ---------- Query Planner Simulation ----------

export const simulateQueryPlan = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId, dialect, sql, estimatedRowCounts } = req.body as {
      projectId: string;
      dialect: string;
      sql: string;
      estimatedRowCounts?: Record<string, number>;
    };

    if (!projectId || !dialect || !sql) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'projectId, dialect, and sql are required',
        },
      });
      return;
    }

    const schemaContext = await AIContextBuilder.buildSchemaContext(projectId);

    if (schemaContext.startsWith('-- No tables found')) {
      res.status(400).json({
        success: false,
        error: {
          code: 'NO_SCHEMA',
          message:
            'No tables found in this project. Import a schema first.',
        },
      });
      return;
    }

    const plannerMessages = buildQueryPlannerPrompt(
      sql,
      schemaContext,
      dialect,
      estimatedRowCounts,
    );

    const provider = await AIProviderFactory.getTracked({ module: 'datagen', endpoint: '/ai/datagen/query-planner', projectId });
    const plannerResponse = await provider.chat({
      messages: plannerMessages,
      temperature: 0.2,
      maxTokens: 8192,
      jsonMode: true,
    });

    let simulation: unknown;
    try {
      simulation = JSON.parse(plannerResponse.content);
    } catch {
      simulation = { rawResponse: plannerResponse.content };
    }

    res.json({
      success: true,
      data: {
        simulation,
        usage: plannerResponse.usage,
        model: plannerResponse.model,
      },
    });
  },
);

// ---------- Data Distribution Simulation ----------

export const simulateDataDistribution = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId, dialect, selectedTables, estimatedRowCounts } =
      req.body as {
        projectId: string;
        dialect: string;
        selectedTables: string[];
        estimatedRowCounts: Record<string, number>;
      };

    if (!projectId || !dialect || !selectedTables?.length || !estimatedRowCounts) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message:
            'projectId, dialect, selectedTables, and estimatedRowCounts are required',
        },
      });
      return;
    }

    const schemaContext = await AIContextBuilder.buildSchemaContext(projectId);

    if (schemaContext.startsWith('-- No tables found')) {
      res.status(400).json({
        success: false,
        error: {
          code: 'NO_SCHEMA',
          message:
            'No tables found in this project. Import a schema first.',
        },
      });
      return;
    }

    const distMessages = buildDataDistributionPrompt(
      schemaContext,
      selectedTables,
      estimatedRowCounts,
      dialect,
    );

    const provider = await AIProviderFactory.getTracked({ module: 'datagen', endpoint: '/ai/datagen/data-distribution', projectId });
    const distResponse = await provider.chat({
      messages: distMessages,
      temperature: 0.2,
      maxTokens: 8192,
      jsonMode: true,
    });

    let simulation: unknown;
    try {
      simulation = JSON.parse(distResponse.content);
    } catch {
      simulation = { rawResponse: distResponse.content };
    }

    res.json({
      success: true,
      data: {
        simulation,
        usage: distResponse.usage,
        model: distResponse.model,
      },
    });
  },
);

// ---------- Documentation Generation ----------

export const generateDocumentation = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId, dialect, projectName, additionalContext } =
      req.body as {
        projectId: string;
        dialect: string;
        projectName: string;
        additionalContext?: string;
      };

    if (!projectId || !dialect) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'projectId and dialect are required',
        },
      });
      return;
    }

    const schemaContext = await AIContextBuilder.buildSchemaContext(projectId);

    if (schemaContext.startsWith('-- No tables found')) {
      res.status(400).json({
        success: false,
        error: {
          code: 'NO_SCHEMA',
          message:
            'No tables found in this project. Import a schema first.',
        },
      });
      return;
    }

    const docMessages = buildDocumentationPrompt(
      schemaContext,
      dialect,
      projectName || 'Database Schema',
      additionalContext,
    );

    const provider = await AIProviderFactory.getTracked({ module: 'docs', endpoint: '/ai/docs/generate', projectId });
    const docResponse = await provider.chat({
      messages: docMessages,
      temperature: 0.3,
      maxTokens: 16384,
      jsonMode: true,
    });

    let documentation: unknown;
    try {
      documentation = JSON.parse(docResponse.content);
    } catch {
      documentation = { rawResponse: docResponse.content };
    }

    res.json({
      success: true,
      data: {
        documentation,
        usage: docResponse.usage,
        model: docResponse.model,
      },
    });
  },
);

// ---------- Migration Assessment ----------

export const assessMigration = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId, sourceDialect, targetDialect } = req.body as {
      projectId: string;
      sourceDialect: string;
      targetDialect: string;
    };

    if (!projectId || !sourceDialect || !targetDialect) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'projectId, sourceDialect, and targetDialect are required',
        },
      });
      return;
    }

    const schemaContext = await AIContextBuilder.buildSchemaContext(projectId);

    if (schemaContext.startsWith('-- No tables found')) {
      res.status(400).json({
        success: false,
        error: {
          code: 'NO_SCHEMA',
          message:
            'No tables found in this project. Import a schema first before requesting migration assessment.',
        },
      });
      return;
    }

    const messages = buildMigrationAssessmentPrompt(
      schemaContext,
      sourceDialect,
      targetDialect,
    );

    const provider = await AIProviderFactory.getTracked({ module: 'migration', endpoint: '/ai/migration/assess', projectId });
    const response = await provider.chat({
      messages,
      temperature: 0.2,
      maxTokens: 8192,
      jsonMode: true,
    });

    let assessment: unknown;
    try {
      assessment = parseAIJson(response.content);
    } catch {
      assessment = { rawResponse: response.content };
    }

    res.json({
      success: true,
      data: {
        assessment,
        usage: response.usage,
        model: response.model,
      },
    });
  },
);

// ---------- Migration Script Generation ----------

export const generateMigrationScripts = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId, sourceDialect, targetDialect, tables } = req.body as {
      projectId: string;
      sourceDialect: string;
      targetDialect: string;
      tables?: string[];
    };

    if (!projectId || !sourceDialect || !targetDialect) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'projectId, sourceDialect, and targetDialect are required',
        },
      });
      return;
    }

    const schemaContext = await AIContextBuilder.buildSchemaContext(projectId);

    if (schemaContext.startsWith('-- No tables found')) {
      res.status(400).json({
        success: false,
        error: {
          code: 'NO_SCHEMA',
          message:
            'No tables found in this project. Import a schema first before generating migration scripts.',
        },
      });
      return;
    }

    const messages = buildMigrationScriptGeneratorPrompt(
      schemaContext,
      sourceDialect,
      targetDialect,
      tables,
    );

    const provider = await AIProviderFactory.getTracked({ module: 'migration', endpoint: '/ai/migration/generate-scripts', projectId });
    const response = await provider.chat({
      messages,
      temperature: 0.2,
      maxTokens: 16384,
      jsonMode: true,
    });

    let scripts: unknown;
    try {
      scripts = parseAIJson(response.content);
    } catch {
      scripts = { rawResponse: response.content };
    }

    res.json({
      success: true,
      data: {
        scripts,
        usage: response.usage,
        model: response.model,
      },
    });
  },
);

// ---------- Column Mapping Suggestion ----------

export const suggestColumnMapping = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId, sourceTable, targetTable, sourceDialect, targetDialect } =
      req.body as {
        projectId?: string;
        sourceTable: {
          name: string;
          columns: Array<{
            name: string;
            dataType: string;
            nullable: boolean;
            isPrimaryKey: boolean;
          }>;
        };
        targetTable: {
          name: string;
          columns: Array<{
            name: string;
            dataType: string;
            nullable: boolean;
            isPrimaryKey: boolean;
          }>;
        };
        sourceDialect: string;
        targetDialect: string;
      };

    if (!sourceTable || !targetTable || !sourceDialect || !targetDialect) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message:
            'sourceTable, targetTable, sourceDialect, and targetDialect are required',
        },
      });
      return;
    }

    let schemaContext: string | undefined;
    if (projectId) {
      const ctx = await AIContextBuilder.buildSchemaContext(projectId);
      if (!ctx.startsWith('-- No tables found')) {
        schemaContext = ctx;
      }
    }

    const messages = buildColumnMappingPrompt(
      sourceTable,
      targetTable,
      sourceDialect,
      targetDialect,
      schemaContext,
    );

    const provider = await AIProviderFactory.getTracked({ module: 'migration', endpoint: '/ai/migration/suggest-column-mapping', projectId });
    const response = await provider.chat({
      messages,
      temperature: 0.2,
      maxTokens: 4096,
      jsonMode: true,
    });

    let result: unknown;
    try {
      result = parseAIJson(response.content);
    } catch {
      result = { rawResponse: response.content };
    }

    res.json({
      success: true,
      data: {
        result,
        usage: response.usage,
        model: response.model,
      },
    });
  },
);

// ---------- Dialect Conversion Validation (AI) ----------

export const validateDialectConversion = asyncHandler(
  async (req: Request, res: Response) => {
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

    // ── Token Optimization: compress SQL before sending to AI ──
    const optimized = optimizeSqlForTokens(sql);
    logger.info('SQL token optimization', {
      originalTokens: Math.ceil(optimized.originalChars / 4),
      optimizedTokens: Math.ceil(optimized.optimizedChars / 4),
      savedTokens: optimized.estimatedTokensSaved,
      insertsTruncated: optimized.insertsWereTruncated,
    });

    const messages = buildDialectValidationPrompt(
      optimized.optimizedSql,
      sourceDialect,
      targetDialect,
      {
        insertsWereTruncated: optimized.insertsWereTruncated,
        truncatedInsertCount: optimized.truncatedInsertCount,
      },
    );

    // Smart maxTokens: estimate based on optimized SQL size (not original).
    // Output needs: corrected SQL (≈ optimized size) + JSON wrapper/issues (~2000 tokens).
    const smartMaxTokens = calculateSmartMaxTokens(optimized.optimizedSql, 16384, 2000);

    const provider = await AIProviderFactory.getTracked({ module: 'migration', endpoint: '/ai/migration/validate-conversion' });
    const aiResponse = await provider.chat({
      messages,
      temperature: 0.2,
      maxTokens: smartMaxTokens,
      jsonMode: true,
    });

    let validation: Record<string, unknown>;
    try {
      // Strip markdown code fences if present (```json ... ```)
      let jsonStr = aiResponse.content.trim();
      const fenceMatch = jsonStr.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
      if (fenceMatch) {
        jsonStr = fenceMatch[1].trim();
      }
      validation = JSON.parse(jsonStr);
    } catch {
      // Last resort: try to extract JSON object from the response
      const jsonMatch = aiResponse.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          validation = JSON.parse(jsonMatch[0]);
        } catch {
          validation = {
            valid: false,
            issues: [],
            overallAssessment: aiResponse.content.substring(0, 500),
            compatibilityScore: 0,
          };
        }
      } else {
        validation = {
          valid: false,
          issues: [],
          overallAssessment: aiResponse.content.substring(0, 500),
          compatibilityScore: 0,
        };
      }
    }

    // If INSERTs were truncated, the AI only validated DDL.
    // Reconstruct correctedSql by merging AI's corrected DDL with original INSERT data.
    if (optimized.insertsWereTruncated && validation.correctedSql && typeof validation.correctedSql === 'string') {
      // The AI returned only corrected DDL; the user's original SQL still has the full INSERTs.
      // We keep AI's corrected DDL as-is — the frontend already has the full original SQL
      // and the user can apply DDL fixes to their editable textarea.
      validation.correctedSql = validation.correctedSql as string;
      validation.insertsTruncatedNote =
        `Note: ${optimized.truncatedInsertCount} INSERT statement(s) were excluded from AI validation to save tokens. ` +
        `The corrected SQL above contains only DDL (CREATE/ALTER/INDEX). Your original INSERT data remains unchanged.`;
    }

    res.json({
      success: true,
      data: {
        validation,
        usage: aiResponse.usage,
        model: aiResponse.model,
        tokenSavings: {
          originalTokens: Math.ceil(optimized.originalChars / 4),
          optimizedTokens: Math.ceil(optimized.optimizedChars / 4),
          saved: optimized.estimatedTokensSaved,
        },
      },
    });
  },
);

// ---------- Schema Evolution Impact Analysis ----------

export const analyzeSchemaEvolution = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId, changeScript, dialect, focusAreas } = req.body as {
      projectId: string;
      changeScript: string;
      dialect: string;
      focusAreas?: string[];
    };

    if (!projectId || !changeScript || !dialect) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'projectId, changeScript, and dialect are required',
        },
      });
      return;
    }

    const schemaContext = await AIContextBuilder.buildSchemaContext(projectId);

    if (schemaContext.startsWith('-- No tables found')) {
      res.status(400).json({
        success: false,
        error: {
          code: 'NO_SCHEMA',
          message:
            'No tables found in this project. Import a schema first before analyzing schema evolution impact.',
        },
      });
      return;
    }

    const messages = buildSchemaEvolutionImpactPrompt(
      changeScript,
      schemaContext,
      dialect,
      focusAreas,
    );

    const promptText = messages.map((m) => m.content).join('\n');
    const smartMax = calculateSmartMaxTokens(promptText, 16384, 4096);

    const provider = await AIProviderFactory.getTracked({
      module: 'schema',
      endpoint: '/ai/schema/evolution-impact',
      projectId,
    });

    const response = await provider.chat({
      messages,
      temperature: 0.2,
      maxTokens: smartMax,
      jsonMode: true,
    });

    let impact: unknown;
    try {
      impact = parseAIJson(response.content);
    } catch {
      impact = { rawResponse: response.content };
    }

    res.json({
      success: true,
      data: {
        impact,
        usage: response.usage,
        model: response.model,
      },
    });
  },
);
