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

export default router;
