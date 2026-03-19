import { useState, useMemo } from 'react';
import {
  FileText, Loader2, Zap, AlertTriangle, Activity,
  ArrowRight, Download, RefreshCw, BarChart3, Target,
  Shield, TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useRuns, useRun, useGenerateReport,
} from '@/hooks/use-pt-suite';
import type { PtAiReport } from '@/types/pt-suite.types';
import { fmtLatency, fmtTps, fmtPct, fmtNum, fmtDuration, fmtRelTime } from '../constants';
import {
  StatusBadge, RiskBadge, EmptyState, Label, Select, Btn, Spinner, StatCard,
} from '../components/shared';

export function ReportsTab() {
  const { data: runs, isPending } = useRuns();
  const generateReport = useGenerateReport();

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const { data: selectedRun } = useRun(selectedRunId ?? undefined);

  const completedRuns = useMemo(() => (runs || []).filter(r => r.status === 'completed' || r.status === 'failed' || r.status === 'stopped'), [runs]);

  const aiReport = useMemo<PtAiReport | null>(() => {
    if (!selectedRun?.reportData && !selectedRun?.aiAnalysis) return null;
    try {
      const data = selectedRun.reportData || selectedRun.aiAnalysis;
      if (typeof data === 'string') return JSON.parse(data) as PtAiReport;
      return data as unknown as PtAiReport;
    } catch { return null; }
  }, [selectedRun]);

  const handleGenerateReport = async () => {
    if (!selectedRunId) return;
    await generateReport.mutateAsync(selectedRunId);
  };

  if (isPending) return <Spinner />;

  const severityIcon: Record<string, React.ReactNode> = {
    critical: <AlertTriangle className="w-4 h-4 text-red-400" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-400" />,
    info: <Activity className="w-4 h-4 text-blue-400" />,
  };

  const severityColors: Record<string, string> = {
    critical: 'border-red-500/30 bg-red-500/5',
    warning: 'border-amber-500/30 bg-amber-500/5',
    info: 'border-blue-500/30 bg-blue-500/5',
  };

  const priorityColors: Record<string, string> = {
    high: 'text-red-400 bg-red-500/10',
    medium: 'text-amber-400 bg-amber-500/10',
    low: 'text-blue-400 bg-blue-500/10',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-200">AI Performance Reports</h3>
          <p className="text-sm text-slate-500">AI-powered analysis of your load test results</p>
        </div>
      </div>

      {/* Run Selector */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 flex items-end gap-3">
        <div className="flex-1">
          <Label>Select a completed test run</Label>
          <Select
            value={selectedRunId || ''}
            onChange={(v) => setSelectedRunId(v || null)}
            options={[
              { value: '', label: 'Choose a run...' },
              ...completedRuns.map(r => ({
                value: r.id,
                label: `${r.scenario?.name || 'Run'} — ${fmtRelTime(r.startedAt)} (${r.status}, ${fmtNum(r.totalRequests)} reqs)`,
              })),
            ]}
          />
        </div>
        {selectedRunId && (
          <Btn onClick={handleGenerateReport} disabled={generateReport.isPending}>
            {generateReport.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {aiReport ? 'Regenerate' : 'Generate'} Report
          </Btn>
        )}
      </div>

      {completedRuns.length === 0 && (
        <EmptyState
          icon={FileText}
          title="No Completed Runs"
          subtitle="Complete a test run first, then come back to generate AI-powered performance reports with bottleneck analysis and recommendations."
        />
      )}

      {/* Run Summary Cards */}
      {selectedRun && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <StatCard label="Total Requests" value={fmtNum(selectedRun.totalRequests)} compact />
          <StatCard label="Total Errors" value={fmtNum(selectedRun.totalErrors)} color={selectedRun.totalErrors > 0 ? 'text-red-400' : 'text-emerald-400'} compact />
          <StatCard label="Avg Latency" value={fmtLatency(selectedRun.avgLatencyMs)} color="text-blue-400" compact />
          <StatCard label="P95 Latency" value={fmtLatency(selectedRun.p95LatencyMs)} color="text-amber-400" compact />
          <StatCard label="P99 Latency" value={fmtLatency(selectedRun.p99LatencyMs)} color="text-red-400" compact />
          <StatCard label="Avg TPS" value={fmtTps(selectedRun.avgTps)} color="text-emerald-400" compact />
          <StatCard label="Error Rate" value={fmtPct(selectedRun.errorRate)} color={selectedRun.errorRate > 1 ? 'text-red-400' : 'text-emerald-400'} compact />
        </div>
      )}

      {/* No Report Generated */}
      {selectedRun && !aiReport && !generateReport.isPending && (
        <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10 flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-cyan-400" />
          </div>
          <h4 className="text-lg font-bold text-slate-200 mb-2">Generate AI Analysis</h4>
          <p className="text-sm text-slate-500 mb-5 max-w-md mx-auto">
            Our AI will analyze your test metrics, identify bottlenecks, evaluate SLA compliance,
            and provide actionable recommendations for performance improvement.
          </p>
          <Btn onClick={handleGenerateReport} className="mx-auto">
            <Zap className="w-4 h-4" /> Generate AI Report
          </Btn>
        </div>
      )}

      {/* Loading */}
      {generateReport.isPending && (
        <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-10 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto mb-3" />
          <h4 className="text-lg font-semibold text-slate-200 mb-1">Analyzing Results...</h4>
          <p className="text-sm text-slate-500">AI is reviewing metrics, identifying patterns, and generating recommendations</p>
        </div>
      )}

      {/* AI Report */}
      {aiReport && (
        <div className="space-y-5">
          {/* Executive Summary */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Target className="w-4 h-4 text-cyan-400" /> Executive Summary
              </h4>
              <RiskBadge level={aiReport.riskLevel} />
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">{aiReport.executiveSummary}</p>
          </div>

          {/* SLA Compliance */}
          {aiReport.slaCompliance && aiReport.slaCompliance.length > 0 && (
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-6">
              <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-4">
                <Shield className="w-4 h-4 text-emerald-400" /> SLA Compliance
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] text-slate-500 uppercase tracking-wider border-b border-slate-700">
                      <th className="pb-2.5 pr-4 text-left">Metric</th>
                      <th className="pb-2.5 pr-4 text-left">Target</th>
                      <th className="pb-2.5 pr-4 text-left">Actual</th>
                      <th className="pb-2.5 text-left">Verdict</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {aiReport.slaCompliance.map((sla, i) => (
                      <tr key={i}>
                        <td className="py-2.5 pr-4 text-slate-300 font-medium">{sla.metric}</td>
                        <td className="py-2.5 pr-4 text-slate-400">{sla.target}</td>
                        <td className="py-2.5 pr-4 text-slate-300 font-mono">{sla.actual}</td>
                        <td className="py-2.5">
                          <StatusBadge status={sla.status} />
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
              <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Bottlenecks Identified ({aiReport.bottlenecks.length})
              </h4>
              {aiReport.bottlenecks.map((b, i) => (
                <div key={i} className={cn('border rounded-xl p-4', severityColors[b.severity] || severityColors.info)}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{severityIcon[b.severity]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-slate-200">{b.title}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400">{b.affectedStep}</span>
                      </div>
                      <p className="text-xs text-slate-400 mb-2">{b.description}</p>
                      <p className="text-xs text-cyan-400 flex items-center gap-1">
                        <ArrowRight className="w-3 h-3 flex-shrink-0" />
                        <span>{b.recommendation}</span>
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {aiReport.recommendations && aiReport.recommendations.length > 0 && (
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-6">
              <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-emerald-400" /> Recommendations
              </h4>
              <div className="space-y-3">
                {aiReport.recommendations.map((rec, i) => (
                  <div key={i} className="flex gap-3 p-3 bg-slate-700/20 rounded-xl border border-slate-700/50">
                    <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded-full h-fit flex-shrink-0', priorityColors[rec.priority] || 'text-slate-400 bg-slate-700')}>
                      {rec.priority}
                    </span>
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-slate-200">{rec.title}</span>
                      <p className="text-xs text-slate-400 mt-0.5">{rec.description}</p>
                      <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> {rec.expectedImprovement}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Capacity Estimate */}
          {aiReport.capacityEstimate && (
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-6">
              <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-purple-400" /> Capacity Estimate
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-cyan-500/5 to-cyan-500/10 border border-cyan-500/20 rounded-xl p-5 text-center">
                  <div className="text-xs text-slate-500 mb-1">Max Safe Virtual Users</div>
                  <div className="text-3xl font-bold text-cyan-400">{fmtNum(aiReport.capacityEstimate.maxSafeVU)}</div>
                </div>
                <div className="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border border-emerald-500/20 rounded-xl p-5 text-center">
                  <div className="text-xs text-slate-500 mb-1">Max Throughput</div>
                  <div className="text-3xl font-bold text-emerald-400">{fmtTps(aiReport.capacityEstimate.maxTps)}</div>
                  <div className="text-xs text-slate-500">req/s</div>
                </div>
                <div className="bg-gradient-to-br from-amber-500/5 to-amber-500/10 border border-amber-500/20 rounded-xl p-5 text-center">
                  <div className="text-xs text-slate-500 mb-1">Limiting Factor</div>
                  <div className="text-sm font-semibold text-amber-400 mt-2">{aiReport.capacityEstimate.limitingFactor}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
