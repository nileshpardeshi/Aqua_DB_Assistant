/**
 * AI Prompt Templates for Performance Testing Suite
 * Provides structured analysis of load test results, API chain design, and assertion suggestions.
 */

import type { AIChatParams } from '../ai-provider.interface.js';

// ── Types ────────────────────────────────────────────────────────────────────

interface PtRunData {
  scenario: { name: string; pattern: string; peakVU: number; duration: number };
  summary: {
    totalRequests: number;
    totalErrors: number;
    avgLatencyMs: number;
    p50: number;
    p95: number;
    p99: number;
    maxLatencyMs: number;
    peakTps: number;
    avgTps: number;
    errorRate: number;
  };
  stepMetrics: Array<{
    stepName: string;
    method: string;
    url: string;
    avgLatency: number;
    p95: number;
    p99: number;
    totalCalls: number;
    totalErrors: number;
    errorRate: number;
  }>;
  timeSeriesHighlights: string;
}

interface PtChainData {
  chainName: string;
  steps: Array<{
    name: string;
    method: string;
    url: string;
    hasBody: boolean;
    extractors: Array<{ name: string; source: string; path: string }>;
    assertions: Array<{ type: string; target: string; operator: string; value: string }>;
    thinkTimeSec: number;
  }>;
  collectionBaseUrl: string;
}

interface PtStepData {
  stepName: string;
  method: string;
  url: string;
  bodyTemplate: string | null;
  sampleResponse: string | null;
}

// ── Performance Test Analysis ────────────────────────────────────────────────

const PT_ANALYSIS_SYSTEM = `You are an expert performance engineer specializing in API load testing analysis. You analyze performance test results to identify bottlenecks, degradation patterns, and provide capacity planning guidance.

You MUST respond with a valid JSON object. Do NOT include any text outside the JSON.`;

const PT_ANALYSIS_SCHEMA = `{
  "executiveSummary": "2-3 sentence summary of test results and key concerns",
  "riskLevel": "Low|Medium|High|Critical",
  "bottlenecks": [
    {
      "stepName": "API step name",
      "issue": "Description of the bottleneck",
      "evidence": "Metrics supporting this finding",
      "severity": "low|medium|high|critical",
      "recommendation": "Specific fix suggestion"
    }
  ],
  "degradationPatterns": [
    {
      "pattern": "Description of degradation over time",
      "affectedSteps": ["step names"],
      "triggerPoint": "At what VU/time did degradation begin"
    }
  ],
  "recommendations": [
    {
      "category": "infrastructure|application|database|caching|architecture",
      "priority": "immediate|short-term|long-term",
      "title": "Recommendation title",
      "description": "Detailed recommendation",
      "expectedImprovement": "What improvement to expect"
    }
  ],
  "capacityEstimate": {
    "maxSafeVU": 0,
    "reasoning": "How this was estimated",
    "scalingFactor": "linear|sublinear|degrading",
    "breakpointIndicators": ["Signs of impending failure"]
  },
  "slaCompliance": [
    {
      "metric": "p95 Latency|Error Rate|TPS",
      "target": "SLA target value",
      "actual": "Measured value",
      "passed": true,
      "notes": "Additional context"
    }
  ]
}`;

export function buildPtAnalysisPrompt(
  runData: PtRunData,
): AIChatParams['messages'] {
  let userContent = '';

  userContent += `## Test Scenario\n`;
  userContent += `Name: ${runData.scenario.name}\n`;
  userContent += `Pattern: ${runData.scenario.pattern} | Peak VU: ${runData.scenario.peakVU} | Duration: ${runData.scenario.duration}s\n\n`;

  userContent += `## Summary Metrics\n`;
  userContent += `Total Requests: ${runData.summary.totalRequests} | Errors: ${runData.summary.totalErrors} (${runData.summary.errorRate.toFixed(2)}%)\n`;
  userContent += `Avg Latency: ${runData.summary.avgLatencyMs.toFixed(1)}ms | P50: ${runData.summary.p50.toFixed(1)}ms | P95: ${runData.summary.p95.toFixed(1)}ms | P99: ${runData.summary.p99.toFixed(1)}ms | Max: ${runData.summary.maxLatencyMs.toFixed(1)}ms\n`;
  userContent += `Peak TPS: ${runData.summary.peakTps.toFixed(1)} | Avg TPS: ${runData.summary.avgTps.toFixed(1)}\n\n`;

  if (runData.stepMetrics.length > 0) {
    userContent += `## Per-Step Metrics\n`;
    for (const step of runData.stepMetrics) {
      userContent += `- ${step.stepName} [${step.method}] ${step.url}\n`;
      userContent += `  Calls: ${step.totalCalls} | Errors: ${step.totalErrors} (${step.errorRate.toFixed(2)}%) | Avg: ${step.avgLatency.toFixed(1)}ms | P95: ${step.p95.toFixed(1)}ms | P99: ${step.p99.toFixed(1)}ms\n`;
    }
    userContent += '\n';
  }

  if (runData.timeSeriesHighlights) {
    userContent += `## Time-Series Highlights\n${runData.timeSeriesHighlights}\n\n`;
  }

  userContent += `## Response Format\nRespond with a JSON object in this exact structure:\n${PT_ANALYSIS_SCHEMA}`;

  return [
    { role: 'system', content: PT_ANALYSIS_SYSTEM },
    { role: 'user', content: userContent },
  ];
}

