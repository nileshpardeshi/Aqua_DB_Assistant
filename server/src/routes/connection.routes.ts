import { Router } from 'express';
import * as connectionController from '../controllers/connection.controller.js';

const router = Router({ mergeParams: true });

// GET    /                  – List database connections
router.get('/', connectionController.list);

// POST   /                  – Create a database connection
router.post('/', connectionController.create);

// GET    /:connectionId     – Get a single connection
router.get('/:connectionId', connectionController.getById);

// PATCH  /:connectionId     – Update a connection
router.patch('/:connectionId', connectionController.update);

// DELETE /:connectionId     – Delete a connection
router.delete('/:connectionId', connectionController.remove);

// POST   /:connectionId/test – Test connection
router.post('/:connectionId/test', connectionController.test);

export default router;
