import toast from 'react-hot-toast';
import { useAITokenStore } from '@/stores/use-ai-token-store';

const MODEL_PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  'claude-sonnet-4-20250514': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-opus-4-20250514': { inputPer1M: 15.0, outputPer1M: 75.0 },
  'claude-haiku-3.5': { inputPer1M: 0.25, outputPer1M: 1.25 },
  'gpt-4o': { inputPer1M: 2.5, outputPer1M: 10.0 },
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
  'gpt-4-turbo': { inputPer1M: 10.0, outputPer1M: 30.0 },
  'gpt-3.5-turbo': { inputPer1M: 0.5, outputPer1M: 1.5 },
  'gemini-2.5-flash': { inputPer1M: 0.15, outputPer1M: 0.6 },
  'gemini-2.5-pro': { inputPer1M: 1.25, outputPer1M: 10.0 },
  'gemini-2.0-flash': { inputPer1M: 0.1, outputPer1M: 0.4 },
  'gemini-2.0-flash-lite': { inputPer1M: 0.0, outputPer1M: 0.0 },
  'gemini-1.5-pro': { inputPer1M: 1.25, outputPer1M: 5.0 },
  'gemini-1.5-flash': { inputPer1M: 0.075, outputPer1M: 0.3 },
};

function estimateCost(model: string | undefined, inputTokens: number, outputTokens: number): number {
  const pricing = (model && MODEL_PRICING[model]) ?? { inputPer1M: 3.0, outputPer1M: 15.0 };
  return (inputTokens * pricing.inputPer1M + outputTokens * pricing.outputPer1M) / 1_000_000;
}

export function trackAIUsage(
  data: { usage?: { inputTokens: number; outputTokens: number }; model?: string },
  module: string,
) {
  if (!data.usage) return;

  const { inputTokens, outputTokens } = data.usage;
  const totalTokens = inputTokens + outputTokens;
  const cost = estimateCost(data.model, inputTokens, outputTokens);

  useAITokenStore.getState().addUsage({
    inputTokens,
    outputTokens,
    totalTokens,
    cost,
    model: data.model ?? 'unknown',
    module,
    timestamp: Date.now(),
  });

  toast(`AI: ${totalTokens.toLocaleString()} tokens (~$${cost.toFixed(4)})`, { duration: 6000 });
}
