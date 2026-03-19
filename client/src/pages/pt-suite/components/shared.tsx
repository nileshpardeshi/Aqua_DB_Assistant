import { useState } from 'react';
import {
  X, Plus, Trash2, Loader2, ChevronDown, ChevronUp,
  CheckCircle2, AlertCircle, Eye, EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { METHOD_COLORS } from '../constants';

// ── Method Badge ─────────────────────────────────────────────────────────────

export function MethodBadge({ method, size = 'sm' }: { method: string; size?: 'sm' | 'xs' }) {
  const m = method.toUpperCase();
  return (
    <span className={cn(
      'rounded font-bold border uppercase tracking-wide',
      METHOD_COLORS[m] || 'bg-slate-500/20 text-slate-400 border-slate-500/30',
      size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
    )}>
      {m}
    </span>
  );
}

// ── Status Badge ─────────────────────────────────────────────────────────────

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
    stopped: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    queued: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    pass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    fail: 'bg-red-500/20 text-red-400 border-red-500/30',
    warn: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  };
  return (
    <span className={cn(
      'px-2 py-0.5 rounded text-xs font-semibold border inline-flex items-center gap-1',
      colors[status] || colors.queued,
    )}>
      {status === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />}
      {status}
    </span>
  );
}

// ── Risk Badge ───────────────────────────────────────────────────────────────

export function RiskBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    Low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    Medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    High: 'bg-red-500/20 text-red-400 border-red-500/30',
    Critical: 'bg-red-600/30 text-red-300 border-red-500/40',
  };
  return (
    <span className={cn('px-3 py-1 rounded-full text-xs font-bold border', colors[level] || colors.Medium)}>
      {level} Risk
    </span>
  );
}

// ── Empty State ──────────────────────────────────────────────────────────────

export function EmptyState({ icon: Icon, title, subtitle, action }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-700 flex items-center justify-center mb-4 shadow-lg">
        <Icon className="w-8 h-8 text-slate-500" />
      </div>
      <h3 className="text-lg font-semibold text-slate-300 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 max-w-sm mb-4">{subtitle}</p>
      {action}
    </div>
  );
}

// ── Modal ────────────────────────────────────────────────────────────────────

