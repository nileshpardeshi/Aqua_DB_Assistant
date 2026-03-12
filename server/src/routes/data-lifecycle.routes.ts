import { Router } from 'express';
import * as dataLifecycleController from '../controllers/data-lifecycle.controller.js';

const router = Router({ mergeParams: true });

// GET    /                  – List data lifecycle rules
router.get('/', dataLifecycleController.list);

// POST   /                  – Create a data lifecycle rule
router.post('/', dataLifecycleController.create);

// GET    /:ruleId           – Get a single rule
router.get('/:ruleId', dataLifecycleController.getById);

// PATCH  /:ruleId           – Update a rule
router.patch('/:ruleId', dataLifecycleController.update);

// DELETE /:ruleId           – Delete a rule
router.delete('/:ruleId', dataLifecycleController.remove);

// POST   /:ruleId/generate-purge-script – Generate purge SQL script
router.post('/:ruleId/generate-purge-script', dataLifecycleController.generatePurgeScript);

export default router;
