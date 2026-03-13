# AI DR (Disaster Recovery) Strategy Generator — Implementation Plan

## Overview

Enterprise-grade AI-powered Disaster Recovery Strategy Generator for database systems. Analyzes database architecture, backup configurations, replication topology, workload patterns, and infrastructure to produce compliance-ready DR strategies with RTO/RPO recommendations, failover plans, backup policies, and risk assessments — tailored for banking, fintech, and large SaaS environments.

---

## Token Optimization Strategy

### Problem
DR assessments involve large schema contexts, infrastructure details, and compliance requirements. Sending everything raw to AI wastes tokens and is slow.

### Solution: Structured Input Collection + Compact AI Payload

```
Stage 1: COLLECT           Stage 2: COMPACT            Stage 3: AI ANALYZE
───────────────────        ──────────────────           ─────────────────
User fills structured   →  Build compact JSON payload  →  AI generates DR strategy
forms (DB size, RPO/RTO    (~2-4KB) from form data        with structured JSON output
targets, replication,      + minimal schema summary       (~3-6KB response)
backup config, infra)      (no raw DDL needed)
```

**Why this works:**
- DR strategy doesn't need full column-level schema — table counts, sizes, and relationships suffice
- Structured form input is already compact — no parsing/extraction needed
- AI receives a focused ~2-4KB payload instead of 50KB+ raw schema
- Response is structured JSON with clear sections — easy to render
- `calculateSmartMaxTokens()` keeps response proportional to input

**Caching:**
- SHA-256 hash of assessment input → cache AI response (10-min TTL via existing cache)
- Same assessment re-run → instant results

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  CLIENT (React)                                                      │
│  ┌───────────────┐  ┌──────────────┐  ┌───────────────────────────┐ │
│  │ Infrastructure │  │ Backup &     │  │ Compliance &              │ │
│  │ Profile Form   │  │ Replication  │  │ Requirements              │ │
│  │ (size, regions │  │ Config Form  │  │ (RTO/RPO targets,         │ │
│  │  cloud, HA)    │  │              │  │  industry, regulations)   │ │
│  └──────┬────────┘  └──────┬───────┘  └───────┬───────────────────┘ │
│         │                  │                   │                     │
│  ┌──────▼──────────────────▼───────────────────▼───────────────────┐ │
│  │              DR Strategy Dashboard                              │ │
│  │  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ ┌──────────┐ │ │
│  │  │Executive │ │Risk      │ │Failover│ │Backup  │ │Compliance│ │ │
│  │  │Summary   │ │Assessment│ │Plan    │ │Policy  │ │Report    │ │ │
│  │  └──────────┘ └──────────┘ └────────┘ └────────┘ └──────────┘ │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                          │ POST /api/v1/projects/:projectId/dr/assess
┌─────────────────────────▼───────────────────────────────────────────┐
│  SERVER (Express)                                                    │
│  ┌─────────────┐   ┌──────────────────┐   ┌───────────────────────┐ │
│  │ DR Controller│   │ DR Service        │   │ AI Provider (Tracked) │ │
│  │ validate +   │──→│ buildCompactPayload│──→│ sendMessage()         │ │
│  │ route        │   │ + persist to DB   │   │ with DR system prompt │ │
│  └─────────────┘   └──────────────────┘   └───────────────────────┘ │
│                            │                        │                │
│                     ┌──────▼──────┐          ┌──────▼──────┐        │
│                     │ Prisma DB   │          │ Prompt      │        │
│                     │ DRAssessment│          │ Template    │        │
│                     └─────────────┘          └─────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Model

### DRAssessment (Prisma)

