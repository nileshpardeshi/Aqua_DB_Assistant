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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files).filter(isAcceptedFile);
      if (fileArray.length === 0) return;
      setSelectedFiles(fileArray);
      upload(fileArray, {
        onSuccess: () => {
          onUploadComplete?.();
        },
      });
    },
    [upload, onUploadComplete]
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
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
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
              ? 'border-aqua-400 bg-aqua-50/50'
              : 'border-slate-300 bg-slate-50/50 hover:border-aqua-300 hover:bg-aqua-50/30'
          )}
        >
          <div
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors',
              isDragOver ? 'bg-aqua-100' : 'bg-slate-100'
            )}
          >
            <Upload
              className={cn(
                'w-6 h-6',
                isDragOver ? 'text-aqua-600' : 'text-slate-400'
              )}
            />
          </div>

          <p className="text-sm font-medium text-slate-700 mb-1">
            {isDragOver ? 'Drop files here' : 'Drop SQL files here'}
          </p>
          <p className="text-xs text-muted-foreground">
            or{' '}
            <span className="text-aqua-600 font-medium">browse your files</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-2">
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
        <div className="border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="w-5 h-5 text-aqua-500 animate-spin" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700">
                Uploading {selectedFiles.length} file
                {selectedFiles.length !== 1 ? 's' : ''}...
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {progress}% complete
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
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
                className="flex items-center gap-2 text-xs text-slate-600"
              >
                <FileCode2 className="w-3.5 h-3.5 text-slate-400" />
                <span className="truncate">{file.name}</span>
                <span className="ml-auto text-slate-400 flex-shrink-0">
                  {formatBytes(file.size)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Success State ─────────────────────────────────────────────── */}
      {isSuccess && (
        <div className="border border-green-200 bg-green-50/50 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <div>
              <p className="text-sm font-medium text-green-800">
                Upload complete
              </p>
              <p className="text-xs text-green-600 mt-0.5">
                {uploadedFiles?.length ?? selectedFiles.length} file
                {(uploadedFiles?.length ?? selectedFiles.length) !== 1
                  ? 's'
                  : ''}{' '}
                uploaded successfully. Schema parsing will begin shortly.
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
        <div className="border border-red-200 bg-red-50/50 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <div>
              <p className="text-sm font-medium text-red-800">Upload failed</p>
              <p className="text-xs text-red-600 mt-0.5">
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
