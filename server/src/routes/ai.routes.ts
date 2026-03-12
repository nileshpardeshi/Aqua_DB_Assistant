import { Router } from 'express';
import * as aiController from '../controllers/ai.controller.js';

const router = Router();

// POST /ai/chat - General AI chat with SSE streaming
router.post('/chat', aiController.chat);

// POST /ai/schema/suggest - AI schema design suggestions
router.post('/schema/suggest', aiController.suggestSchema);

// POST /ai/schema/review - AI schema review
router.post('/schema/review', aiController.reviewSchema);

// POST /ai/query/generate - Natural language to SQL
router.post('/query/generate', aiController.generateSQL);

// POST /ai/query/optimize - AI query optimization
router.post('/query/optimize', aiController.optimizeQuery);

// POST /ai/query/explain - Explain query in plain English
router.post('/query/explain', aiController.explainQuery);

// POST /ai/performance/recommend-indexes - AI index recommendations
router.post('/performance/recommend-indexes', aiController.recommendIndexes);

// POST /ai/performance/recommend-partitions - AI partition recommendations
router.post('/performance/recommend-partitions', aiController.recommendPartitions);

// POST /ai/schema/trigger-analysis - AI trigger validation and analysis
router.post('/schema/trigger-analysis', aiController.analyzeTrigger);

// POST /ai/datagen/synthetic-scripts - Generate synthetic INSERT scripts
router.post('/datagen/synthetic-scripts', aiController.generateSyntheticData);

// POST /ai/datagen/query-planner - Simulate query execution plan
router.post('/datagen/query-planner', aiController.simulateQueryPlan);

// POST /ai/datagen/data-distribution - Simulate data distribution statistics
router.post('/datagen/data-distribution', aiController.simulateDataDistribution);

// POST /ai/docs/generate - Generate database documentation
router.post('/docs/generate', aiController.generateDocumentation);

// POST /ai/migration/assess - AI migration risk assessment
router.post('/migration/assess', aiController.assessMigration);

// POST /ai/migration/generate-scripts - AI migration script generation
router.post('/migration/generate-scripts', aiController.generateMigrationScripts);

// POST /ai/migration/suggest-column-mapping - AI column mapping suggestions
router.post('/migration/suggest-column-mapping', aiController.suggestColumnMapping);

export default router;
