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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DATABASE_DIALECTS } from '@/config/constants';
import {
  useConnections,
  useCreateConnection,
  useUpdateConnection,
  useDeleteConnection,
  useTestConnection,
} from '@/hooks/use-connections';
import type { Connection } from '@/hooks/use-connections';

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
    color: 'text-green-600',
    bg: 'bg-green-50',
    dot: 'bg-green-500',
  },
  disconnected: {
    icon: WifiOff,
    label: 'Disconnected',
    color: 'text-slate-500',
    bg: 'bg-slate-50',
    dot: 'bg-slate-400',
  },
  error: {
    icon: XCircle,
    label: 'Error',
    color: 'text-red-600',
    bg: 'bg-red-50',
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

  const [showForm, setShowForm] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    id: string;
    success: boolean;
    message: string;
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
        // Update existing connection
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
        // Create new connection
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
      } catch {
        // Error handled by mutation
      } finally {
        setDeletingId(null);
      }
    },
    [projectId, deleteConnection]
  );

  const getDialectInfo = (value: string) =>
    DATABASE_DIALECTS.find((d) => d.value === value);

  const isMutating = createConnection.isPending || updateConnection.isPending;

  return (
    <div className="p-6 lg:p-8 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center">
            <Plug className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">
              Connections
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage database connections for this project
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
            const status = STATUS_CONFIG[conn.status];
            const dialectInfo = getDialectInfo(conn.dialect);
            const isTestingThis = testingId === conn.id;
            const isDeletingThis = deletingId === conn.id;
            const testResultForThis =
              testResult?.id === conn.id ? testResult : null;

            return (
              <div
                key={conn.id}
                className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 hover:shadow-md transition-all group"
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
                      <h4 className="text-sm font-semibold text-slate-800 truncate">
                        {conn.name}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={cn(
                            'w-1.5 h-1.5 rounded-full animate-pulse',
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
                    <span className="text-slate-500 w-14 flex-shrink-0">Host:</span>
                    <span className="font-mono text-slate-700 truncate">
                      {conn.host}:{conn.port}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500 w-14 flex-shrink-0">Database:</span>
                    <span className="font-mono text-slate-700 truncate">
                      {conn.database}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500 w-14 flex-shrink-0">User:</span>
                    <span className="font-mono text-slate-700">
                      {conn.username}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500 w-14 flex-shrink-0">SSL:</span>
                    <span className={cn('font-medium', conn.ssl ? 'text-green-600' : 'text-slate-400')}>
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
                </div>

                {/* Test Result */}
                {testResultForThis && (
                  <div
                    className={cn(
                      'text-xs px-3 py-2 rounded-lg mb-3',
                      testResultForThis.success
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    )}
                  >
                    {testResultForThis.success ? (
                      <CheckCircle2 className="w-3 h-3 inline mr-1" />
                    ) : (
                      <XCircle className="w-3 h-3 inline mr-1" />
                    )}
                    {testResultForThis.message}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => handleTestConnection(conn.id)}
                    disabled={isTestingThis}
                    className={cn(
                      'flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                      isTestingThis
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
                        : 'text-aqua-700 bg-aqua-50 border-aqua-200 hover:bg-aqua-100'
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
                    onClick={() => handleEditConnection(conn)}
                    className="inline-flex items-center justify-center p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDeleteConnection(conn.id)}
                    disabled={isDeletingThis}
                    className="inline-flex items-center justify-center p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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

      {/* Empty State */}
      {!isLoading && connections.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center mb-6">
            <Database className="w-10 h-10 text-orange-600" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            No connections yet
          </h3>
          <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
            Add a database connection to enable live schema introspection, query
            execution, and performance monitoring.
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
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
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
                className="p-1 rounded text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Connection Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Production DB"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
                  autoFocus
                />
              </div>

              {/* Dialect */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Database Dialect
                </label>
                <select
                  value={formDialect}
                  onChange={(e) => handleDialectChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Host
                  </label>
                  <input
                    type="text"
                    value={formHost}
                    onChange={(e) => setFormHost(e.target.value)}
                    placeholder="localhost or db.example.com"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Port
                  </label>
                  <input
                    type="number"
                    value={formPort}
                    onChange={(e) => setFormPort(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
                  />
                </div>
              </div>

              {/* Database */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Database Name
                </label>
                <input
                  type="text"
                  value={formDatabase}
                  onChange={(e) => setFormDatabase(e.target.value)}
                  placeholder="my_database"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
                />
              </div>

              {/* Username & Password */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    placeholder="db_user"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder={editingConnection ? '(unchanged)' : 'password'}
                      className="w-full px-3 py-2 pr-9 text-sm border border-slate-200 rounded-lg bg-white text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-slate-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">SSL / TLS</p>
                    <p className="text-[10px] text-slate-500">
                      Encrypt connection to database server
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setFormSsl(!formSsl)}
                  className={cn(
                    'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                    formSsl ? 'bg-aqua-500' : 'bg-slate-300'
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
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
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
                      : 'text-slate-400 bg-slate-100 cursor-not-allowed'
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
