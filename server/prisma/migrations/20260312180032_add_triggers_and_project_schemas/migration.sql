-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "dialect" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "schemas" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProjectFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "dialect" TEXT,
    "checksum" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FileParseResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "statementCount" INTEGER NOT NULL DEFAULT 0,
    "tableCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT,
    "parsedAt" DATETIME,
    "duration" INTEGER,
    CONSTRAINT "FileParseResult_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "ProjectFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SchemaSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT,
    "snapshotData" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SchemaSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TableMetadata" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "schemaName" TEXT NOT NULL DEFAULT 'public',
    "tableName" TEXT NOT NULL,
    "tableType" TEXT NOT NULL DEFAULT 'table',
    "description" TEXT,
    "estimatedRows" BIGINT,
    "originalDDL" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TableMetadata_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ColumnMetadata" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tableId" TEXT NOT NULL,
    "columnName" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "normalizedType" TEXT,
    "ordinalPosition" INTEGER NOT NULL,
    "isNullable" BOOLEAN NOT NULL DEFAULT true,
    "isPrimaryKey" BOOLEAN NOT NULL DEFAULT false,
    "isUnique" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" TEXT,
    "characterMaxLength" INTEGER,
    "numericPrecision" INTEGER,
    "numericScale" INTEGER,
    "description" TEXT,
    "sensitivityTag" TEXT,
    CONSTRAINT "ColumnMetadata_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "TableMetadata" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IndexMetadata" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tableId" TEXT NOT NULL,
    "indexName" TEXT NOT NULL,
    "indexType" TEXT NOT NULL,
    "isUnique" BOOLEAN NOT NULL DEFAULT false,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "columns" TEXT NOT NULL,
    "originalDDL" TEXT,
    CONSTRAINT "IndexMetadata_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "TableMetadata" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConstraintMetadata" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tableId" TEXT NOT NULL,
    "constraintName" TEXT NOT NULL,
    "constraintType" TEXT NOT NULL,
    "definition" TEXT,
    "columns" TEXT NOT NULL,
    CONSTRAINT "ConstraintMetadata_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "TableMetadata" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RelationshipMetadata" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceTableId" TEXT NOT NULL,
    "targetTableId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "sourceColumns" TEXT NOT NULL,
    "targetColumns" TEXT NOT NULL,
    "constraintName" TEXT,
    "isInferred" BOOLEAN NOT NULL DEFAULT false,
    "onDelete" TEXT,
    "onUpdate" TEXT,
    CONSTRAINT "RelationshipMetadata_sourceTableId_fkey" FOREIGN KEY ("sourceTableId") REFERENCES "TableMetadata" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RelationshipMetadata_targetTableId_fkey" FOREIGN KEY ("targetTableId") REFERENCES "TableMetadata" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TriggerMetadata" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tableId" TEXT NOT NULL,
    "triggerName" TEXT NOT NULL,
    "timing" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "triggerBody" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TriggerMetadata_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "TableMetadata" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavedQuery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sql" TEXT NOT NULL,
    "dialect" TEXT NOT NULL,
    "category" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SavedQuery_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QueryExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "savedQueryId" TEXT,
    "sql" TEXT NOT NULL,
    "dialect" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rowsAffected" INTEGER,
    "rowsReturned" INTEGER,
    "executionTime" INTEGER,
    "resultPreview" TEXT,
    "explainPlan" TEXT,
    "errorMessage" TEXT,
    "executedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QueryExecution_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QueryExecution_savedQueryId_fkey" FOREIGN KEY ("savedQueryId") REFERENCES "SavedQuery" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PerformanceRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "runType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT,
    "findings" TEXT,
    "recommendations" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "PerformanceRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Migration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "upSQL" TEXT NOT NULL,
    "downSQL" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "appliedAt" DATETIME,
    "sourceDialect" TEXT NOT NULL,
    "targetDialect" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "dependsOn" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Migration_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DataLifecycleRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "targetTable" TEXT NOT NULL,
    "targetColumns" TEXT,
    "configuration" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DataLifecycleRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AIConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AIConversation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AIMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DatabaseConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dialect" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "database" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordEncrypted" TEXT NOT NULL,
    "sslEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sslConfig" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTestedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DatabaseConnection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "AIProviderConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT,
    "baseUrl" TEXT,
    "model" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "maxTokens" INTEGER NOT NULL DEFAULT 4096,
    "temperature" REAL NOT NULL DEFAULT 0.3,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
CREATE INDEX "QueryExecution_projectId_executedAt_idx" ON "QueryExecution"("projectId", "executedAt");

-- CreateIndex
CREATE INDEX "PerformanceRun_projectId_startedAt_idx" ON "PerformanceRun"("projectId", "startedAt");

-- CreateIndex
CREATE INDEX "Migration_projectId_status_idx" ON "Migration"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Migration_projectId_version_key" ON "Migration"("projectId", "version");

-- CreateIndex
CREATE INDEX "DataLifecycleRule_projectId_ruleType_idx" ON "DataLifecycleRule"("projectId", "ruleType");

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
