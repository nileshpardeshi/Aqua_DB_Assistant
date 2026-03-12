import { FileText, Shield } from 'lucide-react';
import { AuditLogViewer } from '@/components/shared/audit-log-viewer';

export function AuditLogs() {
  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
            <FileText className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Audit Logs</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Track all actions and changes across your projects
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
          <Shield className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
            Compliance Ready
          </span>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-gradient-to-r from-violet-50 via-purple-50 to-indigo-50 rounded-xl border border-violet-200/50 p-5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <FileText className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-1">
              Complete Activity Tracking
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Every action performed in the application is logged for security, compliance, and
              debugging purposes. Use the filters to narrow down specific activities, and export
              logs to CSV for external auditing or reporting.
            </p>
          </div>
        </div>
      </div>

      {/* Audit Log Viewer */}
      <AuditLogViewer />
    </div>
  );
}

export default AuditLogs;
