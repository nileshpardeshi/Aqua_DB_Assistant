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
  userAgent?: string;
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
      const params = new URLSearchParams();
      if (filters?.action) params.set('action', filters.action);
      // Backend uses 'entity' param, frontend filter calls it 'entityType'
      if (filters?.entityType) params.set('entity', filters.entityType);
      if (filters?.projectId) params.set('projectId', filters.projectId);
      if (filters?.startDate) params.set('startDate', filters.startDate);
      if (filters?.endDate) params.set('endDate', filters.endDate);
      if (filters?.page) params.set('page', String(filters.page));
      if (filters?.limit) params.set('limit', String(filters.limit));

      const query = params.toString();
      const url = query ? `/audit-logs?${query}` : '/audit-logs';
      // apiClient interceptor unwraps { success, data } → returns data payload
      // Controller returns { success, data: { logs, meta } }
      // So apiClient.get() returns { logs, meta }
      const response = await apiClient.get(url) as Record<string, unknown>;

      const rawData = (response.logs ?? []) as Array<Record<string, unknown>>;
      const rawMeta = (response.meta ?? {}) as Record<string, unknown>;

      const data: AuditLog[] = rawData.map((log) => ({
        id: log.id as string,
        action: log.action as string,
        entityType: (log.entity as string) || undefined,
        entity: log.entity as string,
        entityId: (log.entityId as string) || undefined,
        entityName: undefined, // Backend doesn't store entityName — entity field serves this
        details: (log.details as string) || undefined,
        projectId: (log.projectId as string) || undefined,
        createdAt: log.createdAt as string,
        ipAddress: (log.ipAddress as string) || undefined,
        userAgent: (log.userAgent as string) || undefined,
      }));

      return {
        data,
        meta: {
          total: (rawMeta.totalItems as number) ?? 0,
          page: (rawMeta.page as number) ?? 1,
          limit: (rawMeta.limit as number) ?? 10,
          totalPages: (rawMeta.totalPages as number) ?? 1,
        },
      };
    },
  });
}
