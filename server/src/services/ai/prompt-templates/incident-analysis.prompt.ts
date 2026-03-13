import type { AIChatParams } from '../ai-provider.interface.js';

const SYSTEM_PROMPT = `You are a senior database incident response engineer with 20+ years of experience in production database systems (Oracle, PostgreSQL, MySQL). You specialize in post-incident analysis, root cause detection, and building incident timelines.

Your expertise includes:
- Correlating database events across multiple data sources (AWR reports, slow query logs, deployment logs, system metrics)
- Identifying causal chains (e.g., index drop → full table scan → CPU spike → query timeout)
- Distinguishing root causes from symptoms
- Quantifying blast radius and business impact
- Recommending immediate fixes and preventive measures

When analyzing an incident timeline:
1. First identify the EARLIEST anomaly — this is often the root cause trigger
2. Map the causal chain from trigger → intermediate effects → visible symptoms
3. Separate schema/config changes (potential causes) from performance degradation (effects)
4. Look for temporal correlations: events within 1-5 minutes of each other are likely related
5. Assign confidence levels to correlations

You MUST respond with a valid JSON object matching the specified schema. Do NOT include any text outside the JSON.`;

const RESPONSE_FORMAT = `
Respond with a JSON object in this exact format:
{
  "incidentSummary": {
    "severity": "critical | high | medium | low",
    "headline": "One-line summary of what happened",
    "duration": "Estimated incident duration (e.g., '47 minutes')",
    "affectedSystems": ["list of affected components"],
    "database": "Database type and instance name if available"
  },
  "timeline": [
    {
      "timestamp": "Original timestamp from data",
      "event": "What happened",
      "category": "deployment | schema_change | performance | query | wait_event | resource | config_change | error",
      "severity": "critical | high | medium | low | info",
      "isRootCause": false,
      "isTrigger": false,
      "correlatedWith": ["IDs or descriptions of related events"],
      "analysis": "Why this event matters in the incident context"
    }
  ],
  "rootCause": {
    "primaryCause": "Clear description of the root cause",
    "confidence": "high | medium | low",
    "explanation": "Detailed technical explanation of why this is the root cause",
    "evidence": ["Specific data points from the timeline that support this conclusion"],
    "causalChain": [
      {
        "step": 1,
        "event": "What happened",
        "effect": "What this caused",
        "timelag": "How long until the next effect"
      }
    ]
  },
  "correlations": [
    {
      "eventA": "First event description",
      "eventB": "Second event description",
      "relationship": "caused_by | contributed_to | symptom_of | coincidental",
      "confidence": "high | medium | low",
      "explanation": "Why these events are correlated"
    }
  ],
  "impact": {
    "queriesAffected": "Number or description of affected queries",
    "latencyIncrease": "e.g., '20ms → 3.5s (175x increase)'",
    "usersImpacted": "Estimated user impact if determinable",
    "dataAtRisk": "Any data integrity concerns",
    "businessImpact": "Business-level impact description"
  },
  "remediation": {
    "immediateFix": {
      "description": "What to do right now to resolve the incident",
      "sql": "SQL command(s) if applicable",
      "estimatedRecoveryTime": "How long until normal operations resume"
    },
    "preventiveMeasures": [
      {
        "title": "Prevention measure title",
        "description": "Detailed description",
        "priority": "immediate | short-term | long-term",
        "implementation": "How to implement this measure"
      }
    ],
    "rollbackSteps": [
      {
        "step": 1,
        "description": "What to do",
        "sql": "SQL if applicable",
        "risk": "Any risks with this rollback step"
      }
    ]
  },
  "lessonsLearned": [
    "Key takeaways from this incident"
  ]
}`;

export function buildIncidentAnalysisPrompt(
  compressedTimeline: string,
  incidentDescription?: string,
  focusAreas?: string[],
): AIChatParams['messages'] {
  let userContent = `Analyze the following database incident timeline and identify the root cause.\n\n`;

  if (incidentDescription) {
    userContent += `**Incident Description:** ${incidentDescription}\n\n`;
  }

  if (focusAreas && focusAreas.length > 0) {
    userContent += `**Focus Areas:** Pay special attention to: ${focusAreas.join(', ')}\n\n`;
  }

  userContent += `**Timeline Data:**\n\`\`\`\n${compressedTimeline}\n\`\`\`\n\n`;

  userContent += `Analyze the timeline carefully. Identify the root cause, map the causal chain, quantify the impact, and provide actionable remediation steps. Look for temporal correlations between schema changes, deployments, and performance degradation.\n\n`;

  userContent += RESPONSE_FORMAT;

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
}
