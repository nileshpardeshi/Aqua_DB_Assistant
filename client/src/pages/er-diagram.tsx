import { ERCanvas } from '@/components/er-diagram/er-canvas';

// ── Component ────────────────────────────────────────────────────────────────

export function ErDiagram() {
  return (
    <div className="h-[calc(100vh-140px)] flex flex-col">
      <ERCanvas />
    </div>
  );
}

export default ErDiagram;
