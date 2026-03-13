# AI AWR Report Analyzer — Implementation Plan

## Overview

Enterprise-grade AI-powered database performance report analyzer supporting Oracle AWR, ASH, ADDM, MySQL Slow Query Logs, and PostgreSQL pg_stat_statements. Converts 50–200 page reports into actionable root-cause analysis, slow SQL identification, bottleneck detection, and tuning recommendations in seconds.

---

## Large File Optimization Strategy

### Problem
AWR reports are 50–200 pages (500KB–5MB). Sending raw text to AI wastes tokens and is slow.

### Solution: Smart Section Extraction + Structured Metrics (No Vector DB Needed)

Instead of a vector database (overkill for structured reports), we use a **3-stage pipeline**:

```
Stage 1: PARSE          Stage 2: EXTRACT           Stage 3: AI ANALYZE
─────────────────       ──────────────────         ─────────────────
Raw HTML/TXT file  →    Section-aware parser   →   Structured JSON metrics
(500KB–5MB)             extracts key sections       (~3–8KB) sent to AI
                        via regex/DOM parsing
```

**Why not a Vector DB?**
- AWR reports are **structured**, not freeform prose — regex extraction is more reliable
- Vector search adds latency and complexity for minimal gain
- The extracted metrics (~3–8KB) fit easily within AI context windows
- Caching parsed results (SHA-256 hash) gives instant re-analysis

**Caching Strategy:**
- SHA-256 hash of uploaded file → cache parsed metrics (in-memory LRU, 1-hour TTL)
- Same file re-uploaded → skip parsing, instant analysis
- AI response cache already exists (10-min TTL) — reuse for identical analysis requests

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  CLIENT (React)                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐ │
│  │ Upload Zone   │  │ Report Type  │  │ Analysis Config   │ │
│  │ .html/.txt/   │  │ Selector     │  │ (focus areas)     │ │
│  │ .log/.csv     │  │              │  │                   │ │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────────┘ │
│         │                 │                   │             │
│  ┌──────▼─────────────────▼───────────────────▼───────────┐ │
│  │              Results Dashboard                          │ │
│  │  ┌─────────┐ ┌──────────┐ ┌─────┐ ┌──────┐ ┌────────┐│ │
│  │  │Overview │ │Root Cause│ │SQL  │ │Wait  │ │Recom-  ││ │
│  │  │Summary  │ │Analysis  │ │Perf │ │Events│ │mend.   ││ │
│  │  └─────────┘ └──────────┘ └─────┘ └──────┘ └────────┘│ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                          │ POST /api/v1/tools/awr-analyze
┌─────────────────────────▼───────────────────────────────────┐
│  SERVER (Express)                                            │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │ AWR Controller    │  │ Report Parser Engine             │ │
│  │ - upload & parse  │  │ ┌────────────┐ ┌──────────────┐ │ │
│  │ - analyze         │  │ │ Oracle AWR │ │ MySQL Slow   │ │ │
│  │ - compare         │  │ │ HTML/TXT   │ │ Query Log    │ │ │
│  └────────┬─────────┘  │ ├────────────┤ ├──────────────┤ │ │
│           │             │ │ Oracle ASH │ │ PG Stats     │ │ │
│           │             │ │ Oracle ADDM│ │ Generic TXT  │ │ │
│           │             │ └────────────┘ └──────────────┘ │ │
│           │             └──────────────────────────────────┘ │
│  ┌────────▼─────────┐  ┌──────────────────────────────────┐ │
│  │ AI Analysis      │  │ Parsed Metrics Cache (LRU)       │ │
│  │ Engine           │  │ SHA-256 key → structured JSON    │ │
│  │ (prompt template)│  │ 1-hour TTL, 50 entries max       │ │
│  └──────────────────┘  └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Supported Report Types

| Report Type | Database | File Formats | Parser Strategy |
|-------------|----------|-------------|-----------------|
| AWR | Oracle | .html, .txt | Section-based regex (Load Profile, Top Wait Events, SQL by Elapsed Time) |
| ASH | Oracle | .html, .txt | Active session metrics extraction |
| ADDM | Oracle | .html, .txt | Finding/recommendation extraction |
| Slow Query Log | MySQL | .log, .txt | Line-by-line query parsing (Query_time, Lock_time) |
| pg_stat_statements | PostgreSQL | .csv, .txt | CSV/tabular parsing (calls, total_time, rows) |
| Generic | Any | .txt, .html | AI-assisted section detection |

---

## Files to Create

### Server (7 files)

| # | File | Purpose |
|---|------|---------|
| 1 | `server/src/services/awr/report-parser.service.ts` | Master parser — detects report type, delegates to format-specific parsers |
| 2 | `server/src/services/awr/parsers/oracle-awr.parser.ts` | Oracle AWR HTML/TXT section extractor |
| 3 | `server/src/services/awr/parsers/mysql-slowlog.parser.ts` | MySQL slow query log parser |
| 4 | `server/src/services/awr/parsers/pg-stats.parser.ts` | PostgreSQL pg_stat_statements CSV parser |
| 5 | `server/src/services/ai/prompt-templates/awr-analysis.prompt.ts` | AI prompt template for report analysis |
| 6 | `server/src/controllers/awr.controller.ts` | API endpoints: upload, parse, analyze, compare |
| 7 | `server/src/routes/awr.routes.ts` | Route definitions |

### Client (4 files)

