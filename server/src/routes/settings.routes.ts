import { Router } from 'express';
import * as settingsController from '../controllers/settings.controller.js';

const router = Router();

// GET /settings/ai-providers - List configured AI providers
router.get('/ai-providers', settingsController.listAIProviders);

// POST /settings/ai-providers - Add or update an AI provider config
router.post('/ai-providers', settingsController.upsertAIProvider);

// DELETE /settings/ai-providers/:id - Remove an AI provider config
router.delete('/ai-providers/:id', settingsController.deleteAIProvider);

// POST /settings/ai-providers/:id/test - Test AI provider connectivity
router.post('/ai-providers/:id/test', settingsController.testAIProvider);

export default router;
