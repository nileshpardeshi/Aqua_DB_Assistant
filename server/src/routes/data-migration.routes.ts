import { Router } from 'express';
import * as ctrl from '../controllers/data-migration.controller.js';
import { csvUpload } from '../controllers/data-migration.controller.js';

const router = Router({ mergeParams: true });

// Upload a CSV file and analyze it
router.post('/upload-csv', csvUpload.single('csvFile'), ctrl.uploadCSV);

// Re-analyze an existing CSV file
router.post('/analyze-csv', ctrl.analyzeCSVFile);

// Resolve table dependencies (topological sort)
router.post('/resolve-dependencies', ctrl.resolveDependencies);

// Start async script generation
router.post('/generate-script', ctrl.generateScript);

// Poll generation status
router.get('/generate-script/:jobId/status', ctrl.getGenerationStatus);

// Download generated script
router.get('/download/:filename', ctrl.downloadScript);

export default router;