```prisma
model DRAssessment {
  id              String   @id @default(uuid()) @db.Uuid
  projectId       String   @db.Uuid
  name            String   @db.VarChar(200)

  // Infrastructure Profile
  infrastructure  String   @db.Text  // JSON: { provider, regions, dbEngine, dbVersion, dbSizeGB, tableCount, avgTPS, peakTPS, haEnabled, clusterType }

  // Backup Configuration
  backupConfig    String   @db.Text  // JSON: { strategy, fullBackupFreq, incrBackupFreq, retentionDays, backupLocation, backupEncrypted, lastBackupTest }

  // Replication Setup
  replicationConfig String @db.Text  // JSON: { type, topology, replicaCount, replicaRegions, lagToleranceSec, autoFailover }

  // Compliance & Targets
  compliance      String   @db.Text  // JSON: { industry, regulations[], targetRTO_min, targetRPO_min, dataClassification, drTestFrequency }

  // AI-Generated Strategy (populated after analysis)
  strategy        String?  @db.Text  // JSON: full AI response
  riskScore       Int?              // 0-100 computed risk score
  status          String   @default("draft") @db.VarChar(20) // draft | analyzed | approved | archived

  createdAt       DateTime @default(now()) @db.Timestamptz
  updatedAt       DateTime @updatedAt @db.Timestamptz

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@schema("aqua_db")
  @@index([projectId, status])
  @@index([createdAt])
}
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/projects/:projectId/dr` | List all DR assessments |
| POST   | `/projects/:projectId/dr` | Create new assessment (draft) |
| GET    | `/projects/:projectId/dr/:id` | Get assessment by ID |
| PATCH  | `/projects/:projectId/dr/:id` | Update assessment |
| DELETE | `/projects/:projectId/dr/:id` | Delete assessment |
| POST   | `/projects/:projectId/dr/:id/analyze` | Run AI analysis on assessment |

---

## AI Prompt Design

### System Prompt
```
You are an enterprise database disaster recovery architect with expertise in:
- Multi-region failover strategies for banking/fintech systems
- RTO/RPO compliance (PCI-DSS, SOX, GDPR, RBI, ISO 27001)
- Database replication topologies (streaming, logical, multi-master)
- Backup strategies (full, incremental, differential, continuous WAL)
- Cloud DR patterns (pilot light, warm standby, multi-site active-active)

Analyze the provided database infrastructure and generate a comprehensive
disaster recovery strategy. Return a JSON response.
```

### User Prompt (Compact ~2-4KB)
```json
{
  "infrastructure": { "provider": "AWS", "regions": ["ap-south-1"], ... },
  "backupConfig": { "strategy": "full+incremental", ... },
  "replicationConfig": { "type": "streaming", ... },
  "compliance": { "industry": "banking", "targetRTO_min": 30, "targetRPO_min": 5, ... },
  "schemaStats": { "tableCount": 245, "totalSizeGB": 850, "largestTableGB": 120 }
}
```

### Expected AI Response Structure
```json
{
  "executiveSummary": {
    "overallRiskLevel": "MEDIUM",
    "riskScore": 42,
    "headline": "...",
    "keyFindings": ["...", "..."],
    "criticalGaps": ["...", "..."]
  },
  "riskAssessment": {
    "categories": [
      { "name": "Data Loss Risk", "score": 35, "level": "LOW", "details": "..." },
      { "name": "Recovery Time Risk", "score": 55, "level": "MEDIUM", "details": "..." },
      ...
    ],
    "vulnerabilities": [{ "severity": "HIGH", "description": "...", "mitigation": "..." }]
  },
  "failoverPlan": {
    "strategy": "warm-standby",
    "steps": [{ "order": 1, "action": "...", "estimatedTime": "...", "responsible": "..." }],
    "estimatedRTO": "25 minutes",
    "estimatedRPO": "5 minutes",
    "automationLevel": "semi-automatic"
  },
  "backupPolicy": {
    "recommended": { "fullFrequency": "daily", "incrementalFrequency": "10min", ... },
    "current_vs_recommended": [{ "aspect": "...", "current": "...", "recommended": "...", "priority": "HIGH" }]
  },
  "complianceReport": {
    "status": "PARTIAL",
    "regulations": [{ "name": "PCI-DSS", "status": "compliant|gap|non-compliant", "gaps": ["..."], "remediation": ["..."] }]
  },
  "architectureDiagram": {
    "primary": { "region": "...", "engine": "...", "role": "primary" },
    "replicas": [{ "region": "...", "role": "read-replica|failover", "replicationType": "..." }],
    "backupTargets": [{ "type": "...", "location": "...", "frequency": "..." }]
  },
  "recommendations": [
    { "priority": "CRITICAL", "category": "...", "action": "...", "impact": "...", "effort": "LOW|MEDIUM|HIGH" }
  ]
}
```

