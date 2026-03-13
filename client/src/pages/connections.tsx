import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Plug,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  WifiOff,
  Trash2,
  Pencil,
  X,
  Eye,
  EyeOff,
  Zap,
  Server,
  Database,
  Lock,
  Play,
  Search,
  Table2,
  Clock,
  Activity,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DATABASE_DIALECTS } from '@/config/constants';
import {
  useConnections,
  useCreateConnection,
  useUpdateConnection,
  useDeleteConnection,
  useTestConnection,
  useRunQuery,
  useIntrospect,
} from '@/hooks/use-connections';
import type { Connection, IntrospectResult } from '@/hooks/use-connections';

const DIALECTS = DATABASE_DIALECTS.filter((d) =>
  ['postgresql', 'mysql', 'oracle', 'sqlserver', 'mariadb', 'snowflake', 'bigquery'].includes(d.value)
);

const DEFAULT_PORTS: Record<string, number> = {
  postgresql: 5432,
  mysql: 3306,
  oracle: 1521,
  sqlserver: 1433,
  mariadb: 3306,
  snowflake: 443,
  bigquery: 443,
};

const STATUS_CONFIG = {
  connected: {
    icon: CheckCircle2,
    label: 'Connected',
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-950/30',
    dot: 'bg-green-500',
  },
  disconnected: {
    icon: WifiOff,
    label: 'Not Tested',
    color: 'text-slate-500 dark:text-slate-400',
    bg: 'bg-slate-50 dark:bg-slate-800',
    dot: 'bg-slate-400',
  },
  error: {
    icon: XCircle,
    label: 'Error',
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/30',
    dot: 'bg-red-500',
  },
};

