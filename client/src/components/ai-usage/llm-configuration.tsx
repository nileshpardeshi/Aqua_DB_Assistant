import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Trash2,
  TestTube,
  Eye,
  EyeOff,
  Star,
  Check,
  X,
  Loader2,
  AlertCircle,
  Zap,
  Pencil,
  Shield,
  Key,
  Thermometer,
  Hash,
  ChevronRight,
} from 'lucide-react';
import {
  useAIProviders,
  useUpsertAIProvider,
  useToggleAIProvider,
  useDeleteAIProvider,
  useTestAIProvider,
  useSeedDefaultProviders,
  type AIProviderConfig,
} from '@/hooks/use-settings';

// ── Provider Metadata ───────────────────────────────────────────────────────

interface ProviderMeta {
  name: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  iconBg: string;
  defaultModels: string[];
  requiresApiKey: boolean;
  requiresBaseUrl: boolean;
  baseUrlPlaceholder?: string;
}

const PROVIDERS: Record<string, ProviderMeta> = {
  anthropic: {
    name: 'Anthropic',
    description: 'Claude models — Opus, Sonnet, Haiku',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    borderColor: 'border-orange-200 dark:border-orange-800',
    iconBg: 'bg-orange-100 dark:bg-orange-900/50',
    defaultModels: [
      'claude-sonnet-4-20250514',
      'claude-opus-4-20250514',
      'claude-haiku-4-5-20251001',
    ],
    requiresApiKey: true,
    requiresBaseUrl: false,
  },
  openai: {
    name: 'OpenAI',
    description: 'GPT-4o, GPT-4o Mini',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    borderColor: 'border-green-200 dark:border-green-800',
    iconBg: 'bg-green-100 dark:bg-green-900/50',
    defaultModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    requiresApiKey: true,
    requiresBaseUrl: false,
  },
  gemini: {
    name: 'Google Gemini',
    description: 'Gemini 2.5 Flash, Gemini Pro',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    iconBg: 'bg-blue-100 dark:bg-blue-900/50',
    defaultModels: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'],
    requiresApiKey: true,
    requiresBaseUrl: false,
  },
  openrouter: {
    name: 'OpenRouter',
    description: 'Access 200+ models via single API key',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    borderColor: 'border-purple-200 dark:border-purple-800',
    iconBg: 'bg-purple-100 dark:bg-purple-900/50',
    defaultModels: [
      'google/gemini-2.5-flash',
      'anthropic/claude-sonnet-4',
      'openai/gpt-4o',
      'meta-llama/llama-3.3-70b-instruct',
    ],
    requiresApiKey: true,
    requiresBaseUrl: false,
  },
  copilot: {
    name: 'GitHub Copilot',
    description: 'Copilot API — GPT-4o, GPT-4o Mini',
    color: 'text-sky-600 dark:text-sky-400',
    bgColor: 'bg-sky-50 dark:bg-sky-950/30',
    borderColor: 'border-sky-200 dark:border-sky-800',
    iconBg: 'bg-sky-100 dark:bg-sky-900/50',
    defaultModels: ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'claude-sonnet-4-20250514'],
    requiresApiKey: true,
    requiresBaseUrl: false,
  },
  ollama: {
    name: 'Ollama (Local)',
    description: 'Run models locally — Llama, Mistral, CodeGemma',
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-50 dark:bg-slate-950/30',
    borderColor: 'border-slate-200 dark:border-slate-700',
    iconBg: 'bg-slate-100 dark:bg-slate-800/50',
    defaultModels: ['llama3.2', 'mistral', 'codegemma', 'deepseek-coder'],
    requiresApiKey: false,
    requiresBaseUrl: true,
    baseUrlPlaceholder: 'http://localhost:11434',
  },
};

// ── Provider Icon ─────────────────────────────────────────────────────────

function ProviderIcon({ provider, className = 'w-5 h-5' }: { provider: string; className?: string }) {
  const meta = PROVIDERS[provider];
  const letter = (meta?.name?.[0] ?? provider[0] ?? 'A').toUpperCase();
  return (
    <span className={`${className} inline-flex items-center justify-center font-bold text-xs ${meta?.color ?? 'text-foreground'}`}>
      {letter}
    </span>
  );
}

// ── Toggle Switch ─────────────────────────────────────────────────────────

