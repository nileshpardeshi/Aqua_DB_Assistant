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
      isEnabled: p.isEnabled,
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
      isEnabled,
      maxTokens,
      temperature,
    } = req.body as {
      id?: string;
      provider: string;
      apiKey?: string;
      baseUrl?: string;
      model: string;
      isDefault?: boolean;
      isEnabled?: boolean;
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
      isEnabled: isEnabled ?? true,
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
        isEnabled: result.isEnabled,
        maxTokens: result.maxTokens,
        temperature: result.temperature,
        hasApiKey: !!result.apiKeyEncrypted,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      },
    });
  },
);

// ---------- Toggle AI Provider Enable/Disable ----------

export const toggleAIProvider = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.params.id as string | undefined;
    const { isEnabled } = req.body as { isEnabled: boolean };

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
        error: { code: 'NOT_FOUND', message: 'AI provider configuration not found' },
      });
      return;
    }

    // If disabling the default provider, clear the default flag
    if (!isEnabled && existing.isDefault) {
      await prisma.aIProviderConfig.update({
        where: { id },
        data: { isEnabled: false, isDefault: false },
      });
    } else {
      await prisma.aIProviderConfig.update({
        where: { id },
        data: { isEnabled },
      });
    }

    res.json({
      success: true,
      data: { id, isEnabled, message: `Provider ${isEnabled ? 'enabled' : 'disabled'} successfully` },
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
        provider: config.provider as 'anthropic' | 'openai' | 'gemini' | 'openrouter' | 'copilot',
        apiKey,
        model: config.model,
        baseUrl: config.baseUrl ?? undefined,
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

// ---------- Seed Default Providers ----------

const DEFAULT_PROVIDERS = [
  { provider: 'openrouter', model: 'google/gemini-2.5-flash', isDefault: true, maxTokens: 8192, temperature: 0.3 },
  { provider: 'anthropic', model: 'claude-sonnet-4-20250514', isDefault: false, maxTokens: 8192, temperature: 0.3 },
  { provider: 'openai', model: 'gpt-4o', isDefault: false, maxTokens: 8192, temperature: 0.3 },
  { provider: 'gemini', model: 'gemini-2.5-flash', isDefault: false, maxTokens: 8192, temperature: 0.3 },
  { provider: 'openrouter', model: 'anthropic/claude-sonnet-4', isDefault: false, maxTokens: 8192, temperature: 0.3 },
  { provider: 'openrouter', model: 'openai/gpt-4o', isDefault: false, maxTokens: 8192, temperature: 0.3 },
  { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct', isDefault: false, maxTokens: 4096, temperature: 0.3 },
  { provider: 'copilot', model: 'gpt-4o', isDefault: false, maxTokens: 8192, temperature: 0.3 },
  { provider: 'copilot', model: 'gpt-4o-mini', isDefault: false, maxTokens: 8192, temperature: 0.3 },
];

export const seedDefaultProviders = asyncHandler(
  async (_req: Request, res: Response) => {
    // Only seed if no providers exist
    const existingCount = await prisma.aIProviderConfig.count();
    if (existingCount > 0) {
      res.json({
        success: true,
        data: { message: 'Providers already exist, skipping seed', seeded: 0 },
      });
      return;
    }

    let seeded = 0;
    for (const p of DEFAULT_PROVIDERS) {
      try {
        await prisma.aIProviderConfig.create({
          data: {
            provider: p.provider,
            model: p.model,
            isDefault: p.isDefault,
            isEnabled: true,
            maxTokens: p.maxTokens,
            temperature: p.temperature,
          },
        });
        seeded++;
      } catch {
        // Skip duplicates
      }
    }

    res.json({
      success: true,
      data: { message: `Seeded ${seeded} default providers`, seeded },
    });
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
