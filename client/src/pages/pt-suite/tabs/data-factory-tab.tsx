import { useState, useMemo } from 'react';
import {
  Database, Package, Beaker, FileText, Plus, Loader2,
  Copy, Download, Trash2, Zap, RefreshCw, Wand2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChains, useCollections } from '@/hooks/use-pt-suite';
import type { PtChainStep } from '@/types/pt-suite.types';
import {
  EmptyState, Modal, Label, Input, Select, Textarea, Btn, Spinner, CollapsibleSection,
} from '../components/shared';

// ── Types ──────────────────────────────────────────────────────────────────────

interface DataTemplate {
  id: string;
  name: string;
  description: string;
  fields: DataField[];
  count: number;
  format: 'json' | 'csv';
}

interface DataField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'email' | 'uuid' | 'date' | 'phone' | 'address' | 'name' | 'company' | 'url' | 'ip' | 'custom';
  pattern?: string;
  min?: number;
  max?: number;
  enum?: string[];
}

// ── Fake Data Generator ────────────────────────────────────────────────────────

const FIRST_NAMES = ['James', 'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'William', 'Sophia', 'Benjamin', 'Isabella', 'Raj', 'Priya', 'Chen', 'Yuki', 'Maria'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Patel', 'Kumar', 'Wang', 'Tanaka', 'Silva'];
const DOMAINS = ['example.com', 'test.org', 'demo.io', 'sample.net', 'acme.co'];
const COMPANIES = ['Acme Corp', 'Globex Inc', 'Initech', 'Umbrella Corp', 'Stark Industries', 'Wayne Enterprises', 'Oscorp', 'Cyberdyne', 'Soylent Corp', 'Tyrell Corp'];
const STREETS = ['Main St', 'Oak Ave', 'Elm Dr', 'Park Blvd', 'Cedar Ln', 'Maple Way', '1st Ave', 'Broadway', 'Market St', 'Pine Rd'];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function generateFieldValue(field: DataField, rowIndex: number): unknown {
  if (field.enum && field.enum.length > 0) {
    return field.enum[randomInt(0, field.enum.length - 1)];
  }

  switch (field.type) {
    case 'string':
      return field.pattern || `${field.name}_${rowIndex + 1}`;
    case 'number':
      return randomInt(field.min ?? 1, field.max ?? 1000);
    case 'boolean':
      return Math.random() > 0.5;
    case 'email': {
      const first = FIRST_NAMES[randomInt(0, FIRST_NAMES.length - 1)].toLowerCase();
      const last = LAST_NAMES[randomInt(0, LAST_NAMES.length - 1)].toLowerCase();
      return `${first}.${last}${randomInt(1, 99)}@${DOMAINS[randomInt(0, DOMAINS.length - 1)]}`;
    }
    case 'uuid':
      return randomUUID();
    case 'date': {
      const start = new Date(2023, 0, 1).getTime();
      const end = new Date(2026, 11, 31).getTime();
      return new Date(start + Math.random() * (end - start)).toISOString().split('T')[0];
    }
    case 'phone':
      return `+1${randomInt(200, 999)}${randomInt(100, 999)}${randomInt(1000, 9999)}`;
    case 'address':
      return `${randomInt(100, 9999)} ${STREETS[randomInt(0, STREETS.length - 1)]}`;
    case 'name': {
      return `${FIRST_NAMES[randomInt(0, FIRST_NAMES.length - 1)]} ${LAST_NAMES[randomInt(0, LAST_NAMES.length - 1)]}`;
    }
    case 'company':
      return COMPANIES[randomInt(0, COMPANIES.length - 1)];
    case 'url':
      return `https://${DOMAINS[randomInt(0, DOMAINS.length - 1)]}/api/v1/${field.name}/${randomInt(1, 1000)}`;
    case 'ip':
      return `${randomInt(10, 192)}.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(1, 254)}`;
    case 'custom':
      return field.pattern || `custom_${rowIndex}`;
    default:
      return `${field.name}_${rowIndex}`;
  }
}