export function Connections() {
  const { projectId } = useParams();
  const { data: connections = [], isLoading } = useConnections(projectId);
  const createConnection = useCreateConnection();
  const updateConnection = useUpdateConnection();
  const deleteConnection = useDeleteConnection();
  const testConnection = useTestConnection();
  const runQueryMutation = useRunQuery();
  const introspectMutation = useIntrospect();

  const [showForm, setShowForm] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    id: string;
    success: boolean;
    message: string;
    latencyMs?: number;
    serverVersion?: string;
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Query panel state
  const [queryPanelId, setQueryPanelId] = useState<string | null>(null);
  const [querySql, setQuerySql] = useState('SELECT 1');
  const [queryResult, setQueryResult] = useState<{
    success: boolean;
    columns: string[];
    rows: Record<string, unknown>[];
    rowCount: number;
    durationMs: number;
    error?: string;
  } | null>(null);

  // Introspect state
  const [introspectPanelId, setIntrospectPanelId] = useState<string | null>(null);
  const [introspectData, setIntrospectData] = useState<IntrospectResult | null>(null);
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set());

  // Form state
  const [formName, setFormName] = useState('');
  const [formHost, setFormHost] = useState('');
  const [formPort, setFormPort] = useState(5432);
  const [formDatabase, setFormDatabase] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formDialect, setFormDialect] = useState('postgresql');
  const [formSsl, setFormSsl] = useState(true);

  const resetForm = useCallback(() => {
    setFormName('');
    setFormHost('');
    setFormPort(5432);
    setFormDatabase('');
    setFormUsername('');
    setFormPassword('');
    setFormDialect('postgresql');
    setFormSsl(true);
    setShowPassword(false);
    setEditingConnection(null);
  }, []);

  const handleOpenForm = useCallback(() => {
    resetForm();
    setShowForm(true);
  }, [resetForm]);

  const handleEditConnection = useCallback((conn: Connection) => {
    setFormName(conn.name);
    setFormHost(conn.host);
    setFormPort(conn.port);
    setFormDatabase(conn.database);
    setFormUsername(conn.username);
    setFormPassword('');
    setFormDialect(conn.dialect);
    setFormSsl(conn.ssl);
    setEditingConnection(conn);
    setShowForm(true);
  }, []);

  const handleDialectChange = useCallback(
    (dialect: string) => {
      setFormDialect(dialect);
      if (!editingConnection) {
        setFormPort(DEFAULT_PORTS[dialect] || 5432);
      }
    },
    [editingConnection]
  );

  const handleSave = useCallback(async () => {
    if (!formName.trim() || !formHost.trim() || !formDatabase.trim() || !projectId) return;

    try {
      if (editingConnection) {
        await updateConnection.mutateAsync({
          projectId,
          connectionId: editingConnection.id,
          data: {
            name: formName.trim(),
            host: formHost.trim(),
            port: formPort,
            database: formDatabase.trim(),
            username: formUsername.trim(),
            ...(formPassword ? { password: formPassword } : {}),
            dialect: formDialect,
            ssl: formSsl,
          },
        });
      } else {
        await createConnection.mutateAsync({
          projectId,
          name: formName.trim(),
          host: formHost.trim(),
          port: formPort,
          database: formDatabase.trim(),
          username: formUsername.trim(),
          password: formPassword,
          dialect: formDialect,
          ssl: formSsl,
        });
      }
      setShowForm(false);
      resetForm();
    } catch {
      // Error handled by mutation
    }
  }, [formName, formHost, formPort, formDatabase, formUsername, formPassword, formDialect, formSsl, projectId, editingConnection, createConnection, updateConnection, resetForm]);

  const handleTestConnection = useCallback(
    async (connectionId: string) => {
      if (!projectId) return;
      setTestingId(connectionId);
      setTestResult(null);

      try {
        const result = await testConnection.mutateAsync({
          projectId,
          connectionId,
        });
        setTestResult({
          id: connectionId,
          success: result.success,
          message: result.message || (result.success ? 'Connection successful' : 'Connection failed'),
          latencyMs: result.latencyMs,
          serverVersion: result.serverVersion,
        });
      } catch (err: unknown) {
        const message =
          err && typeof err === 'object' && 'message' in err
            ? (err as { message: string }).message
            : 'Connection test failed';
        setTestResult({
          id: connectionId,
          success: false,
          message,
        });
      } finally {
        setTestingId(null);
      }
    },
    [projectId, testConnection]
  );

  const handleDeleteConnection = useCallback(
    async (connectionId: string) => {
      if (!projectId) return;
      setDeletingId(connectionId);
      try {
        await deleteConnection.mutateAsync({ projectId, connectionId });
        // Clear panels if this connection was open
        if (queryPanelId === connectionId) setQueryPanelId(null);
        if (introspectPanelId === connectionId) setIntrospectPanelId(null);
      } catch {
        // Error handled by mutation
      } finally {
        setDeletingId(null);
      }
    },
    [projectId, deleteConnection, queryPanelId, introspectPanelId]
  );

  const handleRunQuery = useCallback(async () => {
    if (!projectId || !queryPanelId || !querySql.trim()) return;
    setQueryResult(null);

    try {
      const result = await runQueryMutation.mutateAsync({
        projectId,
        connectionId: queryPanelId,
        sql: querySql.trim(),
      });
      setQueryResult(result);
    } catch (err: unknown) {
      setQueryResult({
        success: false,
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: 0,
        error: err instanceof Error ? err.message : 'Query execution failed',
      });
    }
  }, [projectId, queryPanelId, querySql, runQueryMutation]);

  const handleIntrospect = useCallback(
    async (connectionId: string) => {
      if (!projectId) return;

      if (introspectPanelId === connectionId) {
        setIntrospectPanelId(null);
        setIntrospectData(null);
        return;
      }

      setIntrospectPanelId(connectionId);
      setIntrospectData(null);

      try {
        const result = await introspectMutation.mutateAsync({
          projectId,
          connectionId,
        });
        setIntrospectData(result);
        // Auto-expand first schema
        if (result.schemas.length > 0) {
          setExpandedSchemas(new Set([result.schemas[0]]));
        }
      } catch {
        setIntrospectData(null);
      }
    },
    [projectId, introspectPanelId, introspectMutation]
  );

  const toggleSchema = (schema: string) => {
    setExpandedSchemas((prev) => {
      const next = new Set(prev);
      if (next.has(schema)) next.delete(schema);
      else next.add(schema);
      return next;
    });
  };

  const getDialectInfo = (value: string) =>
    DATABASE_DIALECTS.find((d) => d.value === value);

  const isMutating = createConnection.isPending || updateConnection.isPending;

  return (
    <div className="p-6 lg:p-8 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 flex items-center justify-center">
            <Plug className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">
              Database Connections
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Connect to live databases — test, query, and introspect schemas
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenForm}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-aqua-600 rounded-lg hover:bg-aqua-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Connection
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-aqua-500 animate-spin" />
            <p className="text-sm text-muted-foreground">Loading connections...</p>
          </div>
        </div>
      )}

      {/* Connection Cards Grid */}
      {!isLoading && connections.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {connections.map((conn) => {
            const status = STATUS_CONFIG[conn.status] || STATUS_CONFIG.disconnected;
            const dialectInfo = getDialectInfo(conn.dialect);
            const isTestingThis = testingId === conn.id;
            const isDeletingThis = deletingId === conn.id;
            const testResultForThis =
              testResult?.id === conn.id ? testResult : null;

            return (
              <div
                key={conn.id}
                className="bg-card border border-slate-200 dark:border-slate-700 rounded-xl p-5 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md transition-all group"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${dialectInfo?.color || '#64748b'}20, ${dialectInfo?.color || '#64748b'}10)`,
                      }}
                    >
                      <Server
                        className="w-4 h-4"
                        style={{ color: dialectInfo?.color || '#64748b' }}
                      />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-foreground truncate">
                        {conn.name}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={cn(
                            'w-1.5 h-1.5 rounded-full',
                            conn.status === 'connected' && 'animate-pulse',
                            status.dot
                          )}
                        />
                        <span className={cn('text-[10px] font-medium', status.color)}>
                          {status.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Dialect Badge */}
                  {dialectInfo && (
                    <span
                      className="px-2 py-0.5 text-[10px] font-bold rounded-full"
                      style={{
                        backgroundColor: `${dialectInfo.color}15`,
                        color: dialectInfo.color,
                      }}
                    >
                      {dialectInfo.label}
                    </span>
                  )}
                </div>

                {/* Connection Details */}
                <div className="space-y-1.5 mb-4">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground w-14 flex-shrink-0">Host:</span>
                    <span className="font-mono text-foreground truncate">
                      {conn.host}:{conn.port}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground w-14 flex-shrink-0">Database:</span>
                    <span className="font-mono text-foreground truncate">
                      {conn.database}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground w-14 flex-shrink-0">User:</span>
                    <span className="font-mono text-foreground">
                      {conn.username}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground w-14 flex-shrink-0">SSL:</span>
                    <span className={cn('font-medium', conn.ssl ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground')}>
                      {conn.ssl ? (
                        <span className="flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          Enabled
                        </span>
                      ) : (
                        'Disabled'
                      )}
                    </span>
                  </div>
                  {conn.lastTestedAt && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground w-14 flex-shrink-0">Tested:</span>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(conn.lastTestedAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Test Result */}
                {testResultForThis && (
                  <div
                    className={cn(
                      'text-xs px-3 py-2.5 rounded-lg mb-3 space-y-1',
                      testResultForThis.success
                        ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                        : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                    )}
                  >
                    <div className="flex items-center gap-1">
                      {testResultForThis.success ? (
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      )}
                      <span className="font-medium">{testResultForThis.message}</span>
                    </div>
                    {testResultForThis.success && (
                      <div className="flex items-center gap-3 pl-4.5 text-[10px] opacity-80">
                        {testResultForThis.latencyMs !== undefined && (
                          <span className="flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            {testResultForThis.latencyMs}ms
                          </span>
                        )}
                        {testResultForThis.serverVersion && (
                          <span className="flex items-center gap-1">
                            <Server className="w-3 h-3" />
                            {testResultForThis.serverVersion}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => handleTestConnection(conn.id)}
                    disabled={isTestingThis}
                    className={cn(
                      'flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                      isTestingThis
                        ? 'bg-slate-100 dark:bg-slate-800 text-muted-foreground cursor-not-allowed border-slate-200 dark:border-slate-700'
                        : 'text-aqua-700 dark:text-aqua-400 bg-aqua-50 dark:bg-aqua-950/30 border-aqua-200 dark:border-aqua-800 hover:bg-aqua-100 dark:hover:bg-aqua-900/30'
                    )}
                  >
                    {isTestingThis ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Zap className="w-3 h-3" />
                        Test
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setQueryPanelId(queryPanelId === conn.id ? null : conn.id);
                      setQueryResult(null);
                      setQuerySql('SELECT 1');
                    }}
                    className={cn(
                      'inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                      queryPanelId === conn.id
                        ? 'text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800'
                        : 'text-slate-600 dark:text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30 border-slate-200 dark:border-slate-700'
                    )}
                    title="Run Query"
                  >
                    <Play className="w-3 h-3" />
                    Query
                  </button>

                  <button
                    onClick={() => handleIntrospect(conn.id)}
                    disabled={introspectMutation.isPending && introspectPanelId === conn.id}
                    className={cn(
                      'inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                      introspectPanelId === conn.id
                        ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                        : 'text-slate-600 dark:text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 border-slate-200 dark:border-slate-700'
                    )}
                    title="Introspect Schema"
                  >
                    {introspectMutation.isPending && introspectPanelId === conn.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Search className="w-3 h-3" />
                    )}
                    Schema
                  </button>

                  <button
                    onClick={() => handleEditConnection(conn)}
                    className="inline-flex items-center justify-center p-1.5 text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDeleteConnection(conn.id)}
                    disabled={isDeletingThis}
                    className="inline-flex items-center justify-center p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                    title="Delete"
                  >
                    {isDeletingThis ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Query Panel */}
      {queryPanelId && (
        <div className="bg-card border border-violet-200 dark:border-violet-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-violet-50 dark:bg-violet-950/30 border-b border-violet-200 dark:border-violet-800">
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">
                Run Query — {connections.find((c) => c.id === queryPanelId)?.name}
              </span>
            </div>
            <button
              onClick={() => { setQueryPanelId(null); setQueryResult(null); }}
              className="p-1 rounded text-violet-400 hover:text-violet-600 dark:hover:text-violet-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            <div className="flex gap-2">
              <textarea
                value={querySql}
                onChange={(e) => setQuerySql(e.target.value)}
                placeholder="Enter SQL query..."
                rows={3}
                className="flex-1 px-3 py-2 text-sm font-mono border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 resize-none"
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handleRunQuery();
                  }
                }}
              />
              <button
                onClick={handleRunQuery}
                disabled={runQueryMutation.isPending || !querySql.trim()}
                className={cn(
                  'px-4 py-2 text-sm font-semibold rounded-lg transition-colors self-end',
                  runQueryMutation.isPending || !querySql.trim()
                    ? 'bg-slate-100 dark:bg-slate-800 text-muted-foreground cursor-not-allowed'
                    : 'bg-violet-600 text-white hover:bg-violet-700'
                )}
              >
                {runQueryMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </button>
            </div>

            <p className="text-[10px] text-muted-foreground">
              Press Ctrl+Enter to execute. Results limited to 500 rows.
            </p>

            {/* Query Result */}
            {queryResult && (
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-xs">
                  {queryResult.success ? (
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {queryResult.rowCount} row{queryResult.rowCount !== 1 ? 's' : ''} returned
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Error
                    </span>
                  )}
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {queryResult.durationMs}ms
                  </span>
                </div>

                {queryResult.error && (
                  <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-xs text-red-700 dark:text-red-300 font-mono">
                    {queryResult.error}
                  </div>
                )}

                {queryResult.success && queryResult.columns.length > 0 && (
                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-auto max-h-80">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                          {queryResult.columns.map((col) => (
                            <th
                              key={col}
                              className="px-3 py-2 text-left font-semibold text-foreground whitespace-nowrap"
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {queryResult.rows.map((row, i) => (
                          <tr
                            key={i}
                            className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                          >
                            {queryResult.columns.map((col) => (
                              <td
                                key={col}
                                className="px-3 py-1.5 font-mono text-foreground whitespace-nowrap max-w-[300px] truncate"
                              >
                                {row[col] === null ? (
                                  <span className="text-muted-foreground italic">NULL</span>
                                ) : (
                                  String(row[col])
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Introspect Panel */}
      {introspectPanelId && (
        <div className="bg-card border border-amber-200 dark:border-amber-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                Schema Introspection — {connections.find((c) => c.id === introspectPanelId)?.name}
              </span>
              {introspectData && (
                <span className="text-xs text-amber-500 dark:text-amber-400">
                  ({introspectData.totalTables} table{introspectData.totalTables !== 1 ? 's' : ''} across {introspectData.schemas.length} schema{introspectData.schemas.length !== 1 ? 's' : ''})
                </span>
              )}
            </div>
            <button
              onClick={() => { setIntrospectPanelId(null); setIntrospectData(null); }}
              className="p-1 rounded text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4">
            {introspectMutation.isPending && !introspectData && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
                <span className="ml-2 text-sm text-muted-foreground">Introspecting database...</span>
              </div>
            )}

            {introspectData && (
              <div className="space-y-2">
                {introspectData.schemas.map((schema) => {
                  const tables = introspectData.tables.filter((t) => t.schema === schema);
                  const isExpanded = expandedSchemas.has(schema);

                  return (
                    <div key={schema} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleSchema(schema)}
                        className="flex items-center justify-between w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <Database className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span className="text-xs font-semibold text-foreground">{schema}</span>
                          <span className="text-[10px] text-muted-foreground">
                            ({tables.length} table{tables.length !== 1 ? 's' : ''})
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </button>

                      {isExpanded && tables.length > 0 && (
                        <div className="border-t border-slate-200 dark:border-slate-700">
                          {tables.map((table) => (
                            <div
                              key={`${table.schema}.${table.name}`}
                              className="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 last:border-b-0"
                            >
                              <div className="flex items-center gap-2">
                                <Table2 className="w-3 h-3 text-slate-400" />
                                <span className="font-mono text-foreground">{table.name}</span>
                                {table.type !== 'BASE TABLE' && (
                                  <span className="text-[9px] font-medium text-muted-foreground uppercase px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                                    {table.type === 'VIEW' ? 'view' : table.type}
                                  </span>
                                )}
                              </div>
                              {table.estimated_rows !== null && table.estimated_rows !== undefined && (
                                <span className="text-[10px] text-muted-foreground">
                                  ~{Number(table.estimated_rows).toLocaleString()} rows
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {isExpanded && tables.length === 0 && (
                        <div className="px-3 py-3 text-xs text-muted-foreground italic border-t border-slate-200 dark:border-slate-700">
                          No tables in this schema
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && connections.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 flex items-center justify-center mb-6">
            <Database className="w-10 h-10 text-orange-600 dark:text-orange-400" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            No connections yet
          </h3>
          <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
            Add a database connection to test connectivity, run live queries,
            and introspect schemas directly from your databases.
          </p>
          <button
            onClick={handleOpenForm}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-aqua-600 rounded-lg hover:bg-aqua-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Your First Connection
          </button>
        </div>
      )}

      {/* Add/Edit Connection Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => {
              setShowForm(false);
              resetForm();
            }}
          />
          <div className="relative bg-card rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-foreground">
                {editingConnection ? 'Edit Connection' : 'Add Connection'}
              </h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Connection Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Production DB"
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
                  autoFocus
                />
              </div>

              {/* Dialect */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Database Dialect
                </label>
                <select
                  value={formDialect}
                  onChange={(e) => handleDialectChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
                >
                  {DIALECTS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Host & Port */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Host
                  </label>
                  <input
                    type="text"
                    value={formHost}
                    onChange={(e) => setFormHost(e.target.value)}
                    placeholder="localhost or db.example.com"
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Port
                  </label>
                  <input
                    type="number"
                    value={formPort}
                    onChange={(e) => setFormPort(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
                  />
                </div>
              </div>

              {/* Database */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Database Name
                </label>
                <input
                  type="text"
                  value={formDatabase}
                  onChange={(e) => setFormDatabase(e.target.value)}
                  placeholder="my_database"
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
                />
              </div>

              {/* Username & Password */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    placeholder="db_user"
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder={editingConnection ? '(unchanged)' : 'password'}
                      className="w-full px-3 py-2 pr-9 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* SSL Toggle */}
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">SSL / TLS</p>
                    <p className="text-[10px] text-muted-foreground">
                      Encrypt connection to database server
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setFormSsl(!formSsl)}
                  className={cn(
                    'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                    formSsl ? 'bg-aqua-500' : 'bg-slate-300 dark:bg-slate-600'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm',
                      formSsl ? 'translate-x-4.5' : 'translate-x-0.5'
                    )}
                  />
                </button>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={
                    !formName.trim() ||
                    !formHost.trim() ||
                    !formDatabase.trim() ||
                    isMutating
                  }
                  className={cn(
                    'inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-colors',
                    formName.trim() && formHost.trim() && formDatabase.trim()
                      ? 'text-white bg-aqua-600 hover:bg-aqua-700'
                      : 'text-muted-foreground bg-slate-100 dark:bg-slate-800 cursor-not-allowed'
                  )}
                >
                  {isMutating ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Plus className="w-3 h-3" />
                      {editingConnection ? 'Update' : 'Save Connection'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Connections;
