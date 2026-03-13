import { Router } from 'express';
import * as savedDiagramController from '../controllers/saved-diagram.controller.js';

const router = Router({ mergeParams: true });

// GET    /                        – List saved diagrams
router.get('/', savedDiagramController.list);

// POST   /                        – Create a saved diagram
router.post('/', savedDiagramController.create);

// GET    /:diagramId              – Get a single saved diagram
router.get('/:diagramId', savedDiagramController.getById);

// PATCH  /:diagramId              – Update a saved diagram
router.patch('/:diagramId', savedDiagramController.update);

// DELETE /:diagramId              – Delete a saved diagram
router.delete('/:diagramId', savedDiagramController.remove);

// POST   /:diagramId/duplicate    – Duplicate a saved diagram
router.post('/:diagramId/duplicate', savedDiagramController.duplicate);

export default router;
