import { Router } from 'express';
import * as settingsController from '../controllers/settings.controller.js';

const router = Router();

// GET /settings/ai-providers - List configured AI providers
router.get('/ai-providers', settingsController.listAIProviders);

// POST /settings/ai-providers - Add or update an AI provider config
router.post('/ai-providers', settingsController.upsertAIProvider);

// PATCH /settings/ai-providers/:id/toggle - Enable/disable an AI provider
router.patch('/ai-providers/:id/toggle', settingsController.toggleAIProvider);

// DELETE /settings/ai-providers/:id - Remove an AI provider config
router.delete('/ai-providers/:id', settingsController.deleteAIProvider);

// POST /settings/ai-providers/seed - Seed default provider configurations
router.post('/ai-providers/seed', settingsController.seedDefaultProviders);

// POST /settings/ai-providers/:id/test - Test AI provider connectivity
router.post('/ai-providers/:id/test', settingsController.testAIProvider);

export default router;
