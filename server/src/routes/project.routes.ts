import { Router } from 'express';
import * as projectController from '../controllers/project.controller.js';
import { validate } from '../middleware/validate.js';
import {
  createProjectSchema,
  updateProjectSchema,
  projectIdParamSchema,
  projectListQuerySchema,
} from '../validators/project.validator.js';

const router = Router();

// POST   /projects            – Create a new project
router.post(
  '/',
  validate(createProjectSchema, 'body'),
  projectController.create,
);

// GET    /projects            – List projects (with pagination/search/filter)
router.get(
  '/',
  validate(projectListQuerySchema, 'query'),
  projectController.list,
);

// GET    /projects/stats/global – Global dashboard stats (MUST be before /:projectId)
router.get('/stats/global', projectController.getGlobalStats);

// GET    /projects/:projectId – Get a single project
router.get(
  '/:projectId',
  validate(projectIdParamSchema, 'params'),
  projectController.getById,
);

// PATCH  /projects/:projectId – Update a project
router.patch(
  '/:projectId',
  validate(projectIdParamSchema, 'params'),
  validate(updateProjectSchema, 'body'),
  projectController.update,
);

// DELETE /projects/:projectId – Soft-delete (archive) a project
router.delete(
  '/:projectId',
  validate(projectIdParamSchema, 'params'),
  projectController.remove,
);

// GET    /projects/:projectId/stats – Get project statistics
router.get(
  '/:projectId/stats',
  validate(projectIdParamSchema, 'params'),
  projectController.getStats,
);

export default router;
