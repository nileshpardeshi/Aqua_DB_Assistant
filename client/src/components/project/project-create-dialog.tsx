import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Database, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { DATABASE_DIALECTS } from '../../config/constants';
import { useCreateProject } from '../../hooks/use-projects';
import { useProjectStore } from '../../stores/use-project-store';

interface ProjectCreateDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ProjectCreateDialog({ open, onClose }: ProjectCreateDialogProps) {
  const [name, setName] = useState('');
  const [dialect, setDialect] = useState('postgresql');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const { setActiveProject } = useProjectStore();

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName('');
      setDialect('postgresql');
      setDescription('');
      setError('');
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [open]);

  // Close on escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) {
      onClose();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Project name is required');
      nameInputRef.current?.focus();
      return;
    }

    try {
      const project = await createProject.mutateAsync({
        name: name.trim(),
        dialect,
        description: description.trim() || undefined,
      });
      setActiveProject(project.id);
      onClose();
      navigate(`/project/${project.id}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to create project');
    }
  }

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-lg bg-card rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-aqua-100 dark:bg-aqua-900/30 flex items-center justify-center">
              <Database className="w-5 h-5 text-aqua-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Create New Project
              </h2>
              <p className="text-xs text-muted-foreground">
                Set up a new database engineering project
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Error */}
          {error && (
            <div className="px-4 py-3 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
              {error}
            </div>
          )}

          {/* Project Name */}
          <div className="space-y-2">
            <label
              htmlFor="project-name"
              className="block text-sm font-medium text-foreground"
            >
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              ref={nameInputRef}
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., E-Commerce Platform"
              className="w-full px-4 py-2.5 text-sm border border-input rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500 transition-all"
            />
          </div>

          {/* Database Engine */}
          <div className="space-y-2">
            <label
              htmlFor="project-dialect"
              className="block text-sm font-medium text-foreground"
            >
              Database Engine
            </label>
            <select
              id="project-dialect"
              value={dialect}
              onChange={(e) => setDialect(e.target.value)}
              className="w-full px-4 py-2.5 text-sm border border-input rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500 transition-all appearance-none cursor-pointer"
            >
              {DATABASE_DIALECTS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label
              htmlFor="project-description"
              className="block text-sm font-medium text-foreground"
            >
              Description
            </label>
            <textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this database project..."
              rows={3}
              className="w-full px-4 py-2.5 text-sm border border-input rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500 transition-all resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-muted-foreground bg-secondary rounded-lg hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createProject.isPending}
              className={cn(
                'inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors shadow-sm',
                createProject.isPending
                  ? 'bg-aqua-400 cursor-not-allowed'
                  : 'bg-aqua-600 hover:bg-aqua-700'
              )}
            >
              {createProject.isPending && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ProjectCreateDialog;
