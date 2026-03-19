import { useState, useMemo, useCallback } from 'react';
import {
  Plus, Trash2, Loader2, Play, Link2, ArrowDown, ArrowUp,
  CheckCircle2, XCircle, Clock, Pencil, FolderOpen,
  GripVertical, Copy, Rocket, ChevronDown, ChevronUp, Zap, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useCollections, useChains, useChain, useCreateChain, useDeleteChain,
  useCreateStep, useUpdateStep, useDeleteStep, useReorderSteps,
  useExecuteChain, useSeedDemo,
} from '@/hooks/use-pt-suite';
import type { PtChainStep, PtEndpoint, PtExtractor, PtAssertion, PtChainExecutionResult } from '@/types/pt-suite.types';
import { EXTRACTOR_SOURCES, ASSERTION_TYPES, ASSERTION_OPERATORS, HTTP_METHODS, fmtLatency, fmtBytes } from '../constants';
import {
  MethodBadge, EmptyState, Modal, KvEditor, Label, Input, Textarea,
  Select, Btn, Spinner, CollapsibleSection, Tooltip, ConfirmDialog,
} from '../components/shared';

export function ChainDesignerTab() {
  const { data: chains, isPending: chainsLoading } = useChains();
  const { data: collections } = useCollections();
  const createChain = useCreateChain();
  const deleteChain = useDeleteChain();
  const createStep = useCreateStep();
  const updateStep = useUpdateStep();
  const deleteStep = useDeleteStep();
  const reorderSteps = useReorderSteps();
  const executeChain = useExecuteChain();
  const seedDemo = useSeedDemo();

  const [selectedChainId, setSelectedChainId] = useState<string | null>(null);
  const [showNewChainModal, setShowNewChainModal] = useState(false);
  const [showStepEditor, setShowStepEditor] = useState<{ chainId: string; step?: PtChainStep } | null>(null);
  const [showAddStepChoice, setShowAddStepChoice] = useState<string | null>(null);
  const [executionResult, setExecutionResult] = useState<PtChainExecutionResult | null>(null);
  const [expandedStepResult, setExpandedStepResult] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; chainId: string; name: string } | null>(null);
  const [endpointSearch, setEndpointSearch] = useState('');

  // New chain form
  const [chainForm, setChainForm] = useState({ name: '', description: '', collectionId: '' });
  const [chainErrors, setChainErrors] = useState<Record<string, string>>({});

  // Step editor form
  const [stepForm, setStepForm] = useState({ name: '', method: 'GET', url: '', body: '', thinkTimeSec: 0, isEnabled: true });
  const [stepHeaders, setStepHeaders] = useState<{ key: string; value: string; enabled?: boolean }[]>([]);
  const [stepExtractors, setStepExtractors] = useState<PtExtractor[]>([]);
  const [stepAssertions, setStepAssertions] = useState<PtAssertion[]>([]);
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});

  const { data: selectedChain } = useChain(selectedChainId ?? undefined);
  const steps = useMemo(() => [...(selectedChain?.steps || [])].sort((a, b) => a.sortOrder - b.sortOrder), [selectedChain]);

  const allEndpoints = useMemo(() => {
    if (!collections) return [];
    return collections.flatMap(c => (c.endpoints || []).map(ep => ({ ...ep, collectionName: c.name, baseUrl: c.baseUrl })));
  }, [collections]);

  const filteredEndpoints = useMemo(() => {
    if (!endpointSearch) return allEndpoints;
    const q = endpointSearch.toLowerCase();
    return allEndpoints.filter(ep => ep.name.toLowerCase().includes(q) || ep.path.toLowerCase().includes(q) || ep.method.toLowerCase().includes(q));
  }, [allEndpoints, endpointSearch]);

  const validateChainForm = useCallback(() => {
    const errs: Record<string, string> = {};
    if (!chainForm.name.trim()) errs.name = 'Name is required';
    if (!chainForm.collectionId) errs.collectionId = 'Select a collection';
    setChainErrors(errs);
    return Object.keys(errs).length === 0;
  }, [chainForm]);

  const validateStepForm = useCallback(() => {
    const errs: Record<string, string> = {};
    if (!stepForm.name.trim()) errs.name = 'Step name is required';
    if (!stepForm.url.trim()) errs.url = 'URL is required';
    setStepErrors(errs);
    return Object.keys(errs).length === 0;
  }, [stepForm]);

  const handleCreateChain = async () => {
    if (!validateChainForm()) return;
    const result = await createChain.mutateAsync({
      name: chainForm.name.trim(),
      description: chainForm.description.trim() || undefined,
      collectionId: chainForm.collectionId,
    });
    setSelectedChainId(result.id);
    setShowNewChainModal(false);
    setChainForm({ name: '', description: '', collectionId: '' });
    setChainErrors({});
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
    setStepErrors({});
    setShowStepEditor({ chainId, step });
  };

  const handleSaveStep = async () => {
    if (!showStepEditor || !validateStepForm()) return;
    const data = {
      name: stepForm.name.trim(),
      method: stepForm.method,
      url: stepForm.url.trim(),
      headers: stepHeaders.filter(h => h.key.trim()).map(h => ({ key: h.key.trim(), value: h.value.trim(), enabled: h.enabled ?? true })),
      body: stepForm.body.trim() || undefined,
      extractors: stepExtractors.filter(e => e.name.trim() && e.path.trim()),
      assertions: stepAssertions.filter(a => a.value.trim()),
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
    setEndpointSearch('');
  };

  const handleMoveStep = async (idx: number, direction: 'up' | 'down') => {
    if (!selectedChainId) return;
    const newSteps = [...steps];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= newSteps.length) return;
    [newSteps[idx], newSteps[swapIdx]] = [newSteps[swapIdx], newSteps[idx]];
    await reorderSteps.mutateAsync({
      chainId: selectedChainId,
      stepIds: newSteps.map(s => s.id),
    });
  };

  const handleExecuteChain = async () => {
    if (!selectedChainId) return;
    setExecutionResult(null);
    try {
      const result = await executeChain.mutateAsync({ chainId: selectedChainId });
      setExecutionResult(result);
    } catch { /* handled by mutation */ }
  };

  if (chainsLoading) return <Spinner />;

  const chainList = chains || [];
  const collList = collections || [];

  return (
    <div className="flex gap-6 min-h-[600px]">
      {/* Left Panel: Chain List */}
      <div className="w-72 flex-shrink-0 space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">API Chains</h3>
          <Btn variant="ghost" onClick={() => { setShowNewChainModal(true); setChainForm({ name: '', description: '', collectionId: '' }); setChainErrors({}); }} size="sm">
            <Plus className="w-3 h-3" />
          </Btn>
        </div>

        {chainList.length === 0 ? (
          <div className="text-center py-10 px-4">
            <Link2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500 mb-3">No chains yet</p>
            <Btn variant="ghost" onClick={() => seedDemo.mutate()} disabled={seedDemo.isPending} size="sm" className="mx-auto">
              {seedDemo.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Rocket className="w-3 h-3" />}
              Load Demo
            </Btn>
          </div>
        ) : (
          chainList.map((chain) => (
            <div
              key={chain.id}
              className={cn(
                'p-3 rounded-xl border cursor-pointer transition-all',
                selectedChainId === chain.id
                  ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 shadow-sm shadow-cyan-500/5'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-600',
              )}
              onClick={() => { setSelectedChainId(chain.id); setExecutionResult(null); }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium truncate flex-1">{chain.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteChain.mutate(chain.id); if (selectedChainId === chain.id) setSelectedChainId(null); }}
                  className="p-1 text-slate-500 hover:text-red-400 ml-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-slate-500">{chain.steps?.length ?? '?'} steps</span>
                {chain.isDemo && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">Demo</span>}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Main Area */}
      <div className="flex-1 min-w-0">
        {!selectedChainId ? (
          <EmptyState icon={Link2} title="Select a Chain" subtitle="Choose a chain from the left panel or create a new one to start designing your API test flow." />
        ) : (
          <div className="space-y-5">
            {/* Chain Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-200">{selectedChain?.name || 'Loading...'}</h3>
                {selectedChain?.description && <p className="text-sm text-slate-500 mt-0.5">{selectedChain.description}</p>}
              </div>
              <div className="flex gap-2">
                <Btn variant="secondary" onClick={() => setShowAddStepChoice(selectedChainId)} size="sm">
                  <Plus className="w-3.5 h-3.5" /> Add Step
                </Btn>
                <Btn onClick={handleExecuteChain} disabled={executeChain.isPending || steps.length === 0} size="sm">
                  {executeChain.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  Execute
                </Btn>
              </div>
            </div>

            {/* Steps Flow */}
            {steps.length === 0 ? (
              <EmptyState icon={ArrowDown} title="No Steps" subtitle="Add steps from collection endpoints or create them manually." />
            ) : (
              <div className="space-y-0">
                {steps.map((step, idx) => {
                  const execResult = executionResult?.steps[idx];
                  return (
                    <div key={step.id}>
                      <div className={cn(
                        'relative bg-slate-800/80 border rounded-xl p-4 transition-all group',
                        step.isEnabled ? 'border-slate-700 hover:border-slate-600' : 'border-slate-700/50 opacity-50',
                        execResult && !execResult.error && execResult.status < 400 && 'border-emerald-500/30 bg-emerald-500/5',
                        execResult && (execResult.error || execResult.status >= 400) && 'border-red-500/30 bg-red-500/5',
                      )}>
                        <div className="flex items-center gap-3">
                          {/* Reorder Buttons */}
                          <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleMoveStep(idx, 'up')} disabled={idx === 0} className="p-0.5 text-slate-500 hover:text-slate-300 disabled:opacity-20">
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button onClick={() => handleMoveStep(idx, 'down')} disabled={idx === steps.length - 1} className="p-0.5 text-slate-500 hover:text-slate-300 disabled:opacity-20">
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Step Number */}
                          <span className={cn(
                            'w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0',
                            execResult && !execResult.error && execResult.status < 400
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : execResult && (execResult.error || execResult.status >= 400)
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-cyan-500/20 text-cyan-400',
                          )}>
                            {execResult ? (execResult.error || execResult.status >= 400 ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />) : idx + 1}
                          </span>

                          <MethodBadge method={step.method} />

                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-slate-200">{step.name}</span>
                            <p className="text-xs text-slate-500 font-mono truncate">{step.url}</p>
                          </div>

                          {/* Execution result summary */}
                          {execResult && (
                            <div className="flex items-center gap-3 text-xs">
                              <span className={cn('font-mono', execResult.status >= 400 ? 'text-red-400' : 'text-emerald-400')}>{execResult.status}</span>
                              <span className="text-slate-500">{fmtLatency(execResult.durationMs)}</span>
                              <span className="text-slate-600">{fmtBytes(execResult.responseSize)}</span>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex items-center gap-1">
                            {step.thinkTimeSec > 0 && (
                              <Tooltip text={`${step.thinkTimeSec}s delay after this step`}>
                                <span className="text-xs text-slate-500 mr-1"><Clock className="w-3 h-3 inline" />{step.thinkTimeSec}s</span>
                              </Tooltip>
                            )}
                            <button onClick={() => openStepEditor(selectedChainId!, step)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 opacity-0 group-hover:opacity-100 transition-all">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm({ id: step.id, chainId: selectedChainId!, name: step.name })}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Tags for extractors/assertions */}
                        {((step.extractors?.length ?? 0) > 0 || (step.assertions?.length ?? 0) > 0) && (
                          <div className="flex gap-1.5 mt-2.5 ml-10 flex-wrap">
                            {(step.extractors || []).map((ex, ei) => (
                              <span key={ei} className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono">
                                {'{{'}{ ex.name }{'}}'}
                              </span>
                            ))}
                            {(step.assertions || []).map((a, ai) => {
                              const execAssertion = execResult?.assertionResults?.[ai];
                              return (
                                <span key={ai} className={cn(
                                  'text-[10px] px-2 py-0.5 rounded-full border font-mono',
                                  execAssertion
                                    ? execAssertion.passed
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                      : 'bg-red-500/10 text-red-400 border-red-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                                )}>
                                  {execAssertion && (execAssertion.passed ? '✓ ' : '✗ ')}
                                  {a.type} {a.operator} {a.value}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Arrow connector */}
                      {idx < steps.length - 1 && (
                        <div className="flex justify-center py-1">
                          <div className="flex flex-col items-center">
                            <div className="w-px h-2 bg-slate-700" />
                            <ArrowDown className="w-3.5 h-3.5 text-slate-600" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Execution Result Summary */}
            {executionResult && (
              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    {executionResult.success ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
                    Chain Execution {executionResult.success ? 'Passed' : 'Failed'}
                  </h4>
                  <span className="text-sm text-slate-400 font-mono">{fmtLatency(executionResult.totalDurationMs)}</span>
                </div>

                {/* Extracted Variables */}
                {Object.keys(executionResult.variables).length > 0 && (
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Extracted Variables</span>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(executionResult.variables).map(([k, v]) => (
                        <span key={k} className="text-xs px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono">
                          {k} = <span className="text-purple-400">{String(v).length > 30 ? String(v).slice(0, 30) + '...' : v}</span>
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
      <Modal open={showNewChainModal} onClose={() => setShowNewChainModal(false)} title="Create New Chain"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setShowNewChainModal(false)}>Cancel</Btn>
            <Btn onClick={handleCreateChain} disabled={createChain.isPending}>
              {createChain.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Chain
            </Btn>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label required>Name</Label>
            <Input value={chainForm.name} onChange={(v) => { setChainForm({ ...chainForm, name: v }); setChainErrors({ ...chainErrors, name: '' }); }} placeholder="User Login Flow" error={chainErrors.name} />
          </div>
          <div>
            <Label>Description</Label>
            <Input value={chainForm.description} onChange={(v) => setChainForm({ ...chainForm, description: v })} placeholder="End-to-end test for user authentication" />
          </div>
          <div>
            <Label required>Collection</Label>
            <Select
              value={chainForm.collectionId}
              onChange={(v) => { setChainForm({ ...chainForm, collectionId: v }); setChainErrors({ ...chainErrors, collectionId: '' }); }}
              options={[{ value: '', label: 'Select a collection...' }, ...collList.map(c => ({ value: c.id, label: c.name }))]}
            />
            {chainErrors.collectionId && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{chainErrors.collectionId}</p>}
          </div>
        </div>
      </Modal>

      {/* Add Step Choice Modal */}
      <Modal open={!!showAddStepChoice} onClose={() => { setShowAddStepChoice(null); setEndpointSearch(''); }} title="Add Step" wide>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { setShowAddStepChoice(null); openStepEditor(showAddStepChoice!, undefined); setEndpointSearch(''); }}
              className="p-4 bg-slate-700/30 border border-slate-600 rounded-xl hover:border-cyan-500/50 text-left transition-all hover:bg-slate-700/50"
            >
              <Pencil className="w-5 h-5 text-cyan-400 mb-2" />
              <h4 className="text-sm font-medium text-slate-200">Manual Entry</h4>
              <p className="text-xs text-slate-500 mt-1">Create a custom step from scratch</p>
            </button>
            <div className="p-4 bg-slate-700/30 border border-slate-600 rounded-xl">
              <FolderOpen className="w-5 h-5 text-emerald-400 mb-2" />
              <h4 className="text-sm font-medium text-slate-200">From Collection</h4>
              <p className="text-xs text-slate-500 mt-1">Pick an existing endpoint below</p>
            </div>
          </div>

          {allEndpoints.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Label>Available Endpoints</Label>
                <span className="text-xs text-slate-600">({allEndpoints.length})</span>
              </div>
              <Input value={endpointSearch} onChange={setEndpointSearch} placeholder="Search endpoints..." className="mb-2" />
              <div className="max-h-64 overflow-y-auto space-y-1 border border-slate-700 rounded-lg p-1">
                {filteredEndpoints.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">No matching endpoints</p>
                ) : (
                  filteredEndpoints.map((ep) => (
                    <button
                      key={ep.id}
                      onClick={() => handleAddFromEndpoint(ep, showAddStepChoice!)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-700/50 text-left transition-colors"
                    >
                      <MethodBadge method={ep.method} size="xs" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-slate-300 block truncate">{ep.name}</span>
                        <span className="text-xs text-slate-500 font-mono block truncate">{ep.collectionName} · {ep.path}</span>
                      </div>
                      <Plus className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Step Editor Modal */}
      <Modal open={!!showStepEditor} onClose={() => setShowStepEditor(null)} title={showStepEditor?.step ? 'Edit Step' : 'New Step'} wide
        footer={
          <>
            <Btn variant="secondary" onClick={() => setShowStepEditor(null)}>Cancel</Btn>
            <Btn onClick={handleSaveStep} disabled={createStep.isPending || updateStep.isPending}>
              {(createStep.isPending || updateStep.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {showStepEditor?.step ? 'Update Step' : 'Add Step'}
            </Btn>
          </>
        }
      >
        <div className="space-y-5">
          <div className="flex gap-3">
            <div className="w-28">
              <Label required>Method</Label>
              <Select value={stepForm.method} onChange={(v) => setStepForm({ ...stepForm, method: v })} options={HTTP_METHODS.map(m => ({ value: m, label: m }))} />
            </div>
            <div className="flex-1">
              <Label required hint="Use {{variable}} for dynamic values">URL</Label>
              <Input value={stepForm.url} onChange={(v) => { setStepForm({ ...stepForm, url: v }); setStepErrors({ ...stepErrors, url: '' }); }} placeholder="https://api.example.com/{{userId}}" error={stepErrors.url} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label required>Step Name</Label>
              <Input value={stepForm.name} onChange={(v) => { setStepForm({ ...stepForm, name: v }); setStepErrors({ ...stepErrors, name: '' }); }} placeholder="Authenticate User" error={stepErrors.name} />
            </div>
            <div>
              <Label hint="Delay after this step">Think Time</Label>
              <div className="flex items-center gap-3">
                <input type="range" min={0} max={10} step={0.5} value={stepForm.thinkTimeSec} onChange={(e) => setStepForm({ ...stepForm, thinkTimeSec: parseFloat(e.target.value) })} className="flex-1 accent-cyan-500" />
                <span className="text-sm text-slate-400 w-10 text-right font-mono">{stepForm.thinkTimeSec}s</span>
              </div>
            </div>
          </div>

          <CollapsibleSection title="Headers" badge={stepHeaders.length > 0 ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">{stepHeaders.length}</span> : undefined}>
            <KvEditor items={stepHeaders} onChange={setStepHeaders} canToggle />
          </CollapsibleSection>

          <CollapsibleSection title="Request Body" defaultOpen={!!stepForm.body}>
            <Textarea value={stepForm.body} onChange={(v) => setStepForm({ ...stepForm, body: v })} placeholder='{"key": "{{value}}"}' rows={4} />
          </CollapsibleSection>

          <CollapsibleSection title="Extractors" badge={stepExtractors.length > 0 ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">{stepExtractors.length}</span> : undefined}>
            <div className="space-y-2">
              {stepExtractors.map((ex, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input value={ex.name} onChange={(v) => { const n = [...stepExtractors]; n[i] = { ...n[i], name: v }; setStepExtractors(n); }} placeholder="variableName" className="flex-1" />
                  <Select
                    value={ex.source}
                    onChange={(v) => { const n = [...stepExtractors]; n[i] = { ...n[i], source: v as PtExtractor['source'] }; setStepExtractors(n); }}
                    options={EXTRACTOR_SOURCES.map(s => ({ value: s, label: s }))}
                    className="w-24"
                  />
                  <Input value={ex.path} onChange={(v) => { const n = [...stepExtractors]; n[i] = { ...n[i], path: v }; setStepExtractors(n); }} placeholder="$.data.token" className="flex-1" />
                  <button onClick={() => setStepExtractors(stepExtractors.filter((_, idx) => idx !== i))} className="p-1 text-slate-600 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <button onClick={() => setStepExtractors([...stepExtractors, { name: '', source: 'body', path: '' }])} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add Extractor
              </button>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Assertions" badge={stepAssertions.length > 0 ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">{stepAssertions.length}</span> : undefined}>
            <div className="space-y-2">
              {stepAssertions.map((a, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Select
                    value={a.type}
                    onChange={(v) => { const n = [...stepAssertions]; n[i] = { ...n[i], type: v as PtAssertion['type'] }; setStepAssertions(n); }}
                    options={ASSERTION_TYPES.map(t => ({ value: t, label: t }))}
                    className="w-32"
                  />
                  <Input value={a.target} onChange={(v) => { const n = [...stepAssertions]; n[i] = { ...n[i], target: v }; setStepAssertions(n); }} placeholder="$.data.id" className="flex-1" />
                  <Select
                    value={a.operator}
                    onChange={(v) => { const n = [...stepAssertions]; n[i] = { ...n[i], operator: v as PtAssertion['operator'] }; setStepAssertions(n); }}
                    options={ASSERTION_OPERATORS.map(o => ({ value: o, label: o }))}
                    className="w-28"
                  />
                  <Input value={a.value} onChange={(v) => { const n = [...stepAssertions]; n[i] = { ...n[i], value: v }; setStepAssertions(n); }} placeholder="200" className="w-24" />
                  <button onClick={() => setStepAssertions(stepAssertions.filter((_, idx) => idx !== i))} className="p-1 text-slate-600 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <button onClick={() => setStepAssertions([...stepAssertions, { type: 'status', target: '', operator: 'eq', value: '200' }])} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add Assertion
              </button>
            </div>
          </CollapsibleSection>
        </div>
      </Modal>

      {/* Delete Step Confirmation */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && deleteStep.mutate({ id: deleteConfirm.id, chainId: deleteConfirm.chainId })}
        title="Delete Step"
        message={`Remove "${deleteConfirm?.name}" from this chain?`}
      />
    </div>
  );
}
