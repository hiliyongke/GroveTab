/**
 * DuplicatePreviewModal —— 重复合并预览 Modal（需求 6）
 *
 * 功能：
 *   · 按重复分组展示所有组
 *   · 每组内列出全部重复 Tab（title + url + 窗口 + 打开时间）
 *   · 默认勾选"最旧一条"作为保留项
 *   · 支持"全不勾选" / "全部勾选最旧" 快捷操作
 *   · 点击"合并"：批量关闭未勾选 Tab，单条 Undo + Toast
 *
 * 输入：外部传入 dupGroups + onClose 回调。
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { App, Button, Modal, Space, Tag, Typography, theme } from 'antd';
import type { LiveTab } from '@/shared/types';
import type { DupGroup } from '@/shared/utils/dedupe';
import { useTabsStore, useMetadataStore } from '@/store';
import { nanoid } from 'nanoid';
import { useT } from '@/shared/i18n';

const { Text } = Typography;

interface DuplicatePreviewModalProps {
  open: boolean;
  dupGroups: DupGroup[];
  onClose: () => void;
}

/** 选择最旧（lastAccessed 最小；若相同取 id 最小）作为默认保留项 */
function pickDefaultKeeper(group: DupGroup): number {
  const sorted = [...group.tabs].sort(
    (a, b) => (a.lastAccessed || 0) - (b.lastAccessed || 0) || a.id - b.id,
  );
  return sorted[0]?.id ?? group.tabs[0].id;
}

function formatOpenedAt(ts: number): string {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function DuplicatePreviewModal({ open, dupGroups, onClose }: DuplicatePreviewModalProps) {
  const { t } = useT();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const closeMultipleTabs = useTabsStore((s) => s.closeMultipleTabs);
  const loadAllTabs = useTabsStore((s) => s.loadAllTabs);
  const pushActivity = useMetadataStore((s) => s.pushActivity);

  /** 分组 id → 保留的 tab.id */
  const [keepers, setKeepers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  // 按 canonicalUrl 过滤掉组内只剩 1 条的（需求 6.7：自动从 Modal 中移除零项组）
  const effectiveGroups = useMemo(
    () => dupGroups.filter((g) => g.tabs.length >= 2),
    [dupGroups],
  );

  // 初始化默认保留项
  useEffect(() => {
    if (!open) return;
    const next: Record<string, number> = {};
    for (const group of effectiveGroups) {
      next[group.canonicalUrl] = pickDefaultKeeper(group);
    }
    setKeepers(next);
  }, [open, effectiveGroups]);

  const { closeCount, keepCount } = useMemo(() => {
    let close = 0;
    let keep = 0;
    for (const group of effectiveGroups) {
      const keeperId = keepers[group.canonicalUrl];
      for (const tab of group.tabs) {
        if (tab.id === keeperId) keep += 1;
        else close += 1;
      }
    }
    return { closeCount: close, keepCount: keep };
  }, [effectiveGroups, keepers]);

  const handleKeeperChange = useCallback((canonicalUrl: string, tabId: number) => {
    setKeepers((prev) => ({ ...prev, [canonicalUrl]: tabId }));
  }, []);

  const handleKeepAllOldest = useCallback(() => {
    const next: Record<string, number> = {};
    for (const group of effectiveGroups) {
      next[group.canonicalUrl] = pickDefaultKeeper(group);
    }
    setKeepers(next);
  }, [effectiveGroups]);

  const handleKeepNone = useCallback(() => {
    setKeepers({});
  }, []);

  const handleMerge = useCallback(async () => {
    if (busy) return;
    const toClose: number[] = [];
    for (const group of effectiveGroups) {
      const keeperId = keepers[group.canonicalUrl];
      for (const tab of group.tabs) {
        if (tab.id !== keeperId) toClose.push(tab.id);
      }
    }
    if (toClose.length === 0) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      await closeMultipleTabs(toClose);
      await loadAllTabs();
      message.success(t('dedup.mergedToast', { count: toClose.length }));
      await pushActivity({
        id: nanoid(6),
        type: 'dedup_merge',
        ts: Date.now(),
        summary: t('activity.dedupMerged', { count: toClose.length }),
      });
      onClose();
    } catch (err) {
      console.warn('[DuplicatePreviewModal] merge failed', err);
      message.error(t('dedup.mergedFailed'));
    } finally {
      setBusy(false);
    }
  }, [busy, effectiveGroups, keepers, closeMultipleTabs, loadAllTabs, message, onClose, pushActivity, t]);

  return (
    <Modal
      open={open}
      title={t('dedup.previewTitle')}
      width={720}
      onCancel={onClose}
      centered
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button size="small" onClick={handleKeepAllOldest}>
              {t('dedup.keepOldest')}
            </Button>
            <Button size="small" onClick={handleKeepNone}>
              {t('dedup.keepNone')}
            </Button>
          </Space>
          <Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('dedup.mergeSummary', { close: closeCount, keep: keepCount })}
            </Text>
            <Button onClick={onClose} disabled={busy}>
              {t('dedup.ignoreOnce')}
            </Button>
            <Button
              type="primary"
              onClick={() => void handleMerge()}
              loading={busy}
              disabled={closeCount === 0}
            >
              {t('dedup.mergeNow')}
            </Button>
          </Space>
        </div>
      }
    >
      <div style={{ maxHeight: 480, overflowY: 'auto', padding: '4px 2px' }}>
        {effectiveGroups.length === 0 ? (
          <Text type="secondary">{t('dedup.emptyPreview')}</Text>
        ) : (
          effectiveGroups.map((group) => (
            <GroupSection
              key={group.canonicalUrl}
              group={group}
              keeperId={keepers[group.canonicalUrl]}
              onChange={(id) => handleKeeperChange(group.canonicalUrl, id)}
              token={token}
              t={t}
            />
          ))
        )}
      </div>
    </Modal>
  );
}