export function Modal({ open, onClose, title, children, wide, footer }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
  footer?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150" onClick={onClose}>
      <div
        className={cn(
          'bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-h-[85vh] flex flex-col',
          wide ? 'w-full max-w-3xl' : 'w-full max-w-lg',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/70 flex-shrink-0">
          <h3 className="text-lg font-semibold text-slate-200">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-slate-700/70 flex-shrink-0 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Key-Value Editor ─────────────────────────────────────────────────────────

export function KvEditor({ items, onChange, keyLabel = 'Key', valueLabel = 'Value', canToggle = false }: {
  items: { key: string; value: string; enabled?: boolean }[];
  onChange: (items: { key: string; value: string; enabled?: boolean }[]) => void;
  keyLabel?: string;
  valueLabel?: string;
  canToggle?: boolean;
}) {
  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="flex gap-2 items-center text-[10px] text-slate-500 uppercase tracking-wider px-1">
          {canToggle && <div className="w-6" />}
          <div className="flex-1">{keyLabel}</div>
          <div className="flex-1">{valueLabel}</div>
          <div className="w-8" />
        </div>
      )}
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-center group">
          {canToggle && (
            <button
              onClick={() => { const n = [...items]; n[i] = { ...n[i], enabled: !n[i].enabled }; onChange(n); }}
              className={cn('p-0.5 rounded transition-colors', item.enabled !== false ? 'text-emerald-400' : 'text-slate-600')}
            >
              {item.enabled !== false ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
          )}
          <input
            className={cn(
              'flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-colors',
              item.enabled === false && 'opacity-50',
            )}
            placeholder={keyLabel}
            value={item.key}
            onChange={(e) => { const n = [...items]; n[i] = { ...n[i], key: e.target.value }; onChange(n); }}
          />
          <input
            className={cn(
              'flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-colors',
              item.enabled === false && 'opacity-50',
            )}
            placeholder={valueLabel}
            value={item.value}
            onChange={(e) => { const n = [...items]; n[i] = { ...n[i], value: e.target.value }; onChange(n); }}
          />
          <button
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            className="p-1.5 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...items, { key: '', value: '', enabled: true }])}
        className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 px-1 py-1"
      >
        <Plus className="w-3 h-3" /> Add {keyLabel.toLowerCase()}
      </button>
    </div>
  );
}

// ── Form Primitives ──────────────────────────────────────────────────────────

export function Label({ children, required, hint }: { children: React.ReactNode; required?: boolean; hint?: string }) {
  return (
    <label className="block text-sm font-medium text-slate-300 mb-1.5">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
      {hint && <span className="text-slate-600 font-normal ml-1.5 text-xs">({hint})</span>}
    </label>
  );
}

export function Input({ value, onChange, placeholder, type = 'text', error, className: cls, disabled, min, max }: {
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  error?: string;
  className?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        max={max}
        className={cn(
          'w-full bg-slate-900 border rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 transition-colors',
          error
            ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/30'
            : 'border-slate-700 focus:border-cyan-500 focus:ring-cyan-500/30',
          disabled && 'opacity-50 cursor-not-allowed',
          cls,
        )}
      />
      {error && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
    </div>
  );
}

export function Textarea({ value, onChange, placeholder, rows = 4, className: cls, error }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  error?: string;
}) {
  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={cn(
          'w-full bg-slate-900 border rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:ring-1 resize-none transition-colors',
          error
            ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/30'
            : 'border-slate-700 focus:border-cyan-500 focus:ring-cyan-500/30',
          cls,
        )}
      />
      {error && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
    </div>
  );
}

export function Select({ value, onChange, options, className: cls, disabled }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cn(
        'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-colors',
        disabled && 'opacity-50 cursor-not-allowed',
        cls,
      )}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Btn({ onClick, children, variant = 'primary', disabled, className: cls, size = 'md' }: {
  onClick?: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const base = cn(
    'rounded-lg font-medium transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]',
    size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
  );
  const colors = {
    primary: 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm shadow-cyan-500/20',
    secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-200',
    danger: 'bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/20',
    ghost: 'hover:bg-slate-700 text-slate-400 hover:text-slate-200',
    success: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-500/20',
  };
  return (
    <button onClick={onClick} disabled={disabled} className={cn(base, colors[variant], cls)}>
      {children}
    </button>
  );
}

// ── Loading Spinner ──────────────────────────────────────────────────────────

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
      {label && <span className="ml-2 text-sm text-slate-400">{label}</span>}
    </div>
  );
}

// ── Stat Card (for KPIs) ─────────────────────────────────────────────────────

export function StatCard({ label, value, color = 'text-slate-200', trend, icon: Icon, compact }: {
  label: string;
  value: string | number;
  color?: string;
  trend?: { value: string; positive: boolean };
  icon?: React.ComponentType<{ className?: string }>;
  compact?: boolean;
}) {
  return (
    <div className={cn(
      'bg-slate-800 border border-slate-700 rounded-xl text-center transition-colors hover:border-slate-600',
      compact ? 'p-3' : 'p-4',
    )}>
      {Icon && <Icon className={cn('w-4 h-4 mx-auto mb-1', color)} />}
      <div className="text-xs text-slate-500 mb-0.5">{label}</div>
      <div className={cn(compact ? 'text-lg' : 'text-xl', 'font-bold', color)}>{value}</div>
      {trend && (
        <div className={cn('text-[10px] mt-0.5', trend.positive ? 'text-emerald-400' : 'text-red-400')}>
          {trend.positive ? '↑' : '↓'} {trend.value}
        </div>
      )}
    </div>
  );
}

// ── Collapsible Section ──────────────────────────────────────────────────────

export function CollapsibleSection({ title, children, defaultOpen = false, badge }: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/50 hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-300">{title}</span>
          {badge}
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>
      {isOpen && <div className="px-4 py-3 border-t border-slate-700/50">{children}</div>}
    </div>
  );
}

// ── Confirmation Dialog ──────────────────────────────────────────────────────

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmText = 'Delete', variant = 'danger' }: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  variant?: 'danger' | 'primary';
}) {
  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-slate-400 mb-4">{message}</p>
      <div className="flex justify-end gap-2">
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn variant={variant} onClick={() => { onConfirm(); onClose(); }}>{confirmText}</Btn>
      </div>
    </Modal>
  );
}

// ── Tooltip ──────────────────────────────────────────────────────────────────

export function Tooltip({ children, text }: { children: React.ReactNode; text: string }) {
  return (
    <span className="relative group/tip">
      {children}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-300 whitespace-nowrap opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity z-50">
        {text}
      </span>
    </span>
  );
}
