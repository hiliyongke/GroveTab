/**
 * ArchivePanel — 归档会话浮层（antd 版）
 *
 * 升级点：
 *   - 基于 antd Modal，带 title、footer=null 自定义内容
 *   - Session 行拆分为独立组件 SessionItem
 *   - 新增"归档当前窗口"主操作按钮
 */

import { useState, useSyncExternalStore, useCallback, useEffect } from 'react';
import {
  Plus,
  Save,
  Info,
  Inbox,
  GitMerge,
  CheckSquare,
} from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { Alert, Modal, Button, List, Empty, Spin, Input, theme, Space } from 'antd';
import type { ArchivedSession } from '@/shared/types';
import {
  getArchivedSessions,
  restoreSession,
  deleteSession,
  renameSession,
  archiveAllTabs,
  mergeSessions,
  exportSingleSession,
} from '@/services';
import { createTab, getCurrentWindow } from '@/chrome';
import { useT } from '@/shared/i18n';
import { useTabsStore, useUndoStore, useMetadataStore } from '@/store';
import { feedback } from '@/shared/ui/feedback';
import { SessionItem } from './components/SessionItem';
import { iconColor } from '@/shared/utils/icon-colors';

/* ---------- 简易外部 store 同步归档列表 ---------- */
let sessionsCache: ArchivedSession[] = [];
let sessionsInitialized = false;
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
function getSessionsInitialized() {
  return sessionsInitialized;
}
function notifySessionsListeners() {
  sessionsListeners.forEach((l) => l());
}
async function refreshSessions() {
  sessionsCache = await getArchivedSessions();
  sessionsInitialized = true;
  notifySessionsListeners();
}

// 模块加载时初始化
void refreshSessions();

interface ArchivePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSessionsChange?: (sessions: ArchivedSession[]) => void;
}

