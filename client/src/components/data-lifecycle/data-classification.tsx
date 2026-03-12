import { useState, useCallback } from 'react';
import {
  Shield,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Sensitivity = 'PII' | 'PHI' | 'Financial' | 'Public' | 'Internal';

interface ClassifiedColumn {
  name: string;
  type: string;
  sensitivity: Sensitivity;
  autoDetected: boolean;
}

interface ClassifiedTable {
  name: string;
  columns: ClassifiedColumn[];
  gdprCompliant: boolean;
  pciCompliant: boolean;
}

const SENSITIVITY_CONFIG: Record<
  Sensitivity,
  { label: string; color: string; bg: string; border: string }
> = {
  PII: {
    label: 'PII',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
  },
  PHI: {
    label: 'PHI',
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
  },
  Financial: {
    label: 'Financial',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  Public: {
    label: 'Public',
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
  },
  Internal: {
    label: 'Internal',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
};

// Mock classified tables
const MOCK_TABLES: ClassifiedTable[] = [
  {
    name: 'users',
    gdprCompliant: true,
    pciCompliant: true,
    columns: [
      { name: 'id', type: 'INT', sensitivity: 'Internal', autoDetected: false },
      { name: 'name', type: 'VARCHAR(255)', sensitivity: 'PII', autoDetected: true },
      { name: 'email', type: 'VARCHAR(255)', sensitivity: 'PII', autoDetected: true },
      { name: 'phone', type: 'VARCHAR(20)', sensitivity: 'PII', autoDetected: true },
      { name: 'password_hash', type: 'VARCHAR(255)', sensitivity: 'PII', autoDetected: true },
      { name: 'date_of_birth', type: 'DATE', sensitivity: 'PII', autoDetected: true },
      { name: 'role', type: 'VARCHAR(50)', sensitivity: 'Internal', autoDetected: false },
      { name: 'created_at', type: 'TIMESTAMP', sensitivity: 'Public', autoDetected: false },
    ],
  },
  {
    name: 'medical_records',
    gdprCompliant: false,
    pciCompliant: true,
    columns: [
      { name: 'id', type: 'INT', sensitivity: 'Internal', autoDetected: false },
      { name: 'patient_id', type: 'INT', sensitivity: 'PHI', autoDetected: true },
      { name: 'diagnosis', type: 'TEXT', sensitivity: 'PHI', autoDetected: true },
      { name: 'medication', type: 'VARCHAR(255)', sensitivity: 'PHI', autoDetected: true },
      { name: 'doctor_notes', type: 'TEXT', sensitivity: 'PHI', autoDetected: true },
      { name: 'visit_date', type: 'DATE', sensitivity: 'PHI', autoDetected: false },
    ],
  },
  {
    name: 'payments',
    gdprCompliant: true,
    pciCompliant: false,
    columns: [
      { name: 'id', type: 'INT', sensitivity: 'Internal', autoDetected: false },
      { name: 'user_id', type: 'INT', sensitivity: 'PII', autoDetected: true },
      { name: 'card_number', type: 'VARCHAR(19)', sensitivity: 'Financial', autoDetected: true },
      { name: 'card_expiry', type: 'VARCHAR(5)', sensitivity: 'Financial', autoDetected: true },
      { name: 'cvv_hash', type: 'VARCHAR(255)', sensitivity: 'Financial', autoDetected: true },
      { name: 'amount', type: 'DECIMAL(10,2)', sensitivity: 'Financial', autoDetected: true },
      { name: 'currency', type: 'VARCHAR(3)', sensitivity: 'Public', autoDetected: false },
      { name: 'status', type: 'VARCHAR(50)', sensitivity: 'Internal', autoDetected: false },
    ],
  },
  {
    name: 'products',
    gdprCompliant: true,
    pciCompliant: true,
    columns: [
      { name: 'id', type: 'INT', sensitivity: 'Public', autoDetected: false },
      { name: 'name', type: 'VARCHAR(255)', sensitivity: 'Public', autoDetected: false },
      { name: 'description', type: 'TEXT', sensitivity: 'Public', autoDetected: false },
      { name: 'price', type: 'DECIMAL(10,2)', sensitivity: 'Public', autoDetected: false },
      { name: 'category', type: 'VARCHAR(100)', sensitivity: 'Public', autoDetected: false },
    ],
  },
];

export function DataClassification() {
  const [tables, setTables] = useState<ClassifiedTable[]>(MOCK_TABLES);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(
    new Set(['users', 'payments'])
  );
  const [isClassifying, setIsClassifying] = useState(false);

  const toggleExpand = useCallback((name: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const handleAutoClassify = useCallback(async () => {
    setIsClassifying(true);
    // Simulate AI classification
    await new Promise((resolve) => setTimeout(resolve, 2000));
    // Mark all columns as auto-detected
    setTables((prev) =>
      prev.map((table) => ({
        ...table,
        columns: table.columns.map((col) => ({
          ...col,
          autoDetected: true,
        })),
      }))
    );
    setIsClassifying(false);
  }, []);

  const handleUpdateSensitivity = useCallback(
    (tableName: string, columnName: string, sensitivity: Sensitivity) => {
      setTables((prev) =>
        prev.map((table) =>
          table.name === tableName
            ? {
                ...table,
                columns: table.columns.map((col) =>
                  col.name === columnName ? { ...col, sensitivity } : col
                ),
              }
            : table
        )
      );
    },
    []
  );

  // Stats
  const totalColumns = tables.reduce((acc, t) => acc + t.columns.length, 0);
  const piiColumns = tables.reduce(
    (acc, t) => acc + t.columns.filter((c) => c.sensitivity === 'PII').length,
    0
  );
  const phiColumns = tables.reduce(
    (acc, t) => acc + t.columns.filter((c) => c.sensitivity === 'PHI').length,
    0
  );
  const financialColumns = tables.reduce(
    (acc, t) => acc + t.columns.filter((c) => c.sensitivity === 'Financial').length,
    0
  );
  const gdprCompliant = tables.filter((t) => t.gdprCompliant).length;
  const pciCompliant = tables.filter((t) => t.pciCompliant).length;

  return (
    <div className="space-y-6">
      {/* Summary Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-medium text-slate-600">
          {tables.length} tables, {totalColumns} columns:
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-700">
          {piiColumns} PII
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-100 text-purple-700">
          {phiColumns} PHI
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-700">
          {financialColumns} Financial
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full',
              gdprCompliant === tables.length
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            )}
          >
            {gdprCompliant === tables.length ? (
              <CheckCircle2 className="w-2.5 h-2.5" />
            ) : (
              <AlertTriangle className="w-2.5 h-2.5" />
            )}
            GDPR {gdprCompliant}/{tables.length}
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full',
              pciCompliant === tables.length
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            )}
          >
            {pciCompliant === tables.length ? (
              <CheckCircle2 className="w-2.5 h-2.5" />
            ) : (
              <AlertTriangle className="w-2.5 h-2.5" />
            )}
            PCI {pciCompliant}/{tables.length}
          </span>
        </div>
      </div>

      {/* AI Classify Button */}
      <button
        onClick={handleAutoClassify}
        disabled={isClassifying}
        className={cn(
          'inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all shadow-sm',
          isClassifying
            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
            : 'bg-aqua-600 text-white hover:bg-aqua-700'
        )}
      >
        {isClassifying ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Classifying...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            AI Classify All Columns
          </>
        )}
      </button>

      {/* Table List */}
      <div className="space-y-3">
        {tables.map((table) => {
          const isExpanded = expandedTables.has(table.name);
          const sensitiveCount = table.columns.filter(
            (c) => c.sensitivity !== 'Public' && c.sensitivity !== 'Internal'
          ).length;

          return (
            <div
              key={table.name}
              className="bg-white border border-slate-200 rounded-lg overflow-hidden"
            >
              {/* Table Header */}
              <button
                onClick={() => toggleExpand(table.name)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50/50 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                )}

                <Shield
                  className={cn(
                    'w-4 h-4 flex-shrink-0',
                    sensitiveCount > 0 ? 'text-red-500' : 'text-green-500'
                  )}
                />

                <span className="text-sm font-semibold font-mono text-slate-800">
                  {table.name}
                </span>

                <span className="text-[10px] text-slate-400">
                  {table.columns.length} columns
                </span>

                {sensitiveCount > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-700">
                    {sensitiveCount} sensitive
                  </span>
                )}

                <div className="ml-auto flex items-center gap-1.5">
                  {/* Sensitivity tags for the table */}
                  {Array.from(
                    new Set(
                      table.columns
                        .filter((c) => c.sensitivity !== 'Public' && c.sensitivity !== 'Internal')
                        .map((c) => c.sensitivity)
                    )
                  ).map((sens) => {
                    const config = SENSITIVITY_CONFIG[sens];
                    return (
                      <span
                        key={sens}
                        className={cn(
                          'px-1.5 py-0.5 text-[9px] font-bold rounded uppercase',
                          config.bg,
                          config.color
                        )}
                      >
                        {config.label}
                      </span>
                    );
                  })}

                  {/* Compliance badges */}
                  <span
                    className={cn(
                      'px-1.5 py-0.5 text-[9px] font-bold rounded',
                      table.gdprCompliant
                        ? 'bg-green-50 text-green-700'
                        : 'bg-red-50 text-red-700'
                    )}
                  >
                    GDPR {table.gdprCompliant ? 'OK' : 'FAIL'}
                  </span>
                  <span
                    className={cn(
                      'px-1.5 py-0.5 text-[9px] font-bold rounded',
                      table.pciCompliant
                        ? 'bg-green-50 text-green-700'
                        : 'bg-red-50 text-red-700'
                    )}
                  >
                    PCI {table.pciCompliant ? 'OK' : 'FAIL'}
                  </span>
                </div>
              </button>

              {/* Column Details */}
              {isExpanded && (
                <div className="border-t border-slate-100">
                  {/* Column Header */}
                  <div className="grid grid-cols-12 gap-2 px-4 py-1.5 bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                    <div className="col-span-3">Column</div>
                    <div className="col-span-3">Type</div>
                    <div className="col-span-3">Classification</div>
                    <div className="col-span-3">Detection</div>
                  </div>

                  {table.columns.map((col) => {
                    const sensConfig = SENSITIVITY_CONFIG[col.sensitivity];
                    return (
                      <div
                        key={col.name}
                        className={cn(
                          'grid grid-cols-12 gap-2 px-4 py-2 items-center border-b border-slate-50 last:border-b-0',
                          col.sensitivity === 'PII' && 'bg-red-50/30',
                          col.sensitivity === 'PHI' && 'bg-purple-50/30',
                          col.sensitivity === 'Financial' && 'bg-amber-50/30'
                        )}
                      >
                        <div className="col-span-3">
                          <span className="text-sm font-mono text-slate-700">
                            {col.name}
                          </span>
                        </div>

                        <div className="col-span-3">
                          <span className="text-xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {col.type}
                          </span>
                        </div>

                        <div className="col-span-3">
                          <select
                            value={col.sensitivity}
                            onChange={(e) =>
                              handleUpdateSensitivity(
                                table.name,
                                col.name,
                                e.target.value as Sensitivity
                              )
                            }
                            className={cn(
                              'text-xs font-medium px-2 py-1 rounded border focus:outline-none focus:ring-1 focus:ring-aqua-500/30',
                              sensConfig.bg,
                              sensConfig.border,
                              sensConfig.color
                            )}
                          >
                            {Object.entries(SENSITIVITY_CONFIG).map(
                              ([key, config]) => (
                                <option key={key} value={key}>
                                  {config.label}
                                </option>
                              )
                            )}
                          </select>
                        </div>

                        <div className="col-span-3">
                          {col.autoDetected ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-aqua-600 font-medium">
                              <Sparkles className="w-2.5 h-2.5" />
                              AI Detected
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Manual</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DataClassification;
