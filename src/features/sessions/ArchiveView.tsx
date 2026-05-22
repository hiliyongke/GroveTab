/**
 * ArchiveView — 归档会话内联视图
 *
 * 作为视图 Tab 之一嵌入主内容区，替代原有的 Modal 浮层。
 * 复用 ArchivePanel 的全部业务逻辑，仅移除 Modal 外壳。
 */

import { useState, useSyncExternalStore, useEffect, useMemo } from 'react';
import {
  Plus,
  Save,
  Info,
  Inbox,
} from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { Alert, Button, List, Spin, Input, Modal, Space } from 'antd';
import { FeatureEmptyState } from '@/shared/ui/FeatureEmptyState';
import '@/shared/ui/FeatureEmptyState.css';
import type { ArchivedSession } from '@/shared/types';
import {
  getArchivedSessions,
  deleteSession,
  renameSession,
  archiveAllTabs,
  mergeSessions,
  exportSingleSession,
} from '@/services';
import type { RestoreOutcome } from '@/services/archive';
import { createTab, getCurrentWindow } from '@/chrome';
import { useT } from '@/shared/i18n';
import { track } from '@/shared/utils/metrics';
import { useTabsStore, useUndoStore, useMetadataStore, useSettingsStore } from '@/store';
import { feedback } from '@/shared/ui/feedback';
import { appendHistoryEvent } from '@/repositories';
import { registerHistoryUndoHandler } from '@/services/history/undo-bus';
import { SessionItem } from './components/SessionItem';
import { BatchOperationsMenu } from './components/BatchOperationsMenu';
import { EnhancedRestoreDialog } from './components/EnhancedRestoreDialog';
import { EnhancedRenameDialog } from './components/EnhancedRenameDialog';
import { APP_EVENTS } from '@/shared/config/storage-keys';
import { isSafeExternalUrl } from '@/shared/utils/url-safety';
import './styles/archive.css';

/* ---------- 简易外部 store 同步归档列表 ---------- */
let sessionsCache: ArchivedSession[] = [];
let sessionsInitialized = false;
let sessionsListeners: Array<() => void> = [];

function subscribeSessions(listener: () => void) {
  sessionsListeners.push(listener);
  return () => {
    sessionsListeners = sessionsListeners.filter((l) => l !== listener);
  };
}
function getSessionsSnapshot() {
  return sessionsCache;
}
function getSessionsInitialized() {
  return sessionsInitialized;
}
function notifySessionsListeners() {
  sessionsListeners.forEach((l) => l());
}
export async function refreshSessions() {
  sessionsCache = await getArchivedSessions();
  sessionsInitialized = true;
  notifySessionsListeners();
}

// 模块加载时初始化
void refreshSessions();

/**
 * 模块加载时一次性注册「archive_create」与「archive_restore」事件的「撤销处理器」。
 * - archive_create.撤销 = 删除该归档会话（仅此，请勿尝试復原原 tab，避免与已存在的 useUndoStore 冲突）
 * - archive_restore 未提供：恢复后再「反恢复」语义不明，暂不接
 *
 * 这里在模块作用域调用一次即可：ArchiveView 是 lazy chunk，在面板首次打开时一定会被加载。
 */
registerHistoryUndoHandler('archive_create', async (event) => {
  const sessionId = (event.undoContext as { sessionId?: string } | undefined)?.sessionId;
  if (sessionId === undefined || sessionId === '') return false;
  await deleteSession(sessionId);
  await refreshSessions();
  return true;
});

