import OpenAI from 'openai';
import type {
  AIProvider,
  AIChatParams,
  AIChatResponse,
} from './ai-provider.interface.js';
import { logger } from '../../config/logger.js';

/**
 * Gemini provider using Google's OpenAI-compatible endpoint.
 * This lets us reuse the OpenAI SDK — just point it at Google's URL.
 */
export class GeminiProvider implements AIProvider {
  public readonly providerName = 'gemini';
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(apiKey: string, model: string = 'gemini-2.5-flash') {
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    });
    this.model = model;
  }

  async chat(params: AIChatParams): Promise<AIChatResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        temperature: params.temperature ?? 0.3,
        max_tokens: params.maxTokens ?? 4096,
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
    } catch (error) {
      logger.error('Gemini API error', {
        error: error instanceof Error ? error.message : String(error),
        model: this.model,
      });
      throw this.wrapError(error);
    }
  }

  async *chatStream(params: AIChatParams): AsyncGenerator<string> {
    try {
      const stream = await this.client.chat.completions.create({
        model: this.model,
        temperature: params.temperature ?? 0.3,
        max_tokens: params.maxTokens ?? 4096,
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
    } catch (error) {
      logger.error('Gemini streaming error', {
        error: error instanceof Error ? error.message : String(error),
        model: this.model,
      });
      throw this.wrapError(error);
    }
  }

  private wrapError(error: unknown): Error {
    if (error instanceof OpenAI.APIError) {
      const message = `Gemini API error (${error.status}): ${error.message}`;
      const wrapped = new Error(message);
      (wrapped as unknown as Record<string, unknown>).statusCode =
        error.status && error.status >= 500 ? 502 : (error.status ?? 500);
      (wrapped as unknown as Record<string, unknown>).code = 'AI_PROVIDER_ERROR';
      return wrapped;
    }
    if (error instanceof Error) return error;
    return new Error(String(error));
  }
}