export function ArchivePanel({ open, onOpenChange, onSessionsChange }: ArchivePanelProps) {
  const sessions = useSyncExternalStore(subscribeSessions, getSessionsSnapshot);
  const initialized = useSyncExternalStore(subscribeSessions, getSessionsInitialized);
  const loading = !initialized;
  const [archivingCurrent, setArchivingCurrent] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState('');
  /** v1.0 封板：多选模式 */
  const [selectable, setSelectable] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  /** 高亮会话（由 UndoToast 等跳转触发） */
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeName, setMergeName] = useState('');
  const loadAllTabs = useTabsStore((s) => s.loadAllTabs);
  const tabCount = useTabsStore((s) => s.tabs.length);
  const { t, locale } = useT();
  const { token } = theme.useToken();

  useEffect(() => {
    if (!initialized) return;
    onSessionsChange?.(sessions);
  }, [initialized, onSessionsChange, sessions]);

  /**
   * 监听 canopy:highlight-session 自定义事件，来自 UndoToast / ActivityStrip 的跳转。
   */
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ sessionId?: string }>).detail;
      if (detail?.sessionId !== undefined) {
        setHighlightId(detail.sessionId);
        setExpandedId(detail.sessionId);
        // 3s 后自动移除高亮
        window.setTimeout(() => setHighlightId(null), 3000);
      }
    };
    window.addEventListener('canopy:highlight-session', handler as EventListener);
    return () => window.removeEventListener('canopy:highlight-session', handler as EventListener);
  }, []);

  const handleAfterOpenChange = useCallback(
    (visible: boolean) => {
      if (visible) {
        void refreshSessions();
      } else {
        setExpandedId(null);
      }
    },
    [],
  );

  const handleRestore = async (id: string) => {
    try {
      await restoreSession(id);
      await refreshSessions();
      feedback.success(t('archive.restoredOk'));
    } catch (err) {
      feedback.error(t('archive.restoreFailed'), err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSession(id);
      await refreshSessions();
    } catch (err) {
      feedback.error(t('archive.deleteFailed'), err);
    }
  };

  /** v1.0 封板：分享单个会话为 JSON */
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

  /** v1.0 封板：合并多个会话 */
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

  const handleOpenMerge = () => {
    if (selectedIds.size < 2) {
      feedback.warning(t('archive.mergeNeedTwo'));
      return;
    }
    setMergeName(t('archive.mergedDefaultName'));
    setMergeOpen(true);
  };

  const handleConfirmMerge = async () => {
    try {
      const newSession = await mergeSessions(Array.from(selectedIds), mergeName);
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

  const handleRenameConfirm = async (id: string) => {
    const newName = renamingValue.trim();
    if (!newName) {
      setRenamingId(null);
      return;
    }
    try {
      await renameSession(id, newName);
      await refreshSessions();
      feedback.success(t('archive.renameOk'));
    } catch (err) {
      feedback.error(t('archive.rename'), err);
    }
    setRenamingId(null);
  };

  const startRenaming = (session: ArchivedSession) => {
    setRenamingId(session.id);
    setRenamingValue(session.name);
  };

  const handleOpenSingle = async (tab: { url: string }) => {
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
      const { archivedCount, closedCount, session } = result;
      await loadAllTabs({ silent: true });
      await refreshSessions();

      /**
       * v1.0 封板：归档走 Undo ring buffer，使 UndoToast 富交互能接管展示。
       * snapshots 用于单击"撤销"时恢复原 Tab。
       */
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

      /** 推 Activity Strip 记录 */
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

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      afterOpenChange={handleAfterOpenChange}
      footer={null}
      width={680}
      centered={false}
      destroyOnHidden
      styles={{ body: { padding: 0 } }}
      style={{ top: '10vh' }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingRight: 32 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: token.borderRadius,
              background: token.colorPrimaryBg,
              color: token.colorPrimary,
            }}
          >
            <Save size={ICON_SIZE.MEDIUM} style={{ color: iconColor('archive', token) }} />
          </div>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{t('archive.title')}</span>
          <Space size={4}>
            {selectable ? (
              <>
                <span style={{ fontSize: 12, color: token.colorTextSecondary }}>
                  {t('archive.selectedCount', { count: selectedIds.size })}
                </span>
                <Button
                  size="small"
                  icon={<GitMerge size={ICON_SIZE.DEFAULT} />}
                  onClick={handleOpenMerge}
                  disabled={selectedIds.size < 2}
                >
                  {t('archive.merge')}
                </Button>
                <Button size="small" type="text" onClick={cancelSelect}>
                  {t('archive.cancelSelect')}
                </Button>
              </>
            ) : (
              <Button
                size="small"
                type="text"
                icon={<CheckSquare size={ICON_SIZE.DEFAULT} />}
                onClick={() => setSelectable(true)}
              >
                {t('archive.selectMode')}
              </Button>
            )}
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
      }
    >
      <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '12px 24px 20px' }}>
        <Alert
          type="info"
          showIcon
          icon={<Info size={ICON_SIZE.MEDIUM} />}
          description={t('archive.description')}
          style={{
            marginBottom: 12,
            borderRadius: token.borderRadius,
            fontSize: 12.5,
            lineHeight: 1.6,
          }}
        />
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <Spin />
              <span style={{ fontSize: 12, color: token.colorTextSecondary }}>{t('archive.loading')}</span>
            </div>
          </div>
        ) : sessions.length === 0 ? (
          <Empty
                image={<Inbox size={ICON_SIZE.HERO} style={{ color: token.colorTextTertiary }} />}
            description={
              <div>
                <p style={{ fontSize: 13.5, fontWeight: 500, color: token.colorText, margin: 0 }}>
                  {t('archive.empty')}
                </p>
                <p
                  style={{
                    fontSize: 12,
                    color: token.colorTextTertiary,
                    marginTop: 4,
                    marginBottom: 0,
                  }}
                >
                  {t('archive.emptyHint')}
                </p>
              </div>
            }
            style={{ padding: '32px 0' }}
          />
        ) : (
          <List
            dataSource={sessions}
            renderItem={(session) => (
              <div
                style={{
                  outline: highlightId === session.id ? `2px solid ${token.colorPrimary}` : 'none',
                  outlineOffset: 2,
                  borderRadius: token.borderRadius,
                  transition: 'outline 200ms',
                }}
              >
                <SessionItem
                  session={session}
                  isExpanded={expandedId === session.id}
                  isRenaming={renamingId === session.id}
                  renamingValue={renamingValue}
                  locale={locale}
                  onToggleExpand={() =>
                    setExpandedId((prev) => (prev === session.id ? null : session.id))
                  }
                  onRestore={(id) => { void handleRestore(id); }}
                  onDelete={(id) => { void handleDelete(id); }}
                  onStartRenaming={startRenaming}
                  onRenameConfirm={(id) => { void handleRenameConfirm(id); }}
                  onRenameChange={setRenamingValue}
                  onRenameCancel={() => setRenamingId(null)}
                  onOpenSingle={(tab) => { void handleOpenSingle(tab); }}
                  onShare={(id) => { void handleShare(id); }}
                  selectable={selectable}
                  selected={selectedIds.has(session.id)}
                  onToggleSelect={toggleSelect}
                />
              </div>
            )}
          />
        )}
      </div>

      {/* 合并会话 Modal */}
      <Modal
        open={mergeOpen}
        title={t('archive.mergeTitle')}
        onCancel={() => setMergeOpen(false)}
        onOk={() => void handleConfirmMerge()}
        okText={t('archive.merge')}
        cancelText={t('archive.cancel')}
        centered
      >
        <p style={{ margin: '0 0 12px', fontSize: 13, color: token.colorTextSecondary }}>
          {t('archive.mergeDesc', { count: selectedIds.size })}
        </p>
        <Input
          value={mergeName}
          onChange={(e) => setMergeName(e.target.value)}
          placeholder={t('archive.mergeNamePlaceholder')}
        />
      </Modal>
    </Modal>
  );
}
