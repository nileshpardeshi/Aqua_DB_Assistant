import { Router } from 'express';
import express from 'express';
import {
  parseReportEndpoint,
  detectType,
  analyzeReport,
  compareReports,
  analyzeIncident,
} from '../controllers/awr.controller.js';

const router = Router();

// Larger body limit for report endpoints (AWR/logs can be 10-50MB each)
const largeBody = express.json({ limit: '50mb' });

// Parse report into structured metrics (no AI)
router.post('/parse', largeBody, parseReportEndpoint);

// Auto-detect report type
router.post('/detect-type', detectType);

// Full analysis: parse + AI analysis
router.post('/analyze', largeBody, analyzeReport);

// Compare two reports
router.post('/compare', largeBody, compareReports);

// Incident Time-Machine: multi-source timeline + AI root cause (multiple large files)
router.post('/incident-analyze', largeBody, analyzeIncident);

export default router;
