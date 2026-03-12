import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    // Quick DB connectivity check
    let dbStatus: 'ok' | 'error' = 'ok';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'error';
    }

    const uptime = process.uptime();

    res.json({
      success: true,
      data: {
        status: dbStatus === 'ok' ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: Math.round(uptime),
        database: dbStatus,
        version: process.env.npm_package_version ?? '1.0.0',
      },
    });
  }),
);

export default router;