function generateData(template: DataTemplate): unknown[] {
  const rows: unknown[] = [];
  for (let i = 0; i < template.count; i++) {
    const row: Record<string, unknown> = {};
    for (const field of template.fields) {
      row[field.name] = generateFieldValue(field, i);
    }
    rows.push(row);
  }
  return rows;
}

function dataToCSV(data: unknown[]): string {
  if (data.length === 0) return '';
  const keys = Object.keys(data[0] as Record<string, unknown>);
  const header = keys.join(',');
  const rows = data.map(row => keys.map(k => {
    const v = (row as Record<string, unknown>)[k];
    const s = String(v);
    return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(','));
  return [header, ...rows].join('\n');
}

// ── Field Types ────────────────────────────────────────────────────────────────

const FIELD_TYPES: { value: DataField['type']; label: string; desc: string }[] = [
  { value: 'string', label: 'String', desc: 'Plain text' },
  { value: 'number', label: 'Number', desc: 'Integer range' },
  { value: 'boolean', label: 'Boolean', desc: 'true/false' },
  { value: 'email', label: 'Email', desc: 'Realistic emails' },
  { value: 'uuid', label: 'UUID', desc: 'Unique IDs' },
  { value: 'date', label: 'Date', desc: 'ISO dates' },
  { value: 'phone', label: 'Phone', desc: 'US phone numbers' },
  { value: 'name', label: 'Full Name', desc: 'Realistic names' },
  { value: 'company', label: 'Company', desc: 'Company names' },
  { value: 'address', label: 'Address', desc: 'Street address' },
  { value: 'url', label: 'URL', desc: 'API URLs' },
  { value: 'ip', label: 'IP Address', desc: 'IPv4 addresses' },
  { value: 'custom', label: 'Custom', desc: 'Custom pattern' },
];

// ── Preset Templates ───────────────────────────────────────────────────────────

const PRESETS: Omit<DataTemplate, 'id'>[] = [
  {
    name: 'User Registration Payload',
    description: 'Realistic user registration data for API testing',
    count: 100,
    format: 'json',
    fields: [
      { name: 'username', type: 'name' },
      { name: 'email', type: 'email' },
      { name: 'password', type: 'string', pattern: 'Test@{{index}}Pass!' },
      { name: 'phone', type: 'phone' },
      { name: 'company', type: 'company' },
      { name: 'role', type: 'string', enum: ['admin', 'user', 'manager', 'viewer'] },
    ],
  },
  {
    name: 'E-Commerce Orders',
    description: 'Order data with products, quantities, and pricing',
    count: 500,
    format: 'json',
    fields: [
      { name: 'orderId', type: 'uuid' },
      { name: 'customerId', type: 'uuid' },
      { name: 'product', type: 'string', enum: ['Widget Pro', 'Gadget X', 'Turbo Module', 'Basic Pack', 'Premium Suite'] },
      { name: 'quantity', type: 'number', min: 1, max: 50 },
      { name: 'unitPrice', type: 'number', min: 5, max: 500 },
      { name: 'status', type: 'string', enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] },
      { name: 'orderDate', type: 'date' },
    ],
  },
  {
    name: 'Banking Transactions',
    description: 'Simulated banking transaction records',
    count: 1000,
    format: 'csv',
    fields: [
      { name: 'transactionId', type: 'uuid' },
      { name: 'accountNo', type: 'number', min: 10000000, max: 99999999 },
      { name: 'amount', type: 'number', min: 10, max: 50000 },
      { name: 'type', type: 'string', enum: ['credit', 'debit', 'transfer', 'payment', 'refund'] },
      { name: 'currency', type: 'string', enum: ['USD', 'EUR', 'GBP', 'INR', 'JPY'] },
      { name: 'timestamp', type: 'date' },
      { name: 'merchant', type: 'company' },
    ],
  },
];

// ── Component ──────────────────────────────────────────────────────────────────

export function DataFactoryTab() {
  const [templates, setTemplates] = useState<DataTemplate[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [generatedData, setGeneratedData] = useState<{ template: DataTemplate; data: unknown[]; output: string } | null>(null);

  // Builder form
  const [form, setForm] = useState<Omit<DataTemplate, 'id'>>({
    name: '', description: '', fields: [], count: 100, format: 'json',
  });

  const handleLoadPreset = (preset: Omit<DataTemplate, 'id'>) => {
    const template: DataTemplate = { ...preset, id: randomUUID() };
    setTemplates(prev => [...prev, template]);
    handleGenerate(template);
  };

  const handleAddField = () => {
    setForm(prev => ({
      ...prev,
      fields: [...prev.fields, { name: '', type: 'string' }],
    }));
  };

  const handleUpdateField = (idx: number, updates: Partial<DataField>) => {
    setForm(prev => {
      const fields = [...prev.fields];
      fields[idx] = { ...fields[idx], ...updates };
      return { ...prev, fields };
    });
  };

  const handleRemoveField = (idx: number) => {
    setForm(prev => ({ ...prev, fields: prev.fields.filter((_, i) => i !== idx) }));
  };

  const handleCreateTemplate = () => {
    if (!form.name.trim() || form.fields.length === 0) return;
    const template: DataTemplate = { ...form, id: randomUUID() };
    setTemplates(prev => [...prev, template]);
    handleGenerate(template);
    setShowBuilder(false);
    setForm({ name: '', description: '', fields: [], count: 100, format: 'json' });
  };

  const handleGenerate = (template: DataTemplate) => {
    const data = generateData(template);
    const output = template.format === 'csv'
      ? dataToCSV(data)
      : JSON.stringify(data, null, 2);
    setGeneratedData({ template, data, output });
  };

  const handleCopy = () => {
    if (generatedData) {
      navigator.clipboard.writeText(generatedData.output);
    }
  };

  const handleDownload = () => {
    if (!generatedData) return;
    const ext = generatedData.template.format === 'csv' ? 'csv' : 'json';
    const blob = new Blob([generatedData.output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${generatedData.template.name.replace(/\s+/g, '_').toLowerCase()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-200">Test Data Factory</h3>
          <p className="text-sm text-slate-500">Generate realistic test data for API performance testing</p>
        </div>
        <Btn onClick={() => setShowBuilder(true)}>
          <Plus className="w-4 h-4" /> Custom Template
        </Btn>
      </div>

      {/* Preset Templates */}
      <div>
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Quick Presets</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PRESETS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => handleLoadPreset(preset)}
              className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 text-left hover:border-cyan-500/30 hover:bg-slate-800 transition-all group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10 flex items-center justify-center">
                  {idx === 0 ? <Package className="w-5 h-5 text-cyan-400" /> :
                   idx === 1 ? <Database className="w-5 h-5 text-emerald-400" /> :
                   <Beaker className="w-5 h-5 text-purple-400" />}
                </div>
                <div>
                  <h5 className="text-sm font-medium text-slate-200 group-hover:text-cyan-300 transition-colors">{preset.name}</h5>
                  <p className="text-xs text-slate-500">{preset.fields.length} fields, {preset.count} rows</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mb-3">{preset.description}</p>
              <div className="flex flex-wrap gap-1">
                {preset.fields.map((f, fi) => (
                  <span key={fi} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400">{f.name}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Templates */}
      {templates.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Your Templates</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {templates.map((tmpl) => (
              <div key={tmpl.id} className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <h5 className="text-sm font-medium text-slate-200">{tmpl.name}</h5>
                  <p className="text-xs text-slate-500">{tmpl.fields.length} fields, {tmpl.count} rows, {tmpl.format.toUpperCase()}</p>
                </div>
                <div className="flex gap-1">
                  <Btn variant="ghost" onClick={() => handleGenerate(tmpl)} size="sm"><RefreshCw className="w-3 h-3" /></Btn>
                  <Btn variant="ghost" onClick={() => setTemplates(prev => prev.filter(t => t.id !== tmpl.id))} size="sm"><Trash2 className="w-3 h-3" /></Btn>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generated Data Preview */}
      {generatedData && (
        <div className="bg-slate-800/80 border border-slate-700 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/50">
            <div>
              <h4 className="text-sm font-semibold text-slate-200">{generatedData.template.name}</h4>
              <p className="text-xs text-slate-500">{generatedData.data.length} records generated ({generatedData.template.format.toUpperCase()})</p>
            </div>
            <div className="flex gap-2">
              <Btn variant="ghost" onClick={() => handleGenerate(generatedData.template)} size="sm">
                <RefreshCw className="w-3.5 h-3.5" /> Regenerate
              </Btn>
              <Btn variant="ghost" onClick={handleCopy} size="sm">
                <Copy className="w-3.5 h-3.5" /> Copy
              </Btn>
              <Btn variant="secondary" onClick={handleDownload} size="sm">
                <Download className="w-3.5 h-3.5" /> Download
              </Btn>
            </div>
          </div>
          <pre className="px-5 py-4 text-xs text-slate-400 font-mono max-h-96 overflow-auto bg-slate-900/50">
            {generatedData.output.length > 5000
              ? generatedData.output.slice(0, 5000) + `\n\n... (${generatedData.data.length} records total, showing preview)`
              : generatedData.output}
          </pre>
        </div>
      )}

      {/* Custom Template Builder Modal */}
      <Modal open={showBuilder} onClose={() => setShowBuilder(false)} title="Custom Data Template" wide
        footer={
          <>
            <Btn variant="secondary" onClick={() => setShowBuilder(false)}>Cancel</Btn>
            <Btn onClick={handleCreateTemplate} disabled={!form.name.trim() || form.fields.length === 0}>
              <Wand2 className="w-4 h-4" /> Generate
            </Btn>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label required>Template Name</Label>
              <Input value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="API Test Users" />
            </div>
            <div>
              <Label>Row Count</Label>
              <Input value={form.count} onChange={(v) => setForm({ ...form, count: Math.max(1, Math.min(10000, parseInt(v) || 100)) })} type="number" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Description</Label>
              <Input value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="Test data for user registration API" />
            </div>
            <div>
              <Label>Output Format</Label>
              <Select value={form.format} onChange={(v) => setForm({ ...form, format: v as 'json' | 'csv' })} options={[{ value: 'json', label: 'JSON' }, { value: 'csv', label: 'CSV' }]} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Fields</Label>
              <span className="text-xs text-slate-500">{form.fields.length} fields</span>
            </div>
            <div className="space-y-2">
              {form.fields.map((field, i) => (
                <div key={i} className="flex gap-2 items-start bg-slate-900/50 rounded-lg p-2">
                  <div className="flex-1">
                    <Input value={field.name} onChange={(v) => handleUpdateField(i, { name: v })} placeholder="fieldName" />
                  </div>
                  <div className="w-32">
                    <Select
                      value={field.type}
                      onChange={(v) => handleUpdateField(i, { type: v as DataField['type'] })}
                      options={FIELD_TYPES.map(t => ({ value: t.value, label: t.label }))}
                    />
                  </div>
                  {field.type === 'number' && (
                    <>
                      <div className="w-20">
                        <Input value={field.min ?? ''} onChange={(v) => handleUpdateField(i, { min: parseInt(v) || undefined })} placeholder="Min" type="number" />
                      </div>
                      <div className="w-20">
                        <Input value={field.max ?? ''} onChange={(v) => handleUpdateField(i, { max: parseInt(v) || undefined })} placeholder="Max" type="number" />
                      </div>
                    </>
                  )}
                  {(field.type === 'string' || field.type === 'custom') && (
                    <div className="w-40">
                      <Input value={field.enum?.join(', ') || field.pattern || ''} onChange={(v) => {
                        if (v.includes(',')) handleUpdateField(i, { enum: v.split(',').map(s => s.trim()).filter(Boolean) });
                        else handleUpdateField(i, { pattern: v, enum: undefined });
                      }} placeholder="Enum or pattern" />
                    </div>
                  )}
                  <button onClick={() => handleRemoveField(i)} className="p-1.5 text-slate-600 hover:text-red-400 mt-0.5">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={handleAddField} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 mt-2 px-1">
              <Plus className="w-3 h-3" /> Add Field
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
