# Aqua DB Copilot - Business Requirements Document (BRD)

---

## Document Control

| Field            | Details                                      |
|------------------|----------------------------------------------|
| **Document ID**  | AQUA-BRD-001                                 |
| **Version**      | 1.0                                          |
| **Date**         | March 12, 2026                               |
| **Author**       | Nilesh Pardeshi, Technical Manager           |
| **Organization** | Opus Technologies, Pune                      |
| **Status**       | Approved                                     |
| **Classification** | Internal - Confidential                    |

### Revision History

| Version | Date           | Author           | Description                          |
|---------|----------------|------------------|--------------------------------------|
| 0.1     | January 5, 2026  | Nilesh Pardeshi | Initial draft                        |
| 0.5     | February 10, 2026 | Nilesh Pardeshi | Added functional requirements        |
| 0.8     | February 28, 2026 | Nilesh Pardeshi | Added NFRs, security, deployment     |
| 1.0     | March 12, 2026   | Nilesh Pardeshi | Final review and approval            |

---

## 1. Executive Summary

**Aqua DB Copilot** is an enterprise-grade, AI-powered database engineering platform designed to revolutionize the way database engineers, architects, and DevOps professionals interact with and manage their database ecosystems. The platform provides an integrated suite of intelligent tools spanning schema design, query optimization, performance analysis, migration management, and data lifecycle governance.

Leveraging state-of-the-art Large Language Models (LLMs) from providers such as Anthropic Claude, OpenAI GPT, and local models via Ollama, Aqua DB Copilot transforms natural language instructions into production-ready database operations. The platform supports a comprehensive matrix of database engines including PostgreSQL, MySQL, Oracle, SQL Server, MariaDB, Snowflake, BigQuery, and MongoDB, making it a universal solution for heterogeneous database environments.

The primary goal is to reduce database engineering effort by up to 60%, minimize human error in schema design and migrations, and provide actionable AI-driven insights for performance optimization. This translates directly to reduced operational costs, faster time-to-market for data-driven applications, and improved database reliability across the organization.

---

## 2. Business Objectives

| ID     | Objective                                                                 | Priority | Success Metric                                |
|--------|---------------------------------------------------------------------------|----------|-----------------------------------------------|
| BO-001 | Accelerate database schema design and iteration cycles                    | High     | 60% reduction in schema design time           |
| BO-002 | Reduce SQL query writing and optimization effort through AI assistance    | High     | 50% faster query development                  |
| BO-003 | Provide automated performance analysis and actionable recommendations     | High     | 40% improvement in query performance           |
| BO-004 | Streamline database migration planning and execution                      | Medium   | 70% reduction in migration-related incidents   |
| BO-005 | Enable compliance-ready data lifecycle management                          | Medium   | 100% audit trail coverage                     |
| BO-006 | Support multi-database dialect operations from a single platform           | High     | 8+ database engines supported                 |
| BO-007 | Reduce database-related production incidents                               | High     | 50% reduction in downtime                     |
| BO-008 | Provide enterprise-grade security and access control                       | High     | SOC2/GDPR compliance readiness                |

---

## 3. Stakeholders

| Stakeholder             | Role                           | Interest / Responsibility                                          |
|-------------------------|--------------------------------|--------------------------------------------------------------------|
| Database Engineers      | Primary Users                  | Schema design, query writing, performance tuning                    |
| Database Architects     | Power Users                    | Architecture decisions, migration planning, cross-dialect design    |
| DevOps Engineers        | Secondary Users                | Deployment, monitoring, connection management                       |
| QA Engineers            | Occasional Users               | Test data generation, query validation                              |
| Engineering Managers    | Decision Makers                | ROI tracking, team productivity metrics                             |
| CTO / VP Engineering    | Executive Sponsor              | Strategic alignment, budget approval                                |
| Security / Compliance   | Reviewers                      | Audit logging, data protection, access control                      |
| Product Management      | Stakeholders                   | Feature prioritization, roadmap alignment                           |

---

## 4. Scope

### 4.1 In-Scope

The following modules and capabilities are included in the scope of Aqua DB Copilot:

1. **Project Workspace** - Multi-project management with dialect-specific configurations
2. **Schema Intelligence** - AI-powered schema design, analysis, ER diagrams, and SQL parsing
3. **Query Intelligence** - AI-assisted query writing, optimization, and execution
4. **Performance Lab** - Synthetic data generation, query benchmarking, index advisory, and performance comparison
5. **Migration Studio** - Migration planning, SQL generation, version tracking, and rollback management
6. **Data Lifecycle Management** - Data retention policies, archival strategies, compliance rules, and PII detection
7. **AI Integration** - Multi-provider AI support (Anthropic, OpenAI, Ollama) with configurable models
8. **Security and Compliance** - Role-based access control, audit logging, encryption, and compliance reporting
9. **Database Health Dashboard** - Real-time health scoring, connection pool monitoring, and storage analysis
10. **Cross-Platform Deployment** - Docker containerization, cloud deployment (Vercel + Railway/Render)

