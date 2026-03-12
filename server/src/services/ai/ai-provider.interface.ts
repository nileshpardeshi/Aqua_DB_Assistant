export interface AIProvider {
  readonly providerName: string;
  chat(params: AIChatParams): Promise<AIChatResponse>;
  chatStream(params: AIChatParams): AsyncGenerator<string>;
}

export interface AIChatParams {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface AIChatResponse {
  content: string;
  usage: { inputTokens: number; outputTokens: number };
  model: string;
}
