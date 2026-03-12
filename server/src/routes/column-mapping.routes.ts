import { Router } from 'express';
import * as columnMappingController from '../controllers/column-mapping.controller.js';

const router = Router({ mergeParams: true });

// GET    /                  – List column mappings
router.get('/', columnMappingController.list);

// POST   /                  – Create a column mapping
router.post('/', columnMappingController.create);

// GET    /:mappingId        – Get a single column mapping
router.get('/:mappingId', columnMappingController.getById);

// PATCH  /:mappingId        – Update a column mapping
router.patch('/:mappingId', columnMappingController.update);

// DELETE /:mappingId        – Delete a column mapping
router.delete('/:mappingId', columnMappingController.remove);

export default router;
