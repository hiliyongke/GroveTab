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
  PlusOutlined,
  SaveOutlined,
  InfoCircleOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { Alert, Modal, Button, List, Empty, Spin, theme } from 'antd';
import type { ArchivedSession } from '@/shared/types';
import {
  getArchivedSessions,
  restoreSession,
  deleteSession,
  renameSession,
  archiveAllTabs,
} from '@/services';
import { createTab, getCurrentWindow } from '@/chrome';
import { useT } from '@/shared/i18n';
import { useTabsStore } from '@/store';
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
  const loadAllTabs = useTabsStore((s) => s.loadAllTabs);
  const tabCount = useTabsStore((s) => s.tabs.length);
  const { t, locale } = useT();
  const { token } = theme.useToken();

  useEffect(() => {
    if (!initialized) return;
    onSessionsChange?.(sessions);
  }, [initialized, onSessionsChange, sessions]);

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
      const { archivedCount, closedCount } = await archiveAllTabs();
      await loadAllTabs({ silent: true });
      await refreshSessions();
      feedback.success(t('archive.archivedOk', { count: archivedCount }));
      if (closedCount < archivedCount) {
        feedback.warning(t('archive.closeIncomplete', { count: archivedCount - closedCount }));
      }
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
            <SaveOutlined style={{ fontSize: 14, color: iconColor('archive', token) }} />
          </div>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{t('archive.title')}</span>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            loading={archivingCurrent}
            disabled={tabCount === 0}
            onClick={() => { void handleArchiveCurrent(); }}
            title={t('header.tabCount', { count: tabCount })}
          >
            {t('header.archive')}
          </Button>
        </div>
      }
    >
      <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '12px 24px 20px' }}>
        <Alert
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
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
            image={<InboxOutlined style={{ fontSize: 48, color: token.colorTextTertiary }} />}
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
              />
            )}
          />
        )}
      </div>
    </Modal>
  );
}
