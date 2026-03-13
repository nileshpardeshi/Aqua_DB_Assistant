import { Router } from 'express';
import * as aiUsageController from '../controllers/ai-usage.controller.js';

const router = Router();

// GET    /summary        – Aggregated usage summary
router.get('/summary', aiUsageController.summary);

// GET    /by-module      – Usage broken down by module
router.get('/by-module', aiUsageController.byModule);

// GET    /by-provider    – Usage broken down by provider
router.get('/by-provider', aiUsageController.byProvider);

// GET    /by-project     – Usage broken down by project
router.get('/by-project', aiUsageController.byProject);

// GET    /top-calls      – Most expensive AI calls
router.get('/top-calls', aiUsageController.topCalls);

// GET    /trend          – Usage trend over time
router.get('/trend', aiUsageController.trend);

// GET    /current-month  – Current month usage + budget status
router.get('/current-month', aiUsageController.currentMonth);

// GET    /budget         – List all budget configs
router.get('/budget', aiUsageController.getBudget);

// PUT    /budget         – Create or update a budget config
router.put('/budget', aiUsageController.updateBudget);

// DELETE /budget/:id     – Remove a budget config
router.delete('/budget/:id', aiUsageController.removeBudget);

export default router;
