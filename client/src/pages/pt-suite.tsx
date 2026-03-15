import { useState, useMemo, useCallback } from 'react';
import {
  FolderOpen, Upload, Plus, Trash2, Loader2, ChevronDown, ChevronRight,
  Link2, Play, Square, Eye, FileText, Zap, Timer, Flame, BarChart3,
  TrendingUp, Activity, AlertTriangle, CheckCircle2, XCircle, Search,
  Settings, ArrowDown, ArrowUp, Pencil, ToggleLeft, ToggleRight,
  Gauge, Database, Beaker, Clock, Rocket, Package, X, Copy,
  ArrowRight, ChevronUp, Minus,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
} from 'recharts';
import { cn } from '@/lib/utils';
import {
  useCollections, useCollection, useCreateCollection, useDeleteCollection,
  useParseSwagger, useCreateEndpoint, useDeleteEndpoint,
  useChains, useChain, useCreateChain, useDeleteChain,
  useCreateStep, useUpdateStep, useDeleteStep, useExecuteChain,
  useScenarios, useCreateScenario, useDeleteScenario,
  useRuns, useRun, useStartRun, useStopRun, useGenerateReport,
  useSeedDemo, useRunStream,
} from '@/hooks/use-pt-suite';
import type {
  PtCollection, PtEndpoint, PtChain, PtChainStep, PtScenario,
  PtTestRun, PtMetric, PtChainExecutionResult, PtStepExecutionResult,
  PtAiReport, PtAuthConfig, PtHeader, PtExtractor, PtAssertion,
  PtSlaThreshold,
} from '@/types/pt-suite.types';

// ── Constants ─────────────────────────────────────────────────────────────────

type TabId = 'collections' | 'chains' | 'scenarios' | 'runs' | 'reports' | 'data-factory';

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'collections', label: 'Collections', icon: FolderOpen },
  { id: 'chains', label: 'Chain Designer', icon: Link2 },
  { id: 'scenarios', label: 'Load Scenarios', icon: Gauge },
  { id: 'runs', label: 'Test Runs', icon: Play },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'data-factory', label: 'Data Factory', icon: Database },
];

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  POST: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  PUT: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  PATCH: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const PATTERN_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; color: string; desc: string }> = {
  ramp: { icon: TrendingUp, label: 'Ramp', color: 'text-emerald-400', desc: 'Gradual VU increase' },
  spike: { icon: Zap, label: 'Spike', color: 'text-amber-400', desc: 'Sudden traffic spike' },
  soak: { icon: Timer, label: 'Soak', color: 'text-blue-400', desc: 'Sustained duration' },
  stress: { icon: Flame, label: 'Stress', color: 'text-red-400', desc: 'Push to limits' },
  step: { icon: BarChart3, label: 'Step', color: 'text-purple-400', desc: 'Incremental steps' },
  custom: { icon: Settings, label: 'Custom', color: 'text-slate-400', desc: 'Custom ramp' },
};

const AUTH_TYPES = ['none', 'bearer', 'apiKey', 'basic'] as const;
const BODY_TYPES = ['none', 'json', 'form'] as const;
const EXTRACTOR_SOURCES = ['body', 'header', 'status'] as const;
const ASSERTION_TYPES = ['status', 'body', 'header', 'responseTime'] as const;
const ASSERTION_OPERATORS = ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'contains', 'matches'] as const;
const SLA_METRICS = ['avgLatency', 'p95Latency', 'p99Latency', 'errorRate', 'tps'] as const;
const SLA_OPERATORS = ['lt', 'gt', 'lte', 'gte'] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function MethodBadge({ method }: { method: string }) {
  const m = method.toUpperCase();
  return (
    <span className={cn('px-2 py-0.5 rounded text-xs font-bold border', METHOD_COLORS[m] || 'bg-slate-500/20 text-slate-400 border-slate-500/30')}>
      {m}
    </span>
  );
}

function fmtLatency(ms: number) {
  if (ms < 1) return '<1ms';
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

function fmtTps(v: number) { return v.toLocaleString(undefined, { maximumFractionDigits: 1 }); }
function fmtPct(v: number) { return `${v.toFixed(2)}%`; }
function fmtNum(v: number) { return v.toLocaleString(); }

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: 'bg-emerald-500/20 text-emerald-400',
    running: 'bg-blue-500/20 text-blue-400',
    failed: 'bg-red-500/20 text-red-400',
    stopped: 'bg-amber-500/20 text-amber-400',
    queued: 'bg-slate-500/20 text-slate-400',
  };
  return (
    <span className={cn('px-2 py-0.5 rounded text-xs font-medium', colors[status] || colors.queued)}>
      {status}
    </span>
  );
}

function EmptyState({ icon: Icon, title, subtitle, action }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-slate-500" />
      </div>
      <h3 className="text-lg font-semibold text-slate-300 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 max-w-sm mb-4">{subtitle}</p>
      {action}
    </div>
  );
}

function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className={cn('bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-[85vh] overflow-y-auto', wide ? 'w-full max-w-3xl' : 'w-full max-w-lg')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-slate-200">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

function KvEditor({ items, onChange, keyLabel = 'Key', valueLabel = 'Value' }: {
  items: { key: string; value: string; enabled?: boolean }[];
  onChange: (items: { key: string; value: string; enabled?: boolean }[]) => void;
  keyLabel?: string; valueLabel?: string;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
            placeholder={keyLabel}
            value={item.key}
            onChange={(e) => { const n = [...items]; n[i] = { ...n[i], key: e.target.value }; onChange(n); }}
          />
          <input
            className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
            placeholder={valueLabel}
            value={item.value}
            onChange={(e) => { const n = [...items]; n[i] = { ...n[i], value: e.target.value }; onChange(n); }}
          />
          <button onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="p-1 text-red-400 hover:text-red-300">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...items, { key: '', value: '', enabled: true }])}
        className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
      >
        <Plus className="w-3 h-3" /> Add
      </button>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-slate-300 mb-1">{children}</label>;
}

function Input({ value, onChange, placeholder, type = 'text', className: cls }: {
  value: string | number; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn('w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none', cls)}
    />
  );
}

function Select({ value, onChange, options, className: cls }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn('w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none', cls)}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Btn({ onClick, children, variant = 'primary', disabled, className: cls }: {
  onClick?: () => void; children: React.ReactNode; variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean; className?: string;
}) {
  const base = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed';
  const colors = {
    primary: 'bg-cyan-600 hover:bg-cyan-500 text-white',
    secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-200',
    danger: 'bg-red-600/20 hover:bg-red-600/30 text-red-400',
    ghost: 'hover:bg-slate-700 text-slate-400 hover:text-slate-200',
  };
  return <button onClick={onClick} disabled={disabled} className={cn(base, colors[variant], cls)}>{children}</button>;
}

// ── Tab 1: Collections ────────────────────────────────────────────────────────

