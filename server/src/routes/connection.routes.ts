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

// POST   /:connectionId/test       – Test connection (real connectivity)
router.post('/:connectionId/test', connectionController.test);

// POST   /:connectionId/query      – Run SQL query via connection
router.post('/:connectionId/query', connectionController.runQuery);

// GET    /:connectionId/introspect – Introspect schemas & tables
router.get('/:connectionId/introspect', connectionController.introspect);

export default router;