export function ArchiveView() {
  const sessions = useSyncExternalStore(subscribeSessions, getSessionsSnapshot);
  const initialized = useSyncExternalStore(subscribeSessions, getSessionsInitialized);
  const loading = !initialized;
  const [archivingCurrent, setArchivingCurrent] = useState(false);
  /** 多选模式 */
  const [selectable, setSelectable] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  /** 高亮会话（由 UndoToast 等跳转触发） */
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeName, setMergeName] = useState('');
  /** 增强恢复对话框状态 */
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoringSession, setRestoringSession] = useState<ArchivedSession | null>(null);
  /** 增强重命名对话框状态 */
  const [renamingDialogOpen, setRenamingDialogOpen] = useState(false);
  const [renamingSession, setRenamingSession] = useState<ArchivedSession | null>(null);
  /** 折叠展开状态 */
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  /** 搜索过滤状态 */
  const [searchQuery, setSearchQuery] = useState('');
  const loadAllTabs = useTabsStore((s) => s.loadAllTabs);
  const tabCount = useTabsStore((s) => s.tabs.length);
  const { t, locale } = useT();

  /** 视图首次挂载时刷新数据 */
  useEffect(() => {
    void refreshSessions();
  }, []);

  /**
   * 监听 app:highlight-session 自定义事件
   */
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ sessionId?: string }>).detail;
      if (detail?.sessionId !== undefined) {
        setHighlightId(detail.sessionId);
        window.setTimeout(() => setHighlightId(null), 3000);
      }
    };
    window.addEventListener(APP_EVENTS.highlightSession, handler);
    return () => window.removeEventListener(APP_EVENTS.highlightSession, handler);
  }, []);

  /** 拼音匹配函数（懒加载） */
  const enablePinyin = useSettingsStore((s) => s.settings.searchEnablePinyin ?? true);
  const [pinyinMatchFn, setPinyinMatchFn] = useState<((text: string, query: string) => boolean) | null>(null);

  useEffect(() => {
    if (!enablePinyin || pinyinMatchFn !== null) return;
    void (async () => {
      const { pinyinMatch } = await import('@/shared/utils/pinyin');
      setPinyinMatchFn(() => pinyinMatch);
    })();
  }, [enablePinyin, pinyinMatchFn]);

  /** 搜索过滤逻辑：使用 useMemo 同步计算，避免 useEffect 延迟一帧 */
  const isSearching = searchQuery.trim().length > 0;
  const { filteredSessions, matchedTabIndexes } = useMemo(() => {
    if (!isSearching) {
      return { filteredSessions: sessions, matchedTabIndexes: new Map<string, Set<number>>() };
    }
    const query = searchQuery.toLowerCase().trim();
    const result: ArchivedSession[] = [];
    const matched = new Map<string, Set<number>>();
    for (const session of sessions) {
      const matchedIdxs = new Set<number>();
      // 会话名匹配
      const nameMatch = session.name.toLowerCase().includes(query) ||
        (enablePinyin && pinyinMatchFn !== null && pinyinMatchFn(session.name, query));
      // 标签页匹配
      for (let i = 0; i < session.tabs.length; i++) {
        const tab = session.tabs[i];
        if (!tab) continue;
        const titleMatch = tab.title?.toLowerCase().includes(query) ?? false;
        const pinyinTitleMatch = enablePinyin && pinyinMatchFn !== null && tab.title && pinyinMatchFn(tab.title, query);
        const urlMatch = tab.url.toLowerCase().includes(query);
        if (titleMatch || pinyinTitleMatch || urlMatch) {
          matchedIdxs.add(i);
        }
      }
      if (nameMatch || matchedIdxs.size > 0) {
        result.push(session);
        matched.set(session.id, matchedIdxs);
      }
    }
    return { filteredSessions: result, matchedTabIndexes: matched };
  }, [sessions, isSearching, searchQuery, enablePinyin, pinyinMatchFn]);

  /** 搜索时自动展开匹配的会话 */
  useEffect(() => {
    if (!isSearching) return;
    const newExpanded = new Set<string>();
    for (const session of filteredSessions) {
      if (matchedTabIndexes.has(session.id)) {
        newExpanded.add(session.id);
      }
    }
    setExpandedSessions(newExpanded);
  }, [isSearching, filteredSessions, matchedTabIndexes]);

  const handleRestore = (id: string) => {
    const session = sessions.find(s => s.id === id);
    if (session) {
      setRestoringSession(session);
      setRestoreDialogOpen(true);
    }
  };

  const handleEnhancedRestoreComplete = async (outcome: RestoreOutcome) => {
    await refreshSessions();
    const total = restoringSession?.tabCount ?? outcome.restored;
    void track('archive_restore', { restored: outcome.restored, total });
    if (outcome.cancelled) {
      feedback.info(t('archive.restoreCancelled', { restored: outcome.restored }));
    } else if (outcome.restored === total) {
      feedback.success(t('archive.restoredOk'));
    } else {
      feedback.warning(t('archive.restorePartial', { restored: outcome.restored, total }));
    }
    setRestoreDialogOpen(false);
    setRestoringSession(null);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSession(id);
      void track('archive_delete');
      await refreshSessions();
    } catch (err) {
      feedback.error(t('archive.deleteFailed'), err);
    }
  };

  /** 分享单个会话为 JSON */
  const handleShare = async (id: string) => {
    const payload = await exportSingleSession(id);
    if (payload === null) {
      feedback.error(t('archive.shareFailed'));
      return;
    }
    try {
      const blob = new Blob([payload.content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = payload.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      feedback.success(t('archive.shareOk'));
    } catch (err) {
      feedback.error(t('archive.shareFailed'), err);
    }
  };

  /** 合并多个会话 */
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const cancelSelect = () => {
    setSelectable(false);
    setSelectedIds(new Set());
  };

  const handleSelectModeChange = (enabled: boolean) => {
    if (enabled) {
      setSelectable(true);
      return;
    }
    cancelSelect();
  };

  const handleOpenMerge = async (ids: string[]) => {
    if (ids.length < 2) {
      feedback.warning(t('archive.mergeNeedTwo'));
      return;
    }
    setSelectedIds(new Set(ids));
    setMergeName(t('archive.mergedDefaultName'));
    setMergeOpen(true);
  };

  const handleConfirmMerge = async () => {
    try {
      const newSession = await mergeSessions(Array.from(selectedIds), mergeName);
      void track('archive_merge', { count: selectedIds.size });
      await refreshSessions();
      setMergeOpen(false);
      cancelSelect();
      feedback.success(t('archive.mergedOk', { count: newSession.tabCount }));
      void useMetadataStore.getState().pushActivity({
        id: `merge-${newSession.id}`,
        type: 'archive',
        ts: Date.now(),
        summary: t('archive.mergedActivity', { count: newSession.tabCount, name: newSession.name }),
      });
    } catch (err) {
      feedback.error(t('archive.mergeFailed'), err);
    }
  };

  const startRenaming = (session: ArchivedSession) => {
    setRenamingSession(session);
    setRenamingDialogOpen(true);
  };

  const handleOpenSingle = async (tab: { url: string }) => {
    if (!isSafeExternalUrl(tab.url)) {
      feedback.error(t('archive.restoreFailed'));
      return;
    }
    try {
      const currentWindow = await getCurrentWindow();
      await createTab({ url: tab.url, windowId: currentWindow?.id, active: true });
    } catch (err) {
      feedback.error(t('archive.restoreFailed'), err);
    }
  };

  const handleArchiveCurrent = async () => {
    if (archivingCurrent || tabCount === 0) return;
    setArchivingCurrent(true);
    try {
      const result = await archiveAllTabs();
      void track('archive_create', { count: result.archivedCount });
      const { archivedCount, closedCount, session } = result;
      // 同步记录到「插件历史」时间线，带上足够的 undo 上下文
      void appendHistoryEvent({
        type: 'archive_create',
        title: session.name,
        extra: { count: archivedCount, sessionId: session.id },
        undoable: true,
        undoContext: { sessionId: session.id },
      });
      await loadAllTabs({ silent: true });
      await refreshSessions();

      const snapshots = session.tabs.map((tab) => ({
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl,
        windowId: 0,
        pinned: tab.pinned,
      }));
      const failCount = archivedCount - closedCount;
      const subNote = failCount > 0 ? t('archive.closeIncomplete', { count: failCount }) : '';
      void useUndoStore.getState().addRecord(
        snapshots,
        t('archive.archivedRichToast', { count: archivedCount, name: session.name }),
        { archivedSessionId: session.id, subNote },
      );

      void useMetadataStore.getState().pushActivity({
        id: `archive-${session.id}`,
        type: 'archive',
        ts: Date.now(),
        summary: t('activity.archived', { count: archivedCount, name: session.name }),
        primaryAction: {
          id: 'view',
          label: t('activity.viewArchive'),
          kind: 'open_archive',
          payload: session.id,
        },
      });
    } catch (err) {
      feedback.error(t('archive.archiveFailed'), err);
    } finally {
      setArchivingCurrent(false);
    }
  };

  /** 全部展开/折叠 */
  const expandAll = () => {
    const allIds = new Set(sessions.map(session => session.id));
    setExpandedSessions(allIds);
  };

  const collapseAll = () => {
    setExpandedSessions(new Set());
  };

  return (
    <div className="archive-view">
      {/* 标题栏 */}
      <div className="app-archive-header">
        <div className="app-archive-header__badge">
          <Save size={ICON_SIZE.LARGE} className="app-archive-header__icon" />
        </div>
        <span className="app-archive-header__title">{t('archive.title')}</span>
        <Space size={4}>
          <BatchOperationsMenu
            selectedIds={selectedIds}
            totalCount={sessions.length}
            selectable={selectable}
            onToggleSelectMode={handleSelectModeChange}
            onBatchRestore={async (ids) => {
              for (const id of ids) {
                await handleRestore(id);
              }
            }}
            onBatchDelete={async (ids) => {
              for (const id of ids) {
                await handleDelete(id);
              }
            }}
            onMergeSessions={handleOpenMerge}
            onExportSessions={async (ids) => {
              for (const id of ids) {
                await handleShare(id);
              }
            }}
            onClearAll={async () => {
              for (const session of sessions) {
                await handleDelete(session.id);
              }
            }}
          />
          <Button
            type="primary"
            icon={<Plus size={ICON_SIZE.MEDIUM} />}
            loading={archivingCurrent}
            disabled={tabCount === 0}
            onClick={() => { void handleArchiveCurrent(); }}
            title={t('header.tabCount', { count: tabCount })}
          >
            {t('header.archive')}
          </Button>
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        icon={<Info size={ICON_SIZE.MEDIUM} />}
        description={t('archive.description')}
        className="app-archive-alert"
      />

      {/* 搜索过滤 */}
      <div className="app-archive-search">
        <Input.Search
          className="app-archive-search__input"
          placeholder={t('archive.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
        />
      </div>

      {/* 搜索结果统计 */}
      {searchQuery.trim() && (
        <div className="app-archive-search-result">
          {t('archive.searchResults', {
            count: filteredSessions.length,
            total: sessions.length
          })}
        </div>
      )}

      {/* 全部展开/折叠 */}
      {filteredSessions.length > 0 && (
        <div className="app-archive-expand-actions">
          <Button
            size="small"
            type="text"
            onClick={expandAll}
            disabled={expandedSessions.size === filteredSessions.length}
          >
            {t('archive.expandAll')}
          </Button>
          <Button
            size="small"
            type="text"
            onClick={collapseAll}
            disabled={expandedSessions.size === 0}
          >
            {t('archive.collapseAll')}
          </Button>
        </div>
      )}

      {loading ? (
        <div className="app-archive-loading">
          <div className="app-archive-loading__content">
            <Spin />
            <span className="app-archive-loading__copy">{t('archive.loading')}</span>
          </div>
        </div>
      ) : filteredSessions.length === 0 ? (
        <FeatureEmptyState
          title={t('archive.empty')}
          description={t('archive.emptyHint')}
          icon={<Inbox size={ICON_SIZE.HERO} />}
          hints={[
            t('archive.emptyHint1'),
            t('archive.emptyHint2'),
            t('archive.emptyHint3'),
          ]}
          actions={[{
            text: t('archive.archiveCurrentWindow'),
            onClick: () => void archiveAllTabs(),
            type: 'primary',
          }]}
        />
      ) : (
        <List
          dataSource={filteredSessions}
          renderItem={(session) => (
            <div
              className={`app-archive-session-shell${highlightId === session.id ? ' is-highlighted' : ''}`}
            >
              <SessionItem
                session={session}
                isExpanded={expandedSessions.has(session.id)}
                locale={locale}
                onToggleExpand={() => {
                  setExpandedSessions(prev => {
                    const newSet = new Set(prev);
                    if (newSet.has(session.id)) {
                      newSet.delete(session.id);
                    } else {
                      newSet.add(session.id);
                    }
                    return newSet;
                  });
                }}
                onRestore={(id) => { void handleRestore(id); }}
                onDelete={(id) => { void handleDelete(id); }}
                onStartRenaming={startRenaming}
                onOpenSingle={(tab) => { void handleOpenSingle(tab); }}
                onShare={(id) => { void handleShare(id); }}
                selectable={selectable}
                selected={selectedIds.has(session.id)}
                onToggleSelect={toggleSelect}
                highlightQuery={isSearching ? searchQuery : undefined}
                matchedTabIndexes={matchedTabIndexes.get(session.id)}
              />
            </div>
          )}
        />
      )}

      {/* 合并会话 Modal */}
      <Modal
        open={mergeOpen}
        rootClassName="app-archive-merge-modal"
        title={t('archive.mergeTitle')}
        onCancel={() => setMergeOpen(false)}
        onOk={() => void handleConfirmMerge()}
        okText={t('archive.merge')}
        cancelText={t('archive.cancel')}
        centered
      >
        <p className="app-archive-merge-copy">
          {t('archive.mergeDesc', { count: selectedIds.size })}
        </p>
        <Input
          value={mergeName}
          onChange={(e) => setMergeName(e.target.value)}
          placeholder={t('archive.mergeNamePlaceholder')}
        />
      </Modal>

      {/* 增强恢复对话框 */}
      {restoringSession && (
        <EnhancedRestoreDialog
          open={restoreDialogOpen}
          sessionId={restoringSession.id}
          sessionName={restoringSession.name}
          tabCount={restoringSession.tabCount}
          onClose={() => {
            setRestoreDialogOpen(false);
            setRestoringSession(null);
          }}
          onRestoreComplete={handleEnhancedRestoreComplete}
        />
      )}

      {/* 增强重命名对话框 */}
      {renamingSession && (
        <EnhancedRenameDialog
          open={renamingDialogOpen}
          sessionId={renamingSession.id}
          currentName={renamingSession.name}
          tabCount={renamingSession.tabCount}
          tabUrls={renamingSession.tabs.map(tab => tab.url)}
          onClose={() => {
            setRenamingDialogOpen(false);
            setRenamingSession(null);
          }}
          onRenameConfirm={async (id, newName) => {
            try {
              await renameSession(id, newName);
              await refreshSessions();
              feedback.success(t('archive.renameOk'));
            } catch (err) {
              feedback.error(t('archive.rename'), err);
            }
          }}
        />
      )}
    </div>
  );
}