### 4.2 Out of Scope

The following items are explicitly excluded from the current release:

- Real-time database replication or synchronization
- Data warehouse ETL pipeline management
- Direct production database write operations (read-only connections for analysis)
- Custom visualization / BI dashboard builder
- Mobile native applications (responsive web only)
- Multi-tenancy with per-tenant isolation (single-tenant deployment model for v1)
- Database backup and disaster recovery management
- Real-time query execution against live production databases without explicit user consent

---

## 5. Functional Requirements

### 5.1 Project Workspace (FR-001 to FR-010)

| FR ID  | Requirement                                                                          | Priority | Status  |
|--------|--------------------------------------------------------------------------------------|----------|---------|
| FR-001 | Users shall be able to create new projects with name, description, and dialect        | High     | Done    |
| FR-002 | Users shall be able to view a list of all projects with key statistics                | High     | Done    |
| FR-003 | Users shall be able to edit project name, description, and dialect                    | High     | Done    |
| FR-004 | Users shall be able to delete projects with confirmation dialog                       | High     | Done    |
| FR-005 | Each project shall display table count, query count, and file count                   | Medium   | Done    |
| FR-006 | Dashboard shall show aggregate statistics across all projects                         | Medium   | Done    |
| FR-007 | Users shall be able to navigate between projects via sidebar project selector          | High     | Done    |
| FR-008 | Project overview shall display Recharts-powered analytics (columns per table, table size distribution) | Medium | Done |
| FR-009 | Recent activity timeline shall display last 5 actions within a project                | Medium   | Done    |
| FR-010 | Quick links grid shall provide one-click access to all project modules                | Low      | Done    |

### 5.2 Schema Intelligence (FR-011 to FR-025)

| FR ID  | Requirement                                                                          | Priority | Status    |
|--------|--------------------------------------------------------------------------------------|----------|-----------|
| FR-011 | Users shall be able to upload SQL DDL files for automatic schema parsing              | High     | Done      |
| FR-012 | System shall parse and extract tables, columns, constraints, and indexes from SQL     | High     | Done      |
| FR-013 | Users shall view a complete table list with column details and data types              | High     | Done      |
| FR-014 | Users shall be able to view an interactive Entity-Relationship (ER) diagram            | High     | Done      |
| FR-015 | ER diagram shall support zoom, pan, and node repositioning                            | Medium   | Done      |
| FR-016 | AI shall generate schema design suggestions based on natural language descriptions    | High     | Planned   |
| FR-017 | AI shall identify normalization issues and recommend improvements                     | Medium   | Planned   |
| FR-018 | System shall detect missing indexes based on foreign key relationships                | Medium   | Planned   |
| FR-019 | Users shall be able to export schema as SQL DDL, JSON, or DBML                        | Medium   | Planned   |
| FR-020 | System shall support schema comparison (diff) between two versions                    | Medium   | Planned   |
| FR-021 | Users shall be able to add, modify, and remove columns interactively                  | High     | Planned   |
| FR-022 | System shall validate schema against dialect-specific constraints                     | Medium   | Planned   |
| FR-023 | Users shall be able to view column-level statistics (nullability, uniqueness)          | Low      | Planned   |
| FR-024 | System shall generate CREATE TABLE statements from visual schema editor               | High     | Planned   |
| FR-025 | AI shall suggest optimal data types based on column naming conventions and usage       | Low      | Planned   |

### 5.3 Query Intelligence (FR-026 to FR-040)

