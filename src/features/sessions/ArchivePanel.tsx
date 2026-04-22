/**
 * ArchivePanel — List of archived sessions with restore/delete actions
 */

import { useState, useSyncExternalStore } from 'react';
import { X, RotateCcw, Trash2, Clock } from 'lucide-react';
import type { ArchivedSession } from '@/shared/types';
import { getArchivedSessions, restoreSession, deleteSession } from '@/services';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

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

  // Load on first mount if empty
  if (loading && sessions.length > 0) {
    setLoading(false);
  }

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
          bg-black/60 backdrop-blur-xl border border-white/20
          shadow-2xl shadow-black/30 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white/80">归档会话</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full
              hover:bg-white/20 text-white/50 hover:text-white/80
              transition-all duration-150 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {loading ? (
            <div className="text-white/40 text-sm text-center py-10 animate-pulse">
              加载中...
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-10 text-white/40">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">暂无归档会话</p>
              <p className="text-xs mt-1">点击归档按钮保存当前所有标签页</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)]
                    bg-white/10 hover:bg-white/15 border border-white/10
                    transition-all duration-150"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white/80 truncate">
                      {session.name}
                    </div>
                    <div className="text-xs text-white/40 mt-0.5">
                      {session.tabCount} 个标签页 · {format(session.createdAt, 'M月d日 HH:mm', { locale: zhCN })}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleRestore(session.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-full
                        hover:bg-white/20 text-white/40 hover:text-green-300
                        transition-all duration-150 cursor-pointer"
                      title="恢复"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(session.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-full
                        hover:bg-white/20 text-white/40 hover:text-red-300
                        transition-all duration-150 cursor-pointer"
                      title="删除"
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
