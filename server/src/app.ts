import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { auditLogger } from './middleware/audit-logger.js';
import routes from './routes/index.js';

export function createApp(): express.Application {
  const app = express();

  // --------------- Security middleware ---------------

  app.use(helmet());

  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true,
    }),
  );

  // --------------- Rate limiter ---------------

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // limit each IP to 200 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
      },
    },
  });

  app.use(limiter);

  // --------------- Body parsers ---------------

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // --------------- Request logging ---------------

  app.use((req, _res, next) => {
    logger.http(`${req.method} ${req.url}`);
    next();
  });

  // --------------- Audit logging ---------------

  app.use(auditLogger);

  // --------------- Routes ---------------

  app.use(routes);

  // --------------- 404 handler ---------------

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'The requested endpoint does not exist',
      },
    });
  });

  // --------------- Global error handler ---------------

  app.use(errorHandler);

  return app;
}
