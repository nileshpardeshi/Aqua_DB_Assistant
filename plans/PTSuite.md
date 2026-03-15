# Performance Testing Suite (PT Suite) — Implementation Plan

## Status Tracker

| Phase | Module | Status | Started | Completed |
|-------|--------|--------|---------|-----------|
| Setup | Sidebar Menu + Navigation + Prisma Models | COMPLETED | 2026-03-16 | 2026-03-16 |
| A | API Chain Designer (Swagger Upload + Manual + Visual Builder) | COMPLETED | 2026-03-16 | 2026-03-16 |
| B | Load Scenario Engine (Async VU Pool, Ramp Patterns, SSE) | COMPLETED | 2026-03-16 | 2026-03-16 |
| C | Real-Time Test Dashboard (Live KPI, Charts, SSE Streaming) | COMPLETED | 2026-03-16 | 2026-03-16 |
| D | AI Report Generator (Bottleneck Analysis, SLA Compliance) | COMPLETED | 2026-03-16 | 2026-03-16 |
| E | Test Data Factory (Placeholder UI — Coming Soon) | COMPLETED | 2026-03-16 | 2026-03-16 |
| F | Test History & Baselines (Integrated in Test Runs Tab) | COMPLETED | 2026-03-16 | 2026-03-16 |

---

## Architecture

### Frontend Routes
- `/tools/pt-suite` — PT Suite Landing (standalone, no project dependency)
- `/tools/pt-suite/chains` — API Chain Designer
- `/tools/pt-suite/chains/:chainId` — Edit specific chain
- `/tools/pt-suite/scenarios` — Load Scenarios
- `/tools/pt-suite/runs` — Test Runs Dashboard
- `/tools/pt-suite/runs/:runId` — Live/Completed Run View
- `/tools/pt-suite/data-factory` — Test Data Factory
- `/tools/pt-suite/history` — Test History & Baselines
- `/tools/pt-suite/reports/:runId` — AI Report View

### Backend Routes
- `POST /api/v1/pt/swagger/parse` — Parse uploaded Swagger/OpenAPI file
- `CRUD /api/v1/pt/chains` — API chains
- `CRUD /api/v1/pt/chains/:chainId/steps` — Chain steps
- `CRUD /api/v1/pt/scenarios` — Load scenarios
- `POST /api/v1/pt/runs` — Start test run
- `GET /api/v1/pt/runs/:runId/stream` — SSE live metrics
- `POST /api/v1/pt/runs/:runId/stop` — Stop a run
- `GET /api/v1/pt/runs` — List runs
- `GET /api/v1/pt/runs/:runId` — Run details + summary
- `GET /api/v1/pt/runs/:runId/report` — AI-generated report
- `POST /api/v1/pt/data-factory/generate` — Generate test data
- `POST /api/v1/pt/data-factory/profiles` — Save data profile
- `POST /api/v1/pt/ai/analyze` — AI analysis endpoints

### Prisma Models (New)
- `ApiChain` — Chain name, description, base URL, environment configs
- `ApiChainStep` — Method, URL, headers, body, extractors, assertions, ordering
- `LoadScenario` — Pattern, VU config, ramp, SLA thresholds
- `TestRun` — Execution record with status, timing, summary
- `TestMetric` — Time-series metrics per run (1s intervals)
- `TestRunStep` — Per-step aggregated metrics
- `DbSnapshot` — DB health snapshots during run
- `DataProfile` — Test data generation profiles

### Tech Stack Additions
- `worker_threads` — Node.js native worker pool for VU execution
- `undici` — Fast HTTP client for load generation
- `swagger-parser` — OpenAPI/Swagger file parsing
- Server-Sent Events — Live metrics streaming (existing SSE pattern)
- Recharts — All charts (existing)
- React Flow — API chain visual designer (existing)

---

## Phase Details

### Phase Setup: Menu + Navigation + Models
- Add "PT Suite" to sidebar toolNavItems
- Create all frontend route entries
- Create Prisma schema models
- Run migration
- Create backend route stubs
- Create empty page components

### Phase A: API Chain Designer
1. Swagger/OpenAPI file upload + parsing
2. Manual API step creation form
3. Visual chain builder (React Flow canvas)
4. Variable extraction (JSONPath from responses)
5. Variable injection (template syntax in requests)
6. Assertions configuration
7. Environment management (DEV/QA/STAGING/PROD)
8. Single-step test execution
9. Full chain test execution
10. Demo data: pre-built "E-Commerce Order Flow" chain

### Phase B: Load Scenario Engine
1. Scenario configuration UI (VU, ramp, duration, think time)
2. Visual ramp-up graph editor
3. SLA threshold configuration
4. Node.js Worker Thread pool for VU execution
5. HTTP client with connection pooling (undici)
6. Metrics aggregation (1s intervals)
7. SSE streaming to frontend
8. Stop/Pause controls
9. Demo scenario pre-configured

### Phase C: Real-Time Test Dashboard
1. Live KPI cards (Active VU, Avg RT, TPS, Error Rate, P99)
2. Response time time-series chart (P50/P95/P99)
3. Throughput + Error rate chart
4. Per-API-step breakdown table
5. DB health panel (if DB connected)
6. Slow query detection during test
7. Live log stream

### Phase D: AI Report Generator
1. Post-run AI analysis (bottlenecks, root causes)
2. SLA compliance table
3. Capacity planning recommendations
4. PDF export with charts
5. Executive summary generation
6. Comparison with baseline runs

### Phase E: Test Data Factory
1. Schema-aware table detection
2. Volume profile configuration
3. AI-powered realistic data generation
4. Referential integrity engine
5. Bulk insert with progress
6. Banking/E-commerce data templates
7. Data cleanup (purge test data)

### Phase F: Test History & Baselines
1. Run history list with verdicts
2. Trend charts across runs
3. Baseline setting
4. Regression detection (AI-powered)
5. Run comparison side-by-side
6. Export history as CSV

---

## Resume Instructions
If implementation is interrupted, check the Status Tracker table above.
Each phase updates its status to: NOT_STARTED → IN_PROGRESS → COMPLETED.
Within each phase, individual files are tracked in commit messages.
