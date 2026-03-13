import { Router } from 'express';
import * as toolsController from '../controllers/tools.controller.js';

const router = Router();

// POST /tools/jpa-analyze - Analyze JPA/JPQL/HQL query with AI
router.post('/jpa-analyze', toolsController.analyzeJPA);

// POST /tools/jpa-parse - Parse Java files and extract JPA queries
router.post('/jpa-parse', toolsController.parseJPAFiles);

// GET  /tools/jpa-samples - Load built-in sample JPA files
router.get('/jpa-samples', toolsController.getSampleJPAFiles);

// POST /tools/jpa-batch-analyze - Batch analyze multiple JPA queries
router.post('/jpa-batch-analyze', toolsController.batchAnalyzeJPA);

// POST /tools/convert-sql - Convert SQL between dialects
router.post('/convert-sql', toolsController.convertSQL);

// POST /tools/validate-sql - Validate SQL and extract schema info
router.post('/validate-sql', toolsController.validateSQL);

// POST /tools/detect-dialect - Detect SQL dialect from source text
router.post('/detect-dialect', toolsController.detectDialect);

export default router;