| # | File | Purpose |
|---|------|---------|
| 8 | `client/src/pages/awr-analyzer.tsx` | Main page — upload, results dashboard, PDF export |
| 9 | `client/src/hooks/use-awr.ts` | React Query hooks for API calls |
| 10 | Add to `client/src/router/index.tsx` | Route: `/tools/awr-analyzer` |
| 11 | Add to `client/src/components/layout/sidebar.tsx` | Navigation entry under Tools |

### Files to Modify

| # | File | Change |
|---|------|--------|
| 12 | `server/src/routes/index.ts` | Register AWR routes |

---

## Parsed Metrics Schema (What Gets Sent to AI)

```typescript
interface ParsedReportMetrics {
  reportType: 'awr' | 'ash' | 'addm' | 'mysql_slowlog' | 'pg_stats' | 'generic';
  database: 'oracle' | 'mysql' | 'postgresql' | 'unknown';
  timeRange?: { start: string; end: string };
  instanceInfo?: { name: string; version: string; host: string };

  // Load Profile (AWR)
  loadProfile?: {
    dbTime: number;
    cpuTime: number;
    logicalReads: number;
    physicalReads: number;
    parseCount: number;
    hardParses: number;
    transactions: number;
    redoSize: number;
  };

  // Top Wait Events
  waitEvents: {
    event: string;
    waits: number;
    timeSeconds: number;
    percentDbTime: number;
    waitClass: string;
  }[];

  // Top SQL
  topSQL: {
    sqlId: string;
    sqlText?: string;
    elapsedTime: number;
    cpuTime: number;
    executions: number;
    avgTime: number;
    bufferGets: number;
    diskReads: number;
    rows: number;
  }[];

  // Instance Efficiency
  efficiency?: {
    bufferCacheHit: number;
    libraryHit: number;
    softParseRatio: number;
    executeToParseRatio: number;
    inMemorySort: number;
  };

  // I/O Statistics
  ioStats?: {
    tablespace: string;
    reads: number;
    writes: number;
    avgReadTime: number;
    avgWriteTime: number;
  }[];

  // Memory
  memory?: {
    sgaTotal: number;
    pgaTotal: number;
    sharedPool: number;
    bufferCache: number;
  };

  // Raw sections (for AI fallback)
  rawSections?: Record<string, string>;

  // File metadata
  fileSizeKB: number;
  sectionsFound: string[];
  parseTimeMs: number;
}
```

---

## AI Analysis Output Schema

```typescript
interface AWRAnalysisResult {
  summary: {
    healthScore: number; // 0-100
    healthRating: 'healthy' | 'degraded' | 'critical';
    headline: string;
    keyFindings: string[];
    timeRange: string;
  };

  rootCause: {
    primaryCause: string;
    explanation: string;
    evidence: string[];
    severity: 'critical' | 'high' | 'medium' | 'low';
    affectedArea: 'cpu' | 'io' | 'memory' | 'locking' | 'network' | 'sql' | 'config';
  }[];

  sqlAnalysis: {
    sqlId: string;
    sqlText: string;
    problem: string;
    currentTime: string;
    recommendation: string;
    suggestedRewrite?: string;
    indexRecommendation?: string;
    estimatedImprovement: string;
  }[];

  waitEventAnalysis: {
    event: string;
    interpretation: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    recommendation: string;
  }[];

  recommendations: {
    category: 'index' | 'sql' | 'config' | 'partition' | 'memory' | 'io' | 'architecture';
    priority: 'immediate' | 'short-term' | 'long-term';
    title: string;
    description: string;
    implementation: string;
    estimatedImpact: string;
  }[];

  indexRecommendations: {
    table: string;
    columns: string[];
    reason: string;
    createStatement: string;
    estimatedImprovement: string;
  }[];
}
```

---

## UI Layout

### Upload Phase
- Drag-and-drop zone accepting .html, .txt, .log, .csv
- Report type auto-detection (with manual override dropdown)
- Optional: paste raw text
- "Analyze" button triggers parse → AI pipeline

### Results Dashboard (6 tabs)

1. **Overview** — Health score gauge (0–100), headline, key findings cards, time range
2. **Root Cause** — Severity-coded cards with primary cause, evidence, affected area icons
3. **SQL Performance** — Table of top slow queries with problems, recommendations, suggested rewrites
4. **Wait Events** — Pie chart of wait event distribution + interpretation cards
5. **Recommendations** — Priority-grouped cards (Immediate / Short-term / Long-term) with implementation SQL
6. **Raw Metrics** — Parsed metrics JSON tree view for DBA deep-dive

### Additional Features
- PDF export of full report
- Compare two reports side-by-side
- Copy individual recommendations

---

## Implementation Order

1. Server parsers (Oracle AWR first, then MySQL, PG)
2. AI prompt template
3. Controller + routes
4. Client page (upload → results)
5. Router + sidebar integration
6. PDF export
7. Report comparison (stretch)

---

## Token Budget Estimates

| Stage | Tokens | Notes |
|-------|--------|-------|
| Parsed metrics (input) | ~2,000–4,000 | Structured JSON, not raw HTML |
| System prompt | ~800 | Expert role + JSON schema |
| AI response | ~3,000–6,000 | Full analysis with recommendations |
| **Total per analysis** | **~6,000–11,000** | ~$0.03–0.08 with Claude Sonnet |

Compare: sending raw 200-page AWR would be 50,000–100,000 tokens (~$0.50–1.00).
**Savings: 85–95% token reduction** via smart parsing.
