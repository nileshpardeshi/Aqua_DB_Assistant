import OpenAI from 'openai';
import type {
  AIProvider,
  AIChatParams,
  AIChatResponse,
} from './ai-provider.interface.js';
import { logger } from '../../config/logger.js';

/**
 * OpenRouter provider using OpenAI-compatible API at openrouter.ai.
 * Gives access to many models (Claude, GPT, Gemini, Llama, etc.) via a single key.
 *
 * Features:
 * - Auto-retry on 402 (insufficient credits): parses affordable token limit
 *   from the error message and retries with reduced maxTokens.
 * - Graceful degradation when credits are low.
 */
export class OpenRouterProvider implements AIProvider {
  public readonly providerName = 'openrouter';
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(apiKey: string, model: string = 'google/gemini-2.5-flash') {
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://aqua-db-copilot.dev',
        'X-Title': 'Aqua DB Copilot',
      },
    });
    this.model = model;
  }

  async chat(params: AIChatParams): Promise<AIChatResponse> {
    const maxTokens = params.maxTokens ?? 4096;

    try {
      return await this.doChat(params, maxTokens);
    } catch (error) {
      // Auto-retry on 402 (insufficient credits) with reduced maxTokens
      if (error instanceof OpenAI.APIError && error.status === 402) {
        const affordable = this.parseAffordableTokens(error.message);
        if (affordable && affordable >= 1024) {
          // Use 95% of affordable limit to leave a small safety margin
          const retryTokens = Math.floor(affordable * 0.95);
          logger.warn('OpenRouter 402: retrying with reduced maxTokens', {
            original: maxTokens,
            affordable,
            retryTokens,
            model: this.model,
          });
          try {
            return await this.doChat(params, retryTokens);
          } catch (retryError) {
            logger.error('OpenRouter retry also failed', {
              error: retryError instanceof Error ? retryError.message : String(retryError),
            });
            throw this.wrapError(retryError, affordable);
          }
        }
      }

      logger.error('OpenRouter API error', {
        error: error instanceof Error ? error.message : String(error),
        model: this.model,
      });
      throw this.wrapError(error);
    }
  }

  private async doChat(params: AIChatParams, maxTokens: number): Promise<AIChatResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: params.temperature ?? 0.3,
      max_tokens: maxTokens,
      messages: params.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const choice = response.choices[0];
    const content = choice?.message?.content ?? '';

    return {
      content,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      },
      model: response.model,
    };
  }

  async *chatStream(params: AIChatParams): AsyncGenerator<string> {
    const maxTokens = params.maxTokens ?? 4096;

    try {
      yield* this.doChatStream(params, maxTokens);
    } catch (error) {
      // Auto-retry on 402 for streaming as well
      if (error instanceof OpenAI.APIError && error.status === 402) {
        const affordable = this.parseAffordableTokens(error.message);
        if (affordable && affordable >= 1024) {
          const retryTokens = Math.floor(affordable * 0.95);
          logger.warn('OpenRouter 402 (stream): retrying with reduced maxTokens', {
            original: maxTokens,
            affordable,
            retryTokens,
          });
          try {
            yield* this.doChatStream(params, retryTokens);
            return;
          } catch (retryError) {
            logger.error('OpenRouter stream retry also failed', {
              error: retryError instanceof Error ? retryError.message : String(retryError),
            });
            throw this.wrapError(retryError, affordable);
          }
        }
      }

      logger.error('OpenRouter streaming error', {
        error: error instanceof Error ? error.message : String(error),
        model: this.model,
      });
      throw this.wrapError(error);
    }
  }

  private async *doChatStream(params: AIChatParams, maxTokens: number): AsyncGenerator<string> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      temperature: params.temperature ?? 0.3,
      max_tokens: maxTokens,
      stream: true,
      messages: params.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield delta;
      }
    }
  }

  /**
   * Parse the affordable token count from OpenRouter's 402 error message.
   * Example: "You requested up to 16384 tokens, but can only afford 15506"
   */
  private parseAffordableTokens(message: string): number | null {
    // Pattern: "can only afford <number>"
    const match = message.match(/can only afford\s+(\d+)/i);
    if (match) return parseInt(match[1], 10);

    // Fallback pattern: "but only have <number> credits"
    const fallback = message.match(/only have\s+(\d+)/i);
    if (fallback) return parseInt(fallback[1], 10);

    return null;
  }

  private wrapError(error: unknown, affordableTokens?: number): Error {
    if (error instanceof OpenAI.APIError) {
      let message = `OpenRouter API error (${error.status}): ${error.message}`;
      if (error.status === 402 && affordableTokens) {
        message += ` (Retried with ${affordableTokens} tokens but still failed. Consider adding credits at https://openrouter.ai/settings/credits)`;
      }
      const wrapped = new Error(message);
      (wrapped as unknown as Record<string, unknown>).statusCode =
        error.status && error.status >= 500 ? 502 : (error.status ?? 500);
      (wrapped as unknown as Record<string, unknown>).code =
        error.status === 402 ? 'INSUFFICIENT_CREDITS' : 'AI_PROVIDER_ERROR';
      return wrapped;
    }
    if (error instanceof Error) return error;
    return new Error(String(error));
  }
}