| FR ID  | Requirement                                                                          | Priority | Status    |
|--------|--------------------------------------------------------------------------------------|----------|-----------|
| FR-026 | Users shall have a full-featured SQL editor with syntax highlighting                  | High     | Done      |
| FR-027 | SQL editor shall provide auto-completion for table and column names                   | High     | Done      |
| FR-028 | AI shall generate SQL queries from natural language descriptions                      | High     | Done      |
| FR-029 | AI shall optimize existing SQL queries with explanations                              | High     | Planned   |
| FR-030 | System shall display EXPLAIN/EXPLAIN ANALYZE plan visualization                       | High     | Planned   |
| FR-031 | Users shall be able to save queries with name, description, and tags                  | Medium   | Done      |
| FR-032 | Users shall be able to organize queries in a saved queries library                    | Medium   | Done      |
| FR-033 | System shall provide query history with timestamp and execution details               | Medium   | Planned   |
| FR-034 | AI shall detect potential SQL injection vulnerabilities in queries                     | Medium   | Planned   |
| FR-035 | System shall format/beautify SQL queries with consistent indentation                  | Low      | Done      |
| FR-036 | Users shall be able to execute queries against connected databases                    | High     | Planned   |
| FR-037 | Query results shall be displayed in a sortable, filterable data grid                  | Medium   | Planned   |
| FR-038 | Users shall be able to export query results as CSV, JSON, or Excel                    | Medium   | Planned   |
| FR-039 | AI shall suggest index creation based on query patterns                               | Medium   | Planned   |
| FR-040 | System shall support parameterized queries with variable substitution                 | Low      | Planned   |

### 5.4 Performance Lab (FR-041 to FR-050)

| FR ID  | Requirement                                                                          | Priority | Status    |
|--------|--------------------------------------------------------------------------------------|----------|-----------|
| FR-041 | Users shall generate synthetic test data with configurable volume and distributions   | High     | Planned   |
| FR-042 | System shall benchmark query execution across different configurations                | High     | Planned   |
| FR-043 | AI shall provide index recommendations based on query workload analysis               | High     | Planned   |
| FR-044 | Users shall compare performance across database dialects side by side                 | Medium   | Planned   |
| FR-045 | System shall identify and analyze slow queries with bottleneck detection              | High     | Planned   |
| FR-046 | AI shall predict query execution cost before running                                  | Medium   | Planned   |
| FR-047 | Database health dashboard shall display overall health score (0-100)                  | Medium   | Done      |
| FR-048 | Health dashboard shall show table growth trends over time                             | Medium   | Done      |
| FR-049 | Health dashboard shall display index usage analysis (used vs unused)                  | Medium   | Done      |
| FR-050 | Health dashboard shall show connection pool status and storage breakdown              | Medium   | Done      |

### 5.5 Migration Studio (FR-051 to FR-060)

| FR ID  | Requirement                                                                          | Priority | Status    |
|--------|--------------------------------------------------------------------------------------|----------|-----------|
| FR-051 | Users shall create migration plans from schema diff comparisons                       | High     | Planned   |
| FR-052 | AI shall generate migration SQL scripts with UP and DOWN operations                   | High     | Planned   |
| FR-053 | System shall maintain a versioned migration history with timestamps                   | High     | Planned   |
| FR-054 | Users shall be able to review and edit generated migration scripts                    | High     | Planned   |
| FR-055 | System shall validate migrations for potential data loss scenarios                    | High     | Planned   |
| FR-056 | AI shall suggest safe migration strategies for large tables                           | Medium   | Planned   |
| FR-057 | System shall support migration rollback with generated DOWN scripts                   | Medium   | Planned   |
| FR-058 | Users shall be able to export migration files in dialect-specific formats              | Medium   | Planned   |
| FR-059 | System shall detect breaking changes and warn before migration execution              | High     | Planned   |
| FR-060 | Migration preview shall show estimated execution time and impact analysis             | Low      | Planned   |

### 5.6 Data Lifecycle Management (FR-061 to FR-070)

| FR ID  | Requirement                                                                          | Priority | Status    |
|--------|--------------------------------------------------------------------------------------|----------|-----------|
| FR-061 | Users shall define data retention policies per table with configurable durations       | High     | Planned   |
| FR-062 | System shall suggest archival strategies based on data access patterns                 | Medium   | Planned   |
| FR-063 | AI shall detect PII (Personally Identifiable Information) columns automatically        | High     | Planned   |
| FR-064 | System shall generate compliance reports for GDPR, CCPA, and HIPAA                    | High     | Planned   |
| FR-065 | Users shall define masking rules for sensitive data columns                            | Medium   | Planned   |
| FR-066 | System shall provide data classification labels (Public, Internal, Confidential, Restricted) | Medium | Planned |
| FR-067 | AI shall recommend data partitioning strategies for large tables                       | Medium   | Planned   |
| FR-068 | System shall track data lineage across tables and transformations                      | Low      | Planned   |
| FR-069 | Users shall configure automated data purge schedules with approval workflows           | Medium   | Planned   |
| FR-070 | System shall generate DSAR (Data Subject Access Request) response reports              | Low      | Planned   |

### 5.7 AI Integration (FR-071 to FR-080)

