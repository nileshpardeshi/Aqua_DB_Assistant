import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import * as auditService from '../services/audit.service.js';
import { prisma } from '../config/prisma.js';

// ---------- List ----------

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { projectId, action, entity, startDate, endDate, page, limit } =
    req.query as Record<string, string | undefined>;

  const result = await auditService.listLogs(projectId, {
    action,
    entity,
    startDate,
    endDate,
    page: page ? parseInt(page, 10) : undefined,
    limit: limit ? parseInt(limit, 10) : undefined,
  });

  res.json({
    success: true,
    data: {
      logs: result.data,
      meta: result.meta,
    },
  });
});

// ---------- Get by ID ----------

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const logId = req.params.logId as string;
  const log = await auditService.getLog(logId);

  res.json({
    success: true,
    data: log,
  });
});

// ---------- Seed Demo Data ----------

export const seedDemo = asyncHandler(async (_req: Request, res: Response) => {
  // Check if demo data was already seeded (look for our marker)
  const marker = await prisma.auditLog.findFirst({ where: { details: { contains: 'E-Commerce Platform, dialect: postgresql' } } });
  if (marker) {
    const total = await prisma.auditLog.count();
    res.json({ success: true, message: `Demo data already seeded (${total} total logs).` });
    return;
  }

  const now = Date.now();
  const min = 60_000;
  const hr = 3_600_000;

  const demoLogs = [
    { action: 'CREATE', entity: 'project', details: 'name: E-Commerce Platform, dialect: postgresql', ipAddress: '192.168.1.100', createdAt: new Date(now - 2 * min) },
    { action: 'UPLOAD', entity: 'file', details: 'file: ecommerce_schema.sql (48.2 KB)', ipAddress: '192.168.1.100', createdAt: new Date(now - 5 * min) },
    { action: 'CREATE', entity: 'schema', details: 'Parsed 14 tables, 87 columns, 12 foreign keys from SQL file', ipAddress: '192.168.1.100', createdAt: new Date(now - 5 * min + 500) },
    { action: 'ANALYZE', entity: 'ai-analysis', details: 'AI schema review — 14 tables, dialect: postgresql', ipAddress: '192.168.1.100', createdAt: new Date(now - 12 * min) },
    { action: 'EXECUTE', entity: 'query', details: 'SELECT o.order_id, c.name FROM orders o JOIN customers c ON ...', ipAddress: '192.168.1.100', createdAt: new Date(now - 18 * min) },
    { action: 'CREATE', entity: 'query', details: 'name: Monthly Revenue Report', ipAddress: '192.168.1.100', createdAt: new Date(now - 20 * min) },
    { action: 'UPDATE', entity: 'connection', details: 'name: Production DB, dialect: postgresql', ipAddress: '192.168.1.101', createdAt: new Date(now - 35 * min) },
    { action: 'ANALYZE', entity: 'awr-analysis', details: 'file: oracle-awr-PRODDB-2026-03-14.html', ipAddress: '192.168.1.100', createdAt: new Date(now - 1 * hr) },
    { action: 'ANALYZE', entity: 'incident-analysis', details: 'sources: 3 files', ipAddress: '192.168.1.100', createdAt: new Date(now - 1.5 * hr) },
    { action: 'CREATE', entity: 'migration', details: 'name: add_payment_status_column', ipAddress: '192.168.1.100', createdAt: new Date(now - 2 * hr) },
    { action: 'UPDATE', entity: 'settings', details: 'Updated AI provider to Anthropic, model: claude-sonnet-4', ipAddress: '192.168.1.100', createdAt: new Date(now - 3 * hr) },
    { action: 'CREATE', entity: 'dr-assessment', details: 'name: Production DR Plan Q1 2026', ipAddress: '192.168.1.102', createdAt: new Date(now - 4 * hr) },
    { action: 'ANALYZE', entity: 'dr-assessment', details: 'AI DR strategy analysis for Production DR Plan', ipAddress: '192.168.1.102', createdAt: new Date(now - 4 * hr + 30_000) },
    { action: 'CREATE', entity: 'cost-assessment', details: 'name: AWS RDS Cost Review', ipAddress: '192.168.1.100', createdAt: new Date(now - 5 * hr) },
    { action: 'ANALYZE', entity: 'cost-assessment', details: 'AI cost optimization analysis — 3 recommendations', ipAddress: '192.168.1.100', createdAt: new Date(now - 5 * hr + 45_000) },
    { action: 'EXPORT', entity: 'schema', details: 'Exported DDL for 14 tables as schema_export.sql', ipAddress: '192.168.1.100', createdAt: new Date(now - 6 * hr) },
    { action: 'DELETE', entity: 'query', details: 'Deleted saved query: Temp Debug Query', ipAddress: '192.168.1.100', createdAt: new Date(now - 8 * hr) },
    { action: 'CREATE', entity: 'diagram', details: 'name: Full ER Diagram', ipAddress: '192.168.1.101', createdAt: new Date(now - 10 * hr) },
    { action: 'ANALYZE', entity: 'dialect-conversion', details: 'dialect: mysql → postgresql', ipAddress: '192.168.1.100', createdAt: new Date(now - 12 * hr) },
    { action: 'CREATE', entity: 'project', details: 'name: Analytics Warehouse, dialect: snowflake', ipAddress: '192.168.1.100', createdAt: new Date(now - 24 * hr) },
    { action: 'UPLOAD', entity: 'file', details: 'file: analytics_schema.sql (112.7 KB)', ipAddress: '192.168.1.100', createdAt: new Date(now - 24 * hr + 2 * min) },
    { action: 'CREATE', entity: 'data-lifecycle', details: 'name: 90-day retention policy for user_sessions', ipAddress: '192.168.1.100', createdAt: new Date(now - 36 * hr) },
    { action: 'EXECUTE', entity: 'query', details: 'SELECT COUNT(*) FROM orders WHERE created_at > NOW() - INTERVAL 30 DAY', ipAddress: '192.168.1.101', createdAt: new Date(now - 48 * hr) },
    { action: 'DELETE', entity: 'project', details: 'Archived project: Legacy CRM Migration', ipAddress: '192.168.1.100', createdAt: new Date(now - 72 * hr) },
    { action: 'IMPORT', entity: 'data-migration', details: 'Imported 24,573 rows from users_export.csv', ipAddress: '192.168.1.102', createdAt: new Date(now - 96 * hr) },
  ];

  await prisma.auditLog.createMany({
    data: demoLogs.map((log) => ({
      action: log.action,
      entity: log.entity,
      details: log.details,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt,
    })),
  });

  res.json({ success: true, message: `Seeded ${demoLogs.length} demo audit logs.` });
});
