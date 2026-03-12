import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Database,
  Play,
  Loader2,
  RefreshCw,
  Columns3,
  Shuffle,
  TrendingUp,
  Hash,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCreatePerformanceRun } from '@/hooks/use-performance';

interface ColumnConfig {
  name: string;
  type: string;
  generator: string;
}

type Distribution = 'random' | 'sequential' | 'realistic';

const ROW_COUNT_OPTIONS = [
  { label: '1K', value: 1000 },
  { label: '10K', value: 10000 },
  { label: '100K', value: 100000 },
  { label: '1M', value: 1000000 },
];

const GENERATOR_OPTIONS = [
  'Auto Detect',
  'UUID',
  'Incremental ID',
  'First Name',
  'Last Name',
  'Full Name',
  'Email',
  'Phone',
  'Address',
  'City',
  'Country',
  'Company',
  'Date',
  'Timestamp',
  'Boolean',
  'Integer (1-100)',
  'Integer (1-10000)',
  'Float',
  'Currency',
  'Paragraph',
  'Sentence',
  'URL',
  'IP Address',
  'Lorem Text',
];

const DISTRIBUTION_OPTIONS: { value: Distribution; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  { value: 'random', label: 'Random', icon: Shuffle, description: 'Uniformly random values' },
  { value: 'sequential', label: 'Sequential', icon: TrendingUp, description: 'Ordered / incremental' },
  { value: 'realistic', label: 'Realistic', icon: Database, description: 'Natural-looking data' },
];

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { name: 'id', type: 'INT', generator: 'Incremental ID' },
  { name: 'name', type: 'VARCHAR(255)', generator: 'Full Name' },
  { name: 'email', type: 'VARCHAR(255)', generator: 'Email' },
  { name: 'created_at', type: 'TIMESTAMP', generator: 'Timestamp' },
  { name: 'status', type: 'VARCHAR(50)', generator: 'Boolean' },
];

// Generate sample row data for preview
function generateSampleValue(generator: string, rowIndex: number): string {
  const samples: Record<string, string[]> = {
    'Incremental ID': ['1', '2', '3', '4', '5'],
    'UUID': ['a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', 'c3d4e5f6-a7b8-9012-cdef-123456789012', 'd4e5f6a7-b8c9-0123-defa-234567890123', 'e5f6a7b8-c9d0-1234-efab-345678901234'],
    'Full Name': ['Alice Johnson', 'Bob Smith', 'Carol Williams', 'David Brown', 'Eve Davis'],
    'First Name': ['Alice', 'Bob', 'Carol', 'David', 'Eve'],
    'Last Name': ['Johnson', 'Smith', 'Williams', 'Brown', 'Davis'],
    'Email': ['alice@example.com', 'bob@corp.io', 'carol@test.org', 'david@mail.com', 'eve@acme.co'],
    'Phone': ['+1-555-0101', '+1-555-0102', '+1-555-0103', '+1-555-0104', '+1-555-0105'],
    'Timestamp': ['2025-01-15 08:30:00', '2025-02-20 14:22:00', '2025-03-10 09:45:00', '2025-04-05 16:10:00', '2025-05-12 11:05:00'],
    'Date': ['2025-01-15', '2025-02-20', '2025-03-10', '2025-04-05', '2025-05-12'],
    'Boolean': ['true', 'false', 'true', 'true', 'false'],
    'Integer (1-100)': ['42', '17', '88', '3', '65'],
    'Integer (1-10000)': ['4271', '1729', '8834', '312', '6509'],
    'Float': ['3.14', '2.718', '1.414', '0.577', '9.81'],
    'Currency': ['$49.99', '$124.50', '$9.99', '$299.00', '$74.25'],
    'Company': ['Acme Corp', 'TechStart Inc', 'GlobalServ Ltd', 'DataFlow Co', 'CloudBase LLC'],
    'City': ['New York', 'San Francisco', 'London', 'Tokyo', 'Berlin'],
    'Country': ['United States', 'Canada', 'United Kingdom', 'Japan', 'Germany'],
    'Address': ['123 Main St', '456 Oak Ave', '789 Pine Rd', '321 Elm Dr', '654 Maple Ln'],
    'Paragraph': ['Lorem ipsum dolor sit amet...', 'Sed do eiusmod tempor...', 'Ut enim ad minim veniam...', 'Duis aute irure dolor...', 'Excepteur sint occaecat...'],
    'Sentence': ['The quick brown fox.', 'A lazy dog sleeps.', 'Hello world again.', 'Testing data here.', 'Sample text value.'],
    'URL': ['https://example.com/a', 'https://test.io/b', 'https://demo.org/c', 'https://app.co/d', 'https://site.dev/e'],
    'IP Address': ['192.168.1.1', '10.0.0.42', '172.16.0.100', '192.168.0.55', '10.10.10.10'],
    'Lorem Text': ['Lorem ipsum...', 'Dolor sit amet...', 'Consectetur...', 'Adipiscing elit...', 'Sed do eiusmod...'],
    'Auto Detect': ['value_1', 'value_2', 'value_3', 'value_4', 'value_5'],
  };
  const values = samples[generator] || samples['Auto Detect'];
  return values[rowIndex % values.length];
}

