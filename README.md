<p align="center">
  <img src="logo/logo.jpg" alt="Aqua DB Copilot" width="200" />
</p>

<h1 align="center">Aqua DB Copilot</h1>
<h3 align="center">Your Intelligent Database Engineering Partner</h3>

<p align="center">
  <strong>AI-Powered Database Engineering Platform for Enterprise Teams</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Express.js-4.x-000000?logo=express" alt="Express" />
  <img src="https://img.shields.io/badge/Prisma-6.x-2D3748?logo=prisma" alt="Prisma" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/AI-Multi--Provider-6B4FBB" alt="AI" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
</p>

---

## Overview

**Aqua DB Copilot** is an enterprise-grade AI Database Engineering Platform designed for teams working on large-scale systems such as banking, payment processing, and card management platforms. It assists developers and architects in designing databases, visualizing schemas, optimizing queries, managing data lifecycle, and planning database migrations — all powered by multi-provider AI.

The platform supports databases containing **millions to billions of records** and operates under a **Project Workspace model** where all features are project-centric.

### Platform Statistics

| Metric | Count |
|--------|-------|
| Frontend Pages | 21 |
| API Endpoints | 53+ across 23 route groups |
| Database Models | 28 Prisma models |
| AI Prompt Templates | 22 specialized templates |
| Supported Databases | 8 dialects |
| AI Providers | 5 (Anthropic, OpenAI, Gemini, OpenRouter, Ollama) |
| Custom React Hooks | 28 |
| Frontend Components | 53+ |

---

## Key Features

### 1. Project Workspace & Dashboard

- Create and manage database projects with multi-dialect support
- **Enterprise Dashboard** with KPI cards, quality radar charts, and operations command center
- Auto-detected schema issues and risks (missing PKs, unindexed tables, high nullable ratios)
- Contextual AI-powered recommendations engine
- Activity timeline with audit trail
- Upload SQL/DDL files or design from scratch with AI assistance

### 2. Schema Intelligence

- **Schema Explorer** — Tree/table view of all database objects
- **Table Detail Panel** — Columns, indexes, constraints, triggers, relationships
- **Inline Editing** — Edit descriptions, estimated row counts, and metadata
- **Schema Parsing** — Upload SQL/DDL files with auto-extraction
- **Schema Snapshots** — Version and compare schema states
- **Schema Export** — Generate DDL scripts for any dialect
- **Trigger Management** — Full CRUD with enable/disable toggle
- **Schema Namespace Management** — Create and manage PostgreSQL schemas
- **AI Schema Review** — Design review and best-practice suggestions
- **Schema Evolution Impact Analysis** — AI-powered change impact assessment

### 3. Diagram Studio

- **Interactive ER Diagrams** via React Flow with drag-and-drop
- **Multiple Layout Algorithms** — Dagre (top-down, left-right), force-directed
- **Rich Table Nodes** — Columns, types, PK/FK indicators, nullable markers
- **Relationship Edges** — FK connections with cardinality labels
- **Save & Load** — Persist custom diagram layouts
- **Export** — PNG/SVG diagram export
- **Multiple Diagram Types** — ER, dependency, and custom diagrams

### 4. Query Intelligence

- **AI-Enhanced SQL Editor** — Syntax highlighting, auto-complete, multi-tab
- **Query Execution** — Run against connected databases with result tables
- **Query History** — Execution log with duration and row counts
- **Saved Queries** — Save, organize, and manage SQL queries
- **Schema Reference Panel** — Quick table/column lookup while writing SQL
- **AI Natural Language to SQL** — Describe what you want, get SQL
- **AI Query Optimization** — Performance improvement suggestions
- **AI Query Explanation** — Explain complex queries in plain English
- **Query Templates** — Pre-built templates for common patterns

### 5. Performance Lab

- **Index Advisor** — AI-recommended indexes based on schema and query patterns
- **Partition Advisor** — Table partitioning strategy recommendations
- **Query Benchmark** — Compare performance across configurations
- **Health Dashboard** — Database health metrics and trends
- **Synthetic Data Generator** — Generate 1K to 100M+ rows with referential integrity
  - AI-generated INSERT scripts respecting constraints
  - Data distribution simulation
  - Query plan simulation for load testing
- **In-Memory Sandbox** — Test generated data safely

### 6. DB Documentation Generator

- **AI-Powered Generation** — Comprehensive docs from schema metadata
- **Multiple Formats** — HTML, Markdown, and structured output
- **Complete Coverage** — Tables, columns, relationships, indexes, constraints

