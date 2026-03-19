import { useState, useMemo, useCallback } from 'react';
import {
  Plus, Trash2, Loader2, Rocket, X, Pencil, Play, Copy,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';
import {
  useScenarios, useChains, useCreateScenario, useUpdateScenario, useDeleteScenario,
  useStartRun, useSeedDemo,
} from '@/hooks/use-pt-suite';
import type { PtScenario, PtSlaThreshold } from '@/types/pt-suite.types';
import { PATTERN_CONFIG, SLA_METRICS, SLA_OPERATORS, fmtDuration } from '../constants';
import {
  EmptyState, Label, Input, Select, Btn, Spinner, StatCard,
  ConfirmDialog,
} from '../components/shared';

export function LoadScenariosTab() {
  const { data: scenarios, isPending } = useScenarios();
  const { data: chains } = useChains();
  const createScenario = useCreateScenario();
  const updateScenario = useUpdateScenario();
  const deleteScenario = useDeleteScenario();
  const startRun = useStartRun();
  const seedDemo = useSeedDemo();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState({
    name: '', description: '', chainId: '',
    pattern: 'ramp' as PtScenario['pattern'],
    peakVU: 50, rampUpSec: 30, steadyStateSec: 60, rampDownSec: 15,
    thinkTimeSec: 1, pacingSec: 0, timeoutMs: 30000, maxErrorPct: 5,
  });
  const [slaThresholds, setSlaThresholds] = useState<PtSlaThreshold[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const validateForm = useCallback(() => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.chainId) errs.chainId = 'Select a chain';
    if (form.peakVU < 1) errs.peakVU = 'Must be at least 1';
    if (form.peakVU > 1000) errs.peakVU = 'Max 1000 VUs';
    if (form.rampUpSec < 0) errs.rampUpSec = 'Cannot be negative';
    if (form.steadyStateSec < 1) errs.steadyStateSec = 'Must be at least 1s';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }, [form]);

  // Build ramp preview data
  const rampPreview = useMemo(() => {
    const { peakVU, rampUpSec, steadyStateSec, rampDownSec, pattern } = form;
    const totalSec = rampUpSec + steadyStateSec + rampDownSec;
    const points: { time: number; vu: number }[] = [];
    const numPoints = 50;
    for (let i = 0; i <= numPoints; i++) {
      const t = (i / numPoints) * totalSec;
      let vu = 0;

      if (pattern === 'spike') {
        vu = t < rampUpSec ? peakVU : t < rampUpSec + steadyStateSec ? peakVU : 0;
      } else if (pattern === 'stress') {
        // Stress: ramp beyond peak
        if (t <= rampUpSec) vu = rampUpSec > 0 ? (t / rampUpSec) * peakVU : peakVU;
        else if (t <= rampUpSec + steadyStateSec) {
          const progress = (t - rampUpSec) / steadyStateSec;
          vu = peakVU + progress * peakVU * 0.5; // Go 50% above peak
        }
        else vu = 0;
      } else if (pattern === 'step') {
        const stepCount = 5;
        const stepDuration = totalSec / stepCount;
        const currentStep = Math.min(Math.floor(t / stepDuration), stepCount - 1);
        vu = Math.round(peakVU * ((currentStep + 1) / stepCount));
      } else if (pattern === 'soak') {
        vu = peakVU; // Constant
      } else {
        // Default ramp
        if (t <= rampUpSec) vu = rampUpSec > 0 ? (t / rampUpSec) * peakVU : peakVU;
        else if (t <= rampUpSec + steadyStateSec) vu = peakVU;
        else {
          const remaining = t - rampUpSec - steadyStateSec;
          vu = rampDownSec > 0 ? peakVU * (1 - remaining / rampDownSec) : 0;
        }
      }

      points.push({ time: Math.round(t), vu: Math.max(0, Math.round(vu)) });
    }
    return points;
  }, [form]);

  const totalDuration = form.rampUpSec + form.steadyStateSec + form.rampDownSec;

  const handleCreate = async () => {
    if (!validateForm()) return;
    if (editingId) {
      await updateScenario.mutateAsync({
        id: editingId,
        data: { ...form, description: form.description || undefined, slaThresholds: slaThresholds.length ? slaThresholds : undefined },
      });
    } else {
      await createScenario.mutateAsync({
        ...form,
        description: form.description || undefined,
        slaThresholds: slaThresholds.length ? slaThresholds : undefined,
      });
    }
    setShowForm(false);
    setEditingId(null);
    resetForm();
  };

  const handleEdit = (scenario: PtScenario) => {
    setForm({
      name: scenario.name,
      description: scenario.description || '',
      chainId: scenario.chainId,
      pattern: scenario.pattern,
      peakVU: scenario.peakVU,
      rampUpSec: scenario.rampUpSec,
      steadyStateSec: scenario.steadyStateSec,
      rampDownSec: scenario.rampDownSec,
      thinkTimeSec: scenario.thinkTimeSec,
      pacingSec: scenario.pacingSec,
      timeoutMs: scenario.timeoutMs,
      maxErrorPct: scenario.maxErrorPct,
    });
    setSlaThresholds(scenario.slaThresholds || []);
    setEditingId(scenario.id);
    setShowForm(true);
    setFormErrors({});
  };

  const handleQuickRun = async (scenarioId: string) => {
    await startRun.mutateAsync({ scenarioId });
  };

  const resetForm = () => {
    setForm({ name: '', description: '', chainId: '', pattern: 'ramp', peakVU: 50, rampUpSec: 30, steadyStateSec: 60, rampDownSec: 15, thinkTimeSec: 1, pacingSec: 0, timeoutMs: 30000, maxErrorPct: 5 });
    setSlaThresholds([]);
    setFormErrors({});
  };

  if (isPending) return <Spinner />;

  const list = scenarios || [];
  const chainList = chains || [];

  if (showForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-200">{editingId ? 'Edit Scenario' : 'Create Load Scenario'}</h3>
          <Btn variant="ghost" onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}><X className="w-4 h-4" /> Cancel</Btn>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Configuration */}
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label required>Scenario Name</Label>
                <Input value={form.name} onChange={(v) => { setForm({ ...form, name: v }); setFormErrors({ ...formErrors, name: '' }); }} placeholder="Peak Hour Simulation" error={formErrors.name} />
              </div>
              <div>
                <Label required>Chain</Label>
                <Select
                  value={form.chainId}
                  onChange={(v) => { setForm({ ...form, chainId: v }); setFormErrors({ ...formErrors, chainId: '' }); }}
                  options={[{ value: '', label: 'Select chain...' }, ...chainList.map(c => ({ value: c.id, label: c.name }))]}
                />
                {formErrors.chainId && <p className="text-xs text-red-400 mt-1">{formErrors.chainId}</p>}
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Input value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="Simulate peak traffic conditions" />
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
                        'p-3 rounded-xl border text-left transition-all',
                        form.pattern === key
                          ? 'bg-cyan-500/10 border-cyan-500/30 shadow-sm shadow-cyan-500/5'
                          : 'bg-slate-800/80 border-slate-700 hover:border-slate-600',
                      )}
                    >
                      <Icon className={cn('w-5 h-5 mb-1', cfg.color)} />
                      <div className="text-sm font-medium text-slate-200">{cfg.label}</div>
                      <div className="text-[11px] text-slate-500">{cfg.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* VU Configuration */}
            <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-400 font-medium">Peak Virtual Users</span>
                  <span className="text-cyan-400 font-bold text-lg">{form.peakVU}</span>
                </div>
                <input type="range" min={1} max={500} value={form.peakVU} onChange={(e) => setForm({ ...form, peakVU: parseInt(e.target.value) })} className="w-full accent-cyan-500 h-2" />
                <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
                  <span>1</span><span>100</span><span>250</span><span>500</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label hint="seconds">Ramp Up</Label>
                  <Input value={form.rampUpSec} onChange={(v) => setForm({ ...form, rampUpSec: Math.max(0, parseInt(v) || 0) })} type="number" min={0} error={formErrors.rampUpSec} />
                </div>
                <div>
                  <Label hint="seconds">Steady State</Label>
                  <Input value={form.steadyStateSec} onChange={(v) => setForm({ ...form, steadyStateSec: Math.max(1, parseInt(v) || 1) })} type="number" min={1} error={formErrors.steadyStateSec} />
                </div>
                <div>
                  <Label hint="seconds">Ramp Down</Label>
                  <Input value={form.rampDownSec} onChange={(v) => setForm({ ...form, rampDownSec: Math.max(0, parseInt(v) || 0) })} type="number" min={0} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label hint="between iterations">Think Time</Label>
                  <div className="flex items-center gap-2">
                    <input type="range" min={0} max={10} step={0.5} value={form.thinkTimeSec} onChange={(e) => setForm({ ...form, thinkTimeSec: parseFloat(e.target.value) })} className="flex-1 accent-cyan-500" />
                    <span className="text-xs text-slate-400 w-8 text-right font-mono">{form.thinkTimeSec}s</span>
                  </div>
                </div>
                <div>
                  <Label hint="ms">Request Timeout</Label>
                  <Input value={form.timeoutMs} onChange={(v) => setForm({ ...form, timeoutMs: Math.max(1000, parseInt(v) || 30000) })} type="number" min={1000} />
                </div>
                <div>
                  <Label hint="auto-stop">Max Error %</Label>
                  <Input value={form.maxErrorPct} onChange={(v) => setForm({ ...form, maxErrorPct: Math.max(0, Math.min(100, parseFloat(v) || 5)) })} type="number" min={0} max={100} />
                </div>
              </div>
            </div>

            {/* SLA Thresholds */}
            <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
              <Label hint="Define pass/fail criteria">SLA Thresholds</Label>
              <div className="space-y-2 mt-2">
                {slaThresholds.map((sla, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Select
                      value={sla.metric}
                      onChange={(v) => { const n = [...slaThresholds]; n[i] = { ...n[i], metric: v as PtSlaThreshold['metric'] }; setSlaThresholds(n); }}
                      options={SLA_METRICS.map(m => ({ value: m, label: m === 'avgLatency' ? 'Avg Latency (ms)' : m === 'p95Latency' ? 'P95 Latency (ms)' : m === 'p99Latency' ? 'P99 Latency (ms)' : m === 'errorRate' ? 'Error Rate (%)' : 'TPS' }))}
                      className="w-40"
                    />
                    <Select
                      value={sla.operator}
                      onChange={(v) => { const n = [...slaThresholds]; n[i] = { ...n[i], operator: v as PtSlaThreshold['operator'] }; setSlaThresholds(n); }}
                      options={SLA_OPERATORS.map(o => ({ value: o, label: o === 'lt' ? '<' : o === 'gt' ? '>' : o === 'lte' ? '<=' : '>=' }))}
                      className="w-16"
                    />
                    <Input
                      value={sla.value}
                      onChange={(v) => { const n = [...slaThresholds]; n[i] = { ...n[i], value: parseFloat(v) || 0 }; setSlaThresholds(n); }}
                      type="number" className="w-24"
                    />
                    <Select
                      value={sla.severity}
                      onChange={(v) => { const n = [...slaThresholds]; n[i] = { ...n[i], severity: v as PtSlaThreshold['severity'] }; setSlaThresholds(n); }}
                      options={[{ value: 'warn', label: 'Warning' }, { value: 'fail', label: 'Failure' }]}
                      className="w-24"
                    />
                    <button onClick={() => setSlaThresholds(slaThresholds.filter((_, idx) => idx !== i))} className="p-1 text-slate-600 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button onClick={() => setSlaThresholds([...slaThresholds, { metric: 'p95Latency', operator: 'lt', value: 500, severity: 'warn' }])} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add SLA Rule
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Preview */}
          <div className="space-y-4">
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5">
              <h4 className="text-sm font-semibold text-slate-300 mb-3">VU Load Profile</h4>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={rampPreview}>
                  <defs>
                    <linearGradient id="vuGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#475569" fontSize={10} tickFormatter={(v) => `${v}s`} />
                  <YAxis stroke="#475569" fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '12px' }} labelFormatter={(v) => `${v}s`} />
                  <Area type="monotone" dataKey="vu" stroke="#06b6d4" fill="url(#vuGradient)" strokeWidth={2} name="Virtual Users" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5">
              <h4 className="text-sm font-semibold text-slate-300 mb-3">Test Configuration</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Pattern', PATTERN_CONFIG[form.pattern]?.label || form.pattern],
                  ['Peak VU', `${form.peakVU} users`],
                  ['Total Duration', fmtDuration(totalDuration * 1000)],
                  ['Think Time', `${form.thinkTimeSec}s`],
                  ['Timeout', `${form.timeoutMs}ms`],
                  ['Max Error', `${form.maxErrorPct}%`],
                  ['SLA Rules', `${slaThresholds.length} rules`],
                  ['Est. Requests', `~${Math.round(totalDuration * form.peakVU / (form.thinkTimeSec + 1))}`],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex justify-between py-1.5 border-b border-slate-700/50">
                    <span className="text-slate-500">{label}</span>
                    <span className="text-slate-200 font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <Btn onClick={handleCreate} disabled={createScenario.isPending || updateScenario.isPending} className="w-full justify-center">
              {(createScenario.isPending || updateScenario.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
              {editingId ? 'Update Scenario' : 'Create Scenario'}
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
        <Btn onClick={() => { setShowForm(true); resetForm(); }}>
          <Plus className="w-4 h-4" /> New Scenario
        </Btn>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={() => <Rocket className="w-8 h-8 text-slate-500" />}
          title="No Load Scenarios"
          subtitle="Create a load scenario to define how virtual users will stress-test your API chains."
          action={
            <div className="flex gap-2">
              <Btn variant="secondary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Create Scenario</Btn>
              <Btn onClick={() => seedDemo.mutate()} disabled={seedDemo.isPending}>
                {seedDemo.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                Load Demo
              </Btn>
            </div>
          }
        />
      ) : (
        <div className="grid gap-4">
          {list.map((scenario) => {
            const pcfg = PATTERN_CONFIG[scenario.pattern] || PATTERN_CONFIG.custom;
            const PatternIcon = pcfg.icon;
            const duration = scenario.rampUpSec + scenario.steadyStateSec + scenario.rampDownSec;
            return (
              <div key={scenario.id} className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 hover:border-slate-600 transition-colors group">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', `bg-${pcfg.color.replace('text-', '')}/10`)}>
                      <PatternIcon className={cn('w-5 h-5', pcfg.color)} />
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-200">{scenario.name}</h4>
                      <p className="text-xs text-slate-500">{scenario.chain?.name || 'Unknown chain'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full border', 'bg-slate-700/50 border-slate-600 text-slate-300')}>{pcfg.label}</span>
                    <Btn variant="ghost" onClick={() => handleQuickRun(scenario.id)} disabled={startRun.isPending} size="sm" className="opacity-0 group-hover:opacity-100">
                      <Play className="w-3 h-3" /> Run
                    </Btn>
                    <Btn variant="ghost" onClick={() => handleEdit(scenario)} size="sm" className="opacity-0 group-hover:opacity-100">
                      <Pencil className="w-3 h-3" />
                    </Btn>
                    <button
                      onClick={() => setDeleteConfirm({ id: scenario.id, name: scenario.name })}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-sm">
                  <StatCard label="Peak VU" value={scenario.peakVU} color="text-cyan-400" compact />
                  <StatCard label="Duration" value={fmtDuration(duration * 1000)} compact />
                  <StatCard label="Ramp" value={`${scenario.rampUpSec}s / ${scenario.rampDownSec}s`} compact />
                  <StatCard label="Think Time" value={`${scenario.thinkTimeSec}s`} compact />
                  <StatCard label="Timeout" value={`${scenario.timeoutMs}ms`} compact />
                  <StatCard label="SLA Rules" value={scenario.slaThresholds?.length ?? 0} compact />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && deleteScenario.mutate(deleteConfirm.id)}
        title="Delete Scenario"
        message={`Delete "${deleteConfirm?.name}"? Associated test runs will not be deleted.`}
      />
    </div>
  );
}
