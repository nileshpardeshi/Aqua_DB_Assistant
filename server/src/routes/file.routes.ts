import { Router } from 'express';
import * as fileController from '../controllers/file.controller.js';
import { validate } from '../middleware/validate.js';
import { upload } from '../services/file-upload.service.js';
import {
  fileProjectParamSchema,
  fileIdParamSchema,
  fileListQuerySchema,
} from '../validators/file.validator.js';

const router = Router({ mergeParams: true });

// POST   /projects/:projectId/files           – Upload a file
router.post(
  '/',
  validate(fileProjectParamSchema, 'params'),
  upload.single('file'),
  fileController.uploadFile,
);

// GET    /projects/:projectId/files           – List files for a project
router.get(
  '/',
  validate(fileProjectParamSchema, 'params'),
  validate(fileListQuerySchema, 'query'),
  fileController.listFiles,
);

// GET    /projects/:projectId/files/:fileId   – Get a single file
router.get(
  '/:fileId',
  validate(fileIdParamSchema, 'params'),
  fileController.getFile,
);

// DELETE /projects/:projectId/files/:fileId   – Delete a file
router.delete(
  '/:fileId',
  validate(fileIdParamSchema, 'params'),
  fileController.deleteFile,
);

export default router;
