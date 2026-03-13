-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "dialect" VARCHAR(30) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "schemas" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectFile" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "fileName" VARCHAR(500) NOT NULL,
    "filePath" VARCHAR(1000) NOT NULL,
    "fileType" VARCHAR(50) NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "dialect" VARCHAR(30),
    "checksum" VARCHAR(128) NOT NULL,
    "uploadedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileParseResult" (
    "id" UUID NOT NULL,
    "fileId" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "statementCount" INTEGER NOT NULL DEFAULT 0,
    "tableCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT,
    "parsedAt" TIMESTAMPTZ,
    "duration" INTEGER,

    CONSTRAINT "FileParseResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchemaSnapshot" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "label" VARCHAR(200),
    "snapshotData" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchemaSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableMetadata" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "schemaName" VARCHAR(128) NOT NULL DEFAULT 'public',
    "tableName" VARCHAR(256) NOT NULL,
    "tableType" VARCHAR(30) NOT NULL DEFAULT 'table',
    "description" TEXT,
    "estimatedRows" BIGINT,
    "originalDDL" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "TableMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColumnMetadata" (
    "id" UUID NOT NULL,
    "tableId" UUID NOT NULL,
    "columnName" VARCHAR(256) NOT NULL,
    "dataType" VARCHAR(100) NOT NULL,
    "normalizedType" VARCHAR(100),
    "ordinalPosition" INTEGER NOT NULL,
    "isNullable" BOOLEAN NOT NULL DEFAULT true,
    "isPrimaryKey" BOOLEAN NOT NULL DEFAULT false,
    "isUnique" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" TEXT,
    "characterMaxLength" INTEGER,
    "numericPrecision" INTEGER,
    "numericScale" INTEGER,
    "description" TEXT,
    "sensitivityTag" VARCHAR(30),

    CONSTRAINT "ColumnMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndexMetadata" (
    "id" UUID NOT NULL,
    "tableId" UUID NOT NULL,
    "indexName" VARCHAR(256) NOT NULL,
    "indexType" VARCHAR(30) NOT NULL,
    "isUnique" BOOLEAN NOT NULL DEFAULT false,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "columns" TEXT NOT NULL,
    "originalDDL" TEXT,

    CONSTRAINT "IndexMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstraintMetadata" (
    "id" UUID NOT NULL,
    "tableId" UUID NOT NULL,
    "constraintName" VARCHAR(256) NOT NULL,
    "constraintType" VARCHAR(30) NOT NULL,
    "definition" TEXT,
    "columns" TEXT NOT NULL,

    CONSTRAINT "ConstraintMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelationshipMetadata" (
    "id" UUID NOT NULL,
    "sourceTableId" UUID NOT NULL,
    "targetTableId" UUID NOT NULL,
    "relationshipType" VARCHAR(30) NOT NULL,
    "sourceColumns" TEXT NOT NULL,
    "targetColumns" TEXT NOT NULL,
    "constraintName" VARCHAR(256),
    "isInferred" BOOLEAN NOT NULL DEFAULT false,
    "onDelete" VARCHAR(30),
    "onUpdate" VARCHAR(30),

    CONSTRAINT "RelationshipMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TriggerMetadata" (
    "id" UUID NOT NULL,
    "tableId" UUID NOT NULL,
    "triggerName" VARCHAR(256) NOT NULL,
    "timing" VARCHAR(20) NOT NULL,
    "event" VARCHAR(20) NOT NULL,
    "triggerBody" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "TriggerMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedQuery" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "sql" TEXT NOT NULL,
    "dialect" VARCHAR(30) NOT NULL,
    "category" VARCHAR(50),
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "SavedQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueryExecution" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "savedQueryId" UUID,
    "sql" TEXT NOT NULL,
    "dialect" VARCHAR(30) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "rowsAffected" INTEGER,
    "rowsReturned" INTEGER,
    "executionTime" INTEGER,
    "resultPreview" TEXT,
    "explainPlan" TEXT,
    "errorMessage" TEXT,
    "executedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueryExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceRun" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "runType" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "summary" TEXT,
    "findings" TEXT,
    "recommendations" TEXT,
    "startedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ,

    CONSTRAINT "PerformanceRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Migration" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "version" VARCHAR(50) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "upSQL" TEXT NOT NULL,
    "downSQL" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "appliedAt" TIMESTAMPTZ,
    "sourceDialect" VARCHAR(30) NOT NULL,
    "targetDialect" VARCHAR(30) NOT NULL,
    "checksum" VARCHAR(128) NOT NULL,
    "dependsOn" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Migration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColumnMappingConfig" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "sourceTableName" VARCHAR(256) NOT NULL,
    "targetTableName" VARCHAR(256) NOT NULL,
    "sourceDialect" VARCHAR(30) NOT NULL,
    "targetDialect" VARCHAR(30) NOT NULL,
    "mappings" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ColumnMappingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSheetMappingConfig" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "sourceTableName" VARCHAR(256) NOT NULL,
    "csvFileName" VARCHAR(500) NOT NULL,
    "mappings" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "DataSheetMappingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedDiagram" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "diagramType" VARCHAR(30) NOT NULL,
    "includedTables" TEXT,
    "nodePositions" TEXT,
    "layoutDirection" VARCHAR(5) NOT NULL DEFAULT 'TB',
    "showColumns" BOOLEAN NOT NULL DEFAULT true,
    "showLabels" BOOLEAN NOT NULL DEFAULT true,
    "colorBySchema" BOOLEAN NOT NULL DEFAULT false,
    "annotations" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "SavedDiagram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataLifecycleRule" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "ruleName" VARCHAR(200) NOT NULL,
    "ruleType" VARCHAR(30) NOT NULL,
    "targetTable" VARCHAR(256) NOT NULL,
    "targetColumns" TEXT,
    "configuration" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "DataLifecycleRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIConversation" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "context" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "AIConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIMessage" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatabaseConnection" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "dialect" VARCHAR(30) NOT NULL,
    "host" VARCHAR(500) NOT NULL,
    "port" INTEGER NOT NULL,
    "database" VARCHAR(200) NOT NULL,
    "username" VARCHAR(200) NOT NULL,
    "passwordEncrypted" TEXT NOT NULL,
    "sslEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sslConfig" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTestedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatabaseConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" VARCHAR(50) NOT NULL DEFAULT 'singleton',
    "key" VARCHAR(200) NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIProviderConfig" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(30) NOT NULL,
    "apiKeyEncrypted" TEXT,
    "baseUrl" VARCHAR(500),
    "model" VARCHAR(100) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "maxTokens" INTEGER NOT NULL DEFAULT 4096,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "AIProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "projectId" UUID,
    "action" VARCHAR(50) NOT NULL,
    "entity" VARCHAR(100) NOT NULL,
    "entityId" UUID,
    "details" TEXT,
    "ipAddress" VARCHAR(45),
    "userAgent" VARCHAR(500),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");

-- CreateIndex
CREATE INDEX "ProjectFile_projectId_idx" ON "ProjectFile"("projectId");

-- CreateIndex
CREATE INDEX "ProjectFile_fileType_idx" ON "ProjectFile"("fileType");

-- CreateIndex
CREATE UNIQUE INDEX "FileParseResult_fileId_key" ON "FileParseResult"("fileId");

-- CreateIndex
CREATE INDEX "SchemaSnapshot_projectId_createdAt_idx" ON "SchemaSnapshot"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SchemaSnapshot_projectId_version_key" ON "SchemaSnapshot"("projectId", "version");

-- CreateIndex
CREATE INDEX "TableMetadata_projectId_idx" ON "TableMetadata"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "TableMetadata_projectId_schemaName_tableName_key" ON "TableMetadata"("projectId", "schemaName", "tableName");

-- CreateIndex
CREATE INDEX "ColumnMetadata_tableId_ordinalPosition_idx" ON "ColumnMetadata"("tableId", "ordinalPosition");

-- CreateIndex
CREATE UNIQUE INDEX "ColumnMetadata_tableId_columnName_key" ON "ColumnMetadata"("tableId", "columnName");

-- CreateIndex
CREATE UNIQUE INDEX "IndexMetadata_tableId_indexName_key" ON "IndexMetadata"("tableId", "indexName");

-- CreateIndex
CREATE UNIQUE INDEX "ConstraintMetadata_tableId_constraintName_key" ON "ConstraintMetadata"("tableId", "constraintName");

-- CreateIndex
CREATE INDEX "RelationshipMetadata_sourceTableId_idx" ON "RelationshipMetadata"("sourceTableId");

-- CreateIndex
CREATE INDEX "RelationshipMetadata_targetTableId_idx" ON "RelationshipMetadata"("targetTableId");

-- CreateIndex
CREATE INDEX "TriggerMetadata_tableId_idx" ON "TriggerMetadata"("tableId");

-- CreateIndex
CREATE UNIQUE INDEX "TriggerMetadata_tableId_triggerName_key" ON "TriggerMetadata"("tableId", "triggerName");

-- CreateIndex
CREATE INDEX "SavedQuery_projectId_idx" ON "SavedQuery"("projectId");

-- CreateIndex
CREATE INDEX "SavedQuery_projectId_isFavorite_idx" ON "SavedQuery"("projectId", "isFavorite");

-- CreateIndex
CREATE INDEX "QueryExecution_projectId_executedAt_idx" ON "QueryExecution"("projectId", "executedAt");

-- CreateIndex
CREATE INDEX "PerformanceRun_projectId_startedAt_idx" ON "PerformanceRun"("projectId", "startedAt");

-- CreateIndex
CREATE INDEX "Migration_projectId_status_idx" ON "Migration"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Migration_projectId_version_key" ON "Migration"("projectId", "version");

-- CreateIndex
CREATE INDEX "ColumnMappingConfig_projectId_idx" ON "ColumnMappingConfig"("projectId");

-- CreateIndex
CREATE INDEX "DataSheetMappingConfig_projectId_idx" ON "DataSheetMappingConfig"("projectId");

-- CreateIndex
CREATE INDEX "SavedDiagram_projectId_idx" ON "SavedDiagram"("projectId");

-- CreateIndex
CREATE INDEX "DataLifecycleRule_projectId_ruleType_idx" ON "DataLifecycleRule"("projectId", "ruleType");

-- CreateIndex
CREATE INDEX "DataLifecycleRule_isActive_idx" ON "DataLifecycleRule"("isActive");

-- CreateIndex
CREATE INDEX "AIConversation_projectId_context_idx" ON "AIConversation"("projectId", "context");

-- CreateIndex
CREATE INDEX "AIMessage_conversationId_createdAt_idx" ON "AIMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "DatabaseConnection_projectId_idx" ON "DatabaseConnection"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "AppSettings_key_key" ON "AppSettings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "AIProviderConfig_provider_model_key" ON "AIProviderConfig"("provider", "model");

-- CreateIndex
CREATE INDEX "AuditLog_projectId_createdAt_idx" ON "AuditLog"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");

-- AddForeignKey
ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileParseResult" ADD CONSTRAINT "FileParseResult_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "ProjectFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemaSnapshot" ADD CONSTRAINT "SchemaSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableMetadata" ADD CONSTRAINT "TableMetadata_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColumnMetadata" ADD CONSTRAINT "ColumnMetadata_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "TableMetadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndexMetadata" ADD CONSTRAINT "IndexMetadata_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "TableMetadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstraintMetadata" ADD CONSTRAINT "ConstraintMetadata_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "TableMetadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelationshipMetadata" ADD CONSTRAINT "RelationshipMetadata_sourceTableId_fkey" FOREIGN KEY ("sourceTableId") REFERENCES "TableMetadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelationshipMetadata" ADD CONSTRAINT "RelationshipMetadata_targetTableId_fkey" FOREIGN KEY ("targetTableId") REFERENCES "TableMetadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerMetadata" ADD CONSTRAINT "TriggerMetadata_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "TableMetadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedQuery" ADD CONSTRAINT "SavedQuery_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueryExecution" ADD CONSTRAINT "QueryExecution_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueryExecution" ADD CONSTRAINT "QueryExecution_savedQueryId_fkey" FOREIGN KEY ("savedQueryId") REFERENCES "SavedQuery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceRun" ADD CONSTRAINT "PerformanceRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Migration" ADD CONSTRAINT "Migration_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColumnMappingConfig" ADD CONSTRAINT "ColumnMappingConfig_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSheetMappingConfig" ADD CONSTRAINT "DataSheetMappingConfig_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedDiagram" ADD CONSTRAINT "SavedDiagram_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataLifecycleRule" ADD CONSTRAINT "DataLifecycleRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIMessage" ADD CONSTRAINT "AIMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatabaseConnection" ADD CONSTRAINT "DatabaseConnection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
