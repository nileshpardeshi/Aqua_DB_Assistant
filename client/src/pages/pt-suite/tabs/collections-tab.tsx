import { useState, useCallback } from 'react';
import {
  FolderOpen, Upload, Plus, Trash2, Loader2, ChevronDown, ChevronUp,
  Rocket, CheckCircle2, Search, ExternalLink, Copy, Shield, Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useCollections, useCollection, useCreateCollection, useDeleteCollection,
  useParseSwagger, useCreateEndpoint, useDeleteEndpoint, useSeedDemo,
} from '@/hooks/use-pt-suite';
import type { PtAuthConfig, PtEndpoint } from '@/types/pt-suite.types';
import { AUTH_TYPES, BODY_TYPES, HTTP_METHODS, fmtRelTime } from '../constants';
import {
  MethodBadge, EmptyState, Modal, KvEditor, Label, Input, Textarea,
  Select, Btn, Spinner, ConfirmDialog, Tooltip,
} from '../components/shared';

export function CollectionsTab() {
  const { data: collections, isPending } = useCollections();
  const seedDemo = useSeedDemo();
  const createCollection = useCreateCollection();
  const deleteCollection = useDeleteCollection();
  const parseSwagger = useParseSwagger();
  const createEndpoint = useCreateEndpoint();
  const deleteEndpoint = useDeleteEndpoint();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSwaggerModal, setShowSwaggerModal] = useState(false);
  const [showNewCollModal, setShowNewCollModal] = useState(false);
  const [showNewEndpointModal, setShowNewEndpointModal] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Swagger modal state
  const [swaggerText, setSwaggerText] = useState('');
  const [swaggerResult, setSwaggerResult] = useState<{ collection: unknown; parsed: { title: string; version: string; baseUrl: string; endpointCount: number } } | null>(null);
  const [swaggerError, setSwaggerError] = useState('');

  // New collection form
  const [collForm, setCollForm] = useState({
    name: '', baseUrl: '', description: '',
    authType: 'none' as PtAuthConfig['type'],
    authToken: '', apiKeyName: '', apiKeyValue: '', apiKeyIn: 'header' as 'header' | 'query',
    username: '', password: '',
  });
  const [collHeaders, setCollHeaders] = useState<{ key: string; value: string; enabled?: boolean }[]>([]);
  const [collErrors, setCollErrors] = useState<Record<string, string>>({});

  // New endpoint form
  const [epForm, setEpForm] = useState({ name: '', method: 'GET', path: '', description: '', bodyType: 'none', bodyTemplate: '' });
  const [epHeaders, setEpHeaders] = useState<{ key: string; value: string; enabled?: boolean }[]>([]);
  const [epErrors, setEpErrors] = useState<Record<string, string>>({});

  const { data: expandedColl } = useCollection(expandedId ?? undefined);

  const validateCollForm = useCallback(() => {
    const errs: Record<string, string> = {};
    if (!collForm.name.trim()) errs.name = 'Name is required';
    if (!collForm.baseUrl.trim()) errs.baseUrl = 'Base URL is required';
    else {
      try { new URL(collForm.baseUrl); } catch { errs.baseUrl = 'Must be a valid URL'; }
    }
    if (collForm.authType === 'bearer' && !collForm.authToken.trim()) errs.authToken = 'Token is required';
    if (collForm.authType === 'apiKey' && !collForm.apiKeyName.trim()) errs.apiKeyName = 'Key name is required';
    if (collForm.authType === 'apiKey' && !collForm.apiKeyValue.trim()) errs.apiKeyValue = 'Key value is required';
    setCollErrors(errs);
    return Object.keys(errs).length === 0;
  }, [collForm]);

  const validateEpForm = useCallback(() => {
    const errs: Record<string, string> = {};
    if (!epForm.name.trim()) errs.name = 'Name is required';
    if (!epForm.path.trim()) errs.path = 'Path is required';
    else if (!epForm.path.startsWith('/')) errs.path = 'Path must start with /';
    setEpErrors(errs);
    return Object.keys(errs).length === 0;
  }, [epForm]);

  const handleSwaggerParse = async () => {
    if (!swaggerText.trim()) return;
    setSwaggerError('');
    try {
      const result = await parseSwagger.mutateAsync({ specText: swaggerText });
      setSwaggerResult(result as typeof swaggerResult);
    } catch (err) {
      setSwaggerError(err instanceof Error ? err.message : 'Failed to parse spec');
    }
  };

  const handleSwaggerFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setSwaggerError('File too large (max 10MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSwaggerText(ev.target?.result as string || '');
      setSwaggerError('');
    };
    reader.readAsText(file);
  };

  const handleCreateCollection = async () => {
    if (!validateCollForm()) return;
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
      name: collForm.name.trim(),
      baseUrl: collForm.baseUrl.trim(),
      description: collForm.description.trim() || undefined,
      authConfig: collForm.authType !== 'none' ? authConfig : undefined,
      headers: collHeaders.filter(h => h.key.trim()).map(h => ({ ...h, enabled: true })),
    });
    setShowNewCollModal(false);
    resetCollForm();
  };

  const handleCreateEndpoint = async () => {
    if (!showNewEndpointModal || !validateEpForm()) return;
    await createEndpoint.mutateAsync({
      collectionId: showNewEndpointModal,
      data: {
        name: epForm.name.trim(),
        method: epForm.method,
        path: epForm.path.trim(),
        description: epForm.description.trim() || undefined,
        headers: epHeaders.filter(h => h.key.trim()).map(h => ({ ...h, enabled: true })),
        bodyType: epForm.bodyType !== 'none' ? epForm.bodyType : undefined,
        bodyTemplate: epForm.bodyTemplate.trim() || undefined,
      },
    });
    setShowNewEndpointModal(null);
    resetEpForm();
  };

  const resetCollForm = () => {
    setCollForm({ name: '', baseUrl: '', description: '', authType: 'none', authToken: '', apiKeyName: '', apiKeyValue: '', apiKeyIn: 'header', username: '', password: '' });
    setCollHeaders([]);
    setCollErrors({});
  };

  const resetEpForm = () => {
    setEpForm({ name: '', method: 'GET', path: '', description: '', bodyType: 'none', bodyTemplate: '' });
    setEpHeaders([]);
    setEpErrors({});
  };

  if (isPending) return <Spinner />;

  const list = collections || [];
  const filtered = searchQuery
    ? list.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.baseUrl.toLowerCase().includes(searchQuery.toLowerCase()))
    : list;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-200">API Collections</h3>
          <p className="text-sm text-slate-500">{list.length} collection{list.length !== 1 ? 's' : ''} configured</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none w-48"
              placeholder="Search collections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Btn variant="secondary" onClick={() => { setShowSwaggerModal(true); setSwaggerText(''); setSwaggerResult(null); setSwaggerError(''); }}>
            <Upload className="w-4 h-4" /> Import Swagger
          </Btn>
          <Btn onClick={() => { setShowNewCollModal(true); resetCollForm(); }}>
            <Plus className="w-4 h-4" /> New Collection
          </Btn>
        </div>
      </div>

      {/* Empty State */}
      {list.length === 0 && (
        <EmptyState
          icon={FolderOpen}
          title="No API Collections"
          subtitle="Start by importing a Swagger/OpenAPI spec or creating a collection manually. Or load demo data to explore."
          action={
            <div className="flex gap-2">
              <Btn variant="secondary" onClick={() => setShowSwaggerModal(true)}>
                <Upload className="w-4 h-4" /> Import Swagger
              </Btn>
              <Btn onClick={() => seedDemo.mutate()} disabled={seedDemo.isPending}>
                {seedDemo.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                Load Demo Data
              </Btn>
            </div>
          }
        />
      )}

      {/* Collection Cards */}
      <div className="space-y-3">
        {filtered.map((coll) => {
          const isExpanded = expandedId === coll.id;
          const endpoints = isExpanded && expandedColl ? expandedColl.endpoints || [] : [];
          const authType = (() => {
            try {
              const a = typeof coll.authConfig === 'string' ? JSON.parse(coll.authConfig as string) : coll.authConfig;
              return a?.type || 'none';
            } catch { return 'none'; }
          })();

          return (
            <div key={coll.id} className="bg-slate-800/80 border border-slate-700 rounded-xl overflow-hidden hover:border-slate-600 transition-colors">
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : coll.id)}
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <FolderOpen className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-slate-200 truncate">{coll.name}</h4>
                      {authType !== 'none' && (
                        <Tooltip text={`Auth: ${authType}`}>
                          <Shield className="w-3.5 h-3.5 text-emerald-400" />
                        </Tooltip>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <Globe className="w-3 h-3" />
                      <span className="font-mono truncate">{coll.baseUrl}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 ml-4">
                  <div className="text-right text-xs text-slate-500 hidden sm:block">
                    <div>{coll.endpoints?.length ?? '?'} endpoints</div>
                    <div className="text-slate-600">{fmtRelTime(coll.updatedAt)}</div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ id: coll.id, name: coll.name }); }}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-slate-700/50 px-5 py-4 bg-slate-800/40">
                  {coll.description && (
                    <p className="text-sm text-slate-400 mb-4">{coll.description}</p>
                  )}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-slate-300">Endpoints ({endpoints.length})</span>
                    <Btn variant="ghost" onClick={() => { setShowNewEndpointModal(coll.id); resetEpForm(); }} size="sm">
                      <Plus className="w-3 h-3" /> Add Endpoint
                    </Btn>
                  </div>
                  {endpoints.length === 0 ? (
                    <p className="text-sm text-slate-500 py-6 text-center bg-slate-900/30 rounded-lg">
                      No endpoints yet. Add manually or import a Swagger spec.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-700/50">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-[11px] text-slate-500 uppercase tracking-wider bg-slate-900/50">
                            <th className="px-3 py-2.5 w-20">Method</th>
                            <th className="px-3 py-2.5">Path</th>
                            <th className="px-3 py-2.5">Name</th>
                            <th className="px-3 py-2.5 w-20 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/30">
                          {endpoints.map((ep: PtEndpoint) => (
                            <tr key={ep.id} className="hover:bg-slate-700/20 transition-colors">
                              <td className="px-3 py-2.5"><MethodBadge method={ep.method} size="xs" /></td>
                              <td className="px-3 py-2.5 text-slate-300 font-mono text-xs">{ep.path}</td>
                              <td className="px-3 py-2.5 text-slate-400">{ep.name}</td>
                              <td className="px-3 py-2.5 text-right">
                                <button
                                  onClick={() => deleteEndpoint.mutate({ id: ep.id, collectionId: coll.id })}
                                  className="p-1 text-slate-600 hover:text-red-400 transition-colors"
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

      {/* Swagger Import Modal */}
      <Modal
        open={showSwaggerModal}
        onClose={() => setShowSwaggerModal(false)}
        title="Import Swagger / OpenAPI Spec"
        wide
      >
        {!swaggerResult ? (
          <div className="space-y-4">
            <div>
              <Label hint="JSON or YAML format">Paste Swagger/OpenAPI specification</Label>
              <Textarea
                value={swaggerText}
                onChange={setSwaggerText}
                placeholder='{"openapi": "3.0.0", "info": { "title": "My API" }, ...}'
                rows={10}
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg cursor-pointer text-sm text-slate-300 transition-colors">
                <Upload className="w-4 h-4" /> Choose File
                <input type="file" accept=".json,.yaml,.yml,.txt" className="hidden" onChange={handleSwaggerFile} />
              </label>
              <span className="text-xs text-slate-600">Supports .json, .yaml, .yml</span>
            </div>
            {swaggerError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
                {swaggerError}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Btn variant="secondary" onClick={() => setShowSwaggerModal(false)}>Cancel</Btn>
              <Btn onClick={handleSwaggerParse} disabled={parseSwagger.isPending || !swaggerText.trim()}>
                {parseSwagger.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Parse & Import
              </Btn>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto mb-4" />
            <h4 className="text-xl font-bold text-slate-200 mb-1">Import Successful</h4>
            <p className="text-sm text-slate-400 mb-1">{swaggerResult.parsed.title} v{swaggerResult.parsed.version}</p>
            <p className="text-lg text-emerald-400 font-semibold">{swaggerResult.parsed.endpointCount} endpoints imported</p>
            <div className="mt-6">
              <Btn onClick={() => { setShowSwaggerModal(false); setSwaggerText(''); setSwaggerResult(null); }}>
                <CheckCircle2 className="w-4 h-4" /> Done
              </Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* New Collection Modal */}
      <Modal
        open={showNewCollModal}
        onClose={() => { setShowNewCollModal(false); resetCollForm(); }}
        title="New API Collection"
        wide
        footer={
          <>
            <Btn variant="secondary" onClick={() => { setShowNewCollModal(false); resetCollForm(); }}>Cancel</Btn>
            <Btn onClick={handleCreateCollection} disabled={createCollection.isPending}>
              {createCollection.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Collection
            </Btn>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label required>Name</Label>
              <Input
                value={collForm.name}
                onChange={(v) => { setCollForm({ ...collForm, name: v }); setCollErrors({ ...collErrors, name: '' }); }}
                placeholder="My API Collection"
                error={collErrors.name}
              />
            </div>
            <div>
              <Label required>Base URL</Label>
              <Input
                value={collForm.baseUrl}
                onChange={(v) => { setCollForm({ ...collForm, baseUrl: v }); setCollErrors({ ...collErrors, baseUrl: '' }); }}
                placeholder="https://api.example.com"
                error={collErrors.baseUrl}
              />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Input value={collForm.description} onChange={(v) => setCollForm({ ...collForm, description: v })} placeholder="Brief description of this API collection" />
          </div>

          {/* Auth Config */}
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 space-y-3">
            <Label>Authentication</Label>
            <Select
              value={collForm.authType}
              onChange={(v) => setCollForm({ ...collForm, authType: v as PtAuthConfig['type'] })}
              options={AUTH_TYPES.map(t => ({
                value: t,
                label: t === 'none' ? 'No Auth' : t === 'bearer' ? 'Bearer Token' : t === 'apiKey' ? 'API Key' : t === 'basic' ? 'Basic Auth' : 'OAuth 2.0',
              }))}
            />
            {collForm.authType === 'bearer' && (
              <div>
                <Label required>Bearer Token</Label>
                <Input
                  value={collForm.authToken}
                  onChange={(v) => { setCollForm({ ...collForm, authToken: v }); setCollErrors({ ...collErrors, authToken: '' }); }}
                  placeholder="eyJhbGciOiJIUzI1NiIs..."
                  error={collErrors.authToken}
                />
              </div>
            )}
            {collForm.authType === 'apiKey' && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label required>Key Name</Label>
                  <Input value={collForm.apiKeyName} onChange={(v) => setCollForm({ ...collForm, apiKeyName: v })} placeholder="X-API-Key" error={collErrors.apiKeyName} />
                </div>
                <div>
                  <Label required>Key Value</Label>
                  <Input value={collForm.apiKeyValue} onChange={(v) => setCollForm({ ...collForm, apiKeyValue: v })} placeholder="your-api-key" error={collErrors.apiKeyValue} />
                </div>
                <div>
                  <Label>Location</Label>
                  <Select value={collForm.apiKeyIn} onChange={(v) => setCollForm({ ...collForm, apiKeyIn: v as 'header' | 'query' })} options={[{ value: 'header', label: 'Header' }, { value: 'query', label: 'Query Param' }]} />
                </div>
              </div>
            )}
            {collForm.authType === 'basic' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Username</Label>
                  <Input value={collForm.username} onChange={(v) => setCollForm({ ...collForm, username: v })} placeholder="username" />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input value={collForm.password} onChange={(v) => setCollForm({ ...collForm, password: v })} placeholder="password" type="password" />
                </div>
              </div>
            )}
          </div>

          <div>
            <Label hint="Applied to all requests in this collection">Default Headers</Label>
            <KvEditor items={collHeaders} onChange={setCollHeaders} canToggle />
          </div>
        </div>
      </Modal>

      {/* New Endpoint Modal */}
      <Modal
        open={!!showNewEndpointModal}
        onClose={() => { setShowNewEndpointModal(null); resetEpForm(); }}
        title="Add Endpoint"
        wide
        footer={
          <>
            <Btn variant="secondary" onClick={() => { setShowNewEndpointModal(null); resetEpForm(); }}>Cancel</Btn>
            <Btn onClick={handleCreateEndpoint} disabled={createEndpoint.isPending}>
              {createEndpoint.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Endpoint
            </Btn>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="w-32">
              <Label required>Method</Label>
              <Select value={epForm.method} onChange={(v) => setEpForm({ ...epForm, method: v })} options={HTTP_METHODS.map(m => ({ value: m, label: m }))} />
            </div>
            <div className="flex-1">
              <Label required>Path</Label>
              <Input value={epForm.path} onChange={(v) => { setEpForm({ ...epForm, path: v }); setEpErrors({ ...epErrors, path: '' }); }} placeholder="/api/v1/users/{id}" error={epErrors.path} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label required>Name</Label>
              <Input value={epForm.name} onChange={(v) => { setEpForm({ ...epForm, name: v }); setEpErrors({ ...epErrors, name: '' }); }} placeholder="Get User by ID" error={epErrors.name} />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={epForm.description} onChange={(v) => setEpForm({ ...epForm, description: v })} placeholder="Retrieve user details" />
            </div>
          </div>

          <div>
            <Label>Headers</Label>
            <KvEditor items={epHeaders} onChange={setEpHeaders} canToggle />
          </div>

          <div>
            <Label>Body Type</Label>
            <Select value={epForm.bodyType} onChange={(v) => setEpForm({ ...epForm, bodyType: v })} options={BODY_TYPES.map(t => ({ value: t, label: t === 'none' ? 'No Body' : t.toUpperCase() }))} />
          </div>
          {epForm.bodyType !== 'none' && (
            <div>
              <Label hint="Use {{variableName}} for dynamic values">Body Template</Label>
              <Textarea
                value={epForm.bodyTemplate}
                onChange={(v) => setEpForm({ ...epForm, bodyTemplate: v })}
                placeholder='{"username": "{{username}}", "email": "{{email}}"}'
                rows={5}
              />
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && deleteCollection.mutate(deleteConfirm.id)}
        title="Delete Collection"
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? This will also delete all endpoints, chains, and scenarios associated with this collection.`}
      />
    </div>
  );
}
