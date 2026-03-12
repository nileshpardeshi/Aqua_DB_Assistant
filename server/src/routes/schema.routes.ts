// ---------------------------------------------------------------------------
// Schema Routes – Express Router for Schema Intelligence API
// ---------------------------------------------------------------------------

import { Router } from 'express';
import * as schemaController from '../controllers/schema.controller.js';

const router = Router({ mergeParams: true });

// GET    /projects/:projectId/schema/tables              – List tables
router.get('/tables', schemaController.listTables);

// GET    /projects/:projectId/schema/tables/:tableId     – Get single table
router.get('/tables/:tableId', schemaController.getTable);

// GET    /projects/:projectId/schema/relationships       – Get all relationships
router.get('/relationships', schemaController.getRelationships);

// GET    /projects/:projectId/schema/er-diagram          – Get ER diagram data
router.get('/er-diagram', schemaController.getERDiagram);

// POST   /projects/:projectId/schema/parse               – Parse an uploaded file
router.post('/parse', schemaController.parseUploadedFile);

// GET    /projects/:projectId/schema/snapshots            – List snapshots
router.get('/snapshots', schemaController.listSnapshots);

// POST   /projects/:projectId/schema/snapshots            – Create a snapshot
router.post('/snapshots', schemaController.createSnapshot);

export default router;
