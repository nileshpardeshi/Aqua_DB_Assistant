import { Router } from 'express';
import * as migrationController from '../controllers/migration.controller.js';

const router = Router({ mergeParams: true });

// POST   /convert           – Convert SQL dialect
router.post('/convert', migrationController.convert);

// GET    /                  – List migrations
router.get('/', migrationController.list);

// POST   /                  – Create a migration
router.post('/', migrationController.create);

// GET    /:migrationId      – Get a single migration
router.get('/:migrationId', migrationController.getById);

// PATCH  /:migrationId      – Update a migration
router.patch('/:migrationId', migrationController.update);

// DELETE /:migrationId      – Delete a migration
router.delete('/:migrationId', migrationController.remove);

export default router;
