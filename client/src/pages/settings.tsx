import { useState } from 'react';
import {
  Settings as SettingsIcon,
  Bot,
  Info,
  Key,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Mail,
  Phone,
  Linkedin,
  Globe,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { APP_NAME, APP_TAGLINE } from '@/config/constants';

type SettingsTab = 'ai-providers' | 'general';

interface AIProviderConfig {
  apiKey: string;
  model: string;
  showKey: boolean;
  status: 'idle' | 'testing' | 'success' | 'error';
}

const anthropicModels = [
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250514',
  'claude-haiku-235-20241022',
];

const openaiModels = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-3.5-turbo',
];

export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('ai-providers');

  const [anthropic, setAnthropic] = useState<AIProviderConfig>({
    apiKey: '',
    model: 'claude-sonnet-4-20250514',
    showKey: false,
    status: 'idle',
  });

  const [openai, setOpenai] = useState<AIProviderConfig>({
    apiKey: '',
    model: 'gpt-4o',
    showKey: false,
    status: 'idle',
  });

  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [ollamaStatus, setOllamaStatus] = useState<
    'idle' | 'testing' | 'success' | 'error'
  >('idle');

  const handleTestConnection = async (
    provider: 'anthropic' | 'openai' | 'ollama'
  ) => {
    if (provider === 'anthropic') {
      setAnthropic((prev) => ({ ...prev, status: 'testing' }));
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setAnthropic((prev) => ({
        ...prev,
        status: prev.apiKey ? 'success' : 'error',
      }));
    } else if (provider === 'openai') {
      setOpenai((prev) => ({ ...prev, status: 'testing' }));
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setOpenai((prev) => ({
        ...prev,
        status: prev.apiKey ? 'success' : 'error',
      }));
    } else {
      setOllamaStatus('testing');
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setOllamaStatus(ollamaUrl ? 'success' : 'error');
    }
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'ai-providers', label: 'AI Providers', icon: Bot },
    { id: 'general', label: 'General', icon: Info },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
          <SettingsIcon className="w-5 h-5 text-slate-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Settings</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your application preferences and AI configurations
          </p>
        </div>
      </div>

      {/* Settings Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                isActive
                  ? 'border-aqua-500 text-aqua-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-slate-300'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'ai-providers' && (
        <div className="space-y-6">
          {/* Anthropic */}
          <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center">
                <span className="text-sm font-bold text-orange-700">A</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Anthropic (Claude)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Claude models for AI-powered features
                </p>
              </div>
              <StatusBadge status={anthropic.status} />
            </div>

            <div className="space-y-4">
              {/* API Key */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-muted-foreground" />
                    API Key
                  </div>
                </label>
                <div className="relative">
                  <input
                    type={anthropic.showKey ? 'text' : 'password'}
                    value={anthropic.apiKey}
                    onChange={(e) =>
                      setAnthropic((prev) => ({
                        ...prev,
                        apiKey: e.target.value,
                        status: 'idle',
                      }))
                    }
                    placeholder="sk-ant-api..."
                    className="w-full px-3 py-2 pr-10 text-sm bg-white border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-aqua-400 focus:border-transparent placeholder:text-slate-400 font-mono"
                  />
                  <button
                    onClick={() =>
                      setAnthropic((prev) => ({
                        ...prev,
                        showKey: !prev.showKey,
                      }))
                    }
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  >
                    {anthropic.showKey ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Model */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Model
                </label>
                <div className="relative">
                  <select
                    value={anthropic.model}
                    onChange={(e) =>
                      setAnthropic((prev) => ({
                        ...prev,
                        model: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 text-sm bg-white border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-aqua-400 focus:border-transparent appearance-none cursor-pointer"
                  >
                    {anthropicModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Test Connection */}
              <button
                onClick={() => handleTestConnection('anthropic')}
                disabled={anthropic.status === 'testing'}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-aqua-600 rounded-lg hover:bg-aqua-700 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {anthropic.status === 'testing' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </button>
            </div>
          </div>

          {/* OpenAI */}
          <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center">
                <span className="text-sm font-bold text-green-700">O</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  OpenAI (GPT)
                </h3>
                <p className="text-xs text-muted-foreground">
                  GPT models as an alternative AI provider
                </p>
              </div>
              <StatusBadge status={openai.status} />
            </div>

            <div className="space-y-4">
              {/* API Key */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-muted-foreground" />
                    API Key
                  </div>
                </label>
                <div className="relative">
                  <input
                    type={openai.showKey ? 'text' : 'password'}
                    value={openai.apiKey}
                    onChange={(e) =>
                      setOpenai((prev) => ({
                        ...prev,
                        apiKey: e.target.value,
                        status: 'idle',
                      }))
                    }
                    placeholder="sk-..."
                    className="w-full px-3 py-2 pr-10 text-sm bg-white border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-aqua-400 focus:border-transparent placeholder:text-slate-400 font-mono"
                  />
                  <button
                    onClick={() =>
                      setOpenai((prev) => ({
                        ...prev,
                        showKey: !prev.showKey,
                      }))
                    }
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  >
                    {openai.showKey ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Model */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Model
                </label>
                <div className="relative">
                  <select
                    value={openai.model}
                    onChange={(e) =>
                      setOpenai((prev) => ({
                        ...prev,
                        model: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 text-sm bg-white border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-aqua-400 focus:border-transparent appearance-none cursor-pointer"
                  >
                    {openaiModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Test Connection */}
              <button
                onClick={() => handleTestConnection('openai')}
                disabled={openai.status === 'testing'}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-aqua-600 rounded-lg hover:bg-aqua-700 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {openai.status === 'testing' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </button>
            </div>
          </div>

          {/* Ollama */}
          <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                <Globe className="w-4 h-4 text-slate-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Ollama (Local)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Run AI models locally with Ollama
                </p>
              </div>
              <StatusBadge status={ollamaStatus} />
            </div>

            <div className="space-y-4">
              {/* Base URL */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                    Base URL
                  </div>
                </label>
                <input
                  type="url"
                  value={ollamaUrl}
                  onChange={(e) => {
                    setOllamaUrl(e.target.value);
                    setOllamaStatus('idle');
                  }}
                  placeholder="http://localhost:11434"
                  className="w-full px-3 py-2 text-sm bg-white border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-aqua-400 focus:border-transparent placeholder:text-slate-400 font-mono"
                />
              </div>

              {/* Test Connection */}
              <button
                onClick={() => handleTestConnection('ollama')}
                disabled={ollamaStatus === 'testing'}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-aqua-600 rounded-lg hover:bg-aqua-700 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {ollamaStatus === 'testing' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'general' && (
        <div className="space-y-6">
          {/* App Info */}
          <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Application Info
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Application Name
                </p>
                <p className="text-sm font-medium text-foreground">
                  {APP_NAME}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Version</p>
                <p className="text-sm font-medium text-foreground">1.0.0</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground mb-1">Tagline</p>
                <p className="text-sm font-medium text-foreground">
                  {APP_TAGLINE}
                </p>
              </div>
            </div>
          </div>

          {/* About the Creator */}
          <div className="bg-white rounded-xl border border-border overflow-hidden shadow-sm">
            <div className="px-6 py-4 bg-gradient-to-r from-aqua-50 to-cyan-50 border-b border-aqua-100">
              <h3 className="text-sm font-semibold text-foreground">
                About the Creator
              </h3>
            </div>
            <div className="p-6">
              <div className="flex items-start gap-5">
                {/* Profile Image */}
                <img
                  src="/creator-profile.png"
                  alt="Nilesh Pardeshi"
                  className="w-20 h-20 rounded-xl object-cover border-2 border-aqua-200 shadow-sm flex-shrink-0"
                  onError={(e) => {
                    // Fallback to initials if image not found
                    const target = e.currentTarget;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling;
                    if (fallback) {
                      (fallback as HTMLElement).style.display = 'flex';
                    }
                  }}
                />
                <div
                  className="w-20 h-20 rounded-xl bg-gradient-to-br from-aqua-500 to-cyan-600 items-center justify-center flex-shrink-0 hidden"
                >
                  <span className="text-2xl font-bold text-white">NP</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-base font-bold text-foreground">
                    Nilesh Pardeshi
                  </h4>
                  <p className="text-sm text-aqua-600 font-medium mt-0.5">
                    Technical Manager
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Opus Technologies, Pune
                  </p>

                  {/* Contact Links */}
                  <div className="mt-4 space-y-2.5">
                    <a
                      href="https://www.linkedin.com/in/nileshpardeshi"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 text-xs text-muted-foreground hover:text-aqua-600 transition-colors group"
                    >
                      <Linkedin className="w-4 h-4 text-[#0A66C2] group-hover:scale-110 transition-transform" />
                      <span>linkedin.com/in/nileshpardeshi</span>
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                    <a
                      href="mailto:contactaquaai@gmail.com"
                      className="flex items-center gap-2.5 text-xs text-muted-foreground hover:text-aqua-600 transition-colors group"
                    >
                      <Mail className="w-4 h-4 text-red-500 group-hover:scale-110 transition-transform" />
                      <span>contactaquaai@gmail.com</span>
                    </a>
                    <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                      <Phone className="w-4 h-4 text-emerald-500" />
                      <span>Available on request</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tech Stack */}
          <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Technology Stack
            </h3>
            <div className="flex flex-wrap gap-2">
              {[
                'React 19',
                'TypeScript',
                'Tailwind CSS v4',
                'Zustand',
                'TanStack Query',
                'Express.js',
                'Prisma ORM',
                'PostgreSQL',
                'Lucide Icons',
                'Vite',
              ].map((tech) => (
                <span
                  key={tech}
                  className="px-3 py-1.5 text-xs font-medium text-aqua-700 bg-aqua-50 rounded-full border border-aqua-200/50"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: 'idle' | 'testing' | 'success' | 'error';
}) {
  if (status === 'idle') return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ml-auto',
        status === 'testing' && 'bg-blue-50 text-blue-700',
        status === 'success' && 'bg-emerald-50 text-emerald-700',
        status === 'error' && 'bg-red-50 text-red-700'
      )}
    >
      {status === 'testing' && (
        <Loader2 className="w-3 h-3 animate-spin" />
      )}
      {status === 'success' && <CheckCircle2 className="w-3 h-3" />}
      {status === 'error' && <XCircle className="w-3 h-3" />}
      {status === 'testing' ? 'Testing' : status === 'success' ? 'Connected' : 'Failed'}
    </span>
  );
}

export default Settings;
