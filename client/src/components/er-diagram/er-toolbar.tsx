import { useReactFlow } from 'reactflow';
import {
  ArrowDownUp,
  ArrowLeftRight,
  ZoomIn,
  ZoomOut,
  Maximize,
  Columns3,
  Tag,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useERDiagramStore } from '@/stores/use-er-diagram-store';

// ── Component ────────────────────────────────────────────────────────────────

export function ERToolbar() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  const {
    layoutDirection,
    setLayoutDirection,
    showColumns,
    toggleColumns,
    showRelationshipLabels,
    toggleLabels,
  } = useERDiagramStore();

  return (
    <div className="sticky top-0 z-10 flex items-center gap-1.5 px-4 py-2.5 bg-white/95 backdrop-blur border-b border-slate-200">
      {/* ── Layout Direction ──────────────────────────────────────────── */}
      <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
        <ToolbarButton
          icon={ArrowDownUp}
          label="Top to Bottom"
          active={layoutDirection === 'TB'}
          onClick={() => setLayoutDirection('TB')}
        />
        <ToolbarButton
          icon={ArrowLeftRight}
          label="Left to Right"
          active={layoutDirection === 'LR'}
          onClick={() => setLayoutDirection('LR')}
        />
      </div>

      <Separator />

      {/* ── Zoom Controls ─────────────────────────────────────────────── */}
      <ToolbarButton
        icon={ZoomIn}
        label="Zoom In"
        onClick={() => zoomIn({ duration: 200 })}
      />
      <ToolbarButton
        icon={ZoomOut}
        label="Zoom Out"
        onClick={() => zoomOut({ duration: 200 })}
      />
      <ToolbarButton
        icon={Maximize}
        label="Fit View"
        onClick={() => fitView({ padding: 0.15, duration: 300 })}
      />

      <Separator />

      {/* ── Toggle Controls ───────────────────────────────────────────── */}
      <ToolbarButton
        icon={Columns3}
        label={showColumns ? 'Hide Columns' : 'Show Columns'}
        active={showColumns}
        onClick={toggleColumns}
      />
      <ToolbarButton
        icon={Tag}
        label={showRelationshipLabels ? 'Hide Labels' : 'Show Labels'}
        active={showRelationshipLabels}
        onClick={toggleLabels}
      />

      <Separator />

      {/* ── Export ─────────────────────────────────────────────────────── */}
      <ToolbarButton
        icon={Download}
        label="Export"
        onClick={() => {
          // Placeholder for export functionality
        }}
      />
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function ToolbarButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        'inline-flex items-center justify-center w-8 h-8 rounded-md text-sm transition-colors',
        active
          ? 'bg-aqua-100 text-aqua-700'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
      )}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

function Separator() {
  return <div className="w-px h-5 bg-slate-200 mx-1" />;
}
