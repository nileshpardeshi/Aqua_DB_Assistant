import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Bot,
  User,
  Send,
  Loader2,
  ChevronDown,
  X,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ChatContext = 'general' | 'schema' | 'query' | 'performance';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  context?: ChatContext;
}

interface AIChatPanelProps {
  projectName?: string;
  onClose?: () => void;
  className?: string;
  embedded?: boolean;
}

const contextOptions: { value: ChatContext; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'schema', label: 'Schema Design' },
  { value: 'query', label: 'Query' },
  { value: 'performance', label: 'Performance' },
];

const welcomeMessages: Record<ChatContext, string> = {
  general:
    'Hello! I\'m Aqua AI Copilot. I can help you with database design, SQL queries, performance optimization, and more. How can I assist you today?',
  schema:
    'I\'m ready to help with schema design. I can suggest table structures, relationships, normalization strategies, and naming conventions. What would you like to design?',
  query:
    'I\'m here to help with SQL queries. I can generate, optimize, and explain queries. Describe what data you need or paste a query for review.',
  performance:
    'I can help analyze and improve database performance. Share your queries or describe your performance concerns, and I\'ll provide optimization suggestions.',
};

export function AIChatPanel({
  projectName,
  onClose,
  className,
  embedded = false,
}: AIChatPanelProps) {
  const { projectId } = useParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [context, setContext] = useState<ChatContext>('general');
  const [showContextMenu, setShowContextMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close context menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setShowContextMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup abort on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleSend = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
      context,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Build the messages array for the API (include context prefix)
    const contextPrefix =
      context !== 'general'
        ? `[Context: ${context}] `
        : '';
    const apiMessages = [
      ...messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: contextPrefix + trimmed },
    ];

    // Create placeholder for streaming response
    const assistantMsgId = `msg_${Date.now()}_assistant`;
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        context,
      },
    ]);

    try {
      abortRef.current = new AbortController();
      const response = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          projectId: projectId || undefined,
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(
          response.status === 500
            ? 'AI provider not configured. Please set up your API key in Settings.'
            : `Request failed (${response.status})`
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') break;

          try {
            const event = JSON.parse(payload) as {
              type: 'delta' | 'done' | 'error';
              content: string;
            };

            if (event.type === 'delta') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: m.content + event.content }
                    : m
                )
              );
            } else if (event.type === 'error') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: `Error: ${event.content}` }
                    : m
                )
              );
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const errMsg =
        err instanceof Error
          ? err.message
          : 'Failed to connect to AI. Please check your AI provider settings.';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId ? { ...m, content: errMsg } : m
        )
      );
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col bg-card',
        embedded ? 'h-full' : 'h-full border-l border-border shadow-lg',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-aqua-50 to-cyan-50 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-aqua-500 flex items-center justify-center shadow-sm">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              AI Copilot
            </h3>
            {projectName && (
              <p className="text-[10px] text-muted-foreground">
                {projectName}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Context Selector */}
          <div className="relative" ref={contextMenuRef}>
            <button
              onClick={() => setShowContextMenu(!showContextMenu)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground bg-card rounded-md border border-border hover:bg-slate-50 transition-colors"
            >
              {contextOptions.find((c) => c.value === context)?.label}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showContextMenu && (
              <div className="absolute right-0 top-full mt-1 z-20 w-36 bg-card rounded-lg border border-border shadow-lg py-1">
                {contextOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setContext(opt.value);
                      setShowContextMenu(false);
                    }}
                    className={cn(
                      'w-full px-3 py-1.5 text-xs text-left hover:bg-slate-50 transition-colors',
                      context === opt.value
                        ? 'text-aqua-700 bg-aqua-50 font-medium'
                        : 'text-foreground'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-aqua-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bot className="w-4 h-4 text-aqua-600" />
            </div>
            <div className="bg-slate-50 rounded-xl rounded-tl-sm px-4 py-3 max-w-[85%]">
              <p className="text-xs text-foreground leading-relaxed">
                {welcomeMessages[context]}
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'flex items-start gap-3',
              msg.role === 'user' ? 'flex-row-reverse' : ''
            )}
          >
            {/* Avatar */}
            <div
              className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                msg.role === 'user' ? 'bg-aqua-600' : 'bg-aqua-100'
              )}
            >
              {msg.role === 'user' ? (
                <User className="w-3.5 h-3.5 text-white" />
              ) : (
                <Bot className="w-4 h-4 text-aqua-600" />
              )}
            </div>

            {/* Message Bubble */}
            <div
              className={cn(
                'rounded-xl px-4 py-3 max-w-[85%]',
                msg.role === 'user'
                  ? 'bg-aqua-600 text-white rounded-tr-sm'
                  : 'bg-slate-50 text-foreground rounded-tl-sm'
              )}
            >
              <p
                className={cn(
                  'text-xs leading-relaxed whitespace-pre-wrap',
                  msg.role === 'user' ? 'text-white' : 'text-foreground'
                )}
              >
                {msg.content}
              </p>
              <p
                className={cn(
                  'text-[9px] mt-2',
                  msg.role === 'user'
                    ? 'text-aqua-200'
                    : 'text-muted-foreground'
                )}
              >
                {msg.timestamp.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-aqua-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bot className="w-4 h-4 text-aqua-600" />
            </div>
            <div className="bg-slate-50 rounded-xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-aqua-500 animate-spin" />
                <span className="text-xs text-muted-foreground">
                  Thinking...
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 border-t border-border px-4 py-3 bg-card">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your database..."
            rows={1}
            className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-aqua-400 focus:border-transparent placeholder:text-slate-400 resize-none max-h-24"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className={cn(
              'flex items-center justify-center w-9 h-9 rounded-lg transition-all flex-shrink-0',
              inputValue.trim() && !isLoading
                ? 'bg-aqua-600 text-white hover:bg-aqua-700 shadow-sm'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[9px] text-muted-foreground mt-1.5 text-center">
          AI responses are suggestions. Always verify before applying to production.
        </p>
      </div>
    </div>
  );
}

export default AIChatPanel;
