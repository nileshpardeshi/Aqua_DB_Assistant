import { useRef, useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface SQLEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute?: () => void;
  placeholder?: string;
  dialect?: string;
  className?: string;
}

export function SQLEditor({
  value,
  onChange,
  onExecute,
  placeholder = 'SELECT * FROM users\nWHERE active = true\nORDER BY created_at DESC\nLIMIT 100;',
  className,
}: SQLEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [lineCount, setLineCount] = useState(1);

  // Calculate line count from value
  useEffect(() => {
    const lines = value ? value.split('\n').length : 1;
    setLineCount(Math.max(lines, 1));
  }, [value]);

  // Sync scroll between textarea and line numbers
  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  // Handle Tab key to insert spaces
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const textarea = e.currentTarget;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newValue =
          value.substring(0, start) + '  ' + value.substring(end);
        onChange(newValue);
        // Restore cursor position
        requestAnimationFrame(() => {
          textarea.selectionStart = start + 2;
          textarea.selectionEnd = start + 2;
        });
      }
      // Ctrl+Enter to execute
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onExecute?.();
      }
    },
    [value, onChange, onExecute]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  // Generate line numbers
  const lineNumbers = Array.from({ length: Math.max(lineCount, 20) }, (_, i) => i + 1);

  return (
    <div
      className={cn(
        'relative flex rounded-b-lg overflow-hidden bg-[#1e293b] min-h-[300px]',
        className
      )}
    >
      {/* Line Numbers Gutter */}
      <div
        ref={lineNumbersRef}
        className="flex-shrink-0 select-none overflow-hidden bg-[#162032] border-r border-slate-700/50"
        aria-hidden="true"
      >
        <div className="py-3 px-1">
          {lineNumbers.map((num) => (
            <div
              key={num}
              className={cn(
                'text-right pr-3 pl-3 text-xs leading-[1.625rem] font-mono',
                num <= lineCount
                  ? 'text-slate-500'
                  : 'text-slate-700'
              )}
            >
              {num}
            </div>
          ))}
        </div>
      </div>

      {/* Editor Textarea */}
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          placeholder={placeholder}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className={cn(
            'w-full h-full min-h-[300px] resize-y',
            'bg-transparent text-slate-100 caret-aqua-400',
            'font-mono text-sm leading-[1.625rem]',
            'p-3 outline-none border-none',
            'placeholder:text-slate-600',
            'selection:bg-aqua-500/30'
          )}
          style={{
            tabSize: 2,
          }}
        />

        {/* Keyboard Shortcut Hint */}
        {!value && (
          <div className="absolute bottom-3 right-3 flex items-center gap-2 pointer-events-none">
            <span className="text-[10px] text-slate-600 font-mono">
              Ctrl+Enter to run
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default SQLEditor;
