import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { prisma } from '../config/prisma.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { AIProviderFactory } from '../services/ai/ai-provider.factory.js';
import { logger } from '../config/logger.js';

// ---------- List AI Providers ----------

export const listAIProviders = asyncHandler(
  async (_req: Request, res: Response) => {
    const providers = await prisma.aIProviderConfig.findMany({
      orderBy: [{ isDefault: 'desc' }, { provider: 'asc' }],
    });

    // Mask API keys in the response
    const masked = providers.map((p) => ({
      id: p.id,
      provider: p.provider,
      model: p.model,
      baseUrl: p.baseUrl,
      isDefault: p.isDefault,
      maxTokens: p.maxTokens,
      temperature: p.temperature,
      hasApiKey: !!p.apiKeyEncrypted,
      apiKeyPreview: p.apiKeyEncrypted
        ? maskApiKey(decrypt(p.apiKeyEncrypted))
        : null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    res.json({
      success: true,
      data: masked,
    });
  },
);

// ---------- Upsert AI Provider ----------

export const upsertAIProvider = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      id,
      provider,
      apiKey,
      baseUrl,
      model,
      isDefault,
      maxTokens,
      temperature,
    } = req.body as {
      id?: string;
      provider: string;
      apiKey?: string;
      baseUrl?: string;
      model: string;
      isDefault?: boolean;
      maxTokens?: number;
      temperature?: number;
    };

    if (!provider || !model) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'provider and model are required',
        },
      });
      return;
    }

    // If this is being set as default, clear default from all others
    if (isDefault) {
      await prisma.aIProviderConfig.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const data = {
      provider,
      model,
      baseUrl: baseUrl ?? null,
      isDefault: isDefault ?? false,
      maxTokens: maxTokens ?? 4096,
      temperature: temperature ?? 0.3,
      ...(apiKey ? { apiKeyEncrypted: encrypt(apiKey) } : {}),
    };

    let result;

    if (id) {
      // Update existing
      result = await prisma.aIProviderConfig.update({
        where: { id },
        data,
      });
    } else {
      // Create new -- use upsert to handle unique constraint on (provider, model)
      result = await prisma.aIProviderConfig.upsert({
        where: {
          provider_model: { provider, model },
        },
        update: data,
        create: data,
      });
    }

    res.json({
      success: true,
      data: {
        id: result.id,
        provider: result.provider,
        model: result.model,
        baseUrl: result.baseUrl,
        isDefault: result.isDefault,
        maxTokens: result.maxTokens,
        temperature: result.temperature,
        hasApiKey: !!result.apiKeyEncrypted,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      },
    });
  },
);

// ---------- Delete AI Provider ----------

export const deleteAIProvider = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.params.id as string | undefined;

    if (!id) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Provider ID is required' },
      });
      return;
    }

    const existing = await prisma.aIProviderConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'AI provider configuration not found',
        },
      });
      return;
    }

    await prisma.aIProviderConfig.delete({ where: { id } });

    res.json({
      success: true,
      data: { message: 'AI provider configuration deleted successfully' },
    });
  },
);

// ---------- Test AI Provider ----------

export const testAIProvider = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.params.id as string | undefined;

    if (!id) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Provider ID is required' },
      });
      return;
    }

    const config = await prisma.aIProviderConfig.findUnique({
      where: { id },
    });

    if (!config) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'AI provider configuration not found',
        },
      });
      return;
    }

    if (!config.apiKeyEncrypted) {
      res.status(400).json({
        success: false,
        error: {
          code: 'NO_API_KEY',
          message: 'No API key configured for this provider',
        },
      });
      return;
    }

    try {
      const apiKey = decrypt(config.apiKeyEncrypted);
      const provider = AIProviderFactory.create({
        provider: config.provider as 'anthropic' | 'openai',
        apiKey,
        model: config.model,
      });

      const startTime = Date.now();

      const response = await provider.chat({
        messages: [
          {
            role: 'user',
            content: 'Reply with exactly: "Connection successful"',
          },
        ],
        maxTokens: 50,
        temperature: 0,
      });

      const latencyMs = Date.now() - startTime;

      res.json({
        success: true,
        data: {
          status: 'connected',
          provider: config.provider,
          model: response.model,
          latencyMs,
          response: response.content,
        },
      });
    } catch (error) {
      logger.warn('AI provider test failed', {
        provider: config.provider,
        model: config.model,
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(502).json({
        success: false,
        error: {
          code: 'CONNECTION_FAILED',
          message: `Failed to connect to ${config.provider}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      });
    }
  },
);

// ---------- Helpers ----------

/**
 * Mask an API key for safe display (e.g., "sk-abc...xyz")
 */
function maskApiKey(key: string): string {
  if (key.length <= 8) return '****';
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}
