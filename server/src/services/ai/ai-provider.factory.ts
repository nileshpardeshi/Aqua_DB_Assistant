import type { AIProvider } from './ai-provider.interface.js';
import { AnthropicProvider } from './anthropic.provider.js';
import { OpenAIProvider } from './openai.provider.js';
import { prisma } from '../../config/prisma.js';
import { decrypt } from '../../utils/crypto.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

export interface AIProviderCreateConfig {
  provider: 'anthropic' | 'openai';
  apiKey: string;
  model?: string;
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
      default:
        throw new Error(
          `Unsupported AI provider: ${config.provider}. Supported: anthropic, openai`,
        );
    }
  }

  /**
   * Load the default AI provider from the AIProviderConfig table.
   * If no DB configuration exists, falls back to environment variables.
   * Throws a descriptive error if no provider can be configured.
   */
  static async getDefault(): Promise<AIProvider> {
    // 1. Try loading from the database (isDefault = true)
    try {
      const dbConfig = await prisma.aIProviderConfig.findFirst({
        where: { isDefault: true },
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
          provider: dbConfig.provider as 'anthropic' | 'openai',
          apiKey,
          model: dbConfig.model,
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

    throw new Error(
      `Unsupported DEFAULT_AI_PROVIDER "${provider}". ` +
        'Supported values: anthropic, openai. ' +
        'Configure a provider in Settings > AI Providers or set the appropriate env vars.',
    );
  }
}
