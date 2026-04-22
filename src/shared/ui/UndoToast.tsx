/**
 * UndoToast — Bottom toast showing undo option after closing tabs
 */

import { useUndoStore } from '@/store';
import { Undo, X } from 'lucide-react';

export function UndoToast() {
  const activeToast = useUndoStore((s) => s.activeToast);
  const undoRecord = useUndoStore((s) => s.undoRecord);
  const dismissToast = useUndoStore((s) => s.dismissToast);

  if (!activeToast) return null;

  const tabCount = activeToast.tabs.length;
  const label = tabCount === 1
    ? `已关闭 1 个标签页`
    : `已关闭 ${tabCount} 个标签页`;

  const handleUndo = () => undoRecord(activeToast.id);

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50
        flex items-center gap-3 px-5 py-3 rounded-[var(--radius-lg)]
        bg-black/60 backdrop-blur-xl border border-white/20
        shadow-lg shadow-black/20 animate-in slide-in-from-bottom-4"
    >
      <span className="text-sm text-white/80">{label}</span>
      <button
        onClick={handleUndo}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)]
          bg-white/20 hover:bg-white/30 text-white/90 text-sm font-medium
          transition-all duration-150 cursor-pointer"
      >
        <Undo className="w-3.5 h-3.5" />
        撤销
      </button>
      <button
        onClick={dismissToast}
        className="w-6 h-6 flex items-center justify-center rounded-full
          hover:bg-white/20 text-white/50 hover:text-white/80
          transition-all duration-150 cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
