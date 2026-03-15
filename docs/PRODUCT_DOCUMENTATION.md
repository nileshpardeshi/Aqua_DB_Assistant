# Aqua DB Copilot — Product Documentation

**Version:** 1.0.0
**Release Date:** March 2026
**Author:** Nilesh Pardeshi, Technical Manager, Opus Technologies, Pune

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Overview](#2-product-overview)
3. [Architecture](#3-architecture)
4. [Technology Stack](#4-technology-stack)
5. [Feature Modules](#5-feature-modules)
6. [AI Integration](#6-ai-integration)
7. [Database Support Matrix](#7-database-support-matrix)
8. [API Reference](#8-api-reference)
9. [Data Model](#9-data-model)
10. [Security & Compliance](#10-security--compliance)
11. [Installation Guide](#11-installation-guide)
12. [Configuration Reference](#12-configuration-reference)
13. [Deployment Guide](#13-deployment-guide)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Executive Summary

**Aqua DB Copilot** is an enterprise-grade AI-powered Database Engineering Platform designed for teams managing large-scale database systems in banking, payment processing, card management, and other mission-critical domains. It provides a unified workspace for database design, schema analysis, query optimization, performance benchmarking, API load testing, data lifecycle management, migration planning, disaster recovery, and cost optimization — all enhanced with multi-provider AI assistance.

### Key Highlights

| Metric | Value |
|--------|-------|
| Frontend Pages | 22 |
| API Endpoints | 81+ across 24 route groups |
| Database Models | 36 Prisma models |
| AI Prompt Templates | 25 specialized templates |
| Supported Databases | 8 dialects |
| AI Providers | 5 (Anthropic, OpenAI, Gemini, OpenRouter, Ollama) |

---

## 2. Product Overview

### Vision

Aqua DB Copilot eliminates the fragmentation of database engineering workflows. Instead of switching between multiple tools for schema design, query analysis, migration planning, and performance tuning, teams use a single AI-enhanced platform that understands their database context and provides intelligent assistance at every stage.

### Project Workspace Model

All features operate within a **Project Workspace** model:

```
+------------------+     +-------------------+     +------------------+
|   Create Project |---->| Upload SQL/DDL    |---->| Auto-Parse &     |
|   (Name, Dialect)|     | or Design from    |     | Extract Schema   |
|                  |     | Scratch           |     |                  |
+------------------+     +-------------------+     +------------------+
                                                          |
        +------------------------------------------+------+
        |              |              |             |
   +---------+   +---------+   +---------+   +---------+
   | Schema  |   | Query   |   | Perf    |   | Migrate |
   | Intel.  |   | Intel.  |   | Lab     |   | Studio  |
   +---------+   +---------+   +---------+   +---------+
```

### User Roles

- **Database Architects** — Schema design, ER diagrams, normalization
- **Backend Developers** — Query writing, JPA analysis, performance tuning
- **DBAs** — Performance monitoring, index optimization, DR strategy
- **Performance Testers** — API load testing, chain execution, bottleneck analysis, test reporting
- **Data Engineers** — Migration planning, data lifecycle, cost optimization
- **Team Leads** — Audit trails, AI usage monitoring, project oversight

---

## 3. Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENT (Browser)                     │
│  React 19 + TypeScript + Vite + Tailwind CSS v4          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │ Zustand   │ │ TanStack │ │ React    │ │ Recharts   │  │
│  │ (UI State)│ │ Query    │ │ Flow     │ │ (Charts)   │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP / SSE
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   SERVER (Express.js)                     │
│  TypeScript (ESM) + Prisma ORM                           │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐  │
│  │ Routes &     │ │ Services     │ │ AI Provider      │  │
│  │ Controllers  │ │ (Business    │ │ Factory          │  │
│  │ (23 groups)  │ │  Logic)      │ │ (5 providers)    │  │
│  └──────────────┘ └──────────────┘ └──────────────────┘  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐  │
│  │ Middleware   │ │ SQL Parser   │ │ 22 Prompt        │  │
│  │ (Auth, Audit)│ │ Pipeline     │ │ Templates        │  │
│  └──────────────┘ └──────────────┘ └──────────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
       ┌──────────┐ ┌────────┐ ┌────────────┐
       │PostgreSQL│ │AI APIs │ │File System │
       │  16      │ │(Claude,│ │(Uploads)   │
       │          │ │OpenAI) │ │            │
       └──────────┘ └────────┘ └────────────┘
```

### Request Flow

```
Browser Request
    │
    ▼
Vite Dev Proxy (/api → :3001)
    │
    ▼
Express Middleware Chain
    ├── Helmet (Security Headers)
    ├── CORS (Origin Validation)
    ├── Rate Limiter
    ├── JSON Body Parser
    └── Audit Logger (Auto-logs mutations)
    │
    ▼
Route Handler → Controller → Service → Prisma/AI
    │
    ▼
Response (JSON or SSE Stream)
```

### Multi-Schema Database Architecture

```
PostgreSQL Instance
├── public (Prisma migrations table)
├── aqua_db (All 28 application tables)
└── proj_<id> (Per-project isolated schemas)
    ├── proj_a1b2c3d4
    ├── proj_e5f6g7h8
    └── ...
```

---

## 4. Technology Stack

### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19 | UI framework with concurrent features |
| TypeScript | 5.7 | Type-safe development |
| Vite | Latest | Build tool and dev server |
| Tailwind CSS | v4 | Utility-first styling |
| Zustand | Latest | Client-side state management |
| TanStack Query | Latest | Server state, caching, and synchronization |
| React Flow | Latest | Interactive ER diagrams and flow charts |
| Dagre | Latest | Automatic graph layout for diagrams |
| Recharts | Latest | Charts and data visualization |
| Lucide React | Latest | Icon library |
| React Hot Toast | Latest | Notification system |

### Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 20+ | Runtime environment |
| Express.js | 4.x | HTTP framework |
| TypeScript | 5.7 | Type-safe backend (ESM modules) |
| Prisma | 6.x | ORM with multi-schema support |
| node-sql-parser | Latest | SQL parsing and dialect detection |
| Helmet | Latest | Security headers |
| Winston | Latest | Structured logging |
| Multer | Latest | File upload handling |
| Zod | Latest | Input validation |

### Database

| Technology | Version | Purpose |
|-----------|---------|---------|
| PostgreSQL | 16 | Production database |
| SQLite | — | Development database |

### AI Providers

| Provider | Models | Use Case |
|----------|--------|----------|
| Anthropic | Claude 3.5 Sonnet, Claude 4 | Primary AI provider |
| OpenAI | GPT-4o, GPT-4 | Alternative provider |
| Google Gemini | Gemini Pro | Alternative provider |
| OpenRouter | Multiple models | Router for multiple providers |
| Ollama | Local models | Air-gapped / on-prem environments |

---

## 5. Feature Modules

### 5.1 Dashboard

The main dashboard provides a global view across all projects:

- **Project Cards** — Status, dialect, table count, last activity
- **Global Statistics** — Total projects, tables, queries, conversations
- **Quick Access** — Recent projects, frequently used tools

### 5.2 Project Overview (Enterprise Dashboard)

Each project has a comprehensive overview dashboard:

- **KPI Cards** — Tables, columns, indexes, relationships, connections, migrations
- **Schema Issues & Risks** — Auto-detected problems:
  - Tables missing primary keys
  - Unindexed tables with high row counts
  - High nullable column ratios
  - Wide tables (50+ columns)
  - High-volume tables without partitioning
  - Isolated tables with no foreign key relationships
- **Quality Radar Chart** — 6-dimension quality assessment:
  - PK Coverage, Indexing, FK Relations, Data Integrity, Normalization, Constraints
- **Recommendations Engine** — Contextual suggestions based on project state
- **Operations Command Center** — Schema, query, migration, and performance status
- **Activity Timeline** — Audit trail with action badges
- **Table Insights** — Sortable table list with FK counts and estimated row volumes

### 5.3 Schema Intelligence

Full schema exploration and management:

- **Schema Explorer** — Tree/table view of all database objects
- **Table Detail Panel** — Columns, indexes, constraints, triggers, relationships
- **Inline Editing** — Edit table descriptions, estimated row counts
- **Schema Parsing** — Upload SQL/DDL files, auto-extract tables and relationships
- **Schema Snapshots** — Version and compare schema states over time
- **Schema Export** — Generate DDL scripts for any dialect
- **Trigger Management** — Create, edit, enable/disable database triggers
- **Schema Namespace Management** — Create and manage PostgreSQL schemas
- **AI Schema Review** — AI-powered design review and suggestions
- **Schema Evolution Impact** — Analyze impact of proposed schema changes

### 5.4 Diagram Studio

Enterprise-grade visual diagramming:

- **ER Diagrams** — Interactive entity-relationship diagrams via React Flow
- **Multiple Layout Algorithms** — Dagre (top-down, left-right), force-directed
- **Table Nodes** — Show columns, types, PK/FK indicators, nullable markers
- **Relationship Edges** — FK connections with cardinality labels
- **Drag-and-Drop** — Manual positioning with auto-layout reset
- **Zoom & Pan** — Full canvas navigation
- **Save & Load** — Persist custom diagram layouts
- **Export** — PNG/SVG export of diagrams
- **Multiple Diagram Types** — ER, dependency, and custom diagrams

### 5.5 Query Intelligence

AI-enhanced SQL development environment:

- **SQL Editor** — Syntax highlighting, auto-complete, multi-tab
- **Query Execution** — Run queries against connected databases
- **Query Results** — Tabular display with pagination and export
- **Query History** — Complete execution log with duration and row counts
- **Saved Queries** — Save, organize, and share SQL queries
- **Schema Reference** — Quick lookup of table/column definitions
- **AI Query Generation** — Natural language to SQL conversion
- **AI Query Optimization** — Suggest performance improvements
- **AI Query Explanation** — Explain complex queries in plain English
- **Query Templates** — Pre-built templates for common patterns

### 5.6 Performance Lab

Database performance analysis and optimization:

- **Index Advisor** — AI-recommended indexes based on schema and queries
- **Partition Advisor** — Table partitioning strategy recommendations
- **Query Benchmark** — Compare query performance with different configurations
- **Health Dashboard** — Database health metrics and trends
- **Synthetic Data Generator** — Generate realistic test data:
  - 1K to 100M+ rows with referential integrity
  - AI-generated INSERT scripts respecting data types and constraints
  - Data distribution simulation
  - Query plan simulation for load testing
- **DataGen Test Panel** — In-memory sandbox for testing generated data

### 5.7 DB Documentation Generator

Automated database documentation:

- **AI-Powered Generation** — Generate comprehensive docs from schema metadata
- **Multiple Formats** — HTML, Markdown, and structured output
- **Content Sections** — Overview, table descriptions, column details, relationships, indexes, constraints
- **Export Options** — Download generated documentation

### 5.8 Data Lifecycle Management

Enterprise data retention and compliance:

- **Retention Policy Editor** — Define rules per table:
  - Retention period (days/months/years)
  - Action type (archive, delete, mask, anonymize)
  - Priority levels (low, medium, high, critical)
- **Multi-Dialect Purge Script Generator** — Safe batch DELETE/ARCHIVE scripts
  - PostgreSQL, MySQL, Oracle, SQL Server support
  - Batch size configuration
  - Dry-run mode
- **Data Classification** — Categorize tables by sensitivity
- **Execution History** — Track purge/archive operations
- **CRUD Operations** — Full lifecycle rule management

### 5.9 Migration Studio

Cross-database migration planning and execution:

- **Dialect Converter** — Convert SQL between 8 database dialects:
  - Automatic data type translation
  - Index syntax conversion
  - Constraint migration
  - Trigger and stored procedure adaptation
- **Schema Comparison** — Visual diff between source and target schemas
- **Column Mapping** — Drag-and-drop column-level mapping editor
- **Migration Planner** — Step-by-step migration planning wizard
- **Migration Scripts** — AI-generated migration DDL and DML
- **Migration Timeline** — Track migration progress and dependencies
- **Migration Reports** — Validation reports with risk assessment
- **AI Risk Assessment** — Automated migration risk analysis
- **AI Validation** — Validate converted SQL for correctness
- **Import/Export** — Import CSV data with visual column mapping

### 5.10 Disaster Recovery (DR) Strategy

Database resilience planning:

- **DR Assessments** — Create and manage DR evaluations per project
- **AI-Powered Analysis** — Generate comprehensive DR strategies:
  - RTO/RPO recommendations
  - Backup strategy (full, incremental, differential)
  - Replication topology
  - Failover procedures
  - Recovery runbooks
- **Assessment History** — Track DR planning evolution

### 5.11 Cost Optimizer

Cloud database cost analysis:

- **Cost Assessments** — Evaluate current database spending
- **AI Cost Analysis** — Automated cost optimization recommendations:
  - Right-sizing instance recommendations
  - Reserved instance vs. on-demand analysis
  - Storage optimization (compression, tiering)
  - Read replica strategy
  - Connection pooling recommendations
- **Multi-Cloud Support** — AWS, Azure, GCP cost comparison

### 5.12 SQL Converter (Standalone Tool)

Convert SQL between database dialects without a project:

- **8 Dialect Support** — PostgreSQL, MySQL, Oracle, SQL Server, MariaDB, Snowflake, BigQuery, MongoDB
- **Bidirectional Conversion** — Any source to any target
- **Schema Detection** — Auto-detect source dialect
- **Validation** — Syntax validation of converted SQL

### 5.13 JPA Query Lab

Java Persistence API query analysis:

- **JPA/JPQL/HQL Analysis** — Parse and analyze Java persistence queries
- **N+1 Detection** — Identify N+1 query anti-patterns
- **Performance Recommendations** — Fetch strategy optimization
- **Batch Analysis** — Analyze multiple queries simultaneously
- **Sample Files** — Pre-loaded JPA examples for learning

### 5.14 AWR Report Analyzer

Oracle Automatic Workload Repository analysis:

- **Report Parsing** — Parse AWR, ASH, and ADDM reports
- **Type Detection** — Auto-detect report format
- **AI Analysis** — Deep performance analysis with recommendations
- **Report Comparison** — Compare two reports (before/after)
- **Incident Time Machine** — Multi-source incident root cause analysis:
  - Timeline reconstruction
  - Correlation detection
  - Root cause identification

### 5.15 AI Usage Dashboard

AI consumption monitoring and budget management:

- **Usage Summary** — Total tokens, cost, API calls
- **Usage by Module** — Which features consume most AI tokens
- **Usage by Provider** — Anthropic vs. OpenAI vs. others
- **Usage by Project** — Per-project AI consumption
- **Top Calls** — Most expensive individual API calls
- **Usage Trends** — Time-series usage charts
- **Budget Management** — Set and monitor AI spending limits:
  - Monthly/weekly budgets
  - Per-provider budgets
  - Alert thresholds

### 5.16 Audit & Compliance

Enterprise audit trail:

- **Automatic Logging** — All mutating API requests are logged
- **Audit Log Viewer** — Searchable, filterable log display
- **Log Details** — Method, endpoint, status, user, timestamp, payload
- **Pagination** — Efficient browsing of large audit histories
- **AES-256-GCM Encryption** — Sensitive audit data encrypted at rest

### 5.17 Database Connections

Live database connectivity:

- **Connection Management** — Store and manage database credentials
- **Connection Testing** — Verify connectivity with latency measurement
- **Schema Introspection** — Discover schemas and tables from live databases
- **Live Query Execution** — Run SQL directly against connected databases
- **Multi-Database Support** — Connect to PostgreSQL, MySQL, Oracle, SQL Server, etc.

### 5.18 Settings & Configuration

Application configuration:

- **AI Provider Settings** — Configure API keys and model preferences
- **LLM Configuration** — Select models, adjust parameters
- **Application Settings** — General platform preferences

### 5.19 Performance Testing Suite (PT Suite)

Enterprise-grade API load testing and performance analysis platform — a built-in alternative to JMeter with AI-powered intelligence:

#### API Collections & Swagger Import

```
┌─────────────────────────────────────────────────────────┐
│  Upload Swagger / OpenAPI  ──►  Auto-Populate Endpoints │
│  Manual Entry              ──►  Create Custom Endpoints │
│                                                         │
│  Collection: "Card Management APIs"                     │
│  Base URL: https://api.cardmgmt.bank                    │
│  ├── POST /auth/login          (Authenticate)           │
│  ├── POST /cards/issue         (Issue Card)             │
│  ├── GET  /cards/{id}          (Get Card)               │
│  ├── POST /transactions/auth   (Authorize Transaction)  │
│  └── GET  /transactions/list   (List Transactions)      │
└─────────────────────────────────────────────────────────┘
```

- **Swagger/OpenAPI Import** — Upload JSON/YAML to auto-create collections with all endpoints
- **Manual Entry** — Create collections and endpoints when Swagger unavailable
- **Auth Configuration** — Bearer token, API key, Basic auth per collection
- **Default Headers** — Set common headers across all endpoints

#### Visual API Chain Designer

Build multi-step API test flows with variable extraction and chaining:

```
Step 1: POST /auth/login       ──► Extract: {{authToken}} = $.token
    │
    ▼
Step 2: POST /cards/issue      ──► Extract: {{cardId}} = $.data.id
    │   Headers: Authorization: Bearer {{authToken}}
    ▼
Step 3: GET /cards/{{cardId}}  ──► Assert: status == 200
    │                               Assert: $.data.status == "ACTIVE"
    ▼
Step 4: POST /txn/authorize    ──► Assert: responseTime < 2000ms
        Body: { "cardId": "{{cardId}}", "amount": 29.99 }
```

- **Variable Extraction** — JSONPath extractors to capture tokens, IDs, response data
- **Variable Injection** — Use `{{variables}}` in URLs, headers, and body templates
- **Assertions** — Status code, body content, response time thresholds
- **Think Time** — Configurable delay between steps (simulates real user behavior)
- **Chain Execution** — Test full chain with real HTTP calls before load testing

#### Load Scenario Engine

Configure sophisticated load patterns with visual ramp preview:

| Pattern | Description | Use Case |
|---------|-------------|----------|
| **Ramp** | Gradual increase to peak VU | Normal load testing |
| **Spike** | Sudden burst to peak | Flash sale / batch processing |
| **Soak** | Moderate load for extended duration | Memory leak detection |
| **Stress** | Progressive increase until failure | Find breaking point |
| **Step** | Incremental increase at intervals | Capacity planning |

Configuration options:
- Peak Virtual Users (1 - 500+)
- Ramp-up / Steady State / Ramp-down durations
- Think time between iterations
- Request timeout
- Maximum error percentage before auto-stop
- SLA thresholds (P95 latency, P99 latency, error rate, TPS)

#### Real-Time Test Dashboard

Live monitoring during execution via Server-Sent Events (SSE):

```
┌─────────────────────────────────────────────────────────┐
│  LIVE: Running (12:47 / 20:00)  ████████░░  63%         │
│                                                         │
│  Active VU   Avg Latency   TPS      Error Rate   P99   │
│  ┌──────┐   ┌──────┐    ┌──────┐   ┌──────┐   ┌──────┐│
│  │  347 │   │234ms │    │ 892  │   │ 0.3% │   │1.2s  ││
│  └──────┘   └──────┘    └──────┘   └──────┘   └──────┘│
│                                                         │
│  [Response Time Chart]  [Throughput Chart]              │
│  [Active VU Chart]      [Error Rate Chart]             │
└─────────────────────────────────────────────────────────┘
```

- KPI cards with live values (Active VU, Avg Latency, TPS, Error Rate, P99)
- Response time time-series chart (Avg, P95, P99 lines)
- Throughput bar chart per second
- Active virtual users line chart
- Error rate area chart
- Stop/pause controls

#### AI-Powered Test Reports

Automated analysis after each completed run:

- **Executive Summary** — Overall risk assessment (Low/Medium/High/Critical)
- **SLA Compliance Table** — Each metric with pass/warn/fail badge
- **Bottleneck Identification** — Severity-ranked issues with:
  - Root cause analysis
  - Affected API step
  - Specific recommendations
- **Capacity Estimation** — Maximum safe VU count, max TPS, limiting factor
- **Recommendations** — Prioritized improvements with expected impact

#### Test History & Baselines

- Run history with status badges (completed/failed/stopped)
- Metrics comparison across runs
- Regression detection across releases

#### Data Models (8 New)

| Model | Purpose |
|-------|---------|
| PtApiCollection | API collection with base URL and auth config |
| PtApiEndpoint | Individual API endpoint (method, path, body template) |
| PtApiChain | Sequence of API steps forming a test flow |
| PtChainStep | Single step with extractors, assertions, variables |
| PtLoadScenario | Load test configuration (pattern, VU, ramp, SLA) |
| PtTestRun | Execution record with summary statistics |
| PtTestMetric | Per-second time-series metrics during a run |
| PtStepMetric | Per-API-step aggregated performance data |

---

## 6. AI Integration

### 6.1 Multi-Provider Architecture

```
┌──────────────────────────────────────┐
│         AI Provider Factory          │
│  ┌──────────┐  ┌──────────────────┐  │
│  │ Provider  │  │ Tracked Provider │  │
│  │ Selection │──│ (Usage Logging)  │  │
│  └──────────┘  └──────────────────┘  │
└────────┬─────────────────────────────┘
         │
    ┌────┼────┬────────┬──────────┬────────┐
    ▼    ▼    ▼        ▼          ▼        ▼
┌──────┐┌──────┐┌──────────┐┌──────────┐┌──────┐
│Claude││OpenAI││  Gemini  ││OpenRouter││Ollama│
└──────┘└──────┘└──────────┘└──────────┘└──────┘
```

### 6.2 AI Prompt Templates (25 Specialized Templates)

| # | Template | Module | Purpose |
|---|----------|--------|---------|
| 1 | Schema Design | Schema Intelligence | Generate table designs from requirements |
| 2 | Schema Review | Schema Intelligence | Review schema for best practices |
| 3 | Trigger Analysis | Schema Intelligence | Validate trigger logic |
| 4 | Schema Evolution Impact | Schema Intelligence | Analyze change impact |
| 5 | Natural Language to SQL | Query Intelligence | Convert English to SQL |
| 6 | Query Optimization | Query Intelligence | Optimize slow queries |
| 7 | Query Explanation | Query Intelligence | Explain SQL in plain English |
| 8 | Index Recommendation | Performance Lab | Suggest optimal indexes |
| 9 | Partition Recommendation | Performance Lab | Suggest partitioning strategies |
| 10 | Synthetic Data | Performance Lab | Generate test INSERT scripts |
| 11 | Query Planner Simulation | Performance Lab | Simulate execution plans |
| 12 | Data Distribution | Performance Lab | Simulate data statistics |
| 13 | Documentation Generator | DB Docs | Auto-generate docs |
| 14 | Migration Assessment | Migration Studio | Assess migration risks |
| 15 | Migration Script Generator | Migration Studio | Generate DDL/DML scripts |
| 16 | Column Mapping | Migration Studio | Suggest column mappings |
| 17 | Dialect Validation | Migration Studio | Validate SQL conversion |
| 18 | JPA Analysis | JPA Query Lab | Analyze Java persistence queries |
| 19 | AWR Analysis | AWR Analyzer | Analyze Oracle AWR reports |
| 20 | Incident Analysis | AWR Analyzer | Root cause analysis |
| 21 | DR Strategy | Disaster Recovery | Plan DR strategies |
| 22 | Cost Optimization | Cost Optimizer | Optimize cloud costs |
| 23 | Load Test Analysis | PT Suite | Analyze load test results for bottlenecks and capacity |
| 24 | Chain Design Review | PT Suite | Review API chain design for issues |
| 25 | Assertion Suggestions | PT Suite | Suggest assertions for API test steps |

### 6.3 AI Streaming

The AI chat interface uses **Server-Sent Events (SSE)** for real-time streaming responses, providing a ChatGPT-like experience with token-by-token output.

### 6.4 AI Usage Tracking

Every AI call is automatically tracked:
- **Token counts** — Input and output tokens per request
- **Cost calculation** — Based on provider pricing
- **Module attribution** — Which feature triggered the call
- **Budget enforcement** — Alerts when approaching limits

---

## 7. Database Support Matrix

| Database | Schema Design | Query Intelligence | Migration | Data Lifecycle | Connections |
|----------|:---:|:---:|:---:|:---:|:---:|
| PostgreSQL | Yes | Yes | Yes | Yes | Yes |
| MySQL | Yes | Yes | Yes | Yes | Yes |
| Oracle | Yes | Yes | Yes | Yes | Yes |
| SQL Server | Yes | Yes | Yes | Yes | Yes |
| MariaDB | Yes | Yes | Yes | Yes | Yes |
| Snowflake | Yes | Yes | Yes | — | — |
| BigQuery | Yes | Yes | Yes | — | — |
| MongoDB | Partial | — | Partial | — | — |

---

## 8. API Reference

### Base URL

```
http://localhost:3001/api/v1
```

### Route Groups (24 Total)

#### Project Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/projects` | Create project |
| GET | `/projects` | List projects (search, filter, sort) |
| GET | `/projects/stats/global` | Global statistics |
| GET | `/projects/:id` | Get project details |
| PATCH | `/projects/:id` | Update project |
| DELETE | `/projects/:id` | Archive project (soft delete) |
| GET | `/projects/:id/stats` | Project statistics |

#### Schema Intelligence
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/projects/:id/schema/tables` | List all tables |
| GET | `/projects/:id/schema/tables/:tableId` | Get table details |
| POST | `/projects/:id/schema/tables` | Create table |
| PUT | `/projects/:id/schema/tables/:tableId` | Update table |
| DELETE | `/projects/:id/schema/tables/:tableId` | Delete table |
| GET | `/projects/:id/schema/relationships` | Get relationships |
| GET | `/projects/:id/schema/er-diagram` | ER diagram data |
| POST | `/projects/:id/schema/parse` | Parse SQL file |
| GET | `/projects/:id/schema/snapshots` | List snapshots |
| POST | `/projects/:id/schema/snapshots` | Create snapshot |
| GET | `/projects/:id/schema/export` | Export DDL |
| GET | `/projects/:id/schema/schemas` | List namespaces |
| POST | `/projects/:id/schema/schemas` | Create namespace |
| PUT | `/projects/:id/schema/schemas/:name` | Rename namespace |
| DELETE | `/projects/:id/schema/schemas/:name` | Delete namespace |

#### Triggers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/projects/:id/schema/tables/:tableId/triggers` | List triggers |
| POST | `/projects/:id/schema/tables/:tableId/triggers` | Create trigger |
| PUT | `/projects/:id/schema/tables/:tableId/triggers/:triggerId` | Update trigger |
| DELETE | `/projects/:id/schema/tables/:tableId/triggers/:triggerId` | Delete trigger |
| PATCH | `/projects/:id/schema/tables/:tableId/triggers/:triggerId/toggle` | Toggle trigger |

#### Query Intelligence
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/projects/:id/queries/execute` | Execute SQL |
| GET | `/projects/:id/queries/history` | Execution history |
| GET | `/projects/:id/queries` | List saved queries |
| POST | `/projects/:id/queries` | Save query |
| GET | `/projects/:id/queries/:queryId` | Get saved query |
| PATCH | `/projects/:id/queries/:queryId` | Update query |
| DELETE | `/projects/:id/queries/:queryId` | Delete query |

#### AI Services
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ai/chat` | AI chat (SSE streaming) |
| POST | `/ai/schema/suggest` | Schema design suggestions |
| POST | `/ai/schema/review` | Schema review |
| POST | `/ai/schema/trigger-analysis` | Trigger analysis |
| POST | `/ai/schema/evolution-impact` | Schema change impact |
| POST | `/ai/query/generate` | NL to SQL |
| POST | `/ai/query/optimize` | Query optimization |
| POST | `/ai/query/explain` | Query explanation |
| POST | `/ai/performance/recommend-indexes` | Index recommendations |
| POST | `/ai/performance/recommend-partitions` | Partition recommendations |
| POST | `/ai/datagen/synthetic-scripts` | Synthetic data scripts |
| POST | `/ai/datagen/query-planner` | Execution plan simulation |
| POST | `/ai/datagen/data-distribution` | Data distribution simulation |
| POST | `/ai/docs/generate` | Documentation generation |
| POST | `/ai/migration/assess` | Migration risk assessment |
| POST | `/ai/migration/generate-scripts` | Migration scripts |
| POST | `/ai/migration/suggest-column-mapping` | Column mapping suggestions |
| POST | `/ai/migration/validate-conversion` | Validate conversion |

#### Database Connections
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/projects/:id/connections` | List connections |
| POST | `/projects/:id/connections` | Create connection |
| PATCH | `/projects/:id/connections/:connId` | Update connection |
| DELETE | `/projects/:id/connections/:connId` | Delete connection |
| POST | `/projects/:id/connections/:connId/test` | Test connection |
| POST | `/projects/:id/connections/:connId/query` | Run SQL query |
| GET | `/projects/:id/connections/:connId/introspect` | Introspect schema |

#### Data Lifecycle
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/projects/:id/data-lifecycle` | List rules |
| POST | `/projects/:id/data-lifecycle` | Create rule |
| GET | `/projects/:id/data-lifecycle/:ruleId` | Get rule |
| PATCH | `/projects/:id/data-lifecycle/:ruleId` | Update rule |
| DELETE | `/projects/:id/data-lifecycle/:ruleId` | Delete rule |
| POST | `/projects/:id/data-lifecycle/:ruleId/generate-purge-script` | Generate purge script |

#### Migration Studio
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/projects/:id/migrations/convert` | Convert SQL dialect |
| GET | `/projects/:id/migrations` | List migrations |
| POST | `/projects/:id/migrations` | Create migration |
| GET | `/projects/:id/migrations/:migId` | Get migration |
| PATCH | `/projects/:id/migrations/:migId` | Update migration |
| DELETE | `/projects/:id/migrations/:migId` | Delete migration |

#### Disaster Recovery
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/projects/:id/dr` | List DR assessments |
| POST | `/projects/:id/dr` | Create assessment |
| GET | `/projects/:id/dr/:assessId` | Get assessment |
| PATCH | `/projects/:id/dr/:assessId` | Update assessment |
| DELETE | `/projects/:id/dr/:assessId` | Delete assessment |
| POST | `/projects/:id/dr/:assessId/analyze` | AI DR analysis |

#### Cost Optimizer
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/projects/:id/cost-optimizer` | List assessments |
| POST | `/projects/:id/cost-optimizer` | Create assessment |
| GET | `/projects/:id/cost-optimizer/:assessId` | Get assessment |
| PATCH | `/projects/:id/cost-optimizer/:assessId` | Update assessment |
| DELETE | `/projects/:id/cost-optimizer/:assessId` | Delete assessment |
| POST | `/projects/:id/cost-optimizer/:assessId/analyze` | AI cost analysis |

#### AI Usage & Budget
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/ai-usage/summary` | Usage summary |
| GET | `/ai-usage/by-module` | Usage by module |
| GET | `/ai-usage/by-provider` | Usage by provider |
| GET | `/ai-usage/by-project` | Usage by project |
| GET | `/ai-usage/top-calls` | Most expensive calls |
| GET | `/ai-usage/trend` | Usage trends |
| GET | `/ai-usage/current-month` | Current month + budget |
| GET | `/ai-usage/budget` | List budgets |
| PUT | `/ai-usage/budget` | Set budget |
| DELETE | `/ai-usage/budget/:id` | Remove budget |

#### Audit Logs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/audit-logs` | List audit logs |
| GET | `/audit-logs/:logId` | Get audit log |
| POST | `/audit-logs/seed-demo` | Seed demo data |

#### Standalone Tools
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/tools/convert-sql` | SQL dialect conversion |
| POST | `/tools/validate-sql` | SQL validation |
| POST | `/tools/detect-dialect` | Dialect detection |
| POST | `/tools/jpa-analyze` | JPA analysis |
| POST | `/tools/jpa-parse` | Parse Java files |
| GET | `/tools/jpa-samples` | JPA sample files |
| POST | `/tools/jpa-batch-analyze` | Batch JPA analysis |

#### AWR Analyzer
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/tools/awr/parse` | Parse report |
| POST | `/tools/awr/detect-type` | Detect report type |
| POST | `/tools/awr/analyze` | AI analysis |
| POST | `/tools/awr/compare` | Compare reports |
| POST | `/tools/awr/incident-analyze` | Incident analysis |

#### Performance Testing Suite (PT Suite)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/pt-suite/swagger/parse` | Parse Swagger/OpenAPI spec |
| GET | `/pt-suite/collections` | List API collections |
| POST | `/pt-suite/collections` | Create collection |
| GET | `/pt-suite/collections/:id` | Get collection with endpoints |
| PUT | `/pt-suite/collections/:id` | Update collection |
| DELETE | `/pt-suite/collections/:id` | Delete collection |
| POST | `/pt-suite/collections/:id/endpoints` | Create endpoint |
| PUT | `/pt-suite/endpoints/:id` | Update endpoint |
| DELETE | `/pt-suite/endpoints/:id` | Delete endpoint |
| GET | `/pt-suite/chains` | List API chains |
| POST | `/pt-suite/chains` | Create chain |
| GET | `/pt-suite/chains/:id` | Get chain with steps |
| PUT | `/pt-suite/chains/:id` | Update chain |
| DELETE | `/pt-suite/chains/:id` | Delete chain |
| POST | `/pt-suite/chains/:id/steps` | Add step to chain |
| PUT | `/pt-suite/steps/:id` | Update step |
| DELETE | `/pt-suite/steps/:id` | Delete step |
| POST | `/pt-suite/chains/:id/reorder` | Reorder chain steps |
| POST | `/pt-suite/chains/:id/execute` | Execute chain (test run) |
| GET | `/pt-suite/scenarios` | List load scenarios |
| POST | `/pt-suite/scenarios` | Create scenario |
| PUT | `/pt-suite/scenarios/:id` | Update scenario |
| DELETE | `/pt-suite/scenarios/:id` | Delete scenario |
| POST | `/pt-suite/runs` | Start load test |
| GET | `/pt-suite/runs` | List test runs |
| GET | `/pt-suite/runs/:id` | Get run details |
| GET | `/pt-suite/runs/:id/stream` | SSE live metrics |
| POST | `/pt-suite/runs/:id/stop` | Stop running test |
| POST | `/pt-suite/runs/:id/report` | Generate AI report |
| GET | `/pt-suite/demo/seed` | Seed demo data |
| POST | `/pt-suite/ai/analyze-chain` | AI chain analysis |
| POST | `/pt-suite/ai/suggest-assertions` | AI assertion suggestions |

---

## 9. Data Model

### Entity Relationship Overview

```
Project (1) ──── (*) ProjectFile
    │                    │
    │                    └──── (1) FileParseResult
    │
    ├──── (*) SchemaSnapshot
    │
    ├──── (*) TableMetadata
    │         ├──── (*) ColumnMetadata
    │         ├──── (*) IndexMetadata
    │         ├──── (*) ConstraintMetadata
    │         ├──── (*) TriggerMetadata
    │         └──── (*) RelationshipMetadata
    │
    ├──── (*) SavedQuery
    ├──── (*) QueryExecution
    ├──── (*) PerformanceRun
    ├──── (*) Migration
    ├──── (*) ColumnMappingConfig
    ├──── (*) DataSheetMappingConfig
    ├──── (*) SavedDiagram
    ├──── (*) DataLifecycleRule
    ├──── (*) DatabaseConnection
    ├──── (*) AIConversation ──── (*) AIMessage
    ├──── (*) DRAssessment
    └──── (*) CostAssessment

PT Suite (Standalone):
    PtApiCollection (1) ──── (*) PtApiEndpoint
        │                         │
        └──── (*) PtApiChain      └──── (*) PtChainStep
                    │
                    └──── (*) PtLoadScenario
                                │
                                └──── (*) PtTestRun
                                          ├──── (*) PtTestMetric
                                          └──── (*) PtStepMetric

Standalone:
    AppSettings
    AIProviderConfig
    AuditLog
    AIUsageLog
    AIBudgetConfig
```

### Key Models (36 Total)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| Project | Workspace container | name, dialect, status, dbSchema |
| TableMetadata | Table definitions | tableName, schema, estimatedRows, description |
| ColumnMetadata | Column properties | columnName, dataType, nullable, isPrimaryKey |
| IndexMetadata | Index definitions | indexName, indexType, columns, isUnique |
| ConstraintMetadata | Constraints | constraintName, type (PK/FK/UNIQUE/CHECK) |
| RelationshipMetadata | FK relationships | sourceTable, targetTable, type |
| TriggerMetadata | Triggers | triggerName, event, timing, body, enabled |
| SavedQuery | SQL queries | name, sql, dialect, description |
| QueryExecution | Execution history | sql, durationMs, rowCount, status |
| DatabaseConnection | Live DB connections | host, port, database, dialect, ssl |
| DataLifecycleRule | Retention policies | tableName, retentionDays, action, priority |
| Migration | Migration records | name, sourceDialect, targetDialect, status |
| AIConversation | Chat sessions | title, module, projectId |
| AIUsageLog | Token tracking | provider, model, inputTokens, outputTokens, cost |
| AIBudgetConfig | Budget limits | monthlyBudget, alertThreshold |
| AuditLog | Activity audit | method, endpoint, statusCode, userId |
| DRAssessment | DR evaluations | title, rtoMinutes, rpoMinutes |
| CostAssessment | Cost evaluations | title, currentMonthlyCost |
| PtApiCollection | API test collection | name, baseUrl, swaggerSpec, authConfig |
| PtApiEndpoint | API endpoint definition | method, path, bodyTemplate, headers |
| PtApiChain | API test flow sequence | name, collectionId, description |
| PtChainStep | Chain step with extractors | method, url, extractors, assertions |
| PtLoadScenario | Load test configuration | pattern, peakVU, rampUpSec, slaThresholds |
| PtTestRun | Load test execution | status, avgLatencyMs, p95, p99, peakTps |
| PtTestMetric | Per-second metrics | activeVU, tps, avgLatencyMs, errorCount |
| PtStepMetric | Per-step aggregated data | stepName, totalCalls, avgLatencyMs, errors |

---

## 10. Security & Compliance

### Security Measures

| Feature | Implementation |
|---------|---------------|
| **Security Headers** | Helmet.js with CSP, HSTS, X-Frame-Options |
| **CORS** | Origin whitelisting via `CORS_ORIGIN` |
| **Rate Limiting** | Express rate limiter on all endpoints |
| **Input Validation** | Zod schemas on all request bodies |
| **SQL Injection Prevention** | Prisma parameterized queries |
| **Encryption at Rest** | AES-256-GCM for sensitive data |
| **Audit Logging** | Automatic logging of all mutations |
| **File Upload Validation** | Size limits, type checking |

### Compliance Support

- **PCI DSS** — Encrypted credential storage, audit trails
- **GDPR** — Data lifecycle management, retention policies, data masking
- **SOC 2** — Complete audit logging, access controls
- **HIPAA** — Data classification and encryption capabilities

---

## 11. Installation Guide

### 11.1 Prerequisites

| Requirement | Minimum Version |
|------------|----------------|
| Node.js | 18.x or higher |
| pnpm | 8.x or higher |
| PostgreSQL | 16 (production) |
| Git | 2.x |

### 11.2 Local Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/nileshpardeshi/Aqua_DB_Assistant.git
cd Aqua_DB_Assistant

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example server/.env

# 4. Edit server/.env with your settings:
#    - DATABASE_URL (SQLite for dev, PostgreSQL for prod)
#    - ANTHROPIC_API_KEY (required for AI features)
#    - ENCRYPTION_KEY (32+ character secret)

# 5. Initialize database
cd server && npx prisma db push && cd ..

# 6. Start development servers
pnpm dev
```

**Access Points:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001/api/v1
- Health Check: http://localhost:3001/health

### 11.3 Docker Setup (On-Premises)

```bash
# 1. Start PostgreSQL
docker-compose up -d

# 2. Wait for database to be healthy
docker-compose ps  # Should show "healthy"

# 3. Configure environment
cp .env.example server/.env
# Set DATABASE_URL=postgresql://aqua_user:aqua_password_123@localhost:5432/aqua_db_copilot

# 4. Run migrations
cd server && npx prisma migrate deploy && cd ..

# 5. Start application
pnpm dev
```

### 11.4 Full Docker Deployment

```bash
# Build the application image
docker build -t aqua-db-copilot .

# Run with docker-compose (includes PostgreSQL)
docker-compose up -d

# Run the app container
docker run -d \
  --name aqua-db-copilot \
  --network host \
  -e DATABASE_URL=postgresql://aqua_user:aqua_password_123@localhost:5432/aqua_db_copilot \
  -e ANTHROPIC_API_KEY=your-key \
  -e ENCRYPTION_KEY=your-32-char-key \
  -e NODE_ENV=production \
  -p 3001:3001 \
  aqua-db-copilot
```

---

## 12. Configuration Reference

### Environment Variables

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `PORT` | No | `3001` | Server port |
| `NODE_ENV` | No | `development` | Environment mode |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed CORS origin |
| `DATABASE_URL` | Yes | `file:./dev.db` | Database connection string |
| `ENCRYPTION_KEY` | Yes | — | 32+ character encryption key |
| `DEFAULT_AI_PROVIDER` | No | `anthropic` | Default AI provider |
| `ANTHROPIC_API_KEY` | Yes* | — | Anthropic Claude API key |
| `OPENAI_API_KEY` | No | — | OpenAI API key |
| `GOOGLE_GEMINI_API_KEY` | No | — | Google Gemini API key |
| `OPENROUTER_API_KEY` | No | — | OpenRouter API key |
| `OLLAMA_BASE_URL` | No | `http://localhost:11434` | Ollama local endpoint |
| `UPLOAD_DIR` | No | `./uploads` | File upload directory |
| `MAX_FILE_SIZE_MB` | No | `50` | Max upload size (MB) |
| `LOG_LEVEL` | No | `info` | Log verbosity |

*Required if using AI features with Anthropic provider

### Database URL Formats

```bash
# SQLite (development)
DATABASE_URL=file:./dev.db

# PostgreSQL (production)
DATABASE_URL=postgresql://user:password@host:5432/database?schema=public

# PostgreSQL with SSL
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
```

---

## 13. Deployment Guide

### 13.1 Cloud Deployment (AWS)

#### Architecture

```
┌────────────────────────────────────────┐
│              AWS Cloud                  │
│                                        │
│  ┌──────────┐     ┌────────────────┐   │
│  │CloudFront│────>│ S3 Bucket      │   │
│  │(CDN)     │     │ (React Build)  │   │
│  └──────────┘     └────────────────┘   │
│                                        │
│  ┌──────────┐     ┌────────────────┐   │
│  │ALB       │────>│ ECS/Fargate    │   │
│  │(Load Bal)│     │ (Express.js)   │   │
│  └──────────┘     └────────────────┘   │
│                          │             │
│                   ┌──────┴───────┐     │
│                   │ RDS          │     │
│                   │ PostgreSQL 16│     │
│                   └──────────────┘     │
└────────────────────────────────────────┘
```

#### Steps

1. **Database:** Create RDS PostgreSQL 16 instance
   - Minimum: `db.t3.medium` (2 vCPU, 4 GB RAM)
   - Enable Multi-AZ for production
   - Enable automated backups

2. **Backend:** Deploy to ECS/Fargate or EC2
   ```bash
   # Build Docker image
   docker build -t aqua-db-copilot .

   # Push to ECR
   aws ecr create-repository --repository-name aqua-db-copilot
   docker tag aqua-db-copilot:latest <account>.dkr.ecr.<region>.amazonaws.com/aqua-db-copilot
   docker push <account>.dkr.ecr.<region>.amazonaws.com/aqua-db-copilot
   ```

3. **Frontend:** Deploy to S3 + CloudFront
   ```bash
   cd client && pnpm build
   aws s3 sync dist/ s3://aqua-db-copilot-frontend/
   ```

4. **Environment:** Set variables in ECS task definition or EC2 parameter store

#### Alternative Cloud Platforms

| Platform | Frontend | Backend | Database |
|----------|----------|---------|----------|
| **AWS** | S3 + CloudFront | ECS/Fargate | RDS PostgreSQL |
| **Azure** | Static Web Apps | App Service | Azure DB for PostgreSQL |
| **GCP** | Cloud Storage + CDN | Cloud Run | Cloud SQL PostgreSQL |
| **Vercel + Railway** | Vercel | Railway | Railway PostgreSQL |
| **Render** | Render Static | Render Web Service | Render PostgreSQL |

### 13.2 On-Premises Deployment

#### Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8+ GB |
| Storage | 20 GB SSD | 100+ GB SSD |
| Network | 100 Mbps | 1 Gbps |

#### Steps

1. **Install prerequisites:**
   ```bash
   # Install Node.js 20+
   curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
   apt-get install -y nodejs

   # Install pnpm
   npm install -g pnpm

   # Install PostgreSQL 16
   apt-get install -y postgresql-16
   ```

2. **Configure PostgreSQL:**
   ```sql
   CREATE USER aqua_user WITH PASSWORD 'your-secure-password';
   CREATE DATABASE aqua_db_copilot OWNER aqua_user;
   GRANT ALL PRIVILEGES ON DATABASE aqua_db_copilot TO aqua_user;
   ```

3. **Deploy application:**
   ```bash
   # Clone and build
   git clone https://github.com/nileshpardeshi/Aqua_DB_Assistant.git
   cd Aqua_DB_Assistant
   pnpm install
   cd client && pnpm build && cd ..
   cd server && npx prisma migrate deploy && pnpm build && cd ..

   # Configure environment
   cp .env.example server/.env
   # Edit with production values
   ```

4. **Run with process manager:**
   ```bash
   # Install PM2
   npm install -g pm2

   # Start server
   pm2 start server/dist/index.js --name aqua-db-copilot

   # Enable startup on reboot
   pm2 startup
   pm2 save
   ```

5. **Reverse proxy (Nginx):**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       # Frontend (static files)
       location / {
           root /path/to/Aqua_DB_Assistant/client/dist;
           try_files $uri $uri/ /index.html;
       }

       # Backend API
       location /api/ {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }

       # SSE (AI streaming)
       location /api/v1/ai/chat {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Connection '';
           proxy_buffering off;
           proxy_cache off;
       }
   }
   ```

#### Air-Gapped Deployment (No Internet)

For environments without internet access:

1. Use **Ollama** as the AI provider (runs locally)
2. Pre-download all npm packages on an internet-connected machine
3. Transfer the entire `node_modules` directory via secure media
4. Set `DEFAULT_AI_PROVIDER=ollama` and `OLLAMA_BASE_URL=http://localhost:11434`
5. Install desired Ollama models: `ollama pull llama3` or `ollama pull codellama`

---

## 14. Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|---------|
| Database connection timeout | PostgreSQL not started | Server auto-retries 30 times (60s). Start PostgreSQL first. |
| AI features not working | Missing API key | Set `ANTHROPIC_API_KEY` in `server/.env` |
| CORS errors | Origin mismatch | Set `CORS_ORIGIN` to your frontend URL |
| File upload fails | Size limit exceeded | Increase `MAX_FILE_SIZE_MB` |
| Prisma schema drift | Schema out of sync | Run `npx prisma migrate deploy` |
| Port already in use | Another process | Kill process on port 3001 or change `PORT` |
| SSE streaming not working | Proxy buffering | Disable proxy buffering for `/api/v1/ai/chat` |

### Health Check

```bash
curl http://localhost:3001/health
# Expected: {"status":"ok","timestamp":"..."}
```

### Logs

```bash
# Server logs (development)
pnpm dev:server

# Production logs with PM2
pm2 logs aqua-db-copilot
```

---

## Appendix: Project Structure

```
Aqua_DB_Assistant/
├── client/                          # React Frontend Application
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/              # App shell (sidebar, header)
│   │   │   ├── schema/              # Schema explorer, table detail panel
│   │   │   ├── er-diagram/          # React Flow ER diagram components
│   │   │   ├── query/               # SQL editor, results, history
│   │   │   ├── performance/         # Index advisor, benchmarks, data gen
│   │   │   ├── datagen/             # Synthetic data generation tabs
│   │   │   ├── migration/           # Migration planner, converter, mapping
│   │   │   ├── data-lifecycle/      # Retention rules, purge scripts
│   │   │   ├── ai-usage/            # Usage charts, budget management
│   │   │   ├── awr/                 # AWR report analysis
│   │   │   ├── project/             # Project creation dialog
│   │   │   └── shared/              # AI chat, command palette, uploads
│   │   ├── pages/                   # 21 route pages
│   │   ├── hooks/                   # 28 TanStack Query hooks
│   │   ├── stores/                  # Zustand state stores
│   │   ├── lib/                     # API client, utilities
│   │   └── router/                  # React Router configuration
│   └── public/                      # Static assets
├── server/                          # Express.js Backend
│   ├── prisma/
│   │   ├── schema.prisma            # 28 models, 391+ lines
│   │   └── migrations/              # Database migration history
│   └── src/
│       ├── config/                  # Environment, logger, Prisma client
│       ├── routes/                  # 23 route group files
│       ├── controllers/             # Request handlers
│       ├── services/                # Business logic
│       │   ├── ai/
│       │   │   ├── ai-provider.factory.ts
│       │   │   ├── tracked-ai-provider.ts
│       │   │   └── prompt-templates/  # 22 specialized AI prompts
│       │   └── sql-parser/          # SQL parsing pipeline
│       ├── middleware/              # Auth, audit, error handling
│       └── validators/             # Zod input validation schemas
├── shared/                         # Shared types and constants
├── docker-compose.yml              # PostgreSQL 16 setup
├── Dockerfile                      # Multi-stage production build
└── docs/                           # Documentation
```

---

<p align="center">
  <strong>Aqua DB Copilot</strong> v1.0.0<br/>
  Designed and developed by Nilesh Pardeshi<br/>
  Technical Manager | Opus Technologies, Pune<br/>
  <br/>
  <em>"Your Intelligent Database Engineering Partner"</em>
</p>