### 7. Data Lifecycle Management

- **Retention Policy Editor** — Rules per table (archive, delete, mask, anonymize)
- **Multi-Dialect Purge Script Generator** — PostgreSQL, MySQL, Oracle, SQL Server
  - Batch size configuration and dry-run mode
- **Data Classification** — Categorize tables by sensitivity
- **Execution History** — Track purge/archive operations
- **GDPR/Compliance Support** — Data retention and masking for regulatory compliance

### 8. Migration Studio

- **Dialect Converter** — Convert SQL between 8 database dialects
  - Automatic data type, index, constraint, and trigger translation
- **Schema Comparison** — Visual diff between source and target
- **Column Mapping Editor** — Drag-and-drop column-level mapping
- **Migration Planner** — Step-by-step planning wizard with dependency tracking
- **AI Migration Scripts** — Generated DDL and DML with risk assessment
- **Migration Timeline** — Track progress and execution history
- **Migration Reports** — Validation with row count and checksum verification
- **CSV Data Import** — Import CSV with visual column mapping

### 9. Disaster Recovery (DR) Strategy

- **DR Assessments** — Create and manage DR evaluations per project
- **AI-Powered Analysis** — RTO/RPO recommendations, backup strategies
- **Recovery Runbooks** — Failover procedures and replication topology
- **Assessment History** — Track DR planning evolution

### 10. Cost Optimizer

- **Cost Assessments** — Evaluate current database spending
- **AI Cost Analysis** — Right-sizing, reserved instance analysis, storage optimization
- **Multi-Cloud Support** — AWS, Azure, GCP cost comparison
- **Connection Pooling** — Recommendations for connection management

### 11. SQL Converter (Standalone Tool)

- **8 Dialect Support** — PostgreSQL, MySQL, Oracle, SQL Server, MariaDB, Snowflake, BigQuery, MongoDB
- **Bidirectional Conversion** — Any source to any target
- **Auto-Detect Dialect** — Schema detection from SQL input
- **Syntax Validation** — Validate converted SQL

### 12. JPA Query Lab

- **JPA/JPQL/HQL Analysis** — Parse and analyze Java persistence queries
- **N+1 Detection** — Identify N+1 query anti-patterns
- **Performance Recommendations** — Fetch strategy optimization
- **Batch Analysis** — Analyze multiple queries simultaneously
- **Sample Files** — Pre-loaded JPA examples

### 13. AWR Report Analyzer

- **Report Parsing** — AWR, ASH, and ADDM report analysis
- **Type Detection** — Auto-detect report format
- **AI Analysis** — Deep performance analysis with recommendations
- **Report Comparison** — Before/after comparison
- **Incident Time Machine** — Multi-source root cause analysis with timeline reconstruction

### 14. AI Usage Dashboard

- **Usage Metrics** — Total tokens, cost, API calls
- **Breakdown Views** — By module, by provider, by project
- **Top Calls** — Most expensive individual API calls
- **Usage Trends** — Time-series usage charts
- **Budget Management** — Monthly/weekly budgets with alert thresholds
- **Per-Provider Budgets** — Independent limits per AI provider

### 15. Audit & Compliance

- **Automatic Logging** — All mutating API requests logged automatically
- **Searchable Audit Viewer** — Filter by method, endpoint, status, timestamp
- **AES-256-GCM Encryption** — Sensitive audit data encrypted at rest
- **PCI DSS & GDPR Support** — Enterprise compliance capabilities

### 16. Database Connections

- **Connection Management** — Store and manage database credentials securely
- **Connection Testing** — Verify connectivity with latency measurement
- **Schema Introspection** — Discover schemas and tables from live databases
- **Live Query Execution** — Run SQL directly against connected databases

### 17. AI Copilot Chat

- **Floating AI Assistant** — Available from any page
- **SSE Streaming** — Real-time token-by-token responses
- **Context-Aware** — Understands your project's schema and queries
- **Multi-Provider** — Switch between Anthropic, OpenAI, Gemini, OpenRouter, Ollama

### 18. Settings & Configuration

- **AI Provider Configuration** — API keys, model selection, parameters
- **Application Settings** — General platform preferences
- **LLM Configuration** — Fine-tune AI behavior per use case

---

## Supported Databases

