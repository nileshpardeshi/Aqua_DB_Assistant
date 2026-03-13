import type { AIChatParams } from '../ai-provider.interface.js';

const SYSTEM_PROMPT = `You are an expert database engineer specializing in schema evolution impact analysis. Given a set of proposed schema changes (ALTER TABLE, DROP COLUMN, ADD COLUMN, RENAME, etc.) and the current database schema, you perform a comprehensive impact analysis.

Your analysis covers:
1. **Dependency Mapping**: Identify all objects affected by the change — tables, columns, foreign keys, indexes, constraints, views, stored procedures, triggers
2. **Risk Scoring**: Rate each change from 0-100 based on data loss risk, downtime potential, and cascade impact
3. **Breaking Changes**: Flag changes that will break existing queries, application code, or data integrity
4. **Data Migration**: Estimate data migration complexity and recommend migration scripts
5. **Rollback Strategy**: Suggest how to safely reverse each change
6. **Performance Impact**: Predict how changes affect query performance, index usage, and storage

You MUST respond with a valid JSON object matching the specified schema. Do NOT include any text outside the JSON.`;

const RESPONSE_FORMAT = `
Respond with a JSON object in this exact format:
{
  "overallRiskScore": 65,
  "overallVerdict": "medium",
  "summary": "Brief summary of the overall impact",
  "parsedChanges": [
    {
      "changeType": "DROP_COLUMN | ADD_COLUMN | ALTER_COLUMN | RENAME_COLUMN | DROP_TABLE | ADD_TABLE | ADD_INDEX | DROP_INDEX | ADD_CONSTRAINT | DROP_CONSTRAINT | ALTER_TABLE | OTHER",
      "targetTable": "table_name",
      "targetColumn": "column_name or null",
      "description": "Human-readable description of the change",
      "sql": "The original SQL statement"
    }
  ],
  "impactedObjects": [
    {
      "objectType": "table | column | index | constraint | foreign_key | trigger | view",
      "objectName": "fully qualified name",
      "impactType": "broken | degraded | modified | requires_update",
      "riskLevel": "critical | high | medium | low",
      "description": "How this object is affected",
      "recommendation": "What to do about it"
    }
  ],
  "breakingChanges": [
    {
      "severity": "critical | high | medium",
      "change": "The specific change causing the break",
      "affectedArea": "queries | application_code | data_integrity | foreign_keys | indexes | triggers",
      "description": "Detailed explanation of what breaks",
      "exampleQuery": "Example of a query/code that would break (if applicable)",
      "fix": "How to fix or work around this breaking change"
    }
  ],
  "dataMigration": {
    "required": true,
    "complexity": "none | simple | moderate | complex",
    "estimatedDowntime": "zero | seconds | minutes | hours",
    "steps": [
      {
        "order": 1,
        "description": "Step description",
        "sql": "Migration SQL if applicable",
        "reversible": true
      }
    ]
  },
  "rollbackPlan": {
    "feasibility": "easy | moderate | difficult | impossible",
    "steps": [
      {
        "order": 1,
        "description": "Rollback step",
        "sql": "Rollback SQL"
      }
    ],
    "dataLossOnRollback": false,
    "warnings": ["Any rollback warnings"]
  },
  "performanceImpact": [
    {
      "area": "query_performance | storage | index_usage | lock_contention",
      "impact": "positive | negative | neutral",
      "description": "How performance is affected",
      "recommendation": "Mitigation if negative"
    }
  ],
  "recommendations": [
    {
      "priority": "immediate | before_deploy | after_deploy",
      "category": "safety | performance | data_integrity | testing",
      "title": "Short recommendation title",
      "description": "Detailed recommendation",
      "sql": "Recommended SQL if applicable"
    }
  ]
}`;

export function buildSchemaEvolutionImpactPrompt(
  changeScript: string,
  currentSchema: string,
  dialect: string,
  focusAreas?: string[],
): AIChatParams['messages'] {
  let userContent = `Analyze the impact of the following proposed schema changes on the current database.\n\n`;
  userContent += `**Database dialect:** ${dialect}\n\n`;
  userContent += `**Current Schema:**\n\`\`\`sql\n${currentSchema}\n\`\`\`\n\n`;
  userContent += `**Proposed Changes:**\n\`\`\`sql\n${changeScript}\n\`\`\`\n\n`;

  if (focusAreas && focusAreas.length > 0) {
    userContent += `**Focus Areas:** Pay special attention to: ${focusAreas.join(', ')}\n\n`;
  }

  userContent += `Analyze every change carefully. Map all dependencies, identify all breaking changes, score risks accurately, and provide actionable migration and rollback plans.\n\n`;
  userContent += RESPONSE_FORMAT;

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
}
