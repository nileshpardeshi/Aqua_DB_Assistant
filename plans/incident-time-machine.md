# AI Database Incident Time-Machine — Implementation Plan

## Overview

Enterprise feature that automatically analyzes and reconstructs database incident timelines from multiple input sources (AWR reports, slow query logs, pg_stat_statements, deployment logs, custom event logs). Integrated into the existing **Report Analyzer** section as a dedicated "Incident Time-Machine" mode.

**Key differentiator**: Users upload multiple evidence files (logs, reports, metrics) from an incident window. The system parses each file, extracts timestamped events, builds a unified chronological timeline, then uses AI to correlate events and identify root cause with a professional incident report.

---

## Token Optimization Strategy (Critical — BRD Requirement)

Large files (AWR reports = 50-200KB, slow query logs = 1-50MB) would consume 50K-500K tokens raw. Our multi-stage compression pipeline:

| Stage | Technique | Token Reduction |
|-------|-----------|-----------------|
| 1 | **Local parsing** — extract only timestamped events, metrics, section headers | 85-95% |
| 2 | **Event deduplication** — collapse repeated events (e.g., 10,000 identical slow queries → 1 entry with count) | 50-80% |
| 3 | **Time-window focus** — user specifies incident window, discard events outside ±30min buffer | 30-60% |
| 4 | **Smart truncation** — top-N events per category (top 10 slow queries, top 5 wait events) | 20-40% |
| 5 | **Section extraction** — reuse existing `report-parser.service.ts` compression (50-200KB → 3-8KB) | Already built |
| 6 | **AI response cache** — SHA-256 keyed LRU cache prevents re-analysis of identical inputs | Existing |

**Result**: A 200KB AWR report + 5MB slow query log → ~6-10KB compressed context sent to AI.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (React)                        │
│                                                         │
│  AWR Analyzer Page                                      │
│  ├── [Existing] Single Report Analysis                  │
│  ├── [Existing] Compare Two Reports                     │
│  └── [NEW] Incident Time-Machine                        │
│       ├── Multi-file Upload Zone                        │
│       ├── Incident Window Selector (date/time range)    │
│       ├── Interactive Timeline Visualization            │
│       ├── Event Detail Cards                            │
│       ├── AI Root Cause Panel                           │
│       ├── Correlation Graph                             │
│       └── Incident Report (export PDF)                  │
└───────────────┬─────────────────────────────────────────┘
                │ POST /tools/awr/incident-analyze
                ▼
┌─────────────────────────────────────────────────────────┐
│                    SERVER (Express)                      │
│                                                         │
│  incident-timeline.service.ts                           │
│  ├── parseMultipleReports() — parallel parse            │
│  ├── extractTimelineEvents() — per-parser extraction    │
│  ├── buildUnifiedTimeline() — merge + sort + dedup      │
│  └── compressForAI() — smart truncation                 │
│                                                         │
│  incident-analysis.prompt.ts                            │
│  └── buildIncidentAnalysisPrompt() — timeline → AI      │
│                                                         │
│  awr.controller.ts                                      │
│  └── analyzeIncident() — orchestrates pipeline          │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1 — Server: Incident Timeline Service
**File**: `server/src/services/awr/incident-timeline.service.ts` (NEW)

- `extractTimelineEvents(parsedMetrics, reportType)` — Extract timestamped events from each parsed report:
  - Oracle AWR: snapshot times, top wait events with timestamps, SQL executions, load profile changes
  - MySQL Slow Log: each query with timestamp, query time, rows examined
  - PostgreSQL pg_stats: queries sorted by total execution time, cache miss spikes
  - Generic/deployment logs: line-by-line timestamp extraction via regex
- `buildUnifiedTimeline(events[])` — Merge events from all sources, sort chronologically, deduplicate
- `compressTimelineForAI(timeline, maxTokens)` — Smart truncation to fit within token budget:
  - Keep all "change" events (schema changes, deployments, config changes)
  - Keep top-N performance anomalies per time bucket
  - Collapse repeated events with counts
  - Respect maxTokens budget with priority-based truncation

### Step 2 — Server: AI Prompt Template
**File**: `server/src/services/ai/prompt-templates/incident-analysis.prompt.ts` (NEW)

- System prompt: Expert incident response engineer persona
- Input: compressed timeline events + incident window
- Output JSON schema:
  ```json
  {
    "incidentSummary": { severity, headline, duration, affectedSystems },
    "timeline": [{ timestamp, event, category, severity, isRootCause, correlatedWith }],
    "rootCause": { primaryCause, explanation, evidence[], causalChain[] },
    "correlations": [{ eventA, eventB, relationship, confidence }],
    "impact": { queriesAffected, latencyIncrease, usersImpacted, dataAtRisk },
    "remediation": { immediateFix, preventiveMeasures[], rollbackSteps[] },
    "lessonsLearned": string[]
  }
  ```

### Step 3 — Server: Controller + Route
**File**: `server/src/controllers/awr.controller.ts` (EXTEND)
**File**: `server/src/routes/awr.routes.ts` (EXTEND)

- New endpoint: `POST /tools/awr/incident-analyze`
- Input: `{ sources: [{ content, fileName, type? }], incidentWindow?: { start, end }, focusAreas? }`
- Pipeline: Parse all → Extract events → Build timeline → Compress → AI analysis → Return

### Step 4 — Client: Types & Hook
**File**: `client/src/hooks/use-awr.ts` (EXTEND)

- New types: `IncidentTimelineEvent`, `IncidentAnalysisResult`, `IncidentSource`
- New hook: `useIncidentAnalyze()` — mutation for the incident analysis endpoint

### Step 5 — Client: Incident Time-Machine UI
**File**: `client/src/pages/awr-analyzer.tsx` (EXTEND)

- New mode selector at top: "Single Report" | "Compare" | "Incident Time-Machine"
- Multi-file upload zone (drag multiple files)
- Optional incident window (date/time picker)
- Interactive vertical timeline visualization:
  - Color-coded event nodes by category (deployment=blue, schema=purple, performance=red, query=amber)
  - Severity indicators (critical/high/medium/low)
  - Expandable event cards with details
  - Causal chain arrows connecting correlated events
- Root Cause panel with evidence chain
- Remediation recommendations
- PDF export for incident report
- Demo data with realistic multi-source incident scenario

---

## Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `server/src/services/awr/incident-timeline.service.ts` | CREATE | Event extraction, timeline building, compression |
| 2 | `server/src/services/ai/prompt-templates/incident-analysis.prompt.ts` | CREATE | AI prompt for incident root cause analysis |
| 3 | `server/src/controllers/awr.controller.ts` | EXTEND | New `analyzeIncident` endpoint |
| 4 | `server/src/routes/awr.routes.ts` | EXTEND | Register incident endpoint |
| 5 | `client/src/hooks/use-awr.ts` | EXTEND | Types + `useIncidentAnalyze()` hook |
| 6 | `client/src/pages/awr-analyzer.tsx` | EXTEND | Full Incident Time-Machine UI |

## No New Dependencies Required
- Timeline visualization: Pure CSS/Tailwind (no charting library needed)
- Date picker: HTML5 `datetime-local` input
- PDF export: Reuse existing jsPDF setup from AWR analyzer
