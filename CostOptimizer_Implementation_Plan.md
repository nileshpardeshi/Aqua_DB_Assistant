# AI Database Cost Optimization Advisor — Implementation Plan

## Overview

Enterprise-grade AI-powered Database Cost Optimization Advisor that analyzes database infrastructure spending, query cost patterns, storage waste, index inefficiencies, and compute utilization to generate actionable cost reduction strategies. Tailored for organizations running AWS RDS, Aurora, Snowflake, BigQuery, and on-premise databases — particularly in banking, fintech, and large SaaS environments where cloud database costs can reach $10K-$100K+/month.

---

## Token Optimization Strategy

### Problem
Cost analysis involves query patterns, table sizes, index usage stats, and infrastructure configuration. Sending raw data to AI wastes tokens.

### Solution: Structured Input Collection + Compact AI Payload

```
Stage 1: COLLECT           Stage 2: COMPACT            Stage 3: AI ANALYZE
───────────────────        ──────────────────           ─────────────────
User fills structured   →  Build compact JSON payload  →  AI generates cost
forms (cloud provider,     (~2-4KB) from form data        optimization report
instance type, storage,    + schema stats summary         with structured JSON
query patterns, costs)     (no raw DDL needed)            (~4-6KB response)
```

**Caching:** SHA-256 hash of assessment input → cache AI response (10-min TTL via existing cache)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  CLIENT (React)                                                      │
│  ┌───────────────┐  ┌──────────────┐  ┌───────────────────────────┐ │
│  │ Infrastructure │  │ Query &      │  │ Storage &                 │ │
│  │ Cost Profile   │  │ Compute      │  │ Index                     │ │
│  │ (provider,     │  │ Patterns     │  │ Analysis                  │ │
│  │  instance, $)  │  │              │  │                           │ │
│  └──────┬────────┘  └──────┬───────┘  └───────┬───────────────────┘ │
│         │                  │                   │                     │
│  ┌──────▼──────────────────▼───────────────────▼───────────────────┐ │
│  │              Cost Optimization Dashboard                        │ │
│  │  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ ┌──────────┐ │ │
│  │  │Executive │ │Cost      │ │Query   │ │Storage │ │Action    │ │ │
│  │  │Summary   │ │Breakdown │ │Costs   │ │Savings │ │Plan      │ │ │
│  │  └──────────┘ └──────────┘ └────────┘ └────────┘ └──────────┘ │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                          │ API
┌─────────────────────────▼───────────────────────────────────────────┐
│  SERVER (Express)                                                    │
│  ┌──────────────┐   ┌──────────────────┐   ┌──────────────────────┐ │
│  │ Cost         │   │ Cost Service      │   │ AI Provider (Tracked)│ │
│  │ Controller   │──→│ CRUD + analyze    │──→│ sendMessage()        │ │
│  └──────────────┘   └──────────────────┘   └──────────────────────┘ │
│                            │                        │                │
│                     ┌──────▼──────┐          ┌──────▼──────┐        │
│                     │ Prisma DB   │          │ Prompt      │        │
│                     │CostAssessmt │          │ Template    │        │
│                     └─────────────┘          └─────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Model

### CostAssessment (Prisma)

```prisma
model CostAssessment {
  id                String   @id @default(uuid()) @db.Uuid
  projectId         String   @db.Uuid
  name              String   @db.VarChar(200)
  cloudConfig       String   @db.Text  // JSON: provider, service, instanceType, region, monthlyCost, storageGB, computeHours, reservedInstances
  queryPatterns     String   @db.Text  // JSON: topQueries[], avgQueryCost, fullTableScans, queryVolume, peakHours
  storageProfile    String   @db.Text  // JSON: totalStorageGB, dataGrowthRate, unusedTables[], largestTables[], archiveCandidates
  indexProfile      String   @db.Text  // JSON: totalIndexes, unusedIndexes, duplicateIndexes, missingIndexes, indexSizeGB
  analysis          String?  @db.Text  // JSON: full AI-generated analysis
  monthlySavings    Float?             // estimated monthly $ savings
  status            String   @default("draft") @db.VarChar(20)
  createdAt         DateTime @default(now()) @db.Timestamptz
  updatedAt         DateTime @updatedAt @db.Timestamptz

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
| GET    | `/projects/:projectId/cost-optimizer` | List all cost assessments |
| POST   | `/projects/:projectId/cost-optimizer` | Create new assessment (draft) |
| GET    | `/projects/:projectId/cost-optimizer/:id` | Get assessment by ID |
| PATCH  | `/projects/:projectId/cost-optimizer/:id` | Update assessment |
| DELETE | `/projects/:projectId/cost-optimizer/:id` | Delete assessment |
| POST   | `/projects/:projectId/cost-optimizer/:id/analyze` | Run AI cost analysis |

---

## Frontend Tabs

### Tab 1: Executive Summary
- Total monthly cost + estimated savings (big numbers)
- Savings percentage gauge
- Top 3 cost drivers
- Quick win opportunities

### Tab 2: Cost Breakdown
- Cost by category (compute, storage, I/O, network, backup)
- Cost by table (top 10 most expensive tables)
- Cost trend indicators
- Waste identification

### Tab 3: Query Cost Analysis
- Most expensive queries with estimated cost
- Full table scan detection
- Query frequency vs cost matrix
- Optimization recommendations per query

### Tab 4: Storage & Index Optimization
- Unused tables with storage cost
- Archive candidates with savings estimate
- Redundant/duplicate indexes
- Missing index recommendations
- Index size vs benefit analysis

### Tab 5: Right-Sizing Recommendations
- Instance right-sizing (over/under-provisioned)
- Reserved instance opportunities
- Storage tier optimization (SSD → HDD for cold data)
- Read replica optimization

### Tab 6: Action Plan
- Prioritized savings actions (quick wins → long-term)
- Effort/impact matrix
- Implementation timeline
- Total projected savings

---

## Implementation Sequence

1. Prisma model + migration
2. Server service + controller + routes
3. AI prompt template
4. Client hook
5. Client page with all tabs + sample data
6. Sidebar nav + router
7. Build verification