| FR ID  | Requirement                                                                          | Priority | Status    |
|--------|--------------------------------------------------------------------------------------|----------|-----------|
| FR-071 | System shall support Anthropic Claude models (Sonnet, Opus, Haiku)                    | High     | Done      |
| FR-072 | System shall support OpenAI GPT models (GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo)          | High     | Done      |
| FR-073 | System shall support local Ollama models for air-gapped environments                  | Medium   | Done      |
| FR-074 | Users shall configure API keys and model selection per provider                       | High     | Done      |
| FR-075 | AI chat panel shall provide conversational database assistance                        | High     | Done      |
| FR-076 | AI shall maintain conversation context within a project scope                         | Medium   | Planned   |
| FR-077 | System shall provide AI response streaming for real-time feedback                     | Medium   | Planned   |
| FR-078 | AI shall generate dialect-specific SQL based on the project's configured engine        | High     | Planned   |
| FR-079 | System shall allow users to rate AI responses for quality feedback                    | Low      | Planned   |
| FR-080 | AI shall provide inline schema and query documentation generation                    | Medium   | Planned   |

### 5.8 Security and Compliance (FR-081 to FR-090)

| FR ID  | Requirement                                                                          | Priority | Status    |
|--------|--------------------------------------------------------------------------------------|----------|-----------|
| FR-081 | System shall implement role-based access control (RBAC) with Admin, Editor, Viewer    | High     | Planned   |
| FR-082 | All actions shall be recorded in an immutable audit log                               | High     | Done      |
| FR-083 | Audit logs shall be filterable by action type, entity type, date range                | High     | Done      |
| FR-084 | Audit logs shall be exportable as CSV for external auditing                           | Medium   | Done      |
| FR-085 | System shall encrypt sensitive data at rest and in transit (TLS 1.3)                  | High     | Planned   |
| FR-086 | API keys shall be stored encrypted and never exposed in logs or responses             | High     | Done      |
| FR-087 | System shall enforce session management with configurable timeouts                    | Medium   | Planned   |
| FR-088 | System shall provide CORS configuration for cross-origin security                     | High     | Done      |
| FR-089 | Database connection credentials shall be stored using AES-256 encryption              | High     | Planned   |
| FR-090 | System shall support single sign-on (SSO) via OAuth 2.0 / OIDC providers              | Medium   | Planned   |

---

## 6. Non-Functional Requirements

### 6.1 Performance

| NFR ID  | Requirement                                                              | Target          |
|---------|--------------------------------------------------------------------------|-----------------|
| NFR-001 | Page load time shall be under 2 seconds on a standard broadband connection | < 2s           |
| NFR-002 | API response time shall be under 500ms for non-AI operations               | < 500ms        |
| NFR-003 | AI response generation shall begin streaming within 3 seconds              | < 3s           |
| NFR-004 | SQL file parsing shall complete within 5 seconds for files up to 10MB      | < 5s           |
| NFR-005 | ER diagram shall render up to 100 tables without performance degradation   | 100 tables     |
| NFR-006 | Dashboard charts shall render within 1 second with up to 10,000 data points | < 1s          |

### 6.2 Scalability

| NFR ID  | Requirement                                                              | Target          |
|---------|--------------------------------------------------------------------------|-----------------|
| NFR-007 | System shall support up to 100 concurrent users per deployment instance    | 100 users      |
| NFR-008 | Database shall handle up to 10,000 projects without performance impact     | 10,000 projects|
| NFR-009 | Each project shall support schemas with up to 500 tables                   | 500 tables     |
| NFR-010 | Audit log shall retain entries for at least 2 years                        | 2 years        |

### 6.3 Availability

| NFR ID  | Requirement                                                              | Target          |
|---------|--------------------------------------------------------------------------|-----------------|
| NFR-011 | System uptime shall be 99.5% or higher (excluding planned maintenance)    | 99.5%          |
| NFR-012 | System shall support zero-downtime deployments via rolling updates         | Zero-downtime  |
| NFR-013 | Database shall implement automated backups with 24-hour RPO                | 24h RPO        |

### 6.4 Security

| NFR ID  | Requirement                                                              | Target              |
|---------|--------------------------------------------------------------------------|----------------------|
| NFR-014 | All data in transit shall be encrypted using TLS 1.3                      | TLS 1.3             |
| NFR-015 | All sensitive data at rest shall be encrypted using AES-256                | AES-256             |
| NFR-016 | System shall pass OWASP Top 10 vulnerability assessment                   | Zero critical issues |
| NFR-017 | API shall implement rate limiting (100 requests/minute per user)           | 100 req/min         |
| NFR-018 | System shall support Content Security Policy (CSP) headers                | Strict CSP          |

---

## 7. Database Support Matrix

