import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/api-client';

// ---- Types ----

export interface AuditLog {
  id: string;
  action: string;
  entityType?: string;
  entity?: string;
  entityId?: string;
  entityName?: string;
  details?: string;
  projectId?: string;
  createdAt: string;
  ipAddress?: string;
  userId?: string;
}

export interface AuditLogFilters {
  action?: string;
  entityType?: string;
  projectId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface AuditLogResponse {
  data: AuditLog[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ---- Mock data for development ----

const MOCK_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'al-001',
    action: 'CREATE',
    entityType: 'project',
    entityId: 'proj-1',
    entityName: 'E-Commerce DB',
    details: 'Created new project "E-Commerce DB" with PostgreSQL dialect',
    projectId: 'proj-1',
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    ipAddress: '192.168.1.100',
  },
  {
    id: 'al-002',
    action: 'UPLOAD',
    entityType: 'file',
    entityId: 'file-1',
    entityName: 'schema_v2.sql',
    details: 'Uploaded SQL file schema_v2.sql (24.5 KB) and parsed 12 tables',
    projectId: 'proj-1',
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    ipAddress: '192.168.1.100',
  },
  {
    id: 'al-003',
    action: 'UPDATE',
    entityType: 'schema',
    entityId: 'tbl-users',
    entityName: 'users table',
    details: 'Added index idx_users_email on users.email column',
    projectId: 'proj-1',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    ipAddress: '192.168.1.100',
  },
  {
    id: 'al-004',
    action: 'CREATE',
    entityType: 'query',
    entityId: 'q-1',
    entityName: 'Monthly Revenue Report',
    details: 'Saved new query "Monthly Revenue Report" to workspace',
    projectId: 'proj-1',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    ipAddress: '192.168.1.100',
  },
  {
    id: 'al-005',
    action: 'VIEW',
    entityType: 'schema',
    entityId: 'tbl-orders',
    entityName: 'orders table',
    details: 'Viewed ER diagram for orders table relationships',
    projectId: 'proj-1',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    ipAddress: '192.168.1.101',
  },
  {
    id: 'al-006',
    action: 'DELETE',
    entityType: 'query',
    entityId: 'q-old',
    entityName: 'Temp Debug Query',
    details: 'Deleted saved query "Temp Debug Query"',
    projectId: 'proj-1',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    ipAddress: '192.168.1.100',
  },
  {
    id: 'al-007',
    action: 'EXPORT',
    entityType: 'schema',
    entityId: 'proj-1',
    entityName: 'E-Commerce DB Schema',
    details: 'Exported full schema as SQL DDL file (schema_export_v2.sql)',
    projectId: 'proj-1',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    ipAddress: '192.168.1.100',
  },
  {
    id: 'al-008',
    action: 'CREATE',
    entityType: 'migration',
    entityId: 'mig-1',
    entityName: 'add_payment_status',
    details: 'Generated migration "add_payment_status" adding status column to payments table',
    projectId: 'proj-1',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
    ipAddress: '192.168.1.100',
  },
  {
    id: 'al-009',
    action: 'UPDATE',
    entityType: 'connection',
    entityId: 'conn-1',
    entityName: 'Production DB',
    details: 'Updated connection string for "Production DB" connection',
    projectId: 'proj-1',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    ipAddress: '192.168.1.102',
  },
  {
    id: 'al-010',
    action: 'UPDATE',
    entityType: 'settings',
    entityId: 'settings-ai',
    entityName: 'AI Provider Settings',
    details: 'Updated Anthropic API key and changed model to claude-sonnet-4',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    ipAddress: '192.168.1.100',
  },
  {
    id: 'al-011',
    action: 'CREATE',
    entityType: 'project',
    entityId: 'proj-2',
    entityName: 'Analytics Platform',
    details: 'Created new project "Analytics Platform" with Snowflake dialect',
    projectId: 'proj-2',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
    ipAddress: '192.168.1.100',
  },
  {
    id: 'al-012',
    action: 'VIEW',
    entityType: 'query',
    entityId: 'q-2',
    entityName: 'User Growth Report',
    details: 'Executed and viewed results for "User Growth Report" query',
    projectId: 'proj-1',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
    ipAddress: '192.168.1.101',
  },
];

// ---- Query Keys ----

const auditLogKeys = {
  all: ['audit-logs'] as const,
  lists: () => [...auditLogKeys.all, 'list'] as const,
  list: (filters?: AuditLogFilters) => [...auditLogKeys.lists(), filters] as const,
};

// ---- Hook ----

export function useAuditLogs(filters?: AuditLogFilters) {
  return useQuery({
    queryKey: auditLogKeys.list(filters),
    queryFn: async (): Promise<AuditLogResponse> => {
      try {
        const params = new URLSearchParams();
        if (filters?.action) params.set('action', filters.action);
        if (filters?.entityType) params.set('entityType', filters.entityType);
        if (filters?.projectId) params.set('projectId', filters.projectId);
        if (filters?.startDate) params.set('startDate', filters.startDate);
        if (filters?.endDate) params.set('endDate', filters.endDate);
        if (filters?.page) params.set('page', String(filters.page));
        if (filters?.limit) params.set('limit', String(filters.limit));

        const query = params.toString();
        const url = query ? `/audit-logs?${query}` : '/audit-logs';
        const response = await apiClient.get(url);
        return response as unknown as AuditLogResponse;
      } catch {
        // Fallback to mock data when API is not available
        const page = filters?.page ?? 1;
        const limit = filters?.limit ?? 10;

        let filtered = [...MOCK_AUDIT_LOGS];

        if (filters?.action) {
          filtered = filtered.filter((log) => log.action === filters.action);
        }
        if (filters?.entityType) {
          filtered = filtered.filter((log) => log.entityType === filters.entityType);
        }
        if (filters?.startDate) {
          const start = new Date(filters.startDate);
          filtered = filtered.filter((log) => new Date(log.createdAt) >= start);
        }
        if (filters?.endDate) {
          const end = new Date(filters.endDate);
          filtered = filtered.filter((log) => new Date(log.createdAt) <= end);
        }

        const total = filtered.length;
        const totalPages = Math.ceil(total / limit);
        const startIdx = (page - 1) * limit;
        const data = filtered.slice(startIdx, startIdx + limit);

        return { data, meta: { total, page, limit, totalPages } };
      }
    },
  });
}
