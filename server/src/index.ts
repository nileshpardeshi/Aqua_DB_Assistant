import 'dotenv/config';

import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { prisma } from './config/prisma.js';
import { createApp } from './app.js';

async function bootstrap() {
  // Verify database connectivity
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Failed to connect to database', { error });
    process.exit(1);
  }

  // Backfill: create PostgreSQL schemas for existing projects that don't have one
  try {
    const projects = await prisma.project.findMany({
      where: { dbSchema: null, status: { not: 'archived' } },
      select: { id: true, name: true },
    });

    for (const p of projects) {
      const shortId = p.id.replace(/-/g, '').substring(0, 8);
      const dbSchema = `proj_${shortId}`;
      try {
        await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${dbSchema}"`);
        await prisma.project.update({ where: { id: p.id }, data: { dbSchema } });
        logger.info('Backfilled project schema', { projectId: p.id, name: p.name, dbSchema });
      } catch (err) {
        logger.warn('Failed to backfill project schema', {
          projectId: p.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (projects.length > 0) {
      logger.info(`Backfilled ${projects.length} project schema(s)`);
    }
  } catch (err) {
    logger.warn('Project schema backfill skipped', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(
      `Aqua DB Copilot server running on port ${env.PORT} [${env.NODE_ENV}]`,
    );
    logger.info(`Health check: http://localhost:${env.PORT}/health`);
    logger.info(`API base:     http://localhost:${env.PORT}/api/v1`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      await prisma.$disconnect();
      logger.info('Database disconnected');
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle unhandled rejections / uncaught exceptions
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection', { reason });
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', { error });
    process.exit(1);
  });
}

bootstrap();
