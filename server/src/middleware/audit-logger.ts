/**
 * Audit Logger Middleware
 *
 * Automatically logs mutating API requests (POST/PUT/PATCH/DELETE)
 * to the AuditLog table after the response is sent.
 *
 * Captures: action, entity, entityId, projectId, IP, user-agent.
 * Runs fire-and-forget so it never blocks the response.
 */

import type { Request, Response, NextFunction } from 'express';
import { logAction } from '../services/audit.service.js';
import { logger } from '../config/logger.js';

// HTTP method → audit action mapping
const METHOD_ACTION: Record<string, string> = {
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

// Routes to skip (high-frequency, read-only, or meta endpoints)
const SKIP_PATTERNS = [
  '/api/v1/audit-logs',      // Don't audit the audit endpoint itself
  '/api/v1/ai-usage',        // Token usage tracking (too noisy)
  '/api/v1/tools/awr/parse', // Parse-only (no side effects)
  '/api/v1/tools/awr/detect-type',
];

/**
 * Derive the entity name from the URL path.
 * e.g. /api/v1/projects/:id → "project"
 *      /api/v1/projects/:id/schemas → "schema"
 *      /api/v1/tools/awr/analyze → "awr-report"
 */
function deriveEntity(path: string): string {
  // Remove query string and /api/v1 prefix
  const clean = path.split('?')[0].replace(/^\/api\/v1\//, '');

  // Map known route patterns to entity names
  const entityMap: Array<[RegExp, string]> = [
    [/^projects\/[^/]+\/schemas/, 'schema'],
    [/^projects\/[^/]+\/queries/, 'query'],
    [/^projects\/[^/]+\/files/, 'file'],
    [/^projects\/[^/]+\/migrations/, 'migration'],
    [/^projects\/[^/]+\/dr/, 'dr-assessment'],
    [/^projects\/[^/]+\/cost-optimizer/, 'cost-assessment'],
    [/^projects\/[^/]+\/data-lifecycle/, 'data-lifecycle'],
    [/^projects\/[^/]+\/connections/, 'connection'],
    [/^projects\/[^/]+\/saved-diagrams/, 'diagram'],
    [/^projects\/[^/]+\/column-mappings/, 'column-mapping'],
    [/^projects\/[^/]+\/data-sheet-mappings/, 'data-sheet-mapping'],
    [/^projects\/[^/]+\/data-migration/, 'data-migration'],
    [/^projects\/[^/]+\/performance/, 'performance'],
    [/^projects/, 'project'],
    [/^tools\/awr\/incident-analyze/, 'incident-analysis'],
    [/^tools\/awr\/compare/, 'awr-comparison'],
    [/^tools\/awr\/analyze/, 'awr-analysis'],
    [/^tools\/dialect/, 'dialect-conversion'],
    [/^tools\//, 'tool'],
    [/^ai\//, 'ai-analysis'],
    [/^settings/, 'settings'],
    [/^sandbox/, 'sandbox'],
  ];

  for (const [pattern, entity] of entityMap) {
    if (pattern.test(clean)) return entity;
  }

  // Fallback: use last meaningful path segment
  const segments = clean.split('/').filter(Boolean);
  return segments[segments.length - 1] || 'unknown';
}

/**
 * Derive a specific action label from the route.
 * More descriptive than just "CREATE" or "UPDATE".
 */
function deriveAction(method: string, path: string): string {
  const base = METHOD_ACTION[method] || method;
  const clean = path.split('?')[0].replace(/^\/api\/v1\//, '');

  // Special action overrides
  if (/awr\/analyze/.test(clean)) return 'ANALYZE';
  if (/awr\/compare/.test(clean)) return 'ANALYZE';
  if (/awr\/incident-analyze/.test(clean)) return 'ANALYZE';
  if (/\/analyze$/.test(clean)) return 'ANALYZE';
  if (/\/execute$/.test(clean)) return 'EXECUTE';
  if (/\/export$/.test(clean)) return 'EXPORT';
  if (/\/import$/.test(clean)) return 'IMPORT';
  if (/\/upload$/.test(clean)) return 'UPLOAD';
  if (/\/archive$/.test(clean)) return 'UPDATE';

  return base;
}

/**
 * Extract entityId from URL params (last UUID-like segment).
 */
function extractEntityId(path: string): string | undefined {
  const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  const matches = path.match(uuidPattern);
  return matches ? matches[matches.length - 1] : undefined;
}

/**
 * Extract projectId from URL.
 */
function extractProjectId(path: string): string | undefined {
  const match = path.match(/\/projects\/([0-9a-f-]{36})/i);
  return match ? match[1] : undefined;
}

/**
 * Build a concise details string from the request body.
 */
function buildDetails(req: Request, entity: string): string | undefined {
  const body = req.body;
  if (!body || typeof body !== 'object') return undefined;

  const parts: string[] = [];

  // Capture key identifying fields (keep it concise)
  if (body.name) parts.push(`name: ${body.name}`);
  if (body.dialect) parts.push(`dialect: ${body.dialect}`);
  if (body.fileName) parts.push(`file: ${body.fileName}`);
  if (body.reportType) parts.push(`type: ${body.reportType}`);
  if (body.sources && Array.isArray(body.sources)) {
    parts.push(`sources: ${body.sources.length} files`);
  }

  return parts.length > 0 ? parts.join(', ') : undefined;
}

/**
 * Audit logger middleware.
 * Attach to the Express app BEFORE routes.
 * Only logs mutating requests (POST/PUT/PATCH/DELETE) that return 2xx.
 */
export function auditLogger(req: Request, res: Response, next: NextFunction): void {
  // Only audit mutating methods
  if (!METHOD_ACTION[req.method]) {
    next();
    return;
  }

  // Skip noisy/meta endpoints
  if (SKIP_PATTERNS.some((p) => req.originalUrl.startsWith(p))) {
    next();
    return;
  }

  // Hook into response finish to log after success
  const originalEnd = res.end;
  res.end = function (this: Response, chunk?: unknown, encoding?: unknown, cb?: () => void) {
    // Restore original
    res.end = originalEnd;
    const result = originalEnd.call(this, chunk as string, encoding as BufferEncoding, cb);

    // Only log successful mutations (2xx status)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const action = deriveAction(req.method, req.originalUrl);
      const entity = deriveEntity(req.originalUrl);
      const entityId = extractEntityId(req.originalUrl);
      const projectId = extractProjectId(req.originalUrl);
      const details = buildDetails(req, entity);

      // Fire-and-forget — never block the response
      logAction({
        projectId,
        action,
        entity,
        entityId,
        details,
        ipAddress: (req.ip || req.socket?.remoteAddress || '').replace('::ffff:', ''),
        userAgent: req.get('user-agent')?.slice(0, 500),
      }).catch((err) => {
        logger.warn(`Audit log failed: ${err.message}`);
      });
    }

    return result;
  };

  next();
}
