import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Play, Square, Eye, Loader2, Rocket, X, Clock, RefreshCw,
  TrendingUp, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, LineChart, Line, Legend,
} from 'recharts';
import { cn } from '@/lib/utils';
import {
  useRuns, useRun, useScenarios, useStartRun, useStopRun, useSeedDemo, useRunStream,
} from '@/hooks/use-pt-suite';
import { PATTERN_CONFIG, fmtLatency, fmtTps, fmtPct, fmtNum, fmtDuration, fmtRelTime } from '../constants';
import {
  StatusBadge, EmptyState, Modal, Label, Select, Btn, Spinner, StatCard,
} from '../components/shared';

// ── Live Run Dashboard ─────────────────────────────────────────────────────────

function LiveRunDashboard({ runId, onClose }: { runId: string; onClose: () => void }) {
  const { metrics, isStreaming, latestMetric } = useRunStream(runId);
  const { data: run, refetch } = useRun(runId);
  const stopRun = useStopRun();

  // Auto-refresh run data when streaming stops
  useEffect(() => {
    if (!isStreaming && metrics.length > 0) {
      const timer = setTimeout(() => refetch(), 1500);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, metrics.length, refetch]);

  const chartData = useMemo(() => {
    return metrics.map((m) => ({
      time: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      activeVU: m.activeVU,
      avgLatency: Math.round(m.avgLatencyMs),
      p95Latency: Math.round(m.p95LatencyMs),
      p99Latency: Math.round(m.p99LatencyMs),
      tps: Math.round(m.tps * 10) / 10,
      errors: m.errorCount,
      requests: m.requestCount,
    }));
  }, [metrics]);

  const totals = useMemo(() => {
    if (metrics.length === 0) return null;
    return {
      requests: metrics.reduce((s, m) => s + m.requestCount, 0),
      errors: metrics.reduce((s, m) => s + m.errorCount, 0),
      peakVU: Math.max(...metrics.map(m => m.activeVU)),
      peakTps: Math.max(...metrics.map(m => m.tps)),
      avgLatency: metrics.reduce((s, m) => s + m.avgLatencyMs, 0) / metrics.length,
    };
  }, [metrics]);

  const chartTooltipStyle = { backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px' };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h4 className="text-lg font-semibold text-slate-200">Live Monitoring</h4>
          {isStreaming ? (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live
            </span>
          ) : run?.status && run.status !== 'running' ? (
            <StatusBadge status={run.status} />
          ) : null}
        </div>
        <div className="flex gap-2">
          {run?.status === 'running' && (
            <Btn variant="danger" onClick={() => stopRun.mutate(runId)} disabled={stopRun.isPending} size="sm">
              <Square className="w-3.5 h-3.5" /> Stop
            </Btn>
          )}
          <Btn variant="ghost" onClick={onClose} size="sm"><X className="w-3.5 h-3.5" /> Close</Btn>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Active VU" value={latestMetric ? fmtNum(latestMetric.activeVU) : '-'} color="text-cyan-400" compact />
        <StatCard label="Avg Latency" value={latestMetric ? fmtLatency(latestMetric.avgLatencyMs) : '-'} color="text-blue-400" compact />
        <StatCard label="P99 Latency" value={latestMetric ? fmtLatency(latestMetric.p99LatencyMs) : '-'} color="text-amber-400" compact />
        <StatCard label="TPS" value={latestMetric ? fmtTps(latestMetric.tps) : '-'} color="text-emerald-400" compact />
        <StatCard label="Total Requests" value={totals ? fmtNum(totals.requests) : '-'} compact />
        <StatCard label="Errors" value={totals ? fmtNum(totals.errors) : '-'} color={totals && totals.errors > 0 ? 'text-red-400' : 'text-slate-400'} compact />
      </div>

      {/* Charts */}
      {chartData.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Response Time Chart */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4">
            <h5 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" /> Response Time (ms)
            </h5>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="avgGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#475569" fontSize={9} interval="preserveStartEnd" />
                <YAxis stroke="#475569" fontSize={9} tickFormatter={(v) => `${v}`} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Area type="monotone" dataKey="avgLatency" stroke="#3b82f6" fill="url(#avgGrad)" strokeWidth={2} name="Avg" />
                <Area type="monotone" dataKey="p95Latency" stroke="#f59e0b" fill="none" strokeWidth={1.5} strokeDasharray="4 2" name="P95" />
                <Area type="monotone" dataKey="p99Latency" stroke="#ef4444" fill="none" strokeWidth={1} strokeDasharray="2 2" name="P99" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Throughput Chart */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4">
            <h5 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" /> Throughput (req/s)
            </h5>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#475569" fontSize={9} interval="preserveStartEnd" />
                <YAxis stroke="#475569" fontSize={9} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="tps" fill="#06b6d4" name="TPS" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Active VU Chart */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4">
            <h5 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
              <Play className="w-4 h-4 text-purple-400" /> Virtual Users
            </h5>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="vuGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#475569" fontSize={9} interval="preserveStartEnd" />
                <YAxis stroke="#475569" fontSize={9} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Area type="stepAfter" dataKey="activeVU" stroke="#a78bfa" fill="url(#vuGrad2)" strokeWidth={2} name="Active VU" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Error Chart */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4">
            <h5 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" /> Errors per Second
            </h5>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="errGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#475569" fontSize={9} interval="preserveStartEnd" />
                <YAxis stroke="#475569" fontSize={9} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Area type="monotone" dataKey="errors" stroke="#ef4444" fill="url(#errGrad)" strokeWidth={2} name="Errors" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin mb-2" />
          <span className="text-sm">Waiting for metrics...</span>
          <span className="text-xs text-slate-600 mt-1">Data appears as the load test ramps up</span>
        </div>
      )}

      {/* Step Metrics (after completion) */}
      {run?.stepMetrics && run.stepMetrics.length > 0 && !isStreaming && (
        <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5">
          <h5 className="text-sm font-semibold text-slate-300 mb-3">Per-Step Breakdown</h5>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-slate-500 uppercase tracking-wider border-b border-slate-700">
                  <th className="px-3 py-2 text-left">Step</th>
                  <th className="px-3 py-2 text-right">Calls</th>
                  <th className="px-3 py-2 text-right">Errors</th>
                  <th className="px-3 py-2 text-right">Avg</th>
                  <th className="px-3 py-2 text-right">P95</th>
                  <th className="px-3 py-2 text-right">P99</th>
                  <th className="px-3 py-2 text-right">Min</th>
                  <th className="px-3 py-2 text-right">Max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {run.stepMetrics.map((sm) => (
                  <tr key={sm.id} className="hover:bg-slate-700/20">
                    <td className="px-3 py-2 text-slate-300 font-medium">{sm.stepName}</td>
                    <td className="px-3 py-2 text-right text-slate-300">{fmtNum(sm.totalCalls)}</td>
                    <td className="px-3 py-2 text-right"><span className={sm.totalErrors > 0 ? 'text-red-400' : 'text-slate-400'}>{fmtNum(sm.totalErrors)}</span></td>
                    <td className="px-3 py-2 text-right text-slate-300 font-mono text-xs">{fmtLatency(sm.avgLatencyMs)}</td>
                    <td className="px-3 py-2 text-right text-amber-400 font-mono text-xs">{fmtLatency(sm.p95LatencyMs)}</td>
                    <td className="px-3 py-2 text-right text-red-400 font-mono text-xs">{fmtLatency(sm.p99LatencyMs)}</td>
                    <td className="px-3 py-2 text-right text-emerald-400 font-mono text-xs">{fmtLatency(sm.minLatencyMs)}</td>
                    <td className="px-3 py-2 text-right text-slate-400 font-mono text-xs">{fmtLatency(sm.maxLatencyMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Test Runs Tab ─────────────────────────────────────────────────────────

export function TestRunsTab() {
  const { data: runs, isPending, refetch } = useRuns();
  const { data: scenarios } = useScenarios();
  const startRun = useStartRun();
  const stopRun = useStopRun();
  const seedDemo = useSeedDemo();

  const [liveRunId, setLiveRunId] = useState<string | null>(null);
  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedScenarioId, setSelectedScenarioId] = useState('');

  // Auto-refresh runs list every 5s if there are active runs
  const activeRuns = useMemo(() => (runs || []).filter(r => r.status === 'running' || r.status === 'queued'), [runs]);
  const completedRuns = useMemo(() => (runs || []).filter(r => r.status !== 'running' && r.status !== 'queued'), [runs]);

  useEffect(() => {
    if (activeRuns.length > 0) {
      const interval = setInterval(() => refetch(), 5000);
      return () => clearInterval(interval);
    }
  }, [activeRuns.length, refetch]);

  const handleStartRun = async () => {
    if (!selectedScenarioId) return;
    const result = await startRun.mutateAsync({ scenarioId: selectedScenarioId });
    setShowStartModal(false);
    setSelectedScenarioId('');
    setLiveRunId(result.id);
  };

  if (isPending) return <Spinner />;
  if (liveRunId) return <LiveRunDashboard runId={liveRunId} onClose={() => { setLiveRunId(null); refetch(); }} />;

  const runList = runs || [];
  const scenarioList = scenarios || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-200">Test Runs</h3>
          <p className="text-sm text-slate-500">{runList.length} run{runList.length !== 1 ? 's' : ''} total</p>
        </div>
        <div className="flex gap-2">
          <Btn variant="ghost" onClick={() => refetch()} size="sm"><RefreshCw className="w-3.5 h-3.5" /></Btn>
          <Btn onClick={() => setShowStartModal(true)}>
            <Play className="w-4 h-4" /> Start New Run
          </Btn>
        </div>
      </div>

      {/* Active Runs */}
      {activeRuns.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" /> Active Runs ({activeRuns.length})
          </h4>
          {activeRuns.map((run) => (
            <div key={run.id} className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
                  <span className="text-sm font-medium text-slate-200">{run.scenario?.name || 'Unknown'}</span>
                  <StatusBadge status={run.status} />
                </div>
                <div className="flex gap-2">
                  <Btn variant="secondary" onClick={() => setLiveRunId(run.id)} size="sm">
                    <Eye className="w-3.5 h-3.5" /> Monitor
                  </Btn>
                  <Btn variant="danger" onClick={() => stopRun.mutate(run.id)} disabled={stopRun.isPending} size="sm">
                    <Square className="w-3.5 h-3.5" /> Stop
                  </Btn>
                </div>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                <StatCard label="Peak VU" value={run.scenario?.peakVU ?? '-'} compact />
                <StatCard label="Avg Latency" value={fmtLatency(run.avgLatencyMs)} compact />
                <StatCard label="TPS" value={fmtTps(run.avgTps)} compact />
                <StatCard label="Error Rate" value={fmtPct(run.errorRate)} color={run.errorRate > 1 ? 'text-red-400' : 'text-emerald-400'} compact />
                <StatCard label="P99" value={fmtLatency(run.p99LatencyMs)} compact />
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
            <div className="flex gap-2">
              <Btn onClick={() => setShowStartModal(true)}><Play className="w-4 h-4" /> Start Run</Btn>
              <Btn variant="secondary" onClick={() => seedDemo.mutate()} disabled={seedDemo.isPending}>
                {seedDemo.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                Load Demo
              </Btn>
            </div>
          }
        />
      ) : completedRuns.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Completed Runs</h4>
          <div className="bg-slate-800/80 border border-slate-700 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] text-slate-500 uppercase tracking-wider border-b border-slate-700">
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Scenario</th>
                    <th className="px-4 py-3 text-right">Peak VU</th>
                    <th className="px-4 py-3 text-right">Avg Latency</th>
                    <th className="px-4 py-3 text-right">P95 / P99</th>
                    <th className="px-4 py-3 text-right">TPS</th>
                    <th className="px-4 py-3 text-right">Error Rate</th>
                    <th className="px-4 py-3 text-right">Duration</th>
                    <th className="px-4 py-3 text-right">When</th>
                    <th className="px-4 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {completedRuns.map((run) => {
                    const durationMs = run.completedAt ? new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime() : 0;
                    return (
                      <tr key={run.id} className="hover:bg-slate-700/20 transition-colors">
                        <td className="px-4 py-3"><StatusBadge status={run.status} /></td>
                        <td className="px-4 py-3 text-slate-300">{run.scenario?.name || 'Unknown'}</td>
                        <td className="px-4 py-3 text-right text-slate-300">{run.scenario?.peakVU ?? '-'}</td>
                        <td className="px-4 py-3 text-right text-slate-300 font-mono text-xs">{fmtLatency(run.avgLatencyMs)}</td>
                        <td className="px-4 py-3 text-right text-xs">
                          <span className="text-amber-400">{fmtLatency(run.p95LatencyMs)}</span>
                          <span className="text-slate-600 mx-1">/</span>
                          <span className="text-red-400">{fmtLatency(run.p99LatencyMs)}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-400 font-mono text-xs">{fmtTps(run.avgTps)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn('font-mono text-xs', run.errorRate > 1 ? 'text-red-400' : 'text-emerald-400')}>{fmtPct(run.errorRate)}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400 text-xs">{fmtDuration(durationMs)}</td>
                        <td className="px-4 py-3 text-right text-slate-500 text-xs">{fmtRelTime(run.startedAt)}</td>
                        <td className="px-4 py-3 text-right">
                          <Btn variant="ghost" onClick={() => setLiveRunId(run.id)} size="sm"><Eye className="w-3 h-3" /></Btn>
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
      <Modal open={showStartModal} onClose={() => setShowStartModal(false)} title="Start New Test Run"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setShowStartModal(false)}>Cancel</Btn>
            <Btn onClick={handleStartRun} disabled={startRun.isPending || !selectedScenarioId}>
              {startRun.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Start Run
            </Btn>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Select Scenario</Label>
            <Select
              value={selectedScenarioId}
              onChange={setSelectedScenarioId}
              options={[{ value: '', label: 'Choose a scenario...' }, ...scenarioList.map(s => ({ value: s.id, label: `${s.name} (${s.peakVU} VU, ${PATTERN_CONFIG[s.pattern]?.label || s.pattern})` }))]}
            />
          </div>
          {selectedScenarioId && (() => {
            const s = scenarioList.find(s => s.id === selectedScenarioId);
            if (!s) return null;
            const pcfg = PATTERN_CONFIG[s.pattern] || PATTERN_CONFIG.custom;
            const PatternIcon = pcfg.icon;
            const duration = s.rampUpSec + s.steadyStateSec + s.rampDownSec;
            return (
              <div className="bg-slate-700/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <PatternIcon className={cn('w-4 h-4', pcfg.color)} />
                  <span className="text-sm text-slate-300 font-medium">{pcfg.label} Pattern</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <StatCard label="Peak VU" value={s.peakVU} compact />
                  <StatCard label="Duration" value={fmtDuration(duration * 1000)} compact />
                  <StatCard label="SLA Rules" value={s.slaThresholds?.length ?? 0} compact />
                </div>
              </div>
            );
          })()}
        </div>
      </Modal>
    </div>
  );
}