// ── Chain Design Analysis ────────────────────────────────────────────────────

const PT_CHAIN_ANALYSIS_SYSTEM = `You are an expert API architect who reviews API testing chains for correctness, completeness, and best practices.

You identify:
1. Missing variable extractions that downstream steps need
2. Weak or missing assertions
3. Authentication flow issues
4. Data dependency problems
5. Potential race conditions or ordering issues
6. Missing error handling scenarios

You MUST respond with a valid JSON object. Do NOT include any text outside the JSON.`;

const PT_CHAIN_ANALYSIS_SCHEMA = `{
  "overallScore": 85,
  "issues": [
    {
      "stepIndex": 0,
      "stepName": "Step name",
      "severity": "low|medium|high|critical",
      "category": "extraction|assertion|auth|dependency|ordering|error-handling",
      "issue": "Description of the problem",
      "suggestion": "How to fix it"
    }
  ],
  "missingExtractions": [
    {
      "fromStep": "Step that should extract",
      "variableName": "What to extract",
      "usedInStep": "Step that needs it",
      "suggestedPath": "$.data.id"
    }
  ],
  "suggestedImprovements": [
    "Add error scenario testing for 4xx responses",
    "Add response time assertions to critical steps"
  ]
}`;

export function buildPtChainAnalysisPrompt(
  chainData: PtChainData,
): AIChatParams['messages'] {
  let userContent = '';

  userContent += `## API Chain: ${chainData.chainName}\n`;
  userContent += `Base URL: ${chainData.collectionBaseUrl}\n\n`;

  userContent += `## Steps (${chainData.steps.length})\n`;
  for (let i = 0; i < chainData.steps.length; i++) {
    const step = chainData.steps[i];
    userContent += `\n### Step ${i + 1}: ${step.name}\n`;
    userContent += `Method: ${step.method} | URL: ${step.url}\n`;
    userContent += `Has Body: ${step.hasBody} | Think Time: ${step.thinkTimeSec}s\n`;

    if (step.extractors.length > 0) {
      userContent += `Extractors:\n`;
      for (const ext of step.extractors) {
        userContent += `  - ${ext.name} from ${ext.source}: ${ext.path}\n`;
      }
    }

    if (step.assertions.length > 0) {
      userContent += `Assertions:\n`;
      for (const a of step.assertions) {
        userContent += `  - ${a.type}: ${a.target} ${a.operator} ${a.value}\n`;
      }
    }
  }

  userContent += `\n## Response Format\nRespond with a JSON object in this exact structure:\n${PT_CHAIN_ANALYSIS_SCHEMA}`;

  return [
    { role: 'system', content: PT_CHAIN_ANALYSIS_SYSTEM },
    { role: 'user', content: userContent },
  ];
}

// ── Assertion Suggestion ─────────────────────────────────────────────────────

const PT_ASSERTION_SYSTEM = `You are an expert API tester who suggests comprehensive assertions for API endpoints. Given a step's method, URL, body template, and sample response, suggest assertions that ensure correctness, performance, and data integrity.

You MUST respond with a valid JSON object. Do NOT include any text outside the JSON.`;

const PT_ASSERTION_SCHEMA = `{
  "assertions": [
    {
      "type": "status|header|body|latency|size",
      "target": "What to check (e.g., statusCode, $.data.id, Content-Type, responseTime)",
      "operator": "equals|notEquals|contains|gt|lt|gte|lte|exists|notExists|matches",
      "value": "Expected value or threshold",
      "description": "Why this assertion matters",
      "priority": "must-have|recommended|nice-to-have"
    }
  ],
  "reasoning": "Brief explanation of the assertion strategy"
}`;

export function buildPtAssertionSuggestionPrompt(
  stepData: PtStepData,
): AIChatParams['messages'] {
  let userContent = '';

  userContent += `## API Step: ${stepData.stepName}\n`;
  userContent += `Method: ${stepData.method} | URL: ${stepData.url}\n\n`;

  if (stepData.bodyTemplate) {
    userContent += `## Request Body Template\n\`\`\`json\n${stepData.bodyTemplate}\n\`\`\`\n\n`;
  }

  if (stepData.sampleResponse) {
    userContent += `## Sample Response\n\`\`\`json\n${stepData.sampleResponse}\n\`\`\`\n\n`;
  }

  userContent += `## Response Format\nRespond with a JSON object in this exact structure:\n${PT_ASSERTION_SCHEMA}`;

  return [
    { role: 'system', content: PT_ASSERTION_SYSTEM },
    { role: 'user', content: userContent },
  ];
}