| Database Engine | Version Support | Schema Parsing | Query Intelligence | Performance Lab | Migration Studio |
|----------------|----------------|----------------|-------------------|-----------------|------------------|
| PostgreSQL     | 12+            | Full           | Full              | Full            | Full             |
| MySQL          | 8.0+           | Full           | Full              | Full            | Full             |
| Oracle         | 19c+           | Full           | Full              | Partial         | Full             |
| SQL Server     | 2019+          | Full           | Full              | Partial         | Full             |
| MariaDB        | 10.5+          | Full           | Full              | Full            | Full             |
| Snowflake      | Current        | Full           | Full              | Partial         | Partial          |
| BigQuery       | Current        | Partial        | Full              | Partial         | Partial          |
| MongoDB        | 6.0+           | Partial        | Partial           | Partial         | Planned          |

**Legend:**
- **Full** - All features available and tested for this dialect
- **Partial** - Core features available, some advanced features may not be dialect-specific
- **Planned** - Support is planned for a future release

---

## 8. Technical Architecture

### 8.1 Frontend Architecture

| Component          | Technology                    | Purpose                                    |
|--------------------|-------------------------------|--------------------------------------------|
| Framework          | React 19                      | UI component library and rendering          |
| Build Tool         | Vite                          | Fast development and production builds      |
| Language           | TypeScript 5.x                | Type-safe development                       |
| Styling            | Tailwind CSS v4               | Utility-first CSS framework                 |
| State Management   | Zustand                       | Lightweight global state management         |
| Data Fetching      | TanStack Query (React Query)  | Server state, caching, and synchronization  |
| HTTP Client        | Axios                         | API communication with interceptors         |
| Routing            | React Router v6               | Client-side routing and navigation          |
| Icons              | Lucide React                  | Consistent icon library                     |
| Charts             | Recharts                      | Data visualization and dashboards           |
| Code Editor        | CodeMirror / Monaco           | SQL editing with syntax highlighting        |
| ER Diagrams        | React Flow                    | Interactive node-based diagrams             |

### 8.2 Backend Architecture

| Component          | Technology                    | Purpose                                    |
|--------------------|-------------------------------|--------------------------------------------|
| Runtime            | Node.js 20 LTS               | Server-side JavaScript execution            |
| Framework          | Express.js                    | RESTful API server                          |
| Language           | TypeScript 5.x                | Type-safe backend development               |
| ORM                | Prisma                        | Type-safe database access and migrations    |
| Database           | PostgreSQL 16                 | Primary application database                |
| Validation         | Zod                           | Request/response schema validation          |
| Authentication     | JWT / Passport.js             | User authentication and session management  |
| Logging            | Winston / Pino                | Structured application logging              |
| API Documentation  | Swagger / OpenAPI 3.0         | Auto-generated API documentation            |

### 8.3 AI Layer Architecture

| Component           | Technology                   | Purpose                                    |
|---------------------|------------------------------|--------------------------------------------|
| Primary Provider    | Anthropic Claude API         | Schema design, query generation, analysis   |
| Secondary Provider  | OpenAI GPT API               | Alternative AI processing                   |
| Local Provider      | Ollama                       | Air-gapped / privacy-sensitive deployments  |
| Prompt Engineering  | Custom prompt templates      | Dialect-aware, context-rich AI interactions  |
| Context Management  | Token-aware chunking         | Efficient context window utilization        |
| Response Streaming  | Server-Sent Events (SSE)     | Real-time AI response delivery              |

### 8.4 System Architecture Diagram

```
+---------------------------------------------------+
|                   Client Browser                    |
|  +---------------------------------------------+  |
|  |  React 19 + Vite + TypeScript + Tailwind CSS |  |
|  |  Zustand | TanStack Query | React Router     |  |
|  |  Recharts | React Flow | CodeMirror          |  |
|  +---------------------------------------------+  |
+---------------------------------------------------+
                        |
                    HTTPS/WSS
                        |
+---------------------------------------------------+
|                   API Gateway                       |
|  +---------------------------------------------+  |
|  |  Express.js + TypeScript                     |  |
|  |  JWT Auth | Rate Limiting | CORS             |  |
|  |  Zod Validation | Error Handling             |  |
|  +---------------------------------------------+  |
+---------------------------------------------------+
            |                    |
     +------+------+     +------+------+
     |  Prisma ORM  |     |  AI Service  |
     |  PostgreSQL  |     | Claude/GPT   |
     |  16-alpine   |     | Ollama       |
     +--------------+     +--------------+
```

---

## 9. Security Requirements

### 9.1 Authentication and Authorization

