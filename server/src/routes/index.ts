import { Router } from 'express';
import healthRoutes from './health.routes.js';
import projectRoutes from './project.routes.js';
import fileRoutes from './file.routes.js';
import schemaRoutes from './schema.routes.js';
import aiRoutes from './ai.routes.js';
import settingsRoutes from './settings.routes.js';
import queryRoutes from './query.routes.js';
import performanceRoutes from './performance.routes.js';
import migrationRoutes from './migration.routes.js';
import columnMappingRoutes from './column-mapping.routes.js';
import dataMigrationRoutes from './data-migration.routes.js';
import dataSheetMappingRoutes from './data-sheet-mapping.routes.js';
import savedDiagramRoutes from './saved-diagram.routes.js';
import dataLifecycleRoutes from './data-lifecycle.routes.js';
import connectionRoutes from './connection.routes.js';
import auditRoutes from './audit.routes.js';
import aiUsageRoutes from './ai-usage.routes.js';
import toolsRoutes from './tools.routes.js';
import sandboxRoutes from './sandbox.routes.js';
import awrRoutes from './awr.routes.js';
import drRoutes from './disaster-recovery.routes.js';
import costOptimizerRoutes from './cost-optimizer.routes.js';

const router = Router();

// Health check (no /api/v1 prefix)
router.use('/health', healthRoutes);

// API v1 routes
router.use('/api/v1/projects', projectRoutes);
router.use('/api/v1/projects/:projectId/files', fileRoutes);
router.use('/api/v1/projects/:projectId/schema', schemaRoutes);
router.use('/api/v1/projects/:projectId/queries', queryRoutes);
router.use('/api/v1/projects/:projectId/performance', performanceRoutes);
router.use('/api/v1/projects/:projectId/migrations', migrationRoutes);
router.use('/api/v1/projects/:projectId/column-mappings', columnMappingRoutes);
router.use('/api/v1/projects/:projectId/data-migration', dataMigrationRoutes);
router.use('/api/v1/projects/:projectId/data-sheet-mappings', dataSheetMappingRoutes);
router.use('/api/v1/projects/:projectId/saved-diagrams', savedDiagramRoutes);
router.use('/api/v1/projects/:projectId/data-lifecycle', dataLifecycleRoutes);
router.use('/api/v1/projects/:projectId/connections', connectionRoutes);
router.use('/api/v1/ai', aiRoutes);
router.use('/api/v1/settings', settingsRoutes);
router.use('/api/v1/audit-logs', auditRoutes);
router.use('/api/v1/ai-usage', aiUsageRoutes);
router.use('/api/v1/tools', toolsRoutes);
router.use('/api/v1/projects/:projectId/sandbox', sandboxRoutes);
router.use('/api/v1/tools/awr', awrRoutes);
router.use('/api/v1/projects/:projectId/dr', drRoutes);
router.use('/api/v1/projects/:projectId/cost-optimizer', costOptimizerRoutes);

export default router;
