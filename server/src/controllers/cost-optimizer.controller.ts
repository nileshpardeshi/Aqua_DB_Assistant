import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import * as costService from '../services/cost-optimizer.service.js';
import { AIProviderFactory } from '../services/ai/ai-provider.factory.js';
import { buildCostOptimizationPrompt } from '../services/ai/prompt-templates/cost-optimization.prompt.js';
import { calculateSmartMaxTokens } from '../services/ai/ai-response-cache.js';
import { logger } from '../config/logger.js';

function parseAIJson(content: string): unknown {
  let cleaned = content.trim();
  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)```\s*$/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  return JSON.parse(cleaned);
}

// ---------- List ----------

export const list = asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;
  const assessments = await costService.listAssessments(projectId);
  res.json({ success: true, data: assessments });
});

// ---------- Get by ID ----------

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.assessmentId as string;
  const assessment = await costService.getAssessment(id);
  res.json({ success: true, data: assessment });
});

// ---------- Create ----------

export const create = asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;
  const { name, cloudConfig, queryPatterns, storageProfile, indexProfile } = req.body;

  if (!name || !cloudConfig || !queryPatterns || !storageProfile || !indexProfile) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'name, cloudConfig, queryPatterns, storageProfile, and indexProfile are required' },
    });
    return;
  }

  const stringify = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));

  const assessment = await costService.createAssessment({
    projectId,
    name,
    cloudConfig: stringify(cloudConfig),
    queryPatterns: stringify(queryPatterns),
    storageProfile: stringify(storageProfile),
    indexProfile: stringify(indexProfile),
  });

  res.status(201).json({ success: true, data: assessment });
});

// ---------- Update ----------

export const update = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.assessmentId as string;
  const { name, cloudConfig, queryPatterns, storageProfile, indexProfile, status } = req.body;

  const updateData: Record<string, unknown> = {};
  const stringify = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));

  if (name !== undefined) updateData.name = name;
  if (status !== undefined) updateData.status = status;
  if (cloudConfig !== undefined) updateData.cloudConfig = stringify(cloudConfig);
  if (queryPatterns !== undefined) updateData.queryPatterns = stringify(queryPatterns);
  if (storageProfile !== undefined) updateData.storageProfile = stringify(storageProfile);
  if (indexProfile !== undefined) updateData.indexProfile = stringify(indexProfile);

  const assessment = await costService.updateAssessment(id, updateData);
  res.json({ success: true, data: assessment });
});

// ---------- Delete ----------

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.assessmentId as string;
  const assessment = await costService.deleteAssessment(id);
  res.json({ success: true, data: assessment });
});

// ---------- Analyze (AI-powered Cost Optimization) ----------

export const analyze = asyncHandler(async (req: Request, res: Response) => {
  const assessmentId = req.params.assessmentId as string;
  const projectId = req.params.projectId as string;

  const assessment = await costService.getAssessment(assessmentId);

  let cloudConfig: Record<string, unknown>;
  let queryPatterns: Record<string, unknown>;
  let storageProfile: Record<string, unknown>;
  let indexProfile: Record<string, unknown>;

  try {
    cloudConfig = JSON.parse(assessment.cloudConfig);
    queryPatterns = JSON.parse(assessment.queryPatterns);
    storageProfile = JSON.parse(assessment.storageProfile);
    indexProfile = JSON.parse(assessment.indexProfile);
  } catch {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_DATA', message: 'Assessment contains invalid JSON data.' },
    });
    return;
  }

  const messages = buildCostOptimizationPrompt({
    cloudConfig,
    queryPatterns,
    storageProfile,
    indexProfile,
  });

  const smartMax = calculateSmartMaxTokens(
    JSON.stringify({ cloudConfig, queryPatterns, storageProfile, indexProfile }),
    4096,
    2000,
  );

  const provider = await AIProviderFactory.getTracked({
    module: 'cost-optimizer',
    endpoint: '/cost-optimizer/analyze',
    projectId,
  });

  logger.info('Starting cost optimization analysis', { assessmentId, projectId, maxTokens: smartMax });

  const aiResponse = await provider.chat({
    messages,
    temperature: 0.2,
    maxTokens: smartMax,
    jsonMode: true,
  });

  let analysis: unknown;
  let monthlySavings = 0;

  try {
    analysis = parseAIJson(aiResponse.content);
    const exec = (analysis as Record<string, Record<string, unknown>>)?.executiveSummary;
    if (exec && typeof exec.estimatedMonthlySavings === 'number') {
      monthlySavings = exec.estimatedMonthlySavings;
    }
  } catch {
    logger.warn('Cost optimizer AI response was not valid JSON, storing raw', { assessmentId });
    analysis = { rawResponse: aiResponse.content };
  }

  const updated = await costService.updateAssessment(assessmentId, {
    analysis: JSON.stringify(analysis),
    monthlySavings,
    status: 'analyzed',
  });

  res.json({
    success: true,
    data: {
      assessment: updated,
      analysis,
      usage: aiResponse.usage,
      model: aiResponse.model,
    },
  });
});