- **RBAC Model**: Three roles - Administrator, Editor, Viewer
  - **Administrator**: Full access to all features, user management, settings
  - **Editor**: Create/edit projects, schemas, queries; cannot manage users
  - **Viewer**: Read-only access to projects, schemas, and reports
- **Session Management**: JWT tokens with 24-hour expiration, refresh token rotation
- **Multi-Factor Authentication**: Optional TOTP-based 2FA for administrator accounts

### 9.2 Data Protection

- **Encryption at Rest**: AES-256 encryption for database connection credentials and API keys
- **Encryption in Transit**: TLS 1.3 for all client-server and server-database communication
- **API Key Security**: Keys are hashed before storage; never logged or returned in API responses
- **Input Sanitization**: All user inputs validated and sanitized to prevent XSS and SQL injection

### 9.3 Audit and Compliance

- **Audit Logging**: Every create, update, delete, and view action is logged with:
  - Timestamp (UTC)
  - User ID and IP address
  - Action type and target entity
  - Detailed description of changes
- **Log Retention**: Audit logs retained for a minimum of 2 years
- **Export Capability**: Audit logs exportable as CSV for external compliance tools
- **Compliance Frameworks**:
  - **GDPR**: Data subject rights, PII detection, data retention policies
  - **PCI DSS**: Encryption standards, access controls, audit trails
  - **SOC 2**: Security, availability, processing integrity controls
  - **HIPAA**: PHI protection (where applicable to healthcare clients)

### 9.4 Network Security

- **CORS Policy**: Strict origin whitelisting; no wildcard origins in production
- **CSP Headers**: Content Security Policy to prevent XSS attacks
- **Rate Limiting**: 100 requests/minute per user; 10 requests/minute for AI endpoints
- **DDoS Protection**: Cloud provider-level DDoS mitigation (Cloudflare/AWS Shield)

---

## 10. Deployment Architecture

### 10.1 Development Environment

| Component     | Configuration                              |
|---------------|--------------------------------------------|
| Frontend      | Vite dev server (port 5173) with HMR       |
| Backend       | Express dev server (port 3001) with nodemon |
| Database      | Docker Compose PostgreSQL 16-alpine         |
| AI Providers  | Direct API calls to Anthropic/OpenAI        |

### 10.2 Production Deployment Options

#### Option A: Cloud PaaS (Recommended)

| Component     | Service                    | Configuration               |
|---------------|----------------------------|-----------------------------|
| Frontend      | Vercel                     | Static site deployment, CDN |
| Backend       | Railway or Render          | Node.js container, auto-scaling |
| Database      | Railway PostgreSQL or Neon  | Managed PostgreSQL, backups |
| DNS/CDN       | Cloudflare                 | DNS, CDN, DDoS protection   |

#### Option B: Docker Self-Hosted

| Component     | Configuration                              |
|---------------|--------------------------------------------|
| Container     | Docker multi-stage build (Dockerfile)       |
| Orchestration | Docker Compose for development              |
| Database      | PostgreSQL 16-alpine container              |
| Reverse Proxy | Nginx or Caddy with TLS termination         |

### 10.3 Docker Configuration

The project includes production-ready Docker configuration:

- **`Dockerfile`**: Multi-stage build optimized for production
  - Stage 1 (builder): Installs dependencies, builds client and server
  - Stage 2 (runner): Minimal runtime image with only production artifacts
- **`docker-compose.yml`**: Development database setup
  - PostgreSQL 16-alpine with health checks
  - Persistent volume for data durability
  - Configurable credentials via environment variables

### 10.4 CI/CD Pipeline (Recommended)

```
Code Push -> GitHub Actions -> Lint/Type Check -> Unit Tests -> Build -> Deploy
                                    |
                              Security Scan (SAST)
                                    |
                              Docker Build & Push
                                    |
                              Staging Deploy -> Integration Tests -> Production Deploy
```

---

## 11. Success Criteria

| Criterion                                          | Measurement                           | Target     |
|----------------------------------------------------|---------------------------------------|------------|
| Schema design time reduction                        | Avg. time to complete schema design   | -60%       |
| Query development speed improvement                 | Avg. time to write/optimize queries   | -50%       |
| Migration incident reduction                        | Number of migration-related incidents | -70%       |
| User adoption rate                                  | Active users / total team members     | > 80%      |
| System uptime                                       | Monthly uptime percentage             | > 99.5%    |
| AI response accuracy                                | User satisfaction rating              | > 4.0/5.0  |
| Audit log completeness                              | Actions logged / total actions        | 100%       |
| Database dialect coverage                            | Supported engines                     | 8+         |
| Performance benchmark completion                     | API response times within SLA         | > 95%      |

