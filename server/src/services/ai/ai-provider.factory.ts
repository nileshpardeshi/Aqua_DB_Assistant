import type { AIProvider } from './ai-provider.interface.js';
import { AnthropicProvider } from './anthropic.provider.js';
import { OpenAIProvider } from './openai.provider.js';
import { GeminiProvider } from './gemini.provider.js';
import { OpenRouterProvider } from './openrouter.provider.js';
import { TrackedAIProvider, type TrackedContext } from './tracked-ai-provider.js';
import { prisma } from '../../config/prisma.js';
import { decrypt } from '../../utils/crypto.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

export interface AIProviderCreateConfig {
  provider: 'anthropic' | 'openai' | 'gemini' | 'openrouter' | 'copilot';
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export class AIProviderFactory {
  /**
   * Create an AIProvider instance from an explicit config object.
   */
  static create(config: AIProviderCreateConfig): AIProvider {
    switch (config.provider) {
      case 'anthropic':
        return new AnthropicProvider(config.apiKey, config.model);
      case 'openai':
        return new OpenAIProvider(config.apiKey, config.model);
      case 'gemini':
        return new GeminiProvider(config.apiKey, config.model);
      case 'openrouter':
        return new OpenRouterProvider(config.apiKey, config.model);
      case 'copilot':
        // Copilot uses OpenAI-compatible API with a custom base URL
        return new OpenAIProvider(
          config.apiKey,
          config.model ?? 'gpt-4o',
          config.baseUrl ?? 'https://api.githubcopilot.com',
        );
      default:
        throw new Error(
          `Unsupported AI provider: ${config.provider}. Supported: anthropic, openai, gemini, openrouter, copilot`,
        );
    }
  }

  /**
   * Load the default AI provider from the AIProviderConfig table.
   * If no DB configuration exists, falls back to environment variables.
   * Throws a descriptive error if no provider can be configured.
   */
  static async getDefault(): Promise<AIProvider> {
    // 1. Try loading from the database (isDefault = true AND isEnabled = true)
    try {
      const dbConfig = await prisma.aIProviderConfig.findFirst({
        where: { isDefault: true, isEnabled: true },
      });

      if (dbConfig) {
        const apiKey = dbConfig.apiKeyEncrypted
          ? decrypt(dbConfig.apiKeyEncrypted)
          : '';

        if (!apiKey) {
          throw new Error(
            `Default AI provider "${dbConfig.provider}" has no API key configured.`,
          );
        }

        logger.debug('Using DB-configured AI provider', {
          provider: dbConfig.provider,
          model: dbConfig.model,
        });

        return AIProviderFactory.create({
          provider: dbConfig.provider as AIProviderCreateConfig['provider'],
          apiKey,
          model: dbConfig.model,
          baseUrl: dbConfig.baseUrl ?? undefined,
        });
      }
    } catch (error) {
      // If it is our own thrown error, re-throw it
      if (
        error instanceof Error &&
        error.message.includes('has no API key configured')
      ) {
        throw error;
      }
      logger.warn('Failed to load AI provider from DB, falling back to env', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // 2. Fall back to environment-based configuration
    const provider = env.DEFAULT_AI_PROVIDER;

    if (provider === 'anthropic') {
      const apiKey = env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error(
          'No AI provider configured. Set ANTHROPIC_API_KEY in your environment ' +
            'or configure a provider in Settings > AI Providers.',
        );
      }
      return new AnthropicProvider(apiKey);
    }

    if (provider === 'openai') {
      const apiKey = env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error(
          'No AI provider configured. Set OPENAI_API_KEY in your environment ' +
            'or configure a provider in Settings > AI Providers.',
        );
      }
      return new OpenAIProvider(apiKey);
    }

    if (provider === 'gemini') {
      const apiKey = env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error(
          'No AI provider configured. Set GEMINI_API_KEY in your environment ' +
            'or configure a provider in Settings > AI Providers.',
        );
      }
      return new GeminiProvider(apiKey);
    }

    if (provider === 'openrouter') {
      const apiKey = env.OPENROUTER_API_KEY;
      if (!apiKey) {
        throw new Error(
          'No AI provider configured. Set OPENROUTER_API_KEY in your environment ' +
            'or configure a provider in Settings > AI Providers.',
        );
      }
      return new OpenRouterProvider(apiKey);
    }

    throw new Error(
      `Unsupported DEFAULT_AI_PROVIDER "${provider}". ` +
        'Supported values: anthropic, openai, gemini, openrouter. ' +
        'Configure a provider in Settings > AI Providers or set the appropriate env vars.',
    );
  }

  /**
   * Get the default AI provider wrapped with usage tracking and budget enforcement.
   */
  static async getTracked(context: TrackedContext): Promise<AIProvider> {
    const provider = await AIProviderFactory.getDefault();
    return new TrackedAIProvider(provider, context);
  }
}
