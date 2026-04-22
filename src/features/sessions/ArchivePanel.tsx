/**
 * ArchivePanel — List of archived sessions with restore/delete actions
 */

import { useState, useSyncExternalStore, useEffect } from 'react';
import { X, RotateCcw, Trash2, Clock } from 'lucide-react';
import type { ArchivedSession } from '@/shared/types';
import { getArchivedSessions, restoreSession, deleteSession } from '@/services';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { enUS } from 'date-fns/locale';
import { useT } from '@/shared/i18n';

// Simple external store for archived sessions
let sessionsCache: ArchivedSession[] = [];
let sessionsListeners: (() => void)[] = [];

function subscribeSessions(listener: () => void) {
  sessionsListeners.push(listener);
  return () => {
    sessionsListeners = sessionsListeners.filter((l) => l !== listener);
  };
}

function getSessionsSnapshot() {
  return sessionsCache;
}

function notifySessionsListeners() {
  sessionsListeners.forEach((l) => l());
}

async function refreshSessions() {
  sessionsCache = await getArchivedSessions();
  notifySessionsListeners();
}

// Initialize on module load
refreshSessions();

interface ArchivePanelProps {
  onClose: () => void;
}

export function ArchivePanel({ onClose }: ArchivePanelProps) {
  const sessions = useSyncExternalStore(subscribeSessions, getSessionsSnapshot);
  const [loading, setLoading] = useState(sessions.length === 0);
  const { t, locale } = useT();

  useEffect(() => {
    if (loading && sessions.length > 0) {
      setLoading(false);
    }
  }, [loading, sessions.length]);

  const handleRestore = async (id: string) => {
    await restoreSession(id);
    await refreshSessions();
  };

  const handleDelete = async (id: string) => {
    await deleteSession(id);
    await refreshSessions();
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm flex items-start justify-center pt-[10vh]">
      <div
        className="w-full max-w-2xl rounded-[var(--radius-lg)]
          bg-surface backdrop-blur-xl border border-border
          shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text">{t('archive.title')}</h2>
          <button
            onClick={onClose}
            aria-label={t('archive.close')}
            className="w-8 h-8 flex items-center justify-center rounded-full
              hover:bg-surface-hover text-text-muted hover:text-text
              transition-colors duration-150 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {loading ? (
            <div className="text-text-muted text-sm text-center py-10 animate-pulse">
              {t('archive.loading')}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-10 text-text-muted">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">{t('archive.empty')}</p>
              <p className="text-xs mt-1">{t('archive.emptyHint')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)]
                    bg-surface hover:bg-surface-hover border border-border
                    transition-colors duration-150"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text truncate">
                      {session.name}
                    </div>
                    <div className="text-xs text-text-muted mt-0.5">
                      {t('archive.tabCount', { count: session.tabCount })} · {format(session.createdAt, 'M月d日 HH:mm', { locale: locale === 'zh-CN' ? zhCN : enUS })}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleRestore(session.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-full
                        hover:bg-surface-hover text-text-muted hover:text-green-400
                        transition-colors duration-150 cursor-pointer"
                      title={t('archive.restore')}
                      aria-label={t('archive.restore')}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(session.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-full
                        hover:bg-surface-hover text-text-muted hover:text-red-400
                        transition-colors duration-150 cursor-pointer"
                      title={t('archive.delete')}
                      aria-label={t('archive.delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
