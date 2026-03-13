-- ============================================================================
-- Migration: Move all application tables to "aqua_db" PostgreSQL schema
-- Add dbSchema column to Project for per-project schema tracking
-- Create AIUsageLog and AIBudgetConfig tables (new models)
-- ============================================================================

-- 1. Create the aqua_db schema
CREATE SCHEMA IF NOT EXISTS "aqua_db";

-- 2. Move all 24 existing tables from public to aqua_db
ALTER TABLE "public"."Project" SET SCHEMA "aqua_db";
ALTER TABLE "public"."ProjectFile" SET SCHEMA "aqua_db";
ALTER TABLE "public"."FileParseResult" SET SCHEMA "aqua_db";
ALTER TABLE "public"."SchemaSnapshot" SET SCHEMA "aqua_db";
ALTER TABLE "public"."TableMetadata" SET SCHEMA "aqua_db";
ALTER TABLE "public"."ColumnMetadata" SET SCHEMA "aqua_db";
ALTER TABLE "public"."IndexMetadata" SET SCHEMA "aqua_db";
ALTER TABLE "public"."ConstraintMetadata" SET SCHEMA "aqua_db";
ALTER TABLE "public"."RelationshipMetadata" SET SCHEMA "aqua_db";
ALTER TABLE "public"."TriggerMetadata" SET SCHEMA "aqua_db";
ALTER TABLE "public"."SavedQuery" SET SCHEMA "aqua_db";
ALTER TABLE "public"."QueryExecution" SET SCHEMA "aqua_db";
ALTER TABLE "public"."PerformanceRun" SET SCHEMA "aqua_db";
ALTER TABLE "public"."Migration" SET SCHEMA "aqua_db";
ALTER TABLE "public"."ColumnMappingConfig" SET SCHEMA "aqua_db";
ALTER TABLE "public"."DataSheetMappingConfig" SET SCHEMA "aqua_db";
ALTER TABLE "public"."SavedDiagram" SET SCHEMA "aqua_db";
ALTER TABLE "public"."DataLifecycleRule" SET SCHEMA "aqua_db";
ALTER TABLE "public"."AIConversation" SET SCHEMA "aqua_db";
ALTER TABLE "public"."AIMessage" SET SCHEMA "aqua_db";
ALTER TABLE "public"."DatabaseConnection" SET SCHEMA "aqua_db";
ALTER TABLE "public"."AppSettings" SET SCHEMA "aqua_db";
ALTER TABLE "public"."AIProviderConfig" SET SCHEMA "aqua_db";
ALTER TABLE "public"."AuditLog" SET SCHEMA "aqua_db";

-- 3. Add dbSchema column to Project table
ALTER TABLE "aqua_db"."Project" ADD COLUMN "dbSchema" VARCHAR(63);

-- 4. Create AIUsageLog table (new model)
CREATE TABLE "aqua_db"."AIUsageLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "projectId" UUID,
    "module" VARCHAR(30) NOT NULL,
    "endpoint" VARCHAR(100) NOT NULL,
    "provider" VARCHAR(30) NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsageLog_pkey" PRIMARY KEY ("id")
);

-- 5. Create AIBudgetConfig table (new model)
CREATE TABLE "aqua_db"."AIBudgetConfig" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "projectId" UUID,
    "monthlyTokenLimit" BIGINT NOT NULL,
    "warningThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "isHardLimit" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "AIBudgetConfig_pkey" PRIMARY KEY ("id")
);

-- 6. Create indexes for AIUsageLog
CREATE INDEX "AIUsageLog_projectId_createdAt_idx" ON "aqua_db"."AIUsageLog"("projectId", "createdAt");
CREATE INDEX "AIUsageLog_module_createdAt_idx" ON "aqua_db"."AIUsageLog"("module", "createdAt");
CREATE INDEX "AIUsageLog_provider_model_createdAt_idx" ON "aqua_db"."AIUsageLog"("provider", "model", "createdAt");
CREATE INDEX "AIUsageLog_createdAt_idx" ON "aqua_db"."AIUsageLog"("createdAt");

-- 7. Create indexes and constraints for AIBudgetConfig
CREATE UNIQUE INDEX "AIBudgetConfig_projectId_key" ON "aqua_db"."AIBudgetConfig"("projectId");
CREATE INDEX "AIBudgetConfig_isActive_idx" ON "aqua_db"."AIBudgetConfig"("isActive");

-- 8. Add foreign keys for new tables
ALTER TABLE "aqua_db"."AIUsageLog" ADD CONSTRAINT "AIUsageLog_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "aqua_db"."Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "aqua_db"."AIBudgetConfig" ADD CONSTRAINT "AIBudgetConfig_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "aqua_db"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
