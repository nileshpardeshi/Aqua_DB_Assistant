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

// POST   /projects/:projectId/schema/tables              – Create table manually
router.post('/tables', schemaController.createTable);

// PUT    /projects/:projectId/schema/tables/:tableId     – Update table
router.put('/tables/:tableId', schemaController.updateTable);

// DELETE /projects/:projectId/schema/tables/:tableId     – Delete table
router.delete('/tables/:tableId', schemaController.deleteTable);

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

// GET    /projects/:projectId/schema/export                – Export schema as DDL
router.get('/export', schemaController.exportSchema);

// Schema namespace management
router.get('/schemas', schemaController.listSchemas);
router.post('/schemas', schemaController.createSchema);
router.put('/schemas/:schemaName', schemaController.renameSchema);
router.delete('/schemas/:schemaName', schemaController.deleteSchemaNamespace);

// Trigger CRUD
router.get('/tables/:tableId/triggers', schemaController.listTriggers);
router.post('/tables/:tableId/triggers', schemaController.createTrigger);
router.put('/tables/:tableId/triggers/:triggerId', schemaController.updateTrigger);
router.delete('/tables/:tableId/triggers/:triggerId', schemaController.deleteTrigger);
router.patch('/tables/:tableId/triggers/:triggerId/toggle', schemaController.toggleTrigger);

export default router;
