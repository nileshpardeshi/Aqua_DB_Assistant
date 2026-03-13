import { useCallback, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Upload,
  FileCode2,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/utils';
import { useFileUpload } from '@/hooks/use-file-upload';
import { useParseFile } from '@/hooks/use-schema';

// ── Props ────────────────────────────────────────────────────────────────────

interface FileUploadZoneProps {
  onUploadComplete?: () => void;
  onClose?: () => void;
}

// ── Accepted file types ──────────────────────────────────────────────────────

const ACCEPTED_EXTENSIONS = ['.sql', '.ddl'];
const ACCEPTED_MIME_TYPES = [
  'application/sql',
  'text/sql',
  'text/x-sql',
  'text/plain',
];

function isAcceptedFile(file: File): boolean {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  return (
    ACCEPTED_EXTENSIONS.includes(ext) ||
    ACCEPTED_MIME_TYPES.includes(file.type)
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function FileUploadZone({ onUploadComplete, onClose }: FileUploadZoneProps) {
  const { projectId } = useParams();
  const {
    upload,
    isUploading,
    isSuccess,
    isError,
    error,
    data: uploadedFiles,
    progress,
    reset,
  } = useFileUpload(projectId);
  const parseFile = useParseFile();
  const [parseStatus, setParseStatus] = useState<'idle' | 'parsing' | 'done' | 'error'>('idle');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files).filter(isAcceptedFile);
      if (fileArray.length === 0) return;
      setSelectedFiles(fileArray);
      setParseStatus('idle');
      upload(fileArray, {
        onSuccess: (uploaded) => {
          // Automatically trigger schema parsing for each uploaded file
          if (projectId && uploaded && uploaded.length > 0) {
            setParseStatus('parsing');
            Promise.all(
              uploaded.map((file) =>
                parseFile.mutateAsync({ projectId, fileId: file.id }).catch(() => null)
              )
            ).then(() => {
              setParseStatus('done');
              onUploadComplete?.();
            }).catch(() => {
              setParseStatus('error');
            });
          } else {
            onUploadComplete?.();
          }
        },
      });
    },
    [upload, onUploadComplete, projectId, parseFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleBrowse = () => {
    fileInputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const handleReset = () => {
    setSelectedFiles([]);
    setParseStatus('idle');
    reset();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Upload SQL Files
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Upload .sql or .ddl files to parse and discover your database schema.
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Drop Zone ─────────────────────────────────────────────────── */}
      {!isSuccess && !isUploading && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleBrowse}
          className={cn(
            'relative flex flex-col items-center justify-center py-10 px-6 border-2 border-dashed rounded-xl cursor-pointer transition-all',
            isDragOver
              ? 'border-aqua-400 bg-aqua-50/50 dark:bg-aqua-950/30'
              : 'border-border bg-muted/50 hover:border-aqua-300 hover:bg-aqua-50/30 dark:hover:bg-aqua-950/20'
          )}
        >
          <div
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors',
              isDragOver ? 'bg-aqua-100 dark:bg-aqua-900/30' : 'bg-muted'
            )}
          >
            <Upload
              className={cn(
                'w-6 h-6',
                isDragOver ? 'text-aqua-600' : 'text-muted-foreground'
              )}
            />
          </div>

          <p className="text-sm font-medium text-foreground mb-1">
            {isDragOver ? 'Drop files here' : 'Drop SQL files here'}
          </p>
          <p className="text-xs text-muted-foreground">
            or{' '}
            <span className="text-aqua-600 font-medium">browse your files</span>
          </p>
          <p className="text-[10px] text-muted-foreground mt-2">
            Accepts .sql and .ddl files
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".sql,.ddl"
            multiple
            className="hidden"
            onChange={handleInputChange}
          />
        </div>
      )}

      {/* ── Upload Progress ───────────────────────────────────────────── */}
      {isUploading && (
        <div className="border border-border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="w-5 h-5 text-aqua-500 animate-spin" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                Uploading {selectedFiles.length} file
                {selectedFiles.length !== 1 ? 's' : ''}...
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {progress}% complete
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-aqua-400 to-aqua-600 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* File list */}
          <div className="mt-3 space-y-1.5">
            {selectedFiles.map((file) => (
              <div
                key={file.name}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <FileCode2 className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="truncate">{file.name}</span>
                <span className="ml-auto text-muted-foreground flex-shrink-0">
                  {formatBytes(file.size)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Success State ─────────────────────────────────────────────── */}
      {isSuccess && (
        <div className={cn(
          'border rounded-xl p-4',
          parseStatus === 'done'
            ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/30'
            : parseStatus === 'error'
            ? 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30'
            : 'border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30'
        )}>
          <div className="flex items-center gap-3 mb-3">
            {parseStatus === 'parsing' ? (
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
            ) : parseStatus === 'error' ? (
              <AlertCircle className="w-5 h-5 text-amber-500" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            )}
            <div>
              <p className={cn(
                'text-sm font-medium',
                parseStatus === 'done' ? 'text-green-800 dark:text-green-200' : parseStatus === 'error' ? 'text-amber-800 dark:text-amber-200' : 'text-blue-800 dark:text-blue-200'
              )}>
                {parseStatus === 'parsing'
                  ? 'Parsing schema...'
                  : parseStatus === 'done'
                  ? 'Schema parsed successfully'
                  : parseStatus === 'error'
                  ? 'Upload complete, parsing failed'
                  : 'Upload complete'}
              </p>
              <p className={cn(
                'text-xs mt-0.5',
                parseStatus === 'done' ? 'text-green-600 dark:text-green-400' : parseStatus === 'error' ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'
              )}>
                {parseStatus === 'parsing'
                  ? `Analyzing ${uploadedFiles?.length ?? selectedFiles.length} file${(uploadedFiles?.length ?? selectedFiles.length) !== 1 ? 's' : ''}...`
                  : parseStatus === 'done'
                  ? `${uploadedFiles?.length ?? selectedFiles.length} file${(uploadedFiles?.length ?? selectedFiles.length) !== 1 ? 's' : ''} parsed. Tables and relationships extracted.`
                  : parseStatus === 'error'
                  ? 'Files uploaded but schema parsing encountered an error.'
                  : `${uploadedFiles?.length ?? selectedFiles.length} file${(uploadedFiles?.length ?? selectedFiles.length) !== 1 ? 's' : ''} uploaded. Parsing...`}
              </p>
            </div>
          </div>

          <button
            onClick={handleReset}
            className="text-xs font-medium text-aqua-600 hover:text-aqua-700 transition-colors"
          >
            Upload more files
          </button>
        </div>
      )}

      {/* ── Error State ───────────────────────────────────────────────── */}
      {isError && (
        <div className="border border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/30 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-200">Upload failed</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                {(error as { message?: string })?.message ||
                  'An unexpected error occurred.'}
              </p>
            </div>
          </div>

          <button
            onClick={handleReset}
            className="text-xs font-medium text-aqua-600 hover:text-aqua-700 transition-colors"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