---

## 12. Risks and Mitigations

| Risk ID | Risk Description                                            | Probability | Impact  | Mitigation Strategy                                                    |
|---------|-------------------------------------------------------------|-------------|---------|------------------------------------------------------------------------|
| R-001   | AI provider API outages affecting core functionality          | Medium      | High    | Multi-provider failover; local Ollama fallback                          |
| R-002   | LLM generating incorrect or dangerous SQL                    | Medium      | High    | SQL validation layer; dry-run mode; user confirmation for DDL            |
| R-003   | Data breach through database connection credentials          | Low         | Critical| AES-256 encryption; HSM for key management; access auditing              |
| R-004   | Performance degradation with large schemas (500+ tables)      | Medium      | Medium  | Lazy loading; virtualized rendering; pagination                          |
| R-005   | Breaking changes in AI provider APIs                          | Medium      | Medium  | Abstraction layer; versioned API clients; compatibility testing          |
| R-006   | Vendor lock-in with specific cloud providers                  | Low         | Medium  | Docker containerization; cloud-agnostic architecture                     |
| R-007   | Cost overrun from AI API usage                                | Medium      | Medium  | Token usage monitoring; rate limiting; cost alerts                       |
| R-008   | Incomplete dialect support causing user frustration            | Medium      | Medium  | Prioritized dialect roadmap; community contribution model                |
| R-009   | Regulatory compliance requirements changing                   | Low         | High    | Modular compliance engine; regular regulatory review                     |
| R-010   | User resistance to AI-generated code                          | Medium      | Medium  | Always-reviewable suggestions; transparency in AI reasoning              |

---

## 13. Glossary

| Term                  | Definition                                                                                    |
|-----------------------|-----------------------------------------------------------------------------------------------|
| **DDL**               | Data Definition Language - SQL statements for creating/altering database structures             |
| **DML**               | Data Manipulation Language - SQL statements for querying and modifying data                     |
| **ER Diagram**        | Entity-Relationship Diagram - visual representation of database tables and their relationships  |
| **EXPLAIN Plan**      | Database query execution plan showing how the optimizer will execute a query                    |
| **LLM**              | Large Language Model - AI models like Claude or GPT used for natural language understanding      |
| **Migration**         | A versioned change to a database schema (adding/removing tables, columns, indexes)              |
| **ORM**              | Object-Relational Mapping - a technique for converting data between type systems                 |
| **PII**              | Personally Identifiable Information - data that can identify an individual                       |
| **RBAC**             | Role-Based Access Control - restricting system access based on user roles                        |
| **Schema**           | The structure of a database including tables, columns, types, and relationships                  |
| **SSE**              | Server-Sent Events - a protocol for server-to-client streaming updates                          |
| **TOAST**            | The Oversized-Attribute Storage Technique - PostgreSQL's mechanism for storing large values       |
| **WAL**              | Write-Ahead Log - PostgreSQL's mechanism for ensuring data integrity                             |
| **DSAR**             | Data Subject Access Request - a request by an individual to access their personal data           |
| **SOC 2**            | Service Organization Control 2 - a framework for managing data security                          |
| **GDPR**             | General Data Protection Regulation - EU data protection and privacy regulation                   |
| **HIPAA**            | Health Insurance Portability and Accountability Act - US healthcare data protection law           |
| **PCI DSS**          | Payment Card Industry Data Security Standard - security standards for payment card data           |

---

## 14. Appendix: API Endpoint Summary

### 14.1 Project Management

| Method | Endpoint                      | Description                    | Auth Required |
|--------|-------------------------------|--------------------------------|---------------|
| GET    | `/api/v1/projects`            | List all projects              | Yes           |
| POST   | `/api/v1/projects`            | Create a new project           | Yes           |
| GET    | `/api/v1/projects/:id`        | Get project by ID              | Yes           |
| PATCH  | `/api/v1/projects/:id`        | Update a project               | Yes           |
| DELETE | `/api/v1/projects/:id`        | Delete a project               | Yes           |

### 14.2 Schema Management

| Method | Endpoint                                    | Description                        | Auth Required |
|--------|---------------------------------------------|------------------------------------|---------------|
| GET    | `/api/v1/projects/:id/schema`               | Get project schema                  | Yes           |
| POST   | `/api/v1/projects/:id/schema/upload`        | Upload SQL file for parsing         | Yes           |
| GET    | `/api/v1/projects/:id/schema/tables`        | List all tables                     | Yes           |
| GET    | `/api/v1/projects/:id/schema/tables/:tid`   | Get table details                   | Yes           |
| POST   | `/api/v1/projects/:id/schema/export`        | Export schema                       | Yes           |
| POST   | `/api/v1/projects/:id/schema/diff`          | Compare two schema versions         | Yes           |

