import { Router } from 'express';
import * as dataSheetMappingController from '../controllers/data-sheet-mapping.controller.js';

const router = Router({ mergeParams: true });

// GET    /                  – List data sheet mappings
router.get('/', dataSheetMappingController.list);

// POST   /                  – Create a data sheet mapping
router.post('/', dataSheetMappingController.create);

// GET    /:mappingId        – Get a single data sheet mapping
router.get('/:mappingId', dataSheetMappingController.getById);

// PATCH  /:mappingId        – Update a data sheet mapping
router.patch('/:mappingId', dataSheetMappingController.update);

// DELETE /:mappingId        – Delete a data sheet mapping
router.delete('/:mappingId', dataSheetMappingController.remove);

export default router;