| Database | Schema Design | Query Intelligence | Migration | Data Lifecycle | Live Connections |
|----------|:---:|:---:|:---:|:---:|:---:|
| PostgreSQL | ✅ | ✅ | ✅ | ✅ | ✅ |
| MySQL | ✅ | ✅ | ✅ | ✅ | ✅ |
| Oracle | ✅ | ✅ | ✅ | ✅ | ✅ |
| SQL Server | ✅ | ✅ | ✅ | ✅ | ✅ |
| MariaDB | ✅ | ✅ | ✅ | ✅ | ✅ |
| Snowflake | ✅ | ✅ | ✅ | — | — |
| BigQuery | ✅ | ✅ | ✅ | — | — |
| MongoDB | Partial | — | Partial | — | — |

---

## AI Integration

### Multi-Provider Architecture

Aqua DB Copilot supports **5 AI providers** with automatic usage tracking and budget management:

| Provider | Models | Use Case |
|----------|--------|----------|
| **Anthropic** | Claude 3.5 Sonnet, Claude 4 | Primary (recommended) |
| **OpenAI** | GPT-4o, GPT-4 | Alternative |
| **Google Gemini** | Gemini Pro | Alternative |
| **OpenRouter** | Multiple models | Multi-model router |
| **Ollama** | Llama 3, CodeLlama, etc. | Local/air-gapped |

### 22 Specialized AI Prompt Templates

| Category | Templates |
|----------|-----------|
| **Schema Intelligence** | Schema Design, Schema Review, Trigger Analysis, Evolution Impact |
| **Query Intelligence** | NL to SQL, Query Optimization, Query Explanation |
| **Performance Lab** | Index Recommendation, Partition Recommendation, Synthetic Data, Query Plan Simulation, Data Distribution |
| **Documentation** | Auto-Documentation Generator |
| **Migration Studio** | Risk Assessment, Script Generation, Column Mapping, Dialect Validation |
| **Analytics** | JPA Analysis, AWR Analysis, Incident Analysis |
| **Strategy** | DR Strategy, Cost Optimization |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite, TypeScript, Tailwind CSS v4 |
| **State Management** | Zustand (UI) + TanStack Query (Server State) |
| **ER Diagrams** | React Flow + Dagre Auto-Layout |
| **Charts** | Recharts |
| **Backend** | Express.js, TypeScript (ESM) |
| **ORM** | Prisma 6.x with multiSchema |
| **Database** | PostgreSQL 16 (production) / SQLite (development) |
| **AI Integration** | Anthropic Claude, OpenAI, Gemini, OpenRouter, Ollama |
| **SQL Parsing** | node-sql-parser |
| **Security** | Helmet, CORS, Rate Limiting, AES-256-GCM |
| **Process Manager** | PM2 (production) |
| **Containerization** | Docker with multi-stage build |

---

## Quick Start

### Prerequisites
- **Node.js** >= 18.x
- **pnpm** >= 8.x (`npm install -g pnpm`)

### Installation

```bash
# Clone the repository
git clone https://github.com/nileshpardeshi/Aqua_DB_Assistant.git
cd Aqua_DB_Assistant

# Install dependencies
pnpm install

# Set up environment
cp .env.example server/.env
# Edit server/.env and add your AI API key and encryption key

# Initialize database (SQLite for development)
cd server && npx prisma db push && cd ..

# Start development servers
pnpm dev
```

The application will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001/api/v1
- **Health Check**: http://localhost:3001/health

### Running with PostgreSQL (Production)

```bash
# Start PostgreSQL via Docker
docker-compose up -d

# Set DATABASE_URL in server/.env:
# DATABASE_URL=postgresql://aqua_user:aqua_password_123@localhost:5432/aqua_db_copilot

# Run migrations
cd server && npx prisma migrate deploy && cd ..

# Start servers
pnpm dev
```

### Running Individually

```bash
pnpm dev:server   # Backend on port 3001
pnpm dev:client   # Frontend on port 5173
```

---

## Deployment

### Cloud Deployment

| Platform | Frontend | Backend | Database |
|----------|----------|---------|----------|
| **AWS** | S3 + CloudFront | ECS/Fargate | RDS PostgreSQL |
| **Azure** | Static Web Apps | App Service | Azure DB for PostgreSQL |
| **GCP** | Cloud Storage + CDN | Cloud Run | Cloud SQL PostgreSQL |
| **Vercel + Railway** | Vercel | Railway | Railway PostgreSQL |
| **Render** | Render Static | Render Web Service | Render PostgreSQL |

### Docker Deployment

