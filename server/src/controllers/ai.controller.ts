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
import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';

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

  const provider = await AIProviderFactory.getDefault();

  // If a projectId is provided, prepend schema context as a system message
  let contextMessages = [...messages];
  if (projectId) {
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

    const provider = await AIProviderFactory.getDefault();
    const response = await provider.chat({
      messages,
      temperature: 0.3,
      maxTokens: 8192,
      jsonMode: true,
    });

    let data: unknown;
    try {
      data = JSON.parse(response.content);
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

    const schemaContext = await AIContextBuilder.buildQueryContext(
      projectId,
      sql,
    );

    const messages = buildQueryOptimizationPrompt(
      sql,
      dialect,
      schemaContext,
      explainPlan,
    );

    const provider = await AIProviderFactory.getDefault();
    const response = await provider.chat({
      messages,
      temperature: 0.2,
      maxTokens: 8192,
      jsonMode: true,
    });

    let data: unknown;
    try {
      data = JSON.parse(response.content);
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

    const schemaContext = await AIContextBuilder.buildSchemaContext(projectId);

    const messages = buildNLToSQLPrompt(
      naturalLanguage,
      dialect,
      schemaContext,
    );

    const provider = await AIProviderFactory.getDefault();
    const response = await provider.chat({
      messages,
      temperature: 0.2,
      maxTokens: 4096,
      jsonMode: true,
    });

    let data: unknown;
    try {
      data = JSON.parse(response.content);
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
      schemaContext = await AIContextBuilder.buildQueryContext(projectId, sql);
    }

    const messages = buildQueryExplanationPrompt(sql, dialect, schemaContext);

    const provider = await AIProviderFactory.getDefault();
    const response = await provider.chat({
      messages,
      temperature: 0.2,
      maxTokens: 4096,
      jsonMode: true,
    });

    let data: unknown;
    try {
      data = JSON.parse(response.content);
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

    const provider = await AIProviderFactory.getDefault();
    const response = await provider.chat({
      messages,
      temperature: 0.3,
      maxTokens: 8192,
      jsonMode: true,
    });

    let data: unknown;
    try {
      data = JSON.parse(response.content);
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

    const provider = await AIProviderFactory.getDefault();
    const response = await provider.chat({
      messages,
      temperature: 0.2,
      maxTokens: 8192,
      jsonMode: true,
    });

    let data: unknown;
    try {
      data = JSON.parse(response.content);
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
