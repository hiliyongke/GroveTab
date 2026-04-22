/**
 * UndoToast — Bottom toast showing undo option after closing tabs
 */

import { useUndoStore } from '@/store';
import { Undo, X } from 'lucide-react';
import { useT } from '@/shared/i18n';

export function UndoToast() {
  const activeToast = useUndoStore((s) => s.activeToast);
  const undoRecord = useUndoStore((s) => s.undoRecord);
  const dismissToast = useUndoStore((s) => s.dismissToast);
  const { t } = useT();

  if (!activeToast) return null;

  const tabCount = activeToast.tabs.length;
  const label = tabCount === 1
    ? t('undo.closeOne')
    : t('undo.close', { count: tabCount });

  const handleUndo = () => undoRecord(activeToast.id);

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50
        flex items-center gap-3 px-5 py-3 rounded-[var(--radius-lg)]
        bg-surface backdrop-blur-xl border border-border
        shadow-lg animate-in slide-in-from-bottom-4"
    >
      <span className="text-sm text-text">{label}</span>
      <button
        onClick={handleUndo}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)]
          bg-badge hover:bg-surface-hover text-text text-sm font-medium
          transition-colors duration-150 cursor-pointer"
      >
        <Undo className="w-3.5 h-3.5" />
        {t('undo.action')}
      </button>
      <button
        onClick={dismissToast}
        className="w-6 h-6 flex items-center justify-center rounded-full
          hover:bg-surface-hover text-text-muted hover:text-text
          transition-colors duration-150 cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