interface GroupSectionProps {
  group: DupGroup;
  keeperId: number | undefined;
  onChange: (tabId: number) => void;
  token: ReturnType<typeof theme.useToken>['token'];
  t: (key: string, params?: Record<string, string | number>) => string;
}

function GroupSection({ group, keeperId, onChange, token, t }: GroupSectionProps) {
  const closeCount = keeperId === undefined ? group.tabs.length : group.tabs.length - 1;
  return (
    <div
      style={{
        marginBottom: 12,
        padding: 12,
        borderRadius: 10,
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorFillQuaternary,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text strong style={{ fontSize: 12.5, color: token.colorTextSecondary, wordBreak: 'break-all' }}>
          {group.canonicalUrl}
        </Text>
        <Tag color="gold" bordered={false} style={{ margin: 0 }}>
          {t('dedup.willClose', { count: closeCount })}
        </Tag>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {group.tabs.map((tab: LiveTab) => (
          <label
            key={tab.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 8px',
              borderRadius: 6,
              cursor: 'pointer',
              background: keeperId === tab.id ? token.colorPrimaryBg : 'transparent',
              transition: 'background 120ms',
            }}
          >
            <input
              type="radio"
              name={`group-${group.canonicalUrl}`}
              checked={keeperId === tab.id}
              onChange={() => onChange(tab.id)}
              style={{ margin: 0 }}
            />
            {tab.favIconUrl !== '' && (
              <img src={tab.favIconUrl} alt="" width={14} height={14} style={{ borderRadius: 3 }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
              <span
                style={{
                  fontSize: 12.5,
                  color: token.colorText,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.title}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: token.colorTextTertiary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.url}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
              <Text type="secondary" style={{ fontSize: 10.5 }}>
                {t('dedup.windowLabel', { id: tab.windowId })}
              </Text>
              <Text type="secondary" style={{ fontSize: 10.5 }}>
                {formatOpenedAt(tab.lastAccessed)}
              </Text>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

export default DuplicatePreviewModal;
