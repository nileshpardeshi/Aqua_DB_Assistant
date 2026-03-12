import { Router } from 'express';
import * as queryController from '../controllers/query.controller.js';

const router = Router({ mergeParams: true });

// POST   /execute           – Record a query execution
router.post('/execute', queryController.execute);

// GET    /history           – Get execution history
router.get('/history', queryController.history);

// GET    /                  – List saved queries
router.get('/', queryController.list);

// POST   /                  – Create a saved query
router.post('/', queryController.create);

// GET    /:queryId          – Get a single saved query
router.get('/:queryId', queryController.getById);

// PATCH  /:queryId          – Update a saved query
router.patch('/:queryId', queryController.update);

// DELETE /:queryId          – Delete a saved query
router.delete('/:queryId', queryController.remove);

export default router;
