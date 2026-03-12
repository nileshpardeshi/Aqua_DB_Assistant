import Anthropic from '@anthropic-ai/sdk';
import type {
  AIProvider,
  AIChatParams,
  AIChatResponse,
} from './ai-provider.interface.js';
import { logger } from '../../config/logger.js';

export class AnthropicProvider implements AIProvider {
  public readonly providerName = 'anthropic';
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(apiKey: string, model: string = 'claude-sonnet-4-20250514') {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async chat(params: AIChatParams): Promise<AIChatResponse> {
    const { systemMessage, conversationMessages } =
      this.extractSystemMessage(params.messages);

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: params.maxTokens ?? 4096,
        temperature: params.temperature ?? 0.3,
        ...(systemMessage ? { system: systemMessage } : {}),
        messages: conversationMessages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      });

      const textContent = response.content
        .filter((block) => block.type === 'text')
        .map((block) => {
          if (block.type === 'text') return block.text;
          return '';
        })
        .join('');

      return {
        content: textContent,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
        model: response.model,
      };
    } catch (error) {
      logger.error('Anthropic API error', {
        error: error instanceof Error ? error.message : String(error),
        model: this.model,
      });
      throw this.wrapError(error);
    }
  }

  async *chatStream(params: AIChatParams): AsyncGenerator<string> {
    const { systemMessage, conversationMessages } =
      this.extractSystemMessage(params.messages);

    try {
      const stream = this.client.messages.stream({
        model: this.model,
        max_tokens: params.maxTokens ?? 4096,
        temperature: params.temperature ?? 0.3,
        ...(systemMessage ? { system: systemMessage } : {}),
        messages: conversationMessages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      });

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield event.delta.text;
        }
      }
    } catch (error) {
      logger.error('Anthropic streaming error', {
        error: error instanceof Error ? error.message : String(error),
        model: this.model,
      });
      throw this.wrapError(error);
    }
  }

  /**
   * Anthropic API requires system messages to be passed separately
   * from the conversation messages. This method extracts the system
   * message from the messages array.
   */
  private extractSystemMessage(
    messages: AIChatParams['messages'],
  ): {
    systemMessage: string | undefined;
    conversationMessages: Array<{
      role: 'user' | 'assistant';
      content: string;
    }>;
  } {
    const systemMessages = messages.filter((m) => m.role === 'system');
    const conversationMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const systemMessage = systemMessages.length
      ? systemMessages.map((m) => m.content).join('\n\n')
      : undefined;

    return { systemMessage, conversationMessages };
  }

  private wrapError(error: unknown): Error {
    if (error instanceof Anthropic.APIError) {
      const message = `Anthropic API error (${error.status}): ${error.message}`;
      const wrapped = new Error(message);
      (wrapped as unknown as Record<string, unknown>).statusCode =
        error.status >= 500 ? 502 : error.status;
      (wrapped as unknown as Record<string, unknown>).code = 'AI_PROVIDER_ERROR';
      return wrapped;
    }
    if (error instanceof Error) return error;
    return new Error(String(error));
  }
}
