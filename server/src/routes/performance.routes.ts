import { Router } from 'express';
import * as performanceController from '../controllers/performance.controller.js';

const router = Router({ mergeParams: true });

// GET    /                  – List performance runs
router.get('/', performanceController.list);

// POST   /                  – Create a performance run
router.post('/', performanceController.create);

// GET    /:runId            – Get a single performance run
router.get('/:runId', performanceController.getById);

// PATCH  /:runId            – Update a performance run
router.patch('/:runId', performanceController.update);

export default router;