---

## Frontend Tabs

### Tab 1: Assessment Input
- **Infrastructure Profile**: Cloud provider, regions, DB engine/version, size, TPS, HA config
- **Backup Configuration**: Strategy type, frequencies, retention, encryption, last test date
- **Replication Setup**: Type (streaming/logical/none), topology, replica count/regions, auto-failover
- **Compliance Targets**: Industry sector, regulations, target RTO/RPO, data classification

### Tab 2: Executive Summary
- Overall risk score (gauge visualization)
- Risk level badge (CRITICAL/HIGH/MEDIUM/LOW)
- Key findings list
- Critical gaps highlighted

### Tab 3: Risk Assessment
- Risk category breakdown with scores (colored progress bars)
- Vulnerability list with severity badges
- Mitigation suggestions

### Tab 4: Failover Plan
- Step-by-step failover procedure (numbered timeline)
- Estimated RTO/RPO vs targets (comparison)
- Automation level indicator
- Strategy type badge (pilot-light/warm-standby/hot-standby/active-active)

### Tab 5: Backup Policy
- Current vs Recommended comparison table
- Priority-tagged improvement items
- Retention and encryption recommendations

### Tab 6: Compliance Report
- Per-regulation compliance status
- Gap analysis with remediation steps
- Compliance score per regulation

### Tab 7: DR Architecture
- Visual architecture diagram (primary → replicas → backups)
- Region indicators
- Data flow arrows

### Tab 8: Recommendations
- Prioritized action items (CRITICAL → LOW)
- Category tags (backup, replication, monitoring, testing)
- Effort/impact matrix

---

## Implementation Sequence

### Step 1: Prisma Model + Migration
- Add `DRAssessment` model to `schema.prisma`
- Add relation to `Project` model
- Run `prisma generate` + `prisma db push`

### Step 2: Server — Service + Controller + Routes
- `server/src/services/disaster-recovery.service.ts` — CRUD + AI analysis
- `server/src/services/ai/prompt-templates/dr-strategy.prompt.ts` — prompt builder
- `server/src/controllers/disaster-recovery.controller.ts` — request handlers
- `server/src/routes/disaster-recovery.routes.ts` — route definitions
- Register in `server/src/routes/index.ts`

### Step 3: Client — Hook
- `client/src/hooks/use-disaster-recovery.ts` — TanStack Query hooks

### Step 4: Client — Page + Components
- `client/src/pages/disaster-recovery.tsx` — main page with tab navigation
- `client/src/components/dr/` — tab content components:
  - `dr-assessment-form.tsx` — input collection form
  - `dr-executive-summary.tsx` — summary + risk gauge
  - `dr-risk-assessment.tsx` — risk breakdown
  - `dr-failover-plan.tsx` — step-by-step plan
  - `dr-backup-policy.tsx` — current vs recommended
  - `dr-compliance-report.tsx` — regulation compliance
  - `dr-architecture.tsx` — architecture visualization
  - `dr-recommendations.tsx` — prioritized actions

### Step 5: Navigation + Routing
- Add sidebar entry in `getProjectNavItems()`
- Add route in `client/src/router/index.tsx`

### Step 6: Build Verification
- TypeScript compilation check
- Prisma migration
- Vite production build

---

## Key Design Decisions

1. **Single-page with tabs** — All DR functionality in one page, consistent with Performance Lab / Data Lifecycle pattern
2. **Draft → Analyzed workflow** — Users fill form (draft), then click "Analyze" to run AI, can re-analyze with updated inputs
3. **Saved assessments** — Each assessment is persisted, users can compare over time
4. **Token-efficient** — Form-based input (~2KB) + schema stats (not full DDL) → ~2-4KB AI input
5. **Structured JSON response** — AI returns typed JSON, rendered across tabs — no freeform text parsing
6. **Industry-grade compliance** — Built-in support for PCI-DSS, SOX, GDPR, HIPAA, RBI, ISO 27001