function CollectionsTab() {
  const { data: collections, isPending } = useCollections();
  const seedDemo = useSeedDemo();
  const createCollection = useCreateCollection();
  const deleteCollection = useDeleteCollection();
  const parseSwagger = useParseSwagger();
  const createEndpoint = useCreateEndpoint();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSwaggerModal, setShowSwaggerModal] = useState(false);
  const [showNewCollModal, setShowNewCollModal] = useState(false);
  const [showNewEndpointModal, setShowNewEndpointModal] = useState<string | null>(null);

  // Swagger modal state
  const [swaggerText, setSwaggerText] = useState('');
  const [swaggerResult, setSwaggerResult] = useState<{ endpoints: PtEndpoint[]; count: number } | null>(null);

  // New collection modal state
  const [collForm, setCollForm] = useState({ name: '', baseUrl: '', description: '', authType: 'none' as PtAuthConfig['type'], authToken: '', apiKeyName: '', apiKeyValue: '', apiKeyIn: 'header' as 'header' | 'query', username: '', password: '' });
  const [collHeaders, setCollHeaders] = useState<{ key: string; value: string; enabled?: boolean }[]>([]);

  // New endpoint modal state
  const [epForm, setEpForm] = useState({ name: '', method: 'GET', path: '', description: '', bodyType: 'none', bodyTemplate: '' });
  const [epHeaders, setEpHeaders] = useState<{ key: string; value: string; enabled?: boolean }[]>([]);

  const { data: expandedColl } = useCollection(expandedId ?? undefined);

  const handleSwaggerParse = async () => {
    if (!swaggerText.trim()) return;
    try {
      let spec: string | object = swaggerText;
      try { spec = JSON.parse(swaggerText); } catch { /* treat as YAML string */ }
      const result = await parseSwagger.mutateAsync({ spec });
      setSwaggerResult(result);
    } catch { /* error handled by mutation */ }
  };

  const handleSwaggerFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSwaggerText(ev.target?.result as string || '');
    };
    reader.readAsText(file);
  };

  const handleCreateCollection = async () => {
    const authConfig: PtAuthConfig = { type: collForm.authType };
    if (collForm.authType === 'bearer') authConfig.token = collForm.authToken;
    if (collForm.authType === 'apiKey') {
      authConfig.apiKeyName = collForm.apiKeyName;
      authConfig.apiKeyValue = collForm.apiKeyValue;
      authConfig.apiKeyIn = collForm.apiKeyIn;
    }
    if (collForm.authType === 'basic') {
      authConfig.username = collForm.username;
      authConfig.password = collForm.password;
    }
    await createCollection.mutateAsync({
      name: collForm.name,
      baseUrl: collForm.baseUrl,
      description: collForm.description || undefined,
      authConfig: collForm.authType !== 'none' ? authConfig : undefined,
      headers: collHeaders.filter(h => h.key).map(h => ({ ...h, enabled: true })),
    });
    setShowNewCollModal(false);
    setCollForm({ name: '', baseUrl: '', description: '', authType: 'none', authToken: '', apiKeyName: '', apiKeyValue: '', apiKeyIn: 'header', username: '', password: '' });
    setCollHeaders([]);
  };

  const handleCreateEndpoint = async () => {
    if (!showNewEndpointModal) return;
    await createEndpoint.mutateAsync({
      collectionId: showNewEndpointModal,
      data: {
        name: epForm.name,
        method: epForm.method,
        path: epForm.path,
        description: epForm.description || undefined,
        headers: epHeaders.filter(h => h.key).map(h => ({ ...h, enabled: true })),
        bodyType: epForm.bodyType !== 'none' ? epForm.bodyType : undefined,
        bodyTemplate: epForm.bodyTemplate || undefined,
      },
    });
    setShowNewEndpointModal(null);
    setEpForm({ name: '', method: 'GET', path: '', description: '', bodyType: 'none', bodyTemplate: '' });
    setEpHeaders([]);
  };

  if (isPending) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>;
  }

  const list = collections || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-200">API Collections</h3>
          <p className="text-sm text-slate-500">{list.length} collection{list.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <Btn variant="secondary" onClick={() => setShowSwaggerModal(true)}>
            <Upload className="w-4 h-4" /> Upload Swagger
          </Btn>
          <Btn onClick={() => setShowNewCollModal(true)}>
            <Plus className="w-4 h-4" /> New Collection
          </Btn>
        </div>
      </div>

      {/* Empty State */}
      {list.length === 0 && (
        <EmptyState
          icon={FolderOpen}
          title="No API Collections"
          subtitle="Start by uploading a Swagger spec or creating a new collection manually. Or seed demo data to explore the features."
          action={
            <Btn onClick={() => seedDemo.mutate()} disabled={seedDemo.isPending}>
              {seedDemo.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
              Seed Demo Data
            </Btn>
          }
        />
      )}

      {/* Collection Cards */}
      <div className="space-y-3">
        {list.map((coll) => {
          const isExpanded = expandedId === coll.id;
          const endpoints = isExpanded && expandedColl ? expandedColl.endpoints || [] : [];
          return (
            <div key={coll.id} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-750"
                onClick={() => setExpandedId(isExpanded ? null : coll.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                    <FolderOpen className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-200">{coll.name}</h4>
                    <p className="text-xs text-slate-500">{coll.baseUrl}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right text-xs text-slate-500">
                    <div>{coll.endpoints?.length ?? '?'} endpoints</div>
                    <div>{coll.chains?.length ?? 0} chains</div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteCollection.mutate(coll.id); }}
                    className="p-1.5 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-slate-700 px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-slate-300">Endpoints</span>
                    <Btn variant="ghost" onClick={() => setShowNewEndpointModal(coll.id)} className="text-xs px-2 py-1">
                      <Plus className="w-3 h-3" /> Add Endpoint
                    </Btn>
                  </div>
                  {endpoints.length === 0 ? (
                    <p className="text-sm text-slate-500 py-4 text-center">No endpoints yet. Add one or upload a Swagger spec.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-slate-500 border-b border-slate-700">
                            <th className="pb-2 pr-4 w-20">Method</th>
                            <th className="pb-2 pr-4">Path</th>
                            <th className="pb-2 pr-4">Name</th>
                            <th className="pb-2 w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {endpoints.map((ep) => (
                            <tr key={ep.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                              <td className="py-2 pr-4"><MethodBadge method={ep.method} /></td>
                              <td className="py-2 pr-4 text-slate-300 font-mono text-xs">{ep.path}</td>
                              <td className="py-2 pr-4 text-slate-400">{ep.name}</td>
                              <td className="py-2">
                                <button
                                  onClick={() => {/* could add delete endpoint here */}}
                                  className="p-1 text-slate-500 hover:text-red-400"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Swagger Upload Modal */}
      <Modal open={showSwaggerModal} onClose={() => { setShowSwaggerModal(false); setSwaggerText(''); setSwaggerResult(null); }} title="Upload Swagger / OpenAPI">
        <div className="space-y-4">
          {!swaggerResult ? (
            <>
              <div>
                <Label>Paste Swagger JSON or YAML</Label>
                <textarea
                  className="w-full h-48 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:border-cyan-500 focus:outline-none resize-none"
                  placeholder='{"openapi": "3.0.0", ...}'
                  value={swaggerText}
                  onChange={(e) => setSwaggerText(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg cursor-pointer text-sm text-slate-300">
                  <Upload className="w-4 h-4" /> Choose File
                  <input type="file" accept=".json,.yaml,.yml" className="hidden" onChange={handleSwaggerFile} />
                </label>
                <div className="flex-1" />
                <Btn variant="secondary" onClick={() => { setShowSwaggerModal(false); setSwaggerText(''); }}>Cancel</Btn>
                <Btn onClick={handleSwaggerParse} disabled={parseSwagger.isPending || !swaggerText.trim()}>
                  {parseSwagger.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Parse
                </Btn>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h4 className="text-lg font-semibold text-slate-200 mb-1">Swagger Parsed Successfully</h4>
              <p className="text-sm text-slate-400">{swaggerResult.count} endpoints imported</p>
              <div className="mt-4">
                <Btn onClick={() => { setShowSwaggerModal(false); setSwaggerText(''); setSwaggerResult(null); }}>Done</Btn>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* New Collection Modal */}
      <Modal open={showNewCollModal} onClose={() => setShowNewCollModal(false)} title="New Collection" wide>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Name</Label>
              <Input value={collForm.name} onChange={(v) => setCollForm({ ...collForm, name: v })} placeholder="My API" />
            </div>
            <div>
              <Label>Base URL</Label>
              <Input value={collForm.baseUrl} onChange={(v) => setCollForm({ ...collForm, baseUrl: v })} placeholder="https://api.example.com" />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Input value={collForm.description} onChange={(v) => setCollForm({ ...collForm, description: v })} placeholder="Optional description" />
          </div>

          {/* Auth Config */}
          <div>
            <Label>Authentication</Label>
            <Select
              value={collForm.authType}
              onChange={(v) => setCollForm({ ...collForm, authType: v as PtAuthConfig['type'] })}
              options={AUTH_TYPES.map(t => ({ value: t, label: t === 'none' ? 'None' : t === 'bearer' ? 'Bearer Token' : t === 'apiKey' ? 'API Key' : 'Basic Auth' }))}
            />
          </div>
          {collForm.authType === 'bearer' && (
            <div>
              <Label>Bearer Token</Label>
              <Input value={collForm.authToken} onChange={(v) => setCollForm({ ...collForm, authToken: v })} placeholder="eyJhbGciOi..." />
            </div>
          )}
          {collForm.authType === 'apiKey' && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Key Name</Label>
                <Input value={collForm.apiKeyName} onChange={(v) => setCollForm({ ...collForm, apiKeyName: v })} placeholder="X-API-Key" />
              </div>
              <div>
                <Label>Key Value</Label>
                <Input value={collForm.apiKeyValue} onChange={(v) => setCollForm({ ...collForm, apiKeyValue: v })} placeholder="abc123" />
              </div>
              <div>
                <Label>Location</Label>
                <Select value={collForm.apiKeyIn} onChange={(v) => setCollForm({ ...collForm, apiKeyIn: v as 'header' | 'query' })} options={[{ value: 'header', label: 'Header' }, { value: 'query', label: 'Query' }]} />
              </div>
            </div>
          )}
          {collForm.authType === 'basic' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Username</Label>
                <Input value={collForm.username} onChange={(v) => setCollForm({ ...collForm, username: v })} placeholder="user" />
              </div>
              <div>
                <Label>Password</Label>
                <Input value={collForm.password} onChange={(v) => setCollForm({ ...collForm, password: v })} placeholder="pass" type="password" />
              </div>
            </div>
          )}

          {/* Default Headers */}
          <div>
            <Label>Default Headers</Label>
            <KvEditor items={collHeaders} onChange={setCollHeaders} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="secondary" onClick={() => setShowNewCollModal(false)}>Cancel</Btn>
            <Btn onClick={handleCreateCollection} disabled={createCollection.isPending || !collForm.name || !collForm.baseUrl}>
              {createCollection.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Create Collection
            </Btn>
          </div>
        </div>
      </Modal>

      {/* New Endpoint Modal */}
      <Modal open={!!showNewEndpointModal} onClose={() => setShowNewEndpointModal(null)} title="New Endpoint" wide>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Method</Label>
              <Select value={epForm.method} onChange={(v) => setEpForm({ ...epForm, method: v })} options={['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => ({ value: m, label: m }))} />
            </div>
            <div className="col-span-2">
              <Label>Path</Label>
              <Input value={epForm.path} onChange={(v) => setEpForm({ ...epForm, path: v })} placeholder="/api/users/{id}" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Name</Label>
              <Input value={epForm.name} onChange={(v) => setEpForm({ ...epForm, name: v })} placeholder="Get User by ID" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={epForm.description} onChange={(v) => setEpForm({ ...epForm, description: v })} placeholder="Optional" />
            </div>
          </div>

          <div>
            <Label>Headers</Label>
            <KvEditor items={epHeaders} onChange={setEpHeaders} />
          </div>

          <div>
            <Label>Body Type</Label>
            <Select value={epForm.bodyType} onChange={(v) => setEpForm({ ...epForm, bodyType: v })} options={BODY_TYPES.map(t => ({ value: t, label: t === 'none' ? 'None' : t.toUpperCase() }))} />
          </div>
          {epForm.bodyType !== 'none' && (
            <div>
              <Label>Body Template</Label>
              <textarea
                className="w-full h-32 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:border-cyan-500 focus:outline-none resize-none"
                placeholder='{"username": "{{username}}", ...}'
                value={epForm.bodyTemplate}
                onChange={(e) => setEpForm({ ...epForm, bodyTemplate: e.target.value })}
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="secondary" onClick={() => setShowNewEndpointModal(null)}>Cancel</Btn>
            <Btn onClick={handleCreateEndpoint} disabled={createEndpoint.isPending || !epForm.name || !epForm.path}>
              {createEndpoint.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Add Endpoint
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Tab 2: Chain Designer ─────────────────────────────────────────────────────

function ChainDesignerTab() {
  const { data: chains, isPending: chainsLoading } = useChains();
  const { data: collections } = useCollections();
  const createChain = useCreateChain();
  const deleteChain = useDeleteChain();
  const createStep = useCreateStep();
  const updateStep = useUpdateStep();
  const deleteStep = useDeleteStep();
  const executeChain = useExecuteChain();
  const seedDemo = useSeedDemo();

  const [selectedChainId, setSelectedChainId] = useState<string | null>(null);
  const [showNewChainModal, setShowNewChainModal] = useState(false);
  const [showStepEditor, setShowStepEditor] = useState<{ chainId: string; step?: PtChainStep } | null>(null);
  const [showAddStepChoice, setShowAddStepChoice] = useState<string | null>(null);
  const [executionResult, setExecutionResult] = useState<PtChainExecutionResult | null>(null);

  // New chain form
  const [chainForm, setChainForm] = useState({ name: '', description: '', collectionId: '' });

  // Step editor form
  const [stepForm, setStepForm] = useState({
    name: '', method: 'GET', url: '', body: '', thinkTimeSec: 0, isEnabled: true,
  });
  const [stepHeaders, setStepHeaders] = useState<{ key: string; value: string; enabled?: boolean }[]>([]);
  const [stepExtractors, setStepExtractors] = useState<PtExtractor[]>([]);
  const [stepAssertions, setStepAssertions] = useState<PtAssertion[]>([]);

  const { data: selectedChain } = useChain(selectedChainId ?? undefined);
  const steps = selectedChain?.steps || [];

  const allEndpoints = useMemo(() => {
    if (!collections) return [];
    return collections.flatMap(c => (c.endpoints || []).map(ep => ({ ...ep, collectionName: c.name, baseUrl: c.baseUrl })));
  }, [collections]);

  const handleCreateChain = async () => {
    if (!chainForm.name || !chainForm.collectionId) return;
    const result = await createChain.mutateAsync({
      name: chainForm.name,
      description: chainForm.description || undefined,
      collectionId: chainForm.collectionId,
    });
    setSelectedChainId(result.id);
    setShowNewChainModal(false);
    setChainForm({ name: '', description: '', collectionId: '' });
  };

  const openStepEditor = (chainId: string, step?: PtChainStep) => {
    if (step) {
      setStepForm({
        name: step.name, method: step.method, url: step.url,
        body: step.body || '', thinkTimeSec: step.thinkTimeSec, isEnabled: step.isEnabled,
      });
      setStepHeaders((step.headers || []).map(h => ({ key: h.key, value: h.value, enabled: h.enabled })));
      setStepExtractors(step.extractors || []);
      setStepAssertions(step.assertions || []);
    } else {
      setStepForm({ name: '', method: 'GET', url: '', body: '', thinkTimeSec: 0, isEnabled: true });
      setStepHeaders([]);
      setStepExtractors([]);
      setStepAssertions([]);
    }
    setShowStepEditor({ chainId, step });
  };

  const handleSaveStep = async () => {
    if (!showStepEditor) return;
    const data = {
      name: stepForm.name,
      method: stepForm.method,
      url: stepForm.url,
      headers: stepHeaders.filter(h => h.key).map(h => ({ key: h.key, value: h.value, enabled: h.enabled ?? true })),
      body: stepForm.body || undefined,
      extractors: stepExtractors.length ? stepExtractors : undefined,
      assertions: stepAssertions.length ? stepAssertions : undefined,
      thinkTimeSec: stepForm.thinkTimeSec,
      isEnabled: stepForm.isEnabled,
    };

    if (showStepEditor.step) {
      await updateStep.mutateAsync({ id: showStepEditor.step.id, chainId: showStepEditor.chainId, data });
    } else {
      await createStep.mutateAsync({ chainId: showStepEditor.chainId, data });
    }
    setShowStepEditor(null);
  };

  const handleAddFromEndpoint = async (ep: PtEndpoint & { baseUrl: string }, chainId: string) => {
    await createStep.mutateAsync({
      chainId,
      data: {
        endpointId: ep.id,
        name: ep.name,
        method: ep.method,
        url: ep.baseUrl + ep.path,
        headers: ep.headers?.map(h => ({ key: h.key, value: h.value, enabled: h.enabled })),
        body: ep.bodyTemplate || undefined,
      },
    });
    setShowAddStepChoice(null);
  };

  const handleExecuteChain = async () => {
    if (!selectedChainId) return;
    try {
      const result = await executeChain.mutateAsync({ chainId: selectedChainId });
      setExecutionResult(result);
    } catch { /* handled by mutation */ }
  };

  if (chainsLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>;
  }

  const chainList = chains || [];
  const collList = collections || [];

  return (
    <div className="flex gap-6 min-h-[600px]">
      {/* Left Panel: Chain List */}
      <div className="w-72 flex-shrink-0 space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Chains</h3>
          <Btn variant="ghost" onClick={() => setShowNewChainModal(true)} className="text-xs px-2 py-1">
            <Plus className="w-3 h-3" />
          </Btn>
        </div>

        {chainList.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-8">
            No chains yet.
            <button onClick={() => seedDemo.mutate()} disabled={seedDemo.isPending} className="block mx-auto mt-2 text-cyan-400 hover:text-cyan-300 text-xs">
              {seedDemo.isPending ? 'Seeding...' : 'Seed Demo Data'}
            </button>
          </div>
        ) : (
          chainList.map((chain) => (
            <div
              key={chain.id}
              className={cn(
                'p-3 rounded-lg border cursor-pointer transition-colors',
                selectedChainId === chain.id
                  ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
              )}
              onClick={() => { setSelectedChainId(chain.id); setExecutionResult(null); }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium truncate">{chain.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteChain.mutate(chain.id); if (selectedChainId === chain.id) setSelectedChainId(null); }}
                  className="p-1 text-slate-500 hover:text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{chain.steps?.length ?? '?'} steps</p>
            </div>
          ))
        )}
      </div>

      {/* Main Area: Selected Chain */}
      <div className="flex-1">
        {!selectedChainId ? (
          <EmptyState icon={Link2} title="Select a Chain" subtitle="Choose a chain from the left panel or create a new one to start designing." />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-200">{selectedChain?.name || 'Loading...'}</h3>
              <div className="flex gap-2">
                <Btn variant="secondary" onClick={() => setShowAddStepChoice(selectedChainId)}>
                  <Plus className="w-4 h-4" /> Add Step
                </Btn>
                <Btn onClick={handleExecuteChain} disabled={executeChain.isPending || steps.length === 0}>
                  {executeChain.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Execute Chain
                </Btn>
              </div>
            </div>

            {/* Steps Flow */}
            {steps.length === 0 ? (
              <EmptyState icon={ArrowDown} title="No Steps" subtitle="Add steps from collection endpoints or create them manually." />
            ) : (
              <div className="space-y-0">
                {steps.sort((a, b) => a.sortOrder - b.sortOrder).map((step, idx) => (
                  <div key={step.id}>
                    {/* Step Card */}
                    <div className={cn(
                      'relative bg-slate-800 border rounded-lg p-4 transition-colors',
                      step.isEnabled ? 'border-slate-700' : 'border-slate-700/50 opacity-50',
                    )}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <MethodBadge method={step.method} />
                          <div>
                            <span className="text-sm font-medium text-slate-200">{step.name}</span>
                            <p className="text-xs text-slate-500 font-mono truncate max-w-md">{step.url}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {step.thinkTimeSec > 0 && (
                            <span className="text-xs text-slate-500 mr-2"><Clock className="w-3 h-3 inline mr-0.5" />{step.thinkTimeSec}s</span>
                          )}
                          <button onClick={() => openStepEditor(selectedChainId!, step)} className="p-1.5 rounded hover:bg-slate-700 text-slate-400">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteStep.mutate({ id: step.id, chainId: selectedChainId! })}
                            className="p-1.5 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {/* Tags for extractors/assertions */}
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {(step.extractors || []).map((ex, ei) => (
                          <span key={ei} className="text-xs px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            {'{{'}{ex.name}{'}}'}
                          </span>
                        ))}
                        {(step.assertions || []).map((a, ai) => (
                          <span key={ai} className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {a.type} {a.operator} {a.value}
                          </span>
                        ))}
                      </div>
                    </div>
                    {/* Arrow connector */}
                    {idx < steps.length - 1 && (
                      <div className="flex justify-center py-1">
                        <ArrowDown className="w-4 h-4 text-slate-600" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Execution Result */}
            {executionResult && (
              <div className="mt-6 bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    {executionResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                    Chain Execution {executionResult.success ? 'Passed' : 'Failed'}
                  </h4>
                  <span className="text-sm text-slate-400">{fmtLatency(executionResult.totalDurationMs)} total</span>
                </div>

                {/* Step Results Timeline */}
                <div className="space-y-2">
                  {executionResult.steps.map((sr, i) => (
                    <div key={i} className={cn('flex items-center gap-3 p-3 rounded-lg', sr.error ? 'bg-red-500/5 border border-red-500/20' : 'bg-slate-700/30')}>
                      {sr.error ? <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                      <MethodBadge method={sr.method} />
                      <span className="text-sm text-slate-300 truncate flex-1">{sr.stepName}</span>
                      <span className={cn('text-xs font-mono', sr.status >= 400 ? 'text-red-400' : 'text-emerald-400')}>{sr.status}</span>
                      <span className="text-xs text-slate-500">{fmtLatency(sr.durationMs)}</span>
                      <span className="text-xs text-slate-600">{(sr.responseSize / 1024).toFixed(1)}KB</span>
                    </div>
                  ))}
                </div>

                {/* Extracted Variables */}
                {Object.keys(executionResult.variables).length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-slate-400 block mb-1">Extracted Variables</span>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(executionResult.variables).map(([k, v]) => (
                        <span key={k} className="text-xs px-2 py-1 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                          {k} = <span className="text-purple-400">{v.length > 30 ? v.slice(0, 30) + '...' : v}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Assertion Results */}
                {executionResult.steps.some(s => s.assertionResults.length > 0) && (
                  <div>
                    <span className="text-xs font-medium text-slate-400 block mb-1">Assertions</span>
                    <div className="flex flex-wrap gap-2">
                      {executionResult.steps.flatMap(s => s.assertionResults).map((ar, i) => (
                        <span key={i} className={cn('text-xs px-2 py-0.5 rounded border', ar.passed ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20')}>
                          {ar.passed ? 'PASS' : 'FAIL'}: {ar.assertion.type} {ar.assertion.operator} {ar.assertion.value}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Chain Modal */}
      <Modal open={showNewChainModal} onClose={() => setShowNewChainModal(false)} title="New Chain">
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={chainForm.name} onChange={(v) => setChainForm({ ...chainForm, name: v })} placeholder="User Login Flow" />
          </div>
          <div>
            <Label>Description</Label>
            <Input value={chainForm.description} onChange={(v) => setChainForm({ ...chainForm, description: v })} placeholder="Optional" />
          </div>
          <div>
            <Label>Collection</Label>
            <Select
              value={chainForm.collectionId}
              onChange={(v) => setChainForm({ ...chainForm, collectionId: v })}
              options={[{ value: '', label: 'Select collection...' }, ...collList.map(c => ({ value: c.id, label: c.name }))]}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="secondary" onClick={() => setShowNewChainModal(false)}>Cancel</Btn>
            <Btn onClick={handleCreateChain} disabled={createChain.isPending || !chainForm.name || !chainForm.collectionId}>
              {createChain.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Create
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Add Step Choice Modal */}
      <Modal open={!!showAddStepChoice} onClose={() => setShowAddStepChoice(null)} title="Add Step" wide>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { setShowAddStepChoice(null); openStepEditor(showAddStepChoice!, undefined); }}
              className="p-4 bg-slate-700/50 border border-slate-600 rounded-lg hover:border-cyan-500/50 text-left transition-colors"
            >
              <Pencil className="w-5 h-5 text-cyan-400 mb-2" />
              <h4 className="text-sm font-medium text-slate-200">Manual Entry</h4>
              <p className="text-xs text-slate-500 mt-1">Create a step from scratch</p>
            </button>
            <div className="p-4 bg-slate-700/50 border border-slate-600 rounded-lg">
              <FolderOpen className="w-5 h-5 text-emerald-400 mb-2" />
              <h4 className="text-sm font-medium text-slate-200">From Collection</h4>
              <p className="text-xs text-slate-500 mt-1">Pick an existing endpoint</p>
            </div>
          </div>

          {/* Endpoint Picker */}
          {allEndpoints.length > 0 && (
            <div>
              <Label>Available Endpoints</Label>
              <div className="max-h-64 overflow-y-auto space-y-1 mt-1">
                {allEndpoints.map((ep) => (
                  <button
                    key={ep.id}
                    onClick={() => handleAddFromEndpoint(ep, showAddStepChoice!)}
                    className="w-full flex items-center gap-3 p-2 rounded hover:bg-slate-700 text-left transition-colors"
                  >
                    <MethodBadge method={ep.method} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-slate-300 block truncate">{ep.name}</span>
                      <span className="text-xs text-slate-500 font-mono block truncate">{ep.collectionName} - {ep.path}</span>
                    </div>
                    <Plus className="w-4 h-4 text-slate-500" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Step Editor Modal */}
      <Modal open={!!showStepEditor} onClose={() => setShowStepEditor(null)} title={showStepEditor?.step ? 'Edit Step' : 'New Step'} wide>
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <Label>Method</Label>
              <Select value={stepForm.method} onChange={(v) => setStepForm({ ...stepForm, method: v })} options={['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => ({ value: m, label: m }))} />
            </div>
            <div className="col-span-3">
              <Label>URL</Label>
              <Input value={stepForm.url} onChange={(v) => setStepForm({ ...stepForm, url: v })} placeholder="https://api.example.com/{{userId}}" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Name</Label>
              <Input value={stepForm.name} onChange={(v) => setStepForm({ ...stepForm, name: v })} placeholder="Step name" />
            </div>
            <div>
              <Label>Think Time (seconds)</Label>
              <div className="flex items-center gap-3">
                <input
                  type="range" min={0} max={10} step={0.5}
                  value={stepForm.thinkTimeSec}
                  onChange={(e) => setStepForm({ ...stepForm, thinkTimeSec: parseFloat(e.target.value) })}
                  className="flex-1 accent-cyan-500"
                />
                <span className="text-sm text-slate-400 w-8">{stepForm.thinkTimeSec}s</span>
              </div>
            </div>
          </div>

          {/* Headers */}
          <div>
            <Label>Headers</Label>
            <KvEditor items={stepHeaders} onChange={setStepHeaders} />
          </div>

          {/* Body */}
          <div>
            <Label>Body</Label>
            <textarea
              className="w-full h-24 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:border-cyan-500 focus:outline-none resize-none"
              placeholder='{"key": "value"}'
              value={stepForm.body}
              onChange={(e) => setStepForm({ ...stepForm, body: e.target.value })}
            />
          </div>

          {/* Extractors */}
          <div>
            <Label>Extractors</Label>
            <div className="space-y-2">
              {stepExtractors.map((ex, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input value={ex.name} onChange={(v) => { const n = [...stepExtractors]; n[i] = { ...n[i], name: v }; setStepExtractors(n); }} placeholder="Variable name" className="flex-1" />
                  <Select
                    value={ex.source}
                    onChange={(v) => { const n = [...stepExtractors]; n[i] = { ...n[i], source: v as PtExtractor['source'] }; setStepExtractors(n); }}
                    options={EXTRACTOR_SOURCES.map(s => ({ value: s, label: s }))}
                    className="w-28"
                  />
                  <Input value={ex.path} onChange={(v) => { const n = [...stepExtractors]; n[i] = { ...n[i], path: v }; setStepExtractors(n); }} placeholder="$.data.id" className="flex-1" />
                  <button onClick={() => setStepExtractors(stepExtractors.filter((_, idx) => idx !== i))} className="p-1 text-red-400"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              <button onClick={() => setStepExtractors([...stepExtractors, { name: '', source: 'body', path: '' }])} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add Extractor
              </button>
            </div>
          </div>

          {/* Assertions */}
          <div>
            <Label>Assertions</Label>
            <div className="space-y-2">
              {stepAssertions.map((a, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Select
                    value={a.type}
                    onChange={(v) => { const n = [...stepAssertions]; n[i] = { ...n[i], type: v as PtAssertion['type'] }; setStepAssertions(n); }}
                    options={ASSERTION_TYPES.map(t => ({ value: t, label: t }))}
                    className="w-32"
                  />
                  <Input value={a.target} onChange={(v) => { const n = [...stepAssertions]; n[i] = { ...n[i], target: v }; setStepAssertions(n); }} placeholder="Target" className="flex-1" />
                  <Select
                    value={a.operator}
                    onChange={(v) => { const n = [...stepAssertions]; n[i] = { ...n[i], operator: v as PtAssertion['operator'] }; setStepAssertions(n); }}
                    options={ASSERTION_OPERATORS.map(o => ({ value: o, label: o }))}
                    className="w-28"
                  />
                  <Input value={a.value} onChange={(v) => { const n = [...stepAssertions]; n[i] = { ...n[i], value: v }; setStepAssertions(n); }} placeholder="Expected" className="w-24" />
                  <button onClick={() => setStepAssertions(stepAssertions.filter((_, idx) => idx !== i))} className="p-1 text-red-400"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              <button onClick={() => setStepAssertions([...stepAssertions, { type: 'status', target: '', operator: 'eq', value: '200' }])} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add Assertion
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="secondary" onClick={() => setShowStepEditor(null)}>Cancel</Btn>
            <Btn onClick={handleSaveStep} disabled={createStep.isPending || updateStep.isPending || !stepForm.name || !stepForm.url}>
              {(createStep.isPending || updateStep.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {showStepEditor?.step ? 'Update Step' : 'Add Step'}
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Tab 3: Load Scenarios ─────────────────────────────────────────────────────

function LoadScenariosTab() {
  const { data: scenarios, isPending } = useScenarios();
  const { data: chains } = useChains();
  const createScenario = useCreateScenario();
  const deleteScenario = useDeleteScenario();
  const seedDemo = useSeedDemo();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', chainId: '',
    pattern: 'ramp' as PtScenario['pattern'],
    peakVU: 50, rampUpSec: 30, steadyStateSec: 60, rampDownSec: 15,
    thinkTimeSec: 1, timeoutMs: 30000, maxErrorPct: 5,
  });
  const [slaThresholds, setSlaThresholds] = useState<PtSlaThreshold[]>([]);

  // Build ramp preview data
  const rampPreview = useMemo(() => {
    const { peakVU, rampUpSec, steadyStateSec, rampDownSec } = form;
    const totalSec = rampUpSec + steadyStateSec + rampDownSec;
    const points: { time: number; vu: number }[] = [];
    const numPoints = 40;
    for (let i = 0; i <= numPoints; i++) {
      const t = (i / numPoints) * totalSec;
      let vu = 0;
      if (t <= rampUpSec) {
        vu = rampUpSec > 0 ? (t / rampUpSec) * peakVU : peakVU;
      } else if (t <= rampUpSec + steadyStateSec) {
        vu = peakVU;
      } else {
        const remaining = t - rampUpSec - steadyStateSec;
        vu = rampDownSec > 0 ? peakVU * (1 - remaining / rampDownSec) : 0;
      }
      points.push({ time: Math.round(t), vu: Math.max(0, Math.round(vu)) });
    }
    return points;
  }, [form.peakVU, form.rampUpSec, form.steadyStateSec, form.rampDownSec]);

  const handleCreate = async () => {
    await createScenario.mutateAsync({
      ...form,
      description: form.description || undefined,
      slaThresholds: slaThresholds.length ? slaThresholds : undefined,
    });
    setShowForm(false);
    setForm({ name: '', description: '', chainId: '', pattern: 'ramp', peakVU: 50, rampUpSec: 30, steadyStateSec: 60, rampDownSec: 15, thinkTimeSec: 1, timeoutMs: 30000, maxErrorPct: 5 });
    setSlaThresholds([]);
  };

  if (isPending) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>;
  }

  const list = scenarios || [];
  const chainList = chains || [];

  if (showForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-200">Create Load Scenario</h3>
          <Btn variant="ghost" onClick={() => setShowForm(false)}><X className="w-4 h-4" /> Cancel</Btn>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Left Column: Configuration */}
          <div className="space-y-4">
            <div>
              <Label>Scenario Name</Label>
              <Input value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Peak Hour Simulation" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="Optional description" />
            </div>
            <div>
              <Label>Chain</Label>
              <Select
                value={form.chainId}
                onChange={(v) => setForm({ ...form, chainId: v })}
                options={[{ value: '', label: 'Select chain...' }, ...chainList.map(c => ({ value: c.id, label: c.name }))]}
              />
            </div>

            {/* Pattern Selector */}
            <div>
              <Label>Load Pattern</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {Object.entries(PATTERN_CONFIG).filter(([k]) => k !== 'custom').map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => setForm({ ...form, pattern: key as PtScenario['pattern'] })}
                      className={cn(
                        'p-3 rounded-lg border text-left transition-colors',
                        form.pattern === key
                          ? 'bg-cyan-500/10 border-cyan-500/30'
                          : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                      )}
                    >
                      <Icon className={cn('w-5 h-5 mb-1', cfg.color)} />
                      <div className="text-sm font-medium text-slate-200">{cfg.label}</div>
                      <div className="text-xs text-slate-500">{cfg.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Configuration Sliders */}
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Peak Virtual Users</span>
                  <span className="text-slate-300 font-medium">{form.peakVU}</span>
                </div>
                <input type="range" min={1} max={500} value={form.peakVU} onChange={(e) => setForm({ ...form, peakVU: parseInt(e.target.value) })} className="w-full accent-cyan-500" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Ramp Up (sec)</Label>
                  <Input value={form.rampUpSec} onChange={(v) => setForm({ ...form, rampUpSec: parseInt(v) || 0 })} type="number" />
                </div>
                <div>
                  <Label>Steady State (sec)</Label>
                  <Input value={form.steadyStateSec} onChange={(v) => setForm({ ...form, steadyStateSec: parseInt(v) || 0 })} type="number" />
                </div>
                <div>
                  <Label>Ramp Down (sec)</Label>
                  <Input value={form.rampDownSec} onChange={(v) => setForm({ ...form, rampDownSec: parseInt(v) || 0 })} type="number" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Think Time (sec)</Label>
                  <div className="flex items-center gap-2">
                    <input type="range" min={0} max={10} step={0.5} value={form.thinkTimeSec} onChange={(e) => setForm({ ...form, thinkTimeSec: parseFloat(e.target.value) })} className="flex-1 accent-cyan-500" />
                    <span className="text-xs text-slate-400 w-6">{form.thinkTimeSec}s</span>
                  </div>
                </div>
                <div>
                  <Label>Timeout (ms)</Label>
                  <Input value={form.timeoutMs} onChange={(v) => setForm({ ...form, timeoutMs: parseInt(v) || 30000 })} type="number" />
                </div>
                <div>
                  <Label>Max Error %</Label>
                  <Input value={form.maxErrorPct} onChange={(v) => setForm({ ...form, maxErrorPct: parseFloat(v) || 5 })} type="number" />
                </div>
              </div>
            </div>

            {/* SLA Thresholds */}
            <div>
              <Label>SLA Thresholds</Label>
              <div className="space-y-2">
                {slaThresholds.map((sla, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Select
                      value={sla.metric}
                      onChange={(v) => { const n = [...slaThresholds]; n[i] = { ...n[i], metric: v as PtSlaThreshold['metric'] }; setSlaThresholds(n); }}
                      options={SLA_METRICS.map(m => ({ value: m, label: m }))}
                      className="w-36"
                    />
                    <Select
                      value={sla.operator}
                      onChange={(v) => { const n = [...slaThresholds]; n[i] = { ...n[i], operator: v as PtSlaThreshold['operator'] }; setSlaThresholds(n); }}
                      options={SLA_OPERATORS.map(o => ({ value: o, label: o }))}
                      className="w-20"
                    />
                    <Input
                      value={sla.value}
                      onChange={(v) => { const n = [...slaThresholds]; n[i] = { ...n[i], value: parseFloat(v) || 0 }; setSlaThresholds(n); }}
                      type="number" className="w-24"
                    />
                    <Select
                      value={sla.severity}
                      onChange={(v) => { const n = [...slaThresholds]; n[i] = { ...n[i], severity: v as PtSlaThreshold['severity'] }; setSlaThresholds(n); }}
                      options={[{ value: 'warn', label: 'Warn' }, { value: 'fail', label: 'Fail' }]}
                      className="w-20"
                    />
                    <button onClick={() => setSlaThresholds(slaThresholds.filter((_, idx) => idx !== i))} className="p-1 text-red-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                <button
                  onClick={() => setSlaThresholds([...slaThresholds, { metric: 'p95Latency', operator: 'lt', value: 500, severity: 'warn' }])}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add SLA Threshold
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Preview Chart */}
          <div className="space-y-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <h4 className="text-sm font-semibold text-slate-300 mb-3">VU Ramp Preview</h4>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={rampPreview}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickFormatter={(v) => `${v}s`} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    labelFormatter={(v) => `${v}s`}
                  />
                  <Area type="monotone" dataKey="vu" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.15} strokeWidth={2} name="Virtual Users" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-3">
              <h4 className="text-sm font-semibold text-slate-300">Scenario Summary</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Pattern</span><span className="text-slate-300">{PATTERN_CONFIG[form.pattern]?.label}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Peak VU</span><span className="text-slate-300">{form.peakVU}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Total Duration</span><span className="text-slate-300">{form.rampUpSec + form.steadyStateSec + form.rampDownSec}s</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Think Time</span><span className="text-slate-300">{form.thinkTimeSec}s</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Timeout</span><span className="text-slate-300">{form.timeoutMs}ms</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Max Error</span><span className="text-slate-300">{form.maxErrorPct}%</span></div>
              </div>
            </div>

            <Btn onClick={handleCreate} disabled={createScenario.isPending || !form.name || !form.chainId} className="w-full justify-center">
              {createScenario.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
              Create Scenario
            </Btn>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-200">Load Scenarios</h3>
          <p className="text-sm text-slate-500">{list.length} scenario{list.length !== 1 ? 's' : ''} configured</p>
        </div>
        <Btn onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" /> Create Scenario
        </Btn>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={Gauge}
          title="No Load Scenarios"
          subtitle="Create a load scenario to define how virtual users will interact with your API chains during testing."
          action={
            <Btn onClick={() => seedDemo.mutate()} disabled={seedDemo.isPending}>
              {seedDemo.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
              Seed Demo Data
            </Btn>
          }
        />
      ) : (
        <div className="grid gap-4">
          {list.map((scenario) => {
            const pcfg = PATTERN_CONFIG[scenario.pattern] || PATTERN_CONFIG.custom;
            const PatternIcon = pcfg.icon;
            return (
              <div key={scenario.id} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
                      <PatternIcon className={cn('w-5 h-5', pcfg.color)} />
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-200">{scenario.name}</h4>
                      <p className="text-xs text-slate-500">{scenario.chain?.name || 'Unknown chain'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded border', 'bg-slate-700 border-slate-600 text-slate-300')}>{pcfg.label}</span>
                    <button
                      onClick={() => deleteScenario.mutate(scenario.id)}
                      className="p-1.5 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-4 mt-4 text-sm">
                  <div><span className="text-slate-500 block text-xs">Peak VU</span><span className="text-slate-200 font-medium">{scenario.peakVU}</span></div>
                  <div><span className="text-slate-500 block text-xs">Ramp Up</span><span className="text-slate-200">{scenario.rampUpSec}s</span></div>
                  <div><span className="text-slate-500 block text-xs">Steady</span><span className="text-slate-200">{scenario.steadyStateSec}s</span></div>
                  <div><span className="text-slate-500 block text-xs">Ramp Down</span><span className="text-slate-200">{scenario.rampDownSec}s</span></div>
                  <div><span className="text-slate-500 block text-xs">Timeout</span><span className="text-slate-200">{scenario.timeoutMs}ms</span></div>
                  <div><span className="text-slate-500 block text-xs">SLA Rules</span><span className="text-slate-200">{scenario.slaThresholds?.length ?? 0}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Tab 4: Test Runs ──────────────────────────────────────────────────────────

function LiveRunDashboard({ runId, onClose }: { runId: string; onClose: () => void }) {
  const { metrics, isStreaming, latestMetric } = useRunStream(runId);
  const { data: run } = useRun(runId);
  const stopRun = useStopRun();

  const chartData = useMemo(() => {
    return metrics.map((m, i) => ({
      idx: i,
      time: new Date(m.timestamp).toLocaleTimeString(),
      activeVU: m.activeVU,
      avgLatency: m.avgLatencyMs,
      p95Latency: m.p95LatencyMs,
      p99Latency: m.p99LatencyMs,
      tps: m.tps,
      errors: m.errorCount,
      requests: m.requestCount,
    }));
  }, [metrics]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h4 className="text-lg font-semibold text-slate-200">Live Monitoring</h4>
          {isStreaming && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Streaming
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {run?.status === 'running' && (
            <Btn variant="danger" onClick={() => stopRun.mutate(runId)} disabled={stopRun.isPending}>
              <Square className="w-4 h-4" /> Stop
            </Btn>
          )}
          <Btn variant="ghost" onClick={onClose}><X className="w-4 h-4" /> Close</Btn>
        </div>
      </div>

      {/* Live KPIs */}
      {latestMetric && (
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Active VU', value: fmtNum(latestMetric.activeVU), color: 'text-cyan-400' },
            { label: 'Avg Latency', value: fmtLatency(latestMetric.avgLatencyMs), color: 'text-blue-400' },
            { label: 'TPS', value: fmtTps(latestMetric.tps), color: 'text-emerald-400' },
            { label: 'P99 Latency', value: fmtLatency(latestMetric.p99LatencyMs), color: 'text-amber-400' },
            { label: 'Errors', value: fmtNum(latestMetric.errorCount), color: latestMetric.errorCount > 0 ? 'text-red-400' : 'text-slate-400' },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-500 mb-1">{kpi.label}</div>
              <div className={cn('text-lg font-bold', kpi.color)}>{kpi.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {/* Response Time Chart */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <h5 className="text-sm font-medium text-slate-300 mb-3">Response Time</h5>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="idx" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} tickFormatter={(v) => `${v}ms`} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                <Area type="monotone" dataKey="avgLatency" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={2} name="Avg" />
                <Area type="monotone" dataKey="p95Latency" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.05} strokeWidth={1.5} name="P95" />
                <Area type="monotone" dataKey="p99Latency" stroke="#ef4444" fill="#ef4444" fillOpacity={0.05} strokeWidth={1} name="P99" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Throughput Chart */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <h5 className="text-sm font-medium text-slate-300 mb-3">Throughput (TPS)</h5>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="idx" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                <Bar dataKey="tps" fill="#06b6d4" name="TPS" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Active VU Chart */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <h5 className="text-sm font-medium text-slate-300 mb-3">Active Virtual Users</h5>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="idx" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="activeVU" stroke="#a78bfa" strokeWidth={2} dot={false} name="VU" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Error Rate Chart */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <h5 className="text-sm font-medium text-slate-300 mb-3">Errors</h5>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="idx" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                <Area type="monotone" dataKey="errors" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} strokeWidth={2} name="Errors" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {chartData.length === 0 && (
        <div className="flex items-center justify-center py-12 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Waiting for metrics...
        </div>
      )}
    </div>
  );
}

function TestRunsTab() {
  const { data: runs, isPending } = useRuns();
  const { data: scenarios } = useScenarios();
  const startRun = useStartRun();
  const stopRun = useStopRun();
  const seedDemo = useSeedDemo();

  const [liveRunId, setLiveRunId] = useState<string | null>(null);
  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedScenarioId, setSelectedScenarioId] = useState('');

  const activeRuns = useMemo(() => (runs || []).filter(r => r.status === 'running' || r.status === 'queued'), [runs]);
  const completedRuns = useMemo(() => (runs || []).filter(r => r.status !== 'running' && r.status !== 'queued'), [runs]);

  const handleStartRun = async () => {
    if (!selectedScenarioId) return;
    const result = await startRun.mutateAsync({ scenarioId: selectedScenarioId });
    setShowStartModal(false);
    setSelectedScenarioId('');
    setLiveRunId(result.id);
  };

  if (isPending) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>;
  }

  if (liveRunId) {
    return <LiveRunDashboard runId={liveRunId} onClose={() => setLiveRunId(null)} />;
  }

  const runList = runs || [];
  const scenarioList = scenarios || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-200">Test Runs</h3>
          <p className="text-sm text-slate-500">{runList.length} run{runList.length !== 1 ? 's' : ''} total</p>
        </div>
        <Btn onClick={() => setShowStartModal(true)}>
          <Play className="w-4 h-4" /> Start New Run
        </Btn>
      </div>

      {/* Active Runs */}
      {activeRuns.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" /> Active Runs
          </h4>
          {activeRuns.map((run) => (
            <div key={run.id} className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
                  <span className="text-sm font-medium text-slate-200">{run.scenario?.name || 'Unknown Scenario'}</span>
                  <StatusBadge status={run.status} />
                </div>
                <div className="flex gap-2">
                  <Btn variant="secondary" onClick={() => setLiveRunId(run.id)} className="text-xs px-3 py-1.5">
                    <Eye className="w-3.5 h-3.5" /> View Live
                  </Btn>
                  <Btn variant="danger" onClick={() => stopRun.mutate(run.id)} disabled={stopRun.isPending} className="text-xs px-3 py-1.5">
                    <Square className="w-3.5 h-3.5" /> Stop
                  </Btn>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-4">
                {[
                  { label: 'Active VU', value: fmtNum(run.scenario?.peakVU ?? 0) },
                  { label: 'Avg Latency', value: fmtLatency(run.avgLatencyMs) },
                  { label: 'TPS', value: fmtTps(run.avgTps) },
                  { label: 'Error Rate', value: fmtPct(run.errorRate) },
                  { label: 'P99', value: fmtLatency(run.p99LatencyMs) },
                ].map((kpi) => (
                  <div key={kpi.label} className="bg-slate-800/50 rounded-lg p-2 text-center">
                    <div className="text-xs text-slate-500">{kpi.label}</div>
                    <div className="text-sm font-medium text-slate-200">{kpi.value}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Completed Runs */}
      {runList.length === 0 ? (
        <EmptyState
          icon={Play}
          title="No Test Runs"
          subtitle="Start a new test run by selecting a load scenario. Make sure you have at least one scenario configured."
          action={
            <Btn onClick={() => seedDemo.mutate()} disabled={seedDemo.isPending}>
              {seedDemo.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
              Seed Demo Data
            </Btn>
          }
        />
      ) : completedRuns.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Completed Runs</h4>
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-700">
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Scenario</th>
                    <th className="px-4 py-3 text-right">Peak VU</th>
                    <th className="px-4 py-3 text-right">Avg Latency</th>
                    <th className="px-4 py-3 text-right">P95 / P99</th>
                    <th className="px-4 py-3 text-right">TPS</th>
                    <th className="px-4 py-3 text-right">Error Rate</th>
                    <th className="px-4 py-3 text-right">Duration</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {completedRuns.map((run) => {
                    const durationMs = run.completedAt ? new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime() : 0;
                    return (
                      <tr key={run.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                        <td className="px-4 py-3"><StatusBadge status={run.status} /></td>
                        <td className="px-4 py-3 text-slate-300">{run.scenario?.name || 'Unknown'}</td>
                        <td className="px-4 py-3 text-right text-slate-300">{run.scenario?.peakVU ?? '-'}</td>
                        <td className="px-4 py-3 text-right text-slate-300">{fmtLatency(run.avgLatencyMs)}</td>
                        <td className="px-4 py-3 text-right text-slate-400 text-xs">{fmtLatency(run.p95LatencyMs)} / {fmtLatency(run.p99LatencyMs)}</td>
                        <td className="px-4 py-3 text-right text-slate-300">{fmtTps(run.avgTps)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn(run.errorRate > 1 ? 'text-red-400' : 'text-emerald-400')}>{fmtPct(run.errorRate)}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400">{fmtLatency(durationMs)}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => setLiveRunId(run.id)} className="text-cyan-400 hover:text-cyan-300 text-xs">View</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Start Run Modal */}
      <Modal open={showStartModal} onClose={() => setShowStartModal(false)} title="Start New Test Run">
        <div className="space-y-4">
          <div>
            <Label>Select Scenario</Label>
            <Select
              value={selectedScenarioId}
              onChange={setSelectedScenarioId}
              options={[{ value: '', label: 'Choose a scenario...' }, ...scenarioList.map(s => ({ value: s.id, label: s.name }))]}
            />
          </div>
          {selectedScenarioId && (() => {
            const s = scenarioList.find(s => s.id === selectedScenarioId);
            if (!s) return null;
            const pcfg = PATTERN_CONFIG[s.pattern] || PATTERN_CONFIG.custom;
            const PatternIcon = pcfg.icon;
            return (
              <div className="bg-slate-700/50 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <PatternIcon className={cn('w-4 h-4', pcfg.color)} />
                  <span className="text-sm text-slate-300">{pcfg.label} pattern</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs text-slate-400">
                  <div>Peak VU: <span className="text-slate-200">{s.peakVU}</span></div>
                  <div>Duration: <span className="text-slate-200">{s.rampUpSec + s.steadyStateSec + s.rampDownSec}s</span></div>
                  <div>Chain: <span className="text-slate-200">{s.chain?.name || 'N/A'}</span></div>
                </div>
              </div>
            );
          })()}
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="secondary" onClick={() => setShowStartModal(false)}>Cancel</Btn>
            <Btn onClick={handleStartRun} disabled={startRun.isPending || !selectedScenarioId}>
              {startRun.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Start Run
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Tab 5: Reports ────────────────────────────────────────────────────────────

function ReportsTab() {
  const { data: runs, isPending } = useRuns();
  const generateReport = useGenerateReport();

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const { data: selectedRun } = useRun(selectedRunId ?? undefined);

  const completedRuns = useMemo(() => (runs || []).filter(r => r.status === 'completed' || r.status === 'failed' || r.status === 'stopped'), [runs]);

  const aiReport = useMemo<PtAiReport | null>(() => {
    if (!selectedRun?.aiAnalysis) return null;
    try {
      if (typeof selectedRun.aiAnalysis === 'string') return JSON.parse(selectedRun.aiAnalysis) as PtAiReport;
      return selectedRun.aiAnalysis as unknown as PtAiReport;
    } catch { return null; }
  }, [selectedRun]);

  const handleGenerateReport = async () => {
    if (!selectedRunId) return;
    await generateReport.mutateAsync(selectedRunId);
  };

  if (isPending) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>;
  }

  const riskColors: Record<string, string> = {
    Low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    Medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    High: 'bg-red-500/20 text-red-400 border-red-500/30',
    Critical: 'bg-red-600/30 text-red-300 border-red-600/40',
  };

  const severityColors: Record<string, string> = {
    critical: 'border-red-500/30 bg-red-500/5',
    warning: 'border-amber-500/30 bg-amber-500/5',
    info: 'border-blue-500/30 bg-blue-500/5',
  };

  const priorityColors: Record<string, string> = {
    high: 'text-red-400',
    medium: 'text-amber-400',
    low: 'text-blue-400',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-200">Performance Reports</h3>
      </div>

      {/* Run Selector */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <Label>Select a completed run to view its report</Label>
        <Select
          value={selectedRunId || ''}
          onChange={(v) => setSelectedRunId(v || null)}
          options={[
            { value: '', label: 'Choose a run...' },
            ...completedRuns.map(r => ({
              value: r.id,
              label: `${r.scenario?.name || 'Run'} - ${new Date(r.startedAt).toLocaleDateString()} (${r.status})`,
            })),
          ]}
        />
      </div>

      {completedRuns.length === 0 && (
        <EmptyState
          icon={FileText}
          title="No Completed Runs"
          subtitle="Complete a test run first, then come back here to generate AI-powered performance reports."
        />
      )}

      {selectedRun && !aiReport && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h4 className="text-lg font-semibold text-slate-300 mb-2">No Report Generated</h4>
          <p className="text-sm text-slate-500 mb-4">Generate an AI-powered analysis report for this test run.</p>
          <Btn onClick={handleGenerateReport} disabled={generateReport.isPending} className="mx-auto">
            {generateReport.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Generate AI Report
          </Btn>
        </div>
      )}

      {aiReport && (
        <div className="space-y-4">
          {/* Executive Summary */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-300">Executive Summary</h4>
              <span className={cn('px-3 py-1 rounded-full text-xs font-bold border', riskColors[aiReport.riskLevel] || riskColors.Medium)}>
                {aiReport.riskLevel} Risk
              </span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">{aiReport.executiveSummary}</p>
          </div>

          {/* SLA Compliance */}
          {aiReport.slaCompliance && aiReport.slaCompliance.length > 0 && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <h4 className="text-sm font-semibold text-slate-300 mb-3">SLA Compliance</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-700">
                      <th className="pb-2 pr-4">Metric</th>
                      <th className="pb-2 pr-4">Target</th>
                      <th className="pb-2 pr-4">Actual</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiReport.slaCompliance.map((sla, i) => (
                      <tr key={i} className="border-b border-slate-700/50">
                        <td className="py-2 pr-4 text-slate-300">{sla.metric}</td>
                        <td className="py-2 pr-4 text-slate-400">{sla.target}</td>
                        <td className="py-2 pr-4 text-slate-300">{sla.actual}</td>
                        <td className="py-2">
                          <span className={cn(
                            'px-2 py-0.5 rounded text-xs font-medium',
                            sla.status === 'pass' ? 'bg-emerald-500/20 text-emerald-400'
                              : sla.status === 'warn' ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-red-500/20 text-red-400'
                          )}>
                            {sla.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Bottlenecks */}
          {aiReport.bottlenecks && aiReport.bottlenecks.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-300">Bottlenecks</h4>
              {aiReport.bottlenecks.map((b, i) => (
                <div key={i} className={cn('border rounded-xl p-4', severityColors[b.severity] || severityColors.info)}>
                  <div className="flex items-center gap-2 mb-1">
                    {b.severity === 'critical' ? <AlertTriangle className="w-4 h-4 text-red-400" /> : b.severity === 'warning' ? <AlertTriangle className="w-4 h-4 text-amber-400" /> : <Activity className="w-4 h-4 text-blue-400" />}
                    <span className="text-sm font-medium text-slate-200">{b.title}</span>
                    <span className="text-xs text-slate-500 ml-auto">{b.affectedStep}</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">{b.description}</p>
                  <p className="text-xs text-cyan-400"><ArrowRight className="w-3 h-3 inline mr-1" />{b.recommendation}</p>
                </div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {aiReport.recommendations && aiReport.recommendations.length > 0 && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <h4 className="text-sm font-semibold text-slate-300 mb-3">Recommendations</h4>
              <div className="space-y-3">
                {aiReport.recommendations.map((rec, i) => (
                  <div key={i} className="flex gap-3 p-3 bg-slate-700/30 rounded-lg">
                    <span className={cn('text-xs font-bold uppercase w-16 flex-shrink-0 pt-0.5', priorityColors[rec.priority] || 'text-slate-400')}>
                      {rec.priority}
                    </span>
                    <div>
                      <span className="text-sm font-medium text-slate-200">{rec.title}</span>
                      <p className="text-xs text-slate-400 mt-0.5">{rec.description}</p>
                      <p className="text-xs text-emerald-400 mt-1">Expected: {rec.expectedImprovement}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Capacity Estimate */}
          {aiReport.capacityEstimate && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <h4 className="text-sm font-semibold text-slate-300 mb-3">Capacity Estimate</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-700/30 rounded-lg p-4 text-center">
                  <div className="text-xs text-slate-500 mb-1">Max Safe VU</div>
                  <div className="text-2xl font-bold text-cyan-400">{fmtNum(aiReport.capacityEstimate.maxSafeVU)}</div>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-4 text-center">
                  <div className="text-xs text-slate-500 mb-1">Max TPS</div>
                  <div className="text-2xl font-bold text-emerald-400">{fmtTps(aiReport.capacityEstimate.maxTps)}</div>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-4 text-center">
                  <div className="text-xs text-slate-500 mb-1">Limiting Factor</div>
                  <div className="text-sm font-medium text-amber-400 mt-1">{aiReport.capacityEstimate.limitingFactor}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab 6: Data Factory ───────────────────────────────────────────────────────

function DataFactoryTab() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-slate-700 flex items-center justify-center mb-6">
        <Database className="w-12 h-12 text-cyan-500/50" />
      </div>
      <h3 className="text-xl font-bold text-slate-200 mb-2">Data Factory</h3>
      <p className="text-sm text-slate-500 max-w-lg mb-2">
        Generate realistic, schema-aware test data for your performance tests. Create dynamic
        request bodies, CSV datasets, and parameterized payloads tailored to your API contracts.
      </p>
      <div className="grid grid-cols-3 gap-4 mt-6 text-sm max-w-md">
        {[
          { icon: Package, label: 'Synthetic Payloads', desc: 'Auto-generate JSON bodies' },
          { icon: Database, label: 'CSV Datasets', desc: 'Parameterized test data' },
          { icon: Beaker, label: 'Faker Templates', desc: 'Realistic field values' },
        ].map((item) => (
          <div key={item.label} className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-center">
            <item.icon className="w-5 h-5 text-slate-500 mx-auto mb-1" />
            <div className="text-xs text-slate-300 font-medium">{item.label}</div>
            <div className="text-xs text-slate-600 mt-0.5">{item.desc}</div>
          </div>
        ))}
      </div>
      <span className="inline-flex items-center gap-1.5 mt-6 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-xs text-slate-400">
        <Clock className="w-3.5 h-3.5" /> Coming Soon
      </span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function PtSuite() {
  const [activeTab, setActiveTab] = useState<TabId>('collections');

  return (
    <div className="p-6 lg:p-8 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-100 to-blue-100 dark:from-cyan-900/50 dark:to-blue-900/50 flex items-center justify-center">
          <Gauge className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Performance Testing Suite</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            End-to-end API performance testing: collections, chains, load scenarios, and AI reports
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/50 border border-slate-700 rounded-xl p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex-1 justify-center',
                isActive
                  ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50 border border-transparent'
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden md:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'collections' && <CollectionsTab />}
        {activeTab === 'chains' && <ChainDesignerTab />}
        {activeTab === 'scenarios' && <LoadScenariosTab />}
        {activeTab === 'runs' && <TestRunsTab />}
        {activeTab === 'reports' && <ReportsTab />}
        {activeTab === 'data-factory' && <DataFactoryTab />}
      </div>
    </div>
  );
}
