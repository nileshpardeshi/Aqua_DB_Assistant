/**
 * Performance Testing Suite — Routes
 * API collections, chains, scenarios, load test runs, and AI analysis.
 */

import { Router } from 'express';
import express from 'express';
import {
  parseSwagger,
  listCollections,
  getCollection,
  createCollection,
  updateCollection,
  deleteCollection,
  createEndpoint,
  updateEndpoint,
  deleteEndpoint,
  listChains,
  getChain,
  createChain,
  updateChain,
  deleteChain,
  addStep,
  updateStep,
  deleteStep,
  reorderSteps,
  executeChain,
  listScenarios,
  createScenario,
  updateScenario,
  deleteScenario,
  startRun,
  listRuns,
  getRun,
  streamMetrics,
  stopRun,
  generateReport,
  aiAnalyzeChain,
  aiSuggestAssertions,
  seedDemo,
} from '../controllers/pt-suite.controller.js';

const router = Router();

// Larger body limit for swagger specs
const largeBody = express.json({ limit: '10mb' });

// ── Swagger Parsing ──────────────────────────────────────────────────────────
router.post('/swagger/parse', largeBody, parseSwagger);

// ── Collections ──────────────────────────────────────────────────────────────
router.get('/collections', listCollections);
router.post('/collections', createCollection);
router.get('/collections/:id', getCollection);
router.put('/collections/:id', updateCollection);
router.delete('/collections/:id', deleteCollection);

// ── Endpoints ────────────────────────────────────────────────────────────────
router.post('/collections/:collectionId/endpoints', createEndpoint);
router.put('/endpoints/:id', updateEndpoint);
router.delete('/endpoints/:id', deleteEndpoint);

// ── Chains ───────────────────────────────────────────────────────────────────
router.get('/chains', listChains);
router.post('/chains', createChain);
router.get('/chains/:id', getChain);
router.put('/chains/:id', updateChain);
router.delete('/chains/:id', deleteChain);

// ── Chain Steps ──────────────────────────────────────────────────────────────
router.post('/chains/:chainId/steps', addStep);
router.put('/steps/:id', updateStep);
router.delete('/steps/:id', deleteStep);
router.post('/chains/:chainId/reorder', reorderSteps);

// ── Chain Execution (test run) ───────────────────────────────────────────────
router.post('/chains/:chainId/execute', executeChain);

// ── Scenarios ────────────────────────────────────────────────────────────────
router.get('/scenarios', listScenarios);
router.post('/scenarios', createScenario);
router.put('/scenarios/:id', updateScenario);
router.delete('/scenarios/:id', deleteScenario);

// ── Test Runs ────────────────────────────────────────────────────────────────
router.post('/runs', startRun);
router.get('/runs', listRuns);
router.get('/runs/:id', getRun);
router.get('/runs/:runId/stream', streamMetrics);
router.post('/runs/:runId/stop', stopRun);
router.post('/runs/:runId/report', generateReport);

// ── Demo Data ────────────────────────────────────────────────────────────────
router.get('/demo/seed', seedDemo);

// ── AI Endpoints ─────────────────────────────────────────────────────────────
router.post('/ai/analyze-chain', aiAnalyzeChain);
router.post('/ai/suggest-assertions', aiSuggestAssertions);

export default router;
