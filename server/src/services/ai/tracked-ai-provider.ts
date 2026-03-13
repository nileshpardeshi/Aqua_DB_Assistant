import type { AIProvider, AIChatParams, AIChatResponse } from './ai-provider.interface.js';
import { logAIUsage } from '../ai-usage.service.js';
import { checkBudget } from '../ai-budget.service.js';
import { aiResponseCache, buildCacheKey } from './ai-response-cache.js';
import { logger } from '../../config/logger.js';

export interface TrackedContext {
  module: string;
  endpoint: string;
  projectId?: string;
  /** Set to true to skip cache for this call (e.g., when user explicitly re-triggers) */
  skipCache?: boolean;
}

export class TrackedAIProvider implements AIProvider {
  public readonly providerName: string;

  constructor(
    private inner: AIProvider,
    private context: TrackedContext,
  ) {
    this.providerName = inner.providerName;
  }

  async chat(params: AIChatParams): Promise<AIChatResponse> {
    // 1. Check cache first (saves credits + time)
    const key = !this.context.skipCache ? buildCacheKey(params) : null;

    if (key) {
      const cached = aiResponseCache.get(key);
      if (cached) {
        logger.info('AI response served from cache', {
          module: this.context.module,
          endpoint: this.context.endpoint,
          savedTokens: cached.usage.inputTokens + cached.usage.outputTokens,
        });
        // Log as cache hit (0 cost, 0 duration)
        logAIUsage({
          ...this.context,
          provider: this.providerName,
          model: cached.model + ' (cached)',
          inputTokens: 0,
          outputTokens: 0,
          durationMs: 0,
          status: 'success',
        }).catch(() => {});
        return cached;
      }
    }

    // 2. Check budget (non-blocking — if check fails, allow the call)
    try {
      const budget = await checkBudget(this.context.projectId);
      if (!budget.allowed) {
        const err = new Error(
          `AI budget exceeded (${budget.percentUsed.toFixed(0)}% used). Monthly limit: ${budget.limit.toLocaleString()} tokens.`,
        );
        (err as any).statusCode = 429;
        (err as any).code = 'BUDGET_EXCEEDED';
        throw err;
      }
    } catch (err: any) {
      if (err?.code === 'BUDGET_EXCEEDED') throw err;
      logger.warn('Budget check failed, allowing AI call', { error: err?.message });
    }

    // 3. Execute with timing
    const start = Date.now();
    let response: AIChatResponse;
    try {
      response = await this.inner.chat(params);
    } catch (err) {
      const durationMs = Date.now() - start;
      logAIUsage({
        ...this.context,
        provider: this.providerName,
        model: 'unknown',
        inputTokens: 0,
        outputTokens: 0,
        durationMs,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : String(err),
      }).catch(() => {});
      throw err;
    }

    // 4. Store in cache for future identical requests
    if (key) {
      aiResponseCache.set(key, response);
    }

    // 5. Log usage fire-and-forget
    const durationMs = Date.now() - start;
    logAIUsage({
      ...this.context,
      provider: this.providerName,
      model: response.model,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      durationMs,
      status: 'success',
    }).catch(() => {});

    return response;
  }

  async *chatStream(params: AIChatParams): AsyncGenerator<string> {
    // Budget check for streaming
    try {
      const budget = await checkBudget(this.context.projectId);
      if (!budget.allowed) {
        const err = new Error(
          `AI budget exceeded (${budget.percentUsed.toFixed(0)}% used). Monthly limit: ${budget.limit.toLocaleString()} tokens.`,
        );
        (err as any).statusCode = 429;
        (err as any).code = 'BUDGET_EXCEEDED';
        throw err;
      }
    } catch (err: any) {
      if (err?.code === 'BUDGET_EXCEEDED') throw err;
      logger.warn('Budget check failed, allowing AI stream call', { error: err?.message });
    }

    const start = Date.now();
    let totalContent = '';
    try {
      for await (const chunk of this.inner.chatStream(params)) {
        totalContent += chunk;
        yield chunk;
      }
    } catch (err) {
      const durationMs = Date.now() - start;
      logAIUsage({
        ...this.context,
        provider: this.providerName,
        model: 'unknown',
        inputTokens: 0,
        outputTokens: 0,
        durationMs,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : String(err),
      }).catch(() => {});
      throw err;
    }

    // Estimate tokens for streaming (rough: 1 token ~ 4 chars)
    const estimatedOutputTokens = Math.ceil(totalContent.length / 4);
    const durationMs = Date.now() - start;
    logAIUsage({
      ...this.context,
      provider: this.providerName,
      model: 'stream',
      inputTokens: 0,
      outputTokens: estimatedOutputTokens,
      durationMs,
      status: 'success',
    }).catch(() => {});
  }
}
