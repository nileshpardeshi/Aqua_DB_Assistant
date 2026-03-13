import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import * as drService from '../services/disaster-recovery.service.js';
import { AIProviderFactory } from '../services/ai/ai-provider.factory.js';
import { buildDRStrategyPrompt } from '../services/ai/prompt-templates/dr-strategy.prompt.js';
import { calculateSmartMaxTokens } from '../services/ai/ai-response-cache.js';
import { logger } from '../config/logger.js';

/**
 * Safely parse AI response content as JSON.
 */
function parseAIJson(content: string): unknown {
  let cleaned = content.trim();
  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)```\s*$/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }
  return JSON.parse(cleaned);
}

// ---------- List ----------

export const list = asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;
  const assessments = await drService.listAssessments(projectId);

  res.json({
    success: true,
    data: assessments,
  });
});

// ---------- Get by ID ----------

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const assessmentId = req.params.assessmentId as string;
  const assessment = await drService.getAssessment(assessmentId);

  res.json({
    success: true,
    data: assessment,
  });
});

// ---------- Create ----------

export const create = asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;
  const { name, infrastructure, backupConfig, replicationConfig, compliance } =
    req.body;

  if (!name || !infrastructure || !backupConfig || !replicationConfig || !compliance) {
    res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message:
          'name, infrastructure, backupConfig, replicationConfig, and compliance are required',
      },
    });
    return;
  }

  const assessment = await drService.createAssessment({
    projectId,
    name,
    infrastructure:
      typeof infrastructure === 'string'
        ? infrastructure
        : JSON.stringify(infrastructure),
    backupConfig:
      typeof backupConfig === 'string'
        ? backupConfig
        : JSON.stringify(backupConfig),
    replicationConfig:
      typeof replicationConfig === 'string'
        ? replicationConfig
        : JSON.stringify(replicationConfig),
    compliance:
      typeof compliance === 'string'
        ? compliance
        : JSON.stringify(compliance),
  });

  res.status(201).json({
    success: true,
    data: assessment,
  });
});

// ---------- Update ----------

export const update = asyncHandler(async (req: Request, res: Response) => {
  const assessmentId = req.params.assessmentId as string;
  const { name, infrastructure, backupConfig, replicationConfig, compliance, status } =
    req.body;

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (status !== undefined) updateData.status = status;
  if (infrastructure !== undefined)
    updateData.infrastructure =
      typeof infrastructure === 'string'
        ? infrastructure
        : JSON.stringify(infrastructure);
  if (backupConfig !== undefined)
    updateData.backupConfig =
      typeof backupConfig === 'string'
        ? backupConfig
        : JSON.stringify(backupConfig);
  if (replicationConfig !== undefined)
    updateData.replicationConfig =
      typeof replicationConfig === 'string'
        ? replicationConfig
        : JSON.stringify(replicationConfig);
  if (compliance !== undefined)
    updateData.compliance =
      typeof compliance === 'string'
        ? compliance
        : JSON.stringify(compliance);

  const assessment = await drService.updateAssessment(assessmentId, updateData);

  res.json({
    success: true,
    data: assessment,
  });
});

// ---------- Delete ----------

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const assessmentId = req.params.assessmentId as string;
  const assessment = await drService.deleteAssessment(assessmentId);

  res.json({
    success: true,
    data: assessment,
  });
});

// ---------- Analyze (AI-powered DR Strategy Generation) ----------

export const analyze = asyncHandler(async (req: Request, res: Response) => {
  const assessmentId = req.params.assessmentId as string;
  const projectId = req.params.projectId as string;

  // Load the assessment
  const assessment = await drService.getAssessment(assessmentId);

  // Parse stored JSON fields
  let infrastructure: Record<string, unknown>;
  let backupConfig: Record<string, unknown>;
  let replicationConfig: Record<string, unknown>;
  let compliance: Record<string, unknown>;

  try {
    infrastructure = JSON.parse(assessment.infrastructure);
    backupConfig = JSON.parse(assessment.backupConfig);
    replicationConfig = JSON.parse(assessment.replicationConfig);
    compliance = JSON.parse(assessment.compliance);
  } catch {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_DATA',
        message: 'Assessment contains invalid JSON data. Please update and retry.',
      },
    });
    return;
  }

  // Get schema stats for context
  const schemaStats = await drService.getSchemaStats(projectId);

  // Build AI prompt
  const messages = buildDRStrategyPrompt({
    infrastructure,
    backupConfig,
    replicationConfig,
    compliance,
    schemaStats: schemaStats.tableCount > 0 ? schemaStats : undefined,
  });

  // Calculate smart max tokens — DR strategies are detailed, allow up to 4KB response
  const inputSize = JSON.stringify(messages).length;
  const smartMax = calculateSmartMaxTokens(
    JSON.stringify({ infrastructure, backupConfig, replicationConfig, compliance }),
    4096,
    2000,
  );

  const provider = await AIProviderFactory.getTracked({
    module: 'dr',
    endpoint: '/dr/analyze',
    projectId,
  });

  logger.info('Starting DR analysis', {
    assessmentId,
    projectId,
    inputSize,
    maxTokens: smartMax,
  });

  const aiResponse = await provider.chat({
    messages,
    temperature: 0.2,
    maxTokens: smartMax,
    jsonMode: true,
  });

  // Parse AI response
  let strategy: unknown;
  let riskScore = 50; // default

  try {
    strategy = parseAIJson(aiResponse.content);
    // Extract risk score from response
    const exec = (strategy as Record<string, Record<string, unknown>>)?.executiveSummary;
    if (exec && typeof exec.riskScore === 'number') {
      riskScore = exec.riskScore;
    }
  } catch {
    logger.warn('DR AI response was not valid JSON, storing raw', {
      assessmentId,
      contentLength: aiResponse.content.length,
    });
    strategy = { rawResponse: aiResponse.content };
  }

  // Persist strategy to assessment
  const updated = await drService.updateAssessment(assessmentId, {
    strategy: JSON.stringify(strategy),
    riskScore,
    status: 'analyzed',
  });

  res.json({
    success: true,
    data: {
      assessment: updated,
      strategy,
      usage: aiResponse.usage,
      model: aiResponse.model,
    },
  });
});