```bash
# Build production image
docker build -t aqua-db-copilot .

# Run with environment variables
docker run -d \
  -e DATABASE_URL=postgresql://... \
  -e ANTHROPIC_API_KEY=your-key \
  -e ENCRYPTION_KEY=your-32-char-key \
  -p 3001:3001 \
  aqua-db-copilot
```

### On-Premises / Air-Gapped

For environments without internet:
1. Use **Ollama** as the AI provider (runs locally)
2. Set `DEFAULT_AI_PROVIDER=ollama`
3. Install models: `ollama pull llama3`
4. See [Product Documentation](docs/PRODUCT_DOCUMENTATION.md) for full on-prem guide

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `PORT` | No | `3001` | Server port |
| `NODE_ENV` | No | `development` | Environment |
| `DATABASE_URL` | Yes | `file:./dev.db` | Database connection |
| `ENCRYPTION_KEY` | Yes | — | 32+ char secret |
| `DEFAULT_AI_PROVIDER` | No | `anthropic` | AI provider |
| `ANTHROPIC_API_KEY` | Yes* | — | Claude API key |
| `OPENAI_API_KEY` | No | — | OpenAI API key |
| `OLLAMA_BASE_URL` | No | `http://localhost:11434` | Ollama endpoint |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed origin |
| `MAX_FILE_SIZE_MB` | No | `50` | Upload limit |

---

## Project Structure

```
Aqua_DB_Assistant/
├── client/                          # React Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/              # App shell (sidebar, header)
│   │   │   ├── schema/              # Schema explorer, table detail
│   │   │   ├── er-diagram/          # React Flow ER diagrams
│   │   │   ├── query/               # SQL editor, results, history
│   │   │   ├── performance/         # Index advisor, benchmarks
│   │   │   ├── datagen/             # Synthetic data generation
│   │   │   ├── migration/           # Migration planner, converter
│   │   │   ├── data-lifecycle/      # Retention rules, purge scripts
│   │   │   ├── ai-usage/            # Usage charts, budgets
│   │   │   ├── awr/                 # AWR report analysis
│   │   │   ├── project/             # Project creation
│   │   │   └── shared/              # AI chat, command palette
│   │   ├── pages/                   # 21 route pages
│   │   ├── hooks/                   # 28 custom React hooks
│   │   ├── stores/                  # Zustand state stores
│   │   ├── lib/                     # API client, utilities
│   │   └── router/                  # React Router config
│   └── public/
├── server/                          # Express.js Backend
│   ├── prisma/
│   │   ├── schema.prisma            # 28 models
│   │   └── migrations/
│   └── src/
│       ├── config/                  # Env, logger, Prisma
│       ├── routes/                  # 23 route groups
│       ├── controllers/             # Request handlers
│       ├── services/
│       │   ├── ai/
│       │   │   ├── prompt-templates/  # 22 AI prompts
│       │   │   ├── ai-provider.factory.ts
│       │   │   └── tracked-ai-provider.ts
│       │   └── sql-parser/
│       ├── middleware/              # Auth, audit, errors
│       └── validators/             # Zod schemas
├── shared/                         # Shared types
├── docker-compose.yml              # PostgreSQL setup
├── Dockerfile                      # Multi-stage build
└── docs/                           # Documentation
    └── PRODUCT_DOCUMENTATION.md    # Full product documentation
```

---

## Documentation

- [Product Documentation](docs/PRODUCT_DOCUMENTATION.md) — Comprehensive feature details, architecture, API reference, and deployment guides
- [Implementation Plan](DbImplementationPlan.md) — Original development roadmap

---

## Author & Creator

<p align="center">
  <img src="creatorProfile/nileshpardeshi.png" alt="Nilesh Pardeshi" width="120" />
</p>

**Nilesh Pardeshi**
*Technical Manager | Opus Technologies, Pune*

Seasoned Technical Manager with 15+ years of experience in software engineering, specializing in AI-driven automation, quality engineering, and enterprise solutions. Passionate about leveraging cutting-edge technologies to solve real-world problems.

- **LinkedIn**: [linkedin.com/in/nileshpardeshi](https://www.linkedin.com/in/nileshpardeshi/)
- **Email**: contactaquaai@gmail.com
- **Mobile**: +91-9762017007

---

## License

MIT License

---

<p align="center">
  <strong>Aqua DB Copilot</strong> — Designed for enterprise database teams who demand intelligence, speed, and reliability.
</p>
