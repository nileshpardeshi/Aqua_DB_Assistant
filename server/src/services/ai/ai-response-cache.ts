import { createHash } from 'crypto';
import type { AIChatParams, AIChatResponse } from './ai-provider.interface.js';
import { logger } from '../../config/logger.js';

// ── Cache Entry ─────────────────────────────────────────────────────────────

interface CacheEntry {
  response: AIChatResponse;
  createdAt: number;
  hits: number;
}

// ── Configuration ───────────────────────────────────────────────────────────

interface AICacheConfig {
  /** Maximum number of entries to keep in cache */
  maxEntries: number;
  /** Time-to-live in milliseconds (default: 10 minutes) */
  ttlMs: number;
  /** Whether cache is enabled */
  enabled: boolean;
}

const DEFAULT_CONFIG: AICacheConfig = {
  maxEntries: 100,
  ttlMs: 10 * 60 * 1000, // 10 minutes
  enabled: true,
};

// ── LRU Cache with TTL ─────────────────────────────────────────────────────

class AIResponseCacheStore {
  private cache = new Map<string, CacheEntry>();
  private config: AICacheConfig;
  private stats = { hits: 0, misses: 0, evictions: 0 };

  constructor(config: Partial<AICacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate a deterministic cache key from chat params.
   * Includes messages, temperature, maxTokens, and jsonMode.
   */
  static buildKey(params: AIChatParams): string {
    const payload = JSON.stringify({
      m: params.messages.map((msg) => `${msg.role}:${msg.content}`),
      t: params.temperature ?? 0.3,
      j: params.jsonMode ?? false,
      // NOTE: maxTokens is intentionally excluded from the cache key.
      // The same prompt with different maxTokens should return from cache
      // since the content is the same — only truncation risk differs.
    });
    return createHash('sha256').update(payload).digest('hex').slice(0, 32);
  }

  /**
   * Look up a cached response. Returns undefined on miss or expired entry.
   */
  get(key: string): AIChatResponse | undefined {
    if (!this.config.enabled) return undefined;

    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Check TTL
    if (Date.now() - entry.createdAt > this.config.ttlMs) {
      this.cache.delete(key);
      this.stats.misses++;
      return undefined;
    }

    // LRU: delete and re-insert to move to end (most recent)
    this.cache.delete(key);
    entry.hits++;
    this.cache.set(key, entry);
    this.stats.hits++;

    logger.debug('AI cache HIT', { key: key.slice(0, 8), hits: entry.hits });
    return entry.response;
  }

  /**
   * Store a response in cache. Evicts oldest entry if at capacity.
   */
  set(key: string, response: AIChatResponse): void {
    if (!this.config.enabled) return;

    // Evict oldest entries if at capacity
    while (this.cache.size >= this.config.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
        this.stats.evictions++;
      }
    }

    this.cache.set(key, {
      response,
      createdAt: Date.now(),
      hits: 0,
    });

    logger.debug('AI cache SET', {
      key: key.slice(0, 8),
      size: this.cache.size,
      tokens: response.usage.inputTokens + response.usage.outputTokens,
    });
  }

  /**
   * Invalidate a specific cache entry.
   */
  invalidate(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries.
   */
  clear(): void {
    this.cache.clear();
    logger.debug('AI cache cleared');
  }

  /**
   * Get cache statistics.
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      size: this.cache.size,
      maxEntries: this.config.maxEntries,
      hitRate: total > 0 ? ((this.stats.hits / total) * 100).toFixed(1) + '%' : '0%',
    };
  }

  /**
   * Remove expired entries (called periodically or on-demand).
   */
  prune(): number {
    const now = Date.now();
    let pruned = 0;
    for (const [key, entry] of this.cache) {
      if (now - entry.createdAt > this.config.ttlMs) {
        this.cache.delete(key);
        pruned++;
      }
    }
    if (pruned > 0) {
      logger.debug('AI cache pruned', { pruned, remaining: this.cache.size });
    }
    return pruned;
  }
}

// ── Singleton Instance ──────────────────────────────────────────────────────

export const aiResponseCache = new AIResponseCacheStore({
  maxEntries: 100,
  ttlMs: 10 * 60 * 1000, // 10 minutes
});

// Auto-prune every 5 minutes
setInterval(() => aiResponseCache.prune(), 5 * 60 * 1000).unref();

// ── Convenience: standalone key builder ─────────────────────────────────────

/**
 * Build a cache key from AIChatParams. Exported for use by TrackedAIProvider.
 */
export function buildCacheKey(params: AIChatParams): string {
  const payload = JSON.stringify({
    m: params.messages.map((msg) => `${msg.role}:${msg.content}`),
    t: params.temperature ?? 0.3,
    j: params.jsonMode ?? false,
  });
  return createHash('sha256').update(payload).digest('hex').slice(0, 32);
}

// ── Helper: Estimate tokens from text ───────────────────────────────────────

/**
 * Estimate token count from text content.
 * Approximation: ~4 characters per token for English/SQL text.
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Calculate smart maxTokens based on input size and requested max.
 * For SQL validation, the output needs to include the corrected SQL (≈ input size)
 * plus JSON wrapper, issues, and assessment (~1500 tokens overhead).
 *
 * This prevents requesting more tokens than needed while ensuring enough
 * room for the full corrected SQL response.
 */
export function calculateSmartMaxTokens(
  inputText: string,
  requestedMax: number,
  overhead: number = 1500,
): number {
  const inputTokenEstimate = estimateTokenCount(inputText);
  // Output needs: corrected SQL (≈ input) + overhead for JSON/issues
  const estimatedNeeded = inputTokenEstimate + overhead;
  // Use the smaller of: requested max, or estimated need with 30% buffer
  const smart = Math.min(requestedMax, Math.ceil(estimatedNeeded * 1.3));
  // But never go below 2048 (minimum for useful responses)
  return Math.max(2048, smart);
}