function ToggleSwitch({
  enabled,
  onChange,
  disabled,
  size = 'md',
}: {
  enabled: boolean;
  onChange: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}) {
  const dims = size === 'sm'
    ? { track: 'w-8 h-[18px]', thumb: 'w-3.5 h-3.5', translate: 'translate-x-[14px]', off: 'translate-x-[2px]' }
    : { track: 'w-10 h-[22px]', thumb: 'w-[18px] h-[18px]', translate: 'translate-x-[20px]', off: 'translate-x-[2px]' };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      disabled={disabled}
      className={`
        relative inline-flex items-center shrink-0 cursor-pointer rounded-full
        transition-colors duration-200 ease-in-out
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
        disabled:cursor-not-allowed disabled:opacity-50
        ${dims.track}
        ${enabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block rounded-full bg-white shadow-sm ring-0
          transition-transform duration-200 ease-in-out
          ${dims.thumb}
          ${enabled ? dims.translate : dims.off}
        `}
      />
    </button>
  );
}

// ── Modal Overlay ─────────────────────────────────────────────────────────

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Body */}
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirmation ───────────────────────────────────────────────────

function DeleteConfirm({
  open,
  onClose,
  onConfirm,
  providerName,
  model,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  providerName: string;
  model: string;
  isPending: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-xl">
            <Trash2 className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Delete Provider</h3>
            <p className="text-xs text-muted-foreground mt-0.5">This action cannot be undone</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete <span className="font-semibold text-foreground">{providerName}</span>{' '}
          (<span className="font-mono text-xs">{model}</span>)?
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export function LLMConfiguration() {
  const { data: providers, isLoading } = useAIProviders();
  const upsertMutation = useUpsertAIProvider();
  const toggleMutation = useToggleAIProvider();
  const deleteMutation = useDeleteAIProvider();
  const testMutation = useTestAIProvider();
  const seedMutation = useSeedDefaultProviders();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AIProviderConfig | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { status: string; latency?: number; error?: string }>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [seeded, setSeeded] = useState(false);

  // Auto-seed default providers if none exist
  useEffect(() => {
    if (!isLoading && providers && providers.length === 0 && !seeded) {
      setSeeded(true);
      seedMutation.mutate();
    }
  }, [isLoading, providers, seeded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Form State ──────────────────────────────────────────────────────────

  const [formData, setFormData] = useState({
    provider: 'openrouter',
    model: '',
    apiKey: '',
    baseUrl: '',
    isDefault: false,
    maxTokens: 4096,
    temperature: 0.3,
  });

  const resetForm = useCallback(() => {
    setFormData({
      provider: 'openrouter',
      model: '',
      apiKey: '',
      baseUrl: '',
      isDefault: false,
      maxTokens: 4096,
      temperature: 0.3,
    });
    setModalOpen(false);
    setEditingId(null);
  }, []);

  function openAddModal() {
    resetForm();
    setEditingId(null);
    setModalOpen(true);
  }

  function openEditModal(config: AIProviderConfig) {
    setFormData({
      provider: config.provider,
      model: config.model,
      apiKey: '',
      baseUrl: config.baseUrl ?? '',
      isDefault: config.isDefault,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
    });
    setEditingId(config.id);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!formData.provider || !formData.model) return;

    await upsertMutation.mutateAsync({
      id: editingId ?? undefined,
      provider: formData.provider,
      model: formData.model,
      apiKey: formData.apiKey || undefined,
      baseUrl: formData.baseUrl || undefined,
      isDefault: formData.isDefault,
      maxTokens: formData.maxTokens,
      temperature: formData.temperature,
    });
    resetForm();
  }

  async function handleToggle(id: string, currentEnabled: boolean) {
    await toggleMutation.mutateAsync({ id, isEnabled: !currentEnabled });
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  }

  async function handleTest(id: string) {
    setTestResults((prev) => ({ ...prev, [id]: { status: 'testing' } }));
    try {
      const result = await testMutation.mutateAsync(id);
      setTestResults((prev) => ({
        ...prev,
        [id]: { status: 'success', latency: result.latencyMs },
      }));
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: string }).message)
        : 'Connection failed';
      setTestResults((prev) => ({
        ...prev,
        [id]: { status: 'error', error: message },
      }));
    }
  }

  async function handleSetDefault(id: string, provider: string, model: string) {
    await upsertMutation.mutateAsync({ id, provider, model, isDefault: true });
  }

  // When provider changes in form, set first default model
  useEffect(() => {
    const meta = PROVIDERS[formData.provider];
    if (meta && !editingId) {
      setFormData((prev) => ({
        ...prev,
        model: meta.defaultModels[0] ?? '',
        baseUrl: meta.requiresBaseUrl ? (meta.baseUrlPlaceholder ?? '') : '',
      }));
    }
  }, [formData.provider, editingId]);

  const defaultProvider = providers?.find((p) => p.isDefault && p.isEnabled);

  // Group providers by provider type
  const grouped = (providers ?? []).reduce<Record<string, AIProviderConfig[]>>((acc, p) => {
    (acc[p.provider] ??= []).push(p);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Default Banner */}
      {defaultProvider && (
        <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl">
          <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl">
            <Zap className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
              Active: <span className="capitalize">{PROVIDERS[defaultProvider.provider]?.name ?? defaultProvider.provider}</span>
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-mono truncate">
              {defaultProvider.model}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-xs text-emerald-600 dark:text-emerald-400">
            <span className="flex items-center gap-1"><Hash className="w-3 h-3" /> {defaultProvider.maxTokens}</span>
            <span className="flex items-center gap-1"><Thermometer className="w-3 h-3" /> {defaultProvider.temperature}</span>
            <span className="flex items-center gap-1">
              <Key className="w-3 h-3" /> {defaultProvider.hasApiKey ? 'Configured' : 'Missing'}
            </span>
          </div>
        </div>
      )}

      {!defaultProvider && providers && providers.length > 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">No default provider set</p>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Click the <Star className="w-3 h-3 inline" /> star on any enabled provider to set it as the default for all AI calls.
            </p>
          </div>
        </div>
      )}

      {/* Provider Groups */}
      {Object.keys(grouped).length > 0 ? (
        <div className="space-y-4">
          {Object.entries(grouped).map(([providerKey, configs]) => {
            const meta = PROVIDERS[providerKey];
            return (
              <div key={providerKey} className={`rounded-xl border ${meta?.borderColor ?? 'border-border'} overflow-hidden`}>
                {/* Group Header */}
                <div className={`flex items-center gap-3 px-5 py-3 ${meta?.bgColor ?? 'bg-secondary'}`}>
                  <div className={`p-1.5 rounded-lg ${meta?.iconBg ?? 'bg-secondary'}`}>
                    <ProviderIcon provider={providerKey} className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm font-semibold ${meta?.color ?? 'text-foreground'}`}>
                      {meta?.name ?? providerKey}
                    </h3>
                    <p className="text-[10px] text-muted-foreground">{meta?.description ?? ''}</p>
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground bg-background/60 px-2 py-0.5 rounded-full">
                    {configs.length} model{configs.length > 1 ? 's' : ''}
                  </span>
                </div>

                {/* Model Rows */}
                <div className="divide-y divide-border/50">
                  {configs.map((config) => (
                    <ProviderRow
                      key={config.id}
                      config={config}
                      meta={meta}
                      testResult={testResults[config.id]}
                      isKeyVisible={showKeys[config.id]}
                      onToggle={() => handleToggle(config.id, config.isEnabled)}
                      onTest={() => handleTest(config.id)}
                      onEdit={() => openEditModal(config)}
                      onDelete={() => setDeleteTarget(config)}
                      onSetDefault={() => handleSetDefault(config.id, config.provider, config.model)}
                      onToggleKey={() => setShowKeys((prev) => ({ ...prev, [config.id]: !prev[config.id] }))}
                      togglePending={toggleMutation.isPending}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-card border border-dashed border-border rounded-xl">
          <div className="p-3 bg-secondary rounded-full inline-flex mb-4">
            <Zap className="w-8 h-8 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-foreground">No AI providers configured</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">Add a provider to enable AI features across the platform</p>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Provider
          </button>
        </div>
      )}

      {/* Add Provider Button */}
      {providers && providers.length > 0 && (
        <button
          onClick={openAddModal}
          className="w-full flex items-center justify-center gap-2 p-3.5 border-2 border-dashed border-border rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all"
        >
          <Plus className="w-4 h-4" />
          Add AI Provider
        </button>
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={resetForm}
        title={editingId ? 'Edit Provider Configuration' : 'Add New AI Provider'}
      >
        <ProviderForm
          formData={formData}
          setFormData={setFormData}
          isEditing={!!editingId}
          onSave={handleSave}
          onCancel={resetForm}
          isPending={upsertMutation.isPending}
        />
      </Modal>

      {/* Delete Confirmation */}
      <DeleteConfirm
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        providerName={PROVIDERS[deleteTarget?.provider ?? '']?.name ?? deleteTarget?.provider ?? ''}
        model={deleteTarget?.model ?? ''}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}

// ── Provider Row ──────────────────────────────────────────────────────────

function ProviderRow({
  config,
  meta,
  testResult,
  isKeyVisible,
  onToggle,
  onTest,
  onEdit,
  onDelete,
  onSetDefault,
  onToggleKey,
  togglePending,
}: {
  config: AIProviderConfig;
  meta?: ProviderMeta;
  testResult?: { status: string; latency?: number; error?: string };
  isKeyVisible?: boolean;
  onToggle: () => void;
  onTest: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  onToggleKey: () => void;
  togglePending: boolean;
}) {
  return (
    <div className={`bg-card transition-opacity ${!config.isEnabled ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-4 px-5 py-3.5">
        {/* Toggle */}
        <ToggleSwitch
          enabled={config.isEnabled}
          onChange={onToggle}
          disabled={togglePending}
          size="sm"
        />

        {/* Model Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground font-mono truncate">
              {config.model}
            </span>
            {config.isDefault && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded">
                <Star className="w-2.5 h-2.5 fill-current" /> DEFAULT
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Hash className="w-3 h-3" /> {config.maxTokens}
            </span>
            <span className="flex items-center gap-1">
              <Thermometer className="w-3 h-3" /> {config.temperature}
            </span>
            {config.hasApiKey && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleKey(); }}
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <Key className="w-3 h-3" />
                <span className="font-mono">{isKeyVisible ? config.apiKeyPreview : '******'}</span>
                {isKeyVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            )}
            {!config.hasApiKey && meta?.requiresApiKey && (
              <span className="flex items-center gap-1 text-amber-500">
                <AlertCircle className="w-3 h-3" /> No API key
              </span>
            )}
          </div>
        </div>

        {/* Test Result Inline */}
        {testResult && testResult.status !== 'testing' && (
          <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium ${
            testResult.status === 'success'
              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
          }`}>
            {testResult.status === 'success' ? (
              <><Check className="w-3 h-3" /> {testResult.latency}ms</>
            ) : (
              <><X className="w-3 h-3" /> Failed</>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-0.5">
          {/* Set Default */}
          {!config.isDefault && config.isEnabled && (
            <button
              onClick={(e) => { e.stopPropagation(); onSetDefault(); }}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
              title="Set as default"
            >
              <Star className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Test */}
          <button
            onClick={(e) => { e.stopPropagation(); onTest(); }}
            disabled={!config.hasApiKey || testResult?.status === 'testing'}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Test connection"
          >
            {testResult?.status === 'testing' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <TestTube className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Edit */}
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Edit configuration"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>

          {/* Delete */}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <ChevronRight className="w-4 h-4 text-muted-foreground/30 hidden sm:block" />
      </div>

      {/* Test Error Detail (mobile + expanded) */}
      {testResult && testResult.status === 'error' && (
        <div className="mx-5 mb-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-[11px] text-red-600 dark:text-red-400 line-clamp-2">
            {testResult.error}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Provider Form ─────────────────────────────────────────────────────────

function ProviderForm({
  formData,
  setFormData,
  isEditing,
  onSave,
  onCancel,
  isPending,
}: {
  formData: {
    provider: string;
    model: string;
    apiKey: string;
    baseUrl: string;
    isDefault: boolean;
    maxTokens: number;
    temperature: number;
  };
  setFormData: React.Dispatch<React.SetStateAction<typeof formData>>;
  isEditing: boolean;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const meta = PROVIDERS[formData.provider];

  return (
    <div className="space-y-5">
      {/* Provider Selection */}
      <div>
        <label className="block text-xs font-semibold text-foreground mb-2">Provider</label>
        {isEditing ? (
          <div className={`flex items-center gap-3 p-3 rounded-xl ${meta?.bgColor ?? 'bg-secondary'}`}>
            <div className={`p-1.5 rounded-lg ${meta?.iconBg ?? 'bg-secondary'}`}>
              <ProviderIcon provider={formData.provider} />
            </div>
            <div>
              <p className={`text-sm font-semibold ${meta?.color ?? 'text-foreground'}`}>{meta?.name ?? formData.provider}</p>
              <p className="text-[10px] text-muted-foreground">{meta?.description}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(PROVIDERS).map(([key, pMeta]) => (
              <button
                key={key}
                onClick={() => setFormData((prev) => ({ ...prev, provider: key }))}
                className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all text-left ${
                  formData.provider === key
                    ? `${pMeta.borderColor} ${pMeta.bgColor}`
                    : 'border-transparent bg-secondary/50 hover:bg-secondary'
                }`}
              >
                <div className={`p-1 rounded-md ${pMeta.iconBg}`}>
                  <ProviderIcon provider={key} className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-semibold truncate ${formData.provider === key ? pMeta.color : 'text-foreground'}`}>
                    {pMeta.name}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Model */}
      <div>
        <label className="block text-xs font-semibold text-foreground mb-2">Model</label>
        <div className="space-y-2">
          {meta && (
            <div className="flex flex-wrap gap-1.5">
              {meta.defaultModels.map((m) => (
                <button
                  key={m}
                  onClick={() => setFormData((prev) => ({ ...prev, model: m }))}
                  className={`px-2.5 py-1.5 text-[11px] font-mono rounded-lg border transition-colors ${
                    formData.model === m
                      ? `${meta.borderColor} ${meta.bgColor} ${meta.color} font-semibold`
                      : 'border-border bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
          <input
            type="text"
            value={formData.model}
            onChange={(e) => setFormData((prev) => ({ ...prev, model: e.target.value }))}
            placeholder="Or type a custom model name..."
            className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono"
          />
        </div>
      </div>

      {/* API Key */}
      {meta?.requiresApiKey && (
        <div>
          <label className="block text-xs font-semibold text-foreground mb-2">
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-muted-foreground" />
              API Key
              {isEditing && <span className="text-muted-foreground font-normal">(leave blank to keep current)</span>}
            </span>
          </label>
          <input
            type="password"
            value={formData.apiKey}
            onChange={(e) => setFormData((prev) => ({ ...prev, apiKey: e.target.value }))}
            placeholder={isEditing ? '••••••••••••' : 'Enter your API key'}
            className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono"
          />
        </div>
      )}

      {/* Base URL */}
      {meta?.requiresBaseUrl && (
        <div>
          <label className="block text-xs font-semibold text-foreground mb-2">Base URL</label>
          <input
            type="text"
            value={formData.baseUrl}
            onChange={(e) => setFormData((prev) => ({ ...prev, baseUrl: e.target.value }))}
            placeholder={meta.baseUrlPlaceholder ?? 'http://localhost:11434'}
            className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono"
          />
        </div>
      )}

      {/* Advanced Settings */}
      <div>
        <label className="block text-xs font-semibold text-foreground mb-2">Advanced Settings</label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Max Tokens</label>
            <input
              type="number"
              value={formData.maxTokens}
              onChange={(e) => setFormData((prev) => ({ ...prev, maxTokens: parseInt(e.target.value) || 4096 }))}
              min={256}
              max={128000}
              className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Temperature</label>
            <input
              type="number"
              value={formData.temperature}
              onChange={(e) => setFormData((prev) => ({ ...prev, temperature: parseFloat(e.target.value) || 0.3 }))}
              min={0}
              max={2}
              step={0.1}
              className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Default Toggle */}
      <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl">
        <div>
          <p className="text-xs font-medium text-foreground">Set as default provider</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">All AI calls will use this configuration</p>
        </div>
        <ToggleSwitch
          enabled={formData.isDefault}
          onChange={() => setFormData((prev) => ({ ...prev, isDefault: !prev.isDefault }))}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <button
          onClick={onCancel}
          className="px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={!formData.model || isPending}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          {isEditing ? 'Update Provider' : 'Add Provider'}
        </button>
      </div>
    </div>
  );
}
