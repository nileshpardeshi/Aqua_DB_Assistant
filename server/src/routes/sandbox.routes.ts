import { Router } from 'express';
import * as sandboxController from '../controllers/sandbox.controller.js';

const router = Router({ mergeParams: true });

// GET    /status               – Get sandbox schema status
router.get('/status', sandboxController.status);

// POST   /execute              – Execute SQL in sandbox schema
router.post('/execute', sandboxController.execute);

// GET    /tables/:tableName    – Query sandbox table data (paginated)
router.get('/tables/:tableName', sandboxController.queryTable);

// POST   /promote              – Promote sandbox data to real tables
router.post('/promote', sandboxController.promote);

// POST   /cleanup-promoted     – Drop promoted tables from project schema
router.post('/cleanup-promoted', sandboxController.cleanupPromoted);

// DELETE /                     – Cleanup (drop) sandbox schema
router.delete('/', sandboxController.cleanup);

export default router;