### 14.3 Query Management

| Method | Endpoint                                    | Description                        | Auth Required |
|--------|---------------------------------------------|------------------------------------|---------------|
| GET    | `/api/v1/projects/:id/queries`              | List saved queries                  | Yes           |
| POST   | `/api/v1/projects/:id/queries`              | Save a new query                    | Yes           |
| GET    | `/api/v1/projects/:id/queries/:qid`         | Get query by ID                     | Yes           |
| PATCH  | `/api/v1/projects/:id/queries/:qid`         | Update a saved query                | Yes           |
| DELETE | `/api/v1/projects/:id/queries/:qid`         | Delete a saved query                | Yes           |
| POST   | `/api/v1/projects/:id/queries/execute`      | Execute a query                     | Yes           |
| POST   | `/api/v1/projects/:id/queries/explain`      | Get query execution plan            | Yes           |

### 14.4 AI Services

| Method | Endpoint                                    | Description                        | Auth Required |
|--------|---------------------------------------------|------------------------------------|---------------|
| POST   | `/api/v1/ai/chat`                           | Send AI chat message                | Yes           |
| POST   | `/api/v1/ai/generate-sql`                   | Generate SQL from description       | Yes           |
| POST   | `/api/v1/ai/optimize-query`                 | Optimize a SQL query                | Yes           |
| POST   | `/api/v1/ai/analyze-schema`                 | AI schema analysis                  | Yes           |
| POST   | `/api/v1/ai/explain-query`                  | AI query explanation                | Yes           |

### 14.5 Performance

| Method | Endpoint                                    | Description                        | Auth Required |
|--------|---------------------------------------------|------------------------------------|---------------|
| POST   | `/api/v1/projects/:id/performance/benchmark`| Run query benchmark                 | Yes           |
| GET    | `/api/v1/projects/:id/performance/health`   | Get database health metrics         | Yes           |
| GET    | `/api/v1/projects/:id/performance/slow-queries` | Get slow query list             | Yes           |
| POST   | `/api/v1/projects/:id/performance/index-advisor` | Get index recommendations      | Yes           |

### 14.6 Migrations

| Method | Endpoint                                    | Description                        | Auth Required |
|--------|---------------------------------------------|------------------------------------|---------------|
| GET    | `/api/v1/projects/:id/migrations`           | List migrations                     | Yes           |
| POST   | `/api/v1/projects/:id/migrations`           | Create a new migration              | Yes           |
| GET    | `/api/v1/projects/:id/migrations/:mid`      | Get migration details               | Yes           |
| POST   | `/api/v1/projects/:id/migrations/:mid/apply`| Apply a migration                   | Yes           |
| POST   | `/api/v1/projects/:id/migrations/:mid/rollback` | Rollback a migration           | Yes           |

### 14.7 Connections

| Method | Endpoint                                    | Description                        | Auth Required |
|--------|---------------------------------------------|------------------------------------|---------------|
| GET    | `/api/v1/projects/:id/connections`          | List database connections           | Yes           |
| POST   | `/api/v1/projects/:id/connections`          | Add a database connection           | Yes           |
| DELETE | `/api/v1/projects/:id/connections/:cid`     | Remove a connection                 | Yes           |
| POST   | `/api/v1/projects/:id/connections/:cid/test`| Test a connection                   | Yes           |

### 14.8 Audit Logs

| Method | Endpoint                                    | Description                        | Auth Required |
|--------|---------------------------------------------|------------------------------------|---------------|
| GET    | `/api/v1/audit-logs`                        | List audit log entries              | Yes (Admin)   |
| GET    | `/api/v1/audit-logs/:id`                    | Get audit log entry details         | Yes (Admin)   |
| GET    | `/api/v1/audit-logs/export`                 | Export audit logs as CSV            | Yes (Admin)   |

### 14.9 Settings

| Method | Endpoint                                    | Description                        | Auth Required |
|--------|---------------------------------------------|------------------------------------|---------------|
| GET    | `/api/v1/settings`                          | Get application settings            | Yes           |
| PATCH  | `/api/v1/settings`                          | Update application settings         | Yes (Admin)   |
| POST   | `/api/v1/settings/ai-providers/test`        | Test AI provider connection         | Yes           |

---

*This document is the property of Opus Technologies, Pune. Unauthorized reproduction or distribution is prohibited.*

*Prepared by Nilesh Pardeshi, Technical Manager, Opus Technologies, Pune.*
