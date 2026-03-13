import type { AIChatParams } from '../ai-provider.interface.js';

const SYSTEM_PROMPT = `You are an enterprise database disaster recovery architect with deep expertise in:
- Multi-region failover strategies for banking, fintech, healthcare, and SaaS systems
- RTO/RPO compliance frameworks (PCI-DSS, SOX, GDPR, HIPAA, RBI, ISO 27001, SOC 2)
- Database replication topologies (synchronous/asynchronous streaming, logical, multi-master, cascading)
- Backup strategies (full, incremental, differential, continuous WAL/redo archiving, snapshot-based)
- Cloud DR patterns (pilot light, warm standby, hot standby, multi-site active-active)
- Risk assessment for data loss, corruption, ransomware, regional outages, and hardware failure
- Automated failover mechanisms, health monitoring, and recovery validation

You analyze database infrastructure configurations and generate comprehensive, actionable disaster recovery strategies tailored to the organization's compliance requirements, budget constraints, and risk tolerance.

You MUST respond with a valid JSON object matching the specified schema. Do NOT include any text outside the JSON.`;

const RESPONSE_FORMAT = `
Respond with a JSON object in this exact format:
{
  "executiveSummary": {
    "overallRiskLevel": "CRITICAL | HIGH | MEDIUM | LOW",
    "riskScore": 0-100,
    "headline": "One-line DR readiness summary",
    "keyFindings": ["Finding 1", "Finding 2", "Finding 3"],
    "criticalGaps": ["Gap requiring immediate attention"]
  },
  "riskAssessment": {
    "categories": [
      {
        "name": "Data Loss Risk | Recovery Time Risk | Infrastructure Risk | Backup Reliability | Replication Health | Compliance Risk",
        "score": 0-100,
        "level": "CRITICAL | HIGH | MEDIUM | LOW",
        "details": "Explanation of the risk score"
      }
    ],
    "vulnerabilities": [
      {
        "severity": "CRITICAL | HIGH | MEDIUM | LOW",
        "category": "backup | replication | infrastructure | compliance | monitoring",
        "description": "What the vulnerability is",
        "mitigation": "How to address it"
      }
    ]
  },
  "failoverPlan": {
    "strategy": "pilot-light | warm-standby | hot-standby | active-active",
    "strategyJustification": "Why this strategy is recommended",
    "steps": [
      {
        "order": 1,
        "phase": "Detection | Decision | Execution | Validation",
        "action": "Specific action to take",
        "estimatedTime": "e.g. 2 minutes",
        "responsible": "DBA | DevOps | Automated | Management",
        "automated": true,
        "details": "Additional implementation details"
      }
    ],
    "estimatedRTO": "e.g. 25 minutes",
    "estimatedRPO": "e.g. 5 minutes",
    "meetsTargetRTO": true,
    "meetsTargetRPO": true,
    "automationLevel": "fully-automatic | semi-automatic | manual",
    "rollbackPlan": "How to rollback if failover causes issues"
  },
  "backupPolicy": {
    "recommended": {
      "fullFrequency": "e.g. daily at 02:00 UTC",
      "incrementalFrequency": "e.g. every 15 minutes",
      "retentionDays": 90,
      "backupLocations": ["Primary region", "Cross-region"],
      "encryption": "AES-256",
      "testingFrequency": "monthly",
      "walArchiving": true
    },
    "gaps": [
      {
        "aspect": "What aspect of backup",
        "current": "Current state",
        "recommended": "Recommended state",
        "priority": "CRITICAL | HIGH | MEDIUM | LOW",
        "impact": "What could go wrong"
      }
    ]
  },
  "complianceReport": {
    "overallStatus": "COMPLIANT | PARTIAL | NON_COMPLIANT",
    "regulations": [
      {
        "name": "PCI-DSS | SOX | GDPR | HIPAA | RBI | ISO27001 | SOC2",
        "status": "compliant | partial | non_compliant",
        "score": 0-100,
        "requirements": ["Specific requirement"],
        "gaps": ["What is missing"],
        "remediation": ["Steps to achieve compliance"]
      }
    ]
  },
  "architecture": {
    "recommended": {
      "primary": {
        "region": "e.g. ap-south-1",
        "role": "primary",
        "engine": "e.g. PostgreSQL 15"
      },
      "replicas": [
        {
          "region": "e.g. ap-southeast-1",
          "role": "failover | read-replica | analytics",
          "replicationType": "synchronous | asynchronous | logical",
          "purpose": "Why this replica exists"
        }
      ],
      "backupTargets": [
        {
          "type": "Full | Incremental | WAL Archive | Snapshot",
          "location": "e.g. S3 cross-region",
          "frequency": "e.g. daily",
          "retention": "e.g. 90 days"
        }
      ]
    },
    "dataFlow": "Description of data flow between components"
  },
  "recommendations": [
    {
      "priority": "CRITICAL | HIGH | MEDIUM | LOW",
      "category": "backup | replication | monitoring | testing | infrastructure | compliance | automation",
      "title": "Short action title",
      "description": "Detailed recommendation",
      "impact": "Expected improvement",
      "effort": "LOW | MEDIUM | HIGH",
      "timeline": "e.g. 1-2 weeks"
    }
  ],
  "drTestPlan": {
    "frequency": "quarterly | monthly | bi-annually",
    "testTypes": [
      {
        "name": "Tabletop Exercise | Failover Drill | Full DR Test | Backup Restore Test",
        "frequency": "e.g. quarterly",
        "description": "What the test covers",
        "successCriteria": ["Criteria 1", "Criteria 2"]
      }
    ]
  }
}`;

export function buildDRStrategyPrompt(
  assessmentInput: {
    infrastructure: Record<string, unknown>;
    backupConfig: Record<string, unknown>;
    replicationConfig: Record<string, unknown>;
    compliance: Record<string, unknown>;
    schemaStats?: { tableCount: number; totalSizeGB: number; largestTableGB?: number };
  },
): AIChatParams['messages'] {
  const userContent = `Analyze the following database infrastructure and generate a comprehensive disaster recovery strategy.

**Infrastructure Profile:**
\`\`\`json
${JSON.stringify(assessmentInput.infrastructure, null, 2)}
\`\`\`

**Backup Configuration:**
\`\`\`json
${JSON.stringify(assessmentInput.backupConfig, null, 2)}
\`\`\`

**Replication Setup:**
\`\`\`json
${JSON.stringify(assessmentInput.replicationConfig, null, 2)}
\`\`\`

**Compliance & Targets:**
\`\`\`json
${JSON.stringify(assessmentInput.compliance, null, 2)}
\`\`\`

${assessmentInput.schemaStats ? `**Schema Statistics:**
\`\`\`json
${JSON.stringify(assessmentInput.schemaStats, null, 2)}
\`\`\`
` : ''}
${RESPONSE_FORMAT}`;

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
}
