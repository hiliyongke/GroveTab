/**
 * ArchivePanel — 归档会话浮层（antd 版）
 *
 * 升级点：
 *   - 基于 antd Modal，带 title、footer=null 自定义内容
 *   - Session 行使用 List 组件 + 统一 action 区
 *   - 新增"归档当前窗口"主操作按钮
 */

import { useState, useSyncExternalStore, useCallback } from 'react';
import {
  UndoOutlined,
  DeleteOutlined,
  InboxOutlined,
  PlusOutlined,
  SaveOutlined,
  InfoCircleOutlined,
  RightOutlined,
  LinkOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { Alert, Modal, Button, List, Empty, Spin, Tooltip, Input, theme } from 'antd';
import type { ArchivedSession, ArchivedTab } from '@/shared/types';
import {
  getArchivedSessions,
  restoreSession,
  deleteSession,
  renameSession,
  archiveAllTabs,
} from '@/services';
import { createTab, getCurrentWindow } from '@/chrome';
import { format } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import { useT } from '@/shared/i18n';
import { useTabsStore } from '@/store';
import { feedback } from '@/shared/ui/feedback';

// 简易外部 store 同步归档列表
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
refreshSessions();

interface ArchivePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * 归档面板
 */
export function ArchivePanel({ open, onOpenChange }: ArchivePanelProps) {
  const sessions = useSyncExternalStore(subscribeSessions, getSessionsSnapshot);
  const initialized = useSyncExternalStore(subscribeSessions, getSessionsInitialized);
  const loading = !initialized;
  const [archivingCurrent, setArchivingCurrent] = useState(false);
  /**
   * 受控展开：同一时间只展开一条会话，保持 UI 整洁。
   * 点击同一条会折叠；点击另一条则切换到新的一条。
   */
  const [expandedId, setExpandedId] = useState<string | null>(null);
  /** 正在重命名的会话 ID，null 表示不在重命名态 */
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState('');
  const loadAllTabs = useTabsStore((s) => s.loadAllTabs);
  const tabCount = useTabsStore((s) => s.tabs.length);
  const { t, locale } = useT();
  const { token } = theme.useToken();

  // 面板打开时主动刷新一次；关闭时重置展开状态。
  // 用 Modal 的 afterOpenChange 回调取代 useEffect 中的同步 setState，
  // 这是一次真实的 UI 事件，既符合 React 19 的副作用纪律，也能保证
  // 读到的是 Modal 挂载/卸载后的最终 open 值。
  const handleAfterOpenChange = useCallback(
    (visible: boolean) => {
      if (visible) {
        refreshSessions();
      } else {
        setExpandedId(null);
      }
    },
    [refreshSessions],
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

  /**
   * 重命名确认：调用 renameSession 后刷新列表并退出编辑态。
   * 空值或重复值直接取消，不调 API。
   */
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

  /** 进入重命名态：预填当前名称 + 聚焦 */
  const startRenaming = (session: ArchivedSession) => {
    setRenamingId(session.id);
    setRenamingValue(session.name);
  };

  /**
   * 打开归档里的单个 tab——不动归档记录本身，仅把那一条拎出来看。
   * 与「恢复整组」的区别：整组会一次性还原并可选择是否保留归档；单个打开就是"预览/提取"。
   */
  const handleOpenSingle = async (tab: ArchivedTab) => {
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
      const { closedCount } = await archiveAllTabs();
      // 归档是批量关闭，和合并去重同理：走静默刷新，避免主视图闪一次 Spin
      await loadAllTabs({ silent: true });
      await refreshSessions();
      feedback.success(t('archive.archivedOk', { count: closedCount }));
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
      styles={{
        body: { padding: 0 },
      }}
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
            <SaveOutlined style={{ fontSize: 14 }} />
          </div>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{t('archive.title')}</span>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            loading={archivingCurrent}
            disabled={tabCount === 0}
            onClick={handleArchiveCurrent}
            title={t('header.tabCount', { count: tabCount })}
          >
            {t('header.archive')}
          </Button>
        </div>
      }
    >
      {/* 内容区 */}
      <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '12px 24px 20px' }}>
        {/* 首行固定一条说明，帮助第一次打开的用户理解「归档」到底在干什么 */}
        <Alert
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          message={t('archive.description')}
          style={{
            marginBottom: 12,
            borderRadius: token.borderRadius,
            fontSize: 12.5,
            lineHeight: 1.6,
          }}
        />
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Spin tip={t('archive.loading')}>
              <div style={{ minHeight: 48 }} />
            </Spin>
          </div>
        ) : sessions.length === 0 ? (
          <Empty
            image={<InboxOutlined style={{ fontSize: 48, color: token.colorTextTertiary }} />}
            imageStyle={{ height: 60 }}
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
            renderItem={(session) => {
              const isExpanded = expandedId === session.id;
              return (
                <List.Item
                  key={session.id}
                  style={{
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    padding: '12px 0',
                  }}
                >
                  {/* 主行：展开箭头 + 基本信息 + 操作 */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      width: '100%',
                      cursor: 'pointer',
                    }}
                    onClick={() => setExpandedId(isExpanded ? null : session.id)}
                  >
                    {/* 展开箭头 */}
                    <Tooltip title={isExpanded ? t('archive.collapse') : t('archive.expand')}>
                      <Button
                        type="text"
                        size="small"
                        icon={
                          <RightOutlined
                            style={{
                              fontSize: 11,
                              transition: 'transform 0.2s',
                              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)',
                            }}
                          />
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedId(isExpanded ? null : session.id);
                        }}
                      />
                    </Tooltip>

                    {/* 图标 */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 36,
                        height: 36,
                        borderRadius: token.borderRadius,
                        background: token.colorFillSecondary,
                        color: token.colorTextTertiary,
                        flexShrink: 0,
                      }}
                    >
                      <SaveOutlined style={{ fontSize: 16 }} />
                    </div>

                    {/* 标题 + 描述 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {renamingId === session.id ? (
                        <Input
                          size="small"
                          value={renamingValue}
                          onChange={(e) => setRenamingValue(e.target.value)}
                          onPressEnter={() => handleRenameConfirm(session.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              e.stopPropagation();
                              setRenamingId(null);
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          style={{ fontSize: 13, fontWeight: 500 }}
                          autoFocus
                        />
                      ) : (
                        <div
                          style={{
                            fontSize: 13.5,
                            fontWeight: 500,
                            color: token.colorText,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {session.name}
                        </div>
                      )}
                      <div style={{ fontSize: 11.5, color: token.colorTextTertiary, marginTop: 2 }}>
                        {t('archive.tabCount', { count: session.tabCount })}
                        <span style={{ margin: '0 6px', color: token.colorBorder }}>·</span>
                        {format(session.createdAt, 'MMM d, HH:mm', {
                          locale: locale === 'zh-CN' ? zhCN : enUS,
                        })}
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div
                      style={{ display: 'flex', gap: 4, flexShrink: 0 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Tooltip title={t('archive.restore')}>
                        <Button
                          type="text"
                          icon={<UndoOutlined />}
                          onClick={() => handleRestore(session.id)}
                        />
                      </Tooltip>
                      <Tooltip title={t('archive.rename')}>
                        <Button
                          type="text"
                          icon={<EditOutlined />}
                          onClick={() => startRenaming(session)}
                        />
                      </Tooltip>
                      <Tooltip title={t('archive.delete')}>
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleDelete(session.id)}
                        />
                      </Tooltip>
                    </div>
                  </div>

                  {/* 展开详情：tab 列表 */}
                  {isExpanded && (
                    <div
                      style={{
                        marginTop: 8,
                        marginLeft: 40, // 与主行图标左侧对齐
                        padding: 8,
                        background: token.colorFillQuaternary,
                        borderRadius: token.borderRadius,
                        maxHeight: 260,
                        overflowY: 'auto',
                      }}
                    >
                      {session.tabs.length === 0 ? (
                        <div
                          style={{
                            padding: 16,
                            textAlign: 'center',
                            fontSize: 12,
                            color: token.colorTextTertiary,
                          }}
                        >
                          {t('archive.empty')}
                        </div>
                      ) : (
                        session.tabs.map((tab, idx) => (
                          <div
                            key={`${session.id}-${idx}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '6px 8px',
                              borderRadius: token.borderRadiusSM,
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = token.colorFillSecondary;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            {/* favicon，失败则隐藏 */}
                            {tab.favIconUrl ? (
                              <img
                                src={tab.favIconUrl}
                                alt=""
                                width={14}
                                height={14}
                                style={{ flexShrink: 0, borderRadius: 2 }}
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                                }}
                              />
                            ) : (
                              <div style={{ width: 14, height: 14, flexShrink: 0 }} />
                            )}

                            {/* 标题 + hostname */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 12.5,
                                  color: token.colorText,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={tab.title || tab.url}
                              >
                                {tab.title || tab.url}
                              </div>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: token.colorTextTertiary,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {tab.hostname || tab.url}
                              </div>
                            </div>

                            {/* 单独打开 */}
                            <Tooltip title={t('archive.openTab')}>
                              <Button
                                type="text"
                                size="small"
                                icon={<LinkOutlined />}
                                onClick={() => handleOpenSingle(tab)}
                              />
                            </Tooltip>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </List.Item>
              );
            }}
          />
        )}
      </div>
    </Modal>
  );
}