export function SyntheticDataGenerator() {
  const { projectId } = useParams();
  const createRun = useCreatePerformanceRun();

  const [tableName, setTableName] = useState('');
  const [rowCount, setRowCount] = useState(10000);
  const [distribution, setDistribution] = useState<Distribution>('realistic');
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnType, setNewColumnType] = useState('VARCHAR(255)');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showPreview, setShowPreview] = useState(false);

  const handleAddColumn = useCallback(() => {
    if (!newColumnName.trim()) return;
    setColumns((prev) => [
      ...prev,
      { name: newColumnName.trim(), type: newColumnType, generator: 'Auto Detect' },
    ]);
    setNewColumnName('');
    setNewColumnType('VARCHAR(255)');
  }, [newColumnName, newColumnType]);

  const handleRemoveColumn = useCallback((index: number) => {
    setColumns((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpdateGenerator = useCallback((index: number, generator: string) => {
    setColumns((prev) =>
      prev.map((col, i) => (i === index ? { ...col, generator } : col))
    );
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!tableName.trim() || !projectId) return;
    setIsGenerating(true);
    setProgress(0);

    // Simulate generation progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          return 95;
        }
        return prev + Math.random() * 15;
      });
    }, 300);

    try {
      await createRun.mutateAsync({
        projectId,
        type: 'data-generation',
        name: `Generate ${rowCount.toLocaleString()} rows for ${tableName}`,
        config: {
          tableName,
          rowCount,
          distribution,
          columns,
        },
      });
      setProgress(100);
    } catch {
      // Error handled by mutation
    } finally {
      clearInterval(interval);
      setTimeout(() => {
        setIsGenerating(false);
        setProgress(0);
      }, 1000);
    }
  }, [tableName, rowCount, distribution, columns, projectId, createRun]);

  return (
    <div className="space-y-6">
      {/* Table Name & Row Count */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Table Name
          </label>
          <div className="relative">
            <Database className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="e.g., users, orders, products"
              className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500 transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Number of Rows
          </label>
          <div className="flex gap-2">
            {ROW_COUNT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRowCount(opt.value)}
                className={cn(
                  'flex-1 px-3 py-2.5 text-sm font-medium rounded-lg border transition-all',
                  rowCount === opt.value
                    ? 'bg-aqua-50 border-aqua-300 text-aqua-700 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Distribution */}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">
          Data Distribution
        </label>
        <div className="grid grid-cols-3 gap-3">
          {DISTRIBUTION_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                onClick={() => setDistribution(opt.value)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left',
                  distribution === opt.value
                    ? 'bg-aqua-50 border-aqua-300 shadow-sm'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                )}
              >
                <Icon
                  className={cn(
                    'w-4 h-4 flex-shrink-0',
                    distribution === opt.value ? 'text-aqua-600' : 'text-slate-400'
                  )}
                />
                <div>
                  <p
                    className={cn(
                      'text-sm font-medium',
                      distribution === opt.value ? 'text-aqua-700' : 'text-slate-700'
                    )}
                  >
                    {opt.label}
                  </p>
                  <p className="text-[10px] text-slate-500">{opt.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Column Configuration */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
            <Columns3 className="w-3.5 h-3.5" />
            Column Configuration
          </label>
          <span className="text-[10px] text-slate-500">
            {columns.length} column{columns.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            <div className="col-span-3">Column</div>
            <div className="col-span-3">Type</div>
            <div className="col-span-4">Generator</div>
            <div className="col-span-2 text-right">Action</div>
          </div>

          {/* Rows */}
          {columns.map((col, idx) => (
            <div
              key={idx}
              className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-slate-100 last:border-b-0 items-center hover:bg-slate-50/50"
            >
              <div className="col-span-3">
                <span className="text-sm font-mono text-slate-700">{col.name}</span>
              </div>
              <div className="col-span-3">
                <span className="text-xs text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                  {col.type}
                </span>
              </div>
              <div className="col-span-4">
                <select
                  value={col.generator}
                  onChange={(e) => handleUpdateGenerator(idx, e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-aqua-500/30"
                >
                  {GENERATOR_OPTIONS.map((gen) => (
                    <option key={gen} value={gen}>
                      {gen}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 text-right">
                <button
                  onClick={() => handleRemoveColumn(idx)}
                  className="text-xs text-red-500 hover:text-red-700 transition-colors px-2 py-1"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          {/* Add Column */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50/50 items-center">
            <div className="col-span-3">
              <input
                type="text"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                placeholder="column_name"
                className="w-full text-sm font-mono border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-aqua-500/30"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddColumn();
                }}
              />
            </div>
            <div className="col-span-3">
              <input
                type="text"
                value={newColumnType}
                onChange={(e) => setNewColumnType(e.target.value)}
                placeholder="VARCHAR(255)"
                className="w-full text-xs font-mono border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-aqua-500/30"
              />
            </div>
            <div className="col-span-4" />
            <div className="col-span-2 text-right">
              <button
                onClick={handleAddColumn}
                disabled={!newColumnName.trim()}
                className={cn(
                  'text-xs font-medium px-3 py-1.5 rounded transition-colors',
                  newColumnName.trim()
                    ? 'text-aqua-700 bg-aqua-50 hover:bg-aqua-100'
                    : 'text-slate-400 cursor-not-allowed'
                )}
              >
                + Add
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Generate Button & Progress */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !tableName.trim()}
          className={cn(
            'inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all shadow-sm',
            isGenerating || !tableName.trim()
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-aqua-600 text-white hover:bg-aqua-700'
          )}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Generate Data
            </>
          )}
        </button>

        <button
          onClick={() => setShowPreview(!showPreview)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Hash className="w-3.5 h-3.5" />
          {showPreview ? 'Hide' : 'Show'} Preview
        </button>

        {isGenerating && (
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500">Generating rows...</span>
              <span className="text-xs font-medium text-aqua-600">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-aqua-500 to-cyan-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Preview Table */}
      {showPreview && columns.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-slate-700">
              Sample Preview (5 rows)
            </h4>
            <button
              onClick={() => setShowPreview(false)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {columns.map((col, i) => (
                    <th
                      key={i}
                      className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap"
                    >
                      {col.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }, (_, rowIdx) => (
                  <tr
                    key={rowIdx}
                    className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50"
                  >
                    {columns.map((col, colIdx) => (
                      <td
                        key={colIdx}
                        className="px-3 py-2 text-slate-700 font-mono whitespace-nowrap"
                      >
                        {generateSampleValue(col.generator, rowIdx)}
                      </td>
                    ))}
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

export default SyntheticDataGenerator;
