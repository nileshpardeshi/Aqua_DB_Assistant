import { Router } from 'express';
import * as costController from '../controllers/cost-optimizer.controller.js';

const router = Router({ mergeParams: true });

// GET    /                          – List cost assessments
router.get('/', costController.list);

// POST   /                          – Create a cost assessment (draft)
router.post('/', costController.create);

// GET    /:assessmentId             – Get a single assessment
router.get('/:assessmentId', costController.getById);

// PATCH  /:assessmentId             – Update an assessment
router.patch('/:assessmentId', costController.update);

// DELETE /:assessmentId             – Delete an assessment
router.delete('/:assessmentId', costController.remove);

// POST   /:assessmentId/analyze     – Run AI cost optimization analysis
router.post('/:assessmentId/analyze', costController.analyze);

export default router;
