import { Router } from 'express';
import * as drController from '../controllers/disaster-recovery.controller.js';

const router = Router({ mergeParams: true });

// GET    /                          – List DR assessments
router.get('/', drController.list);

// POST   /                          – Create a DR assessment (draft)
router.post('/', drController.create);

// GET    /:assessmentId             – Get a single assessment
router.get('/:assessmentId', drController.getById);

// PATCH  /:assessmentId             – Update an assessment
router.patch('/:assessmentId', drController.update);

// DELETE /:assessmentId             – Delete an assessment
router.delete('/:assessmentId', drController.remove);

// POST   /:assessmentId/analyze     – Run AI DR strategy analysis
router.post('/:assessmentId/analyze', drController.analyze);

export default router;
