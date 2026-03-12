import { Router } from 'express';
import * as auditController from '../controllers/audit.controller.js';

const router = Router();

// GET    /                  – List audit logs (with optional filters)
router.get('/', auditController.list);

// GET    /:logId            – Get a single audit log
router.get('/:logId', auditController.getById);

export default router;
