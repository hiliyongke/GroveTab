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
import styles from './DuplicatePreviewModal.module.less';

const { Text } = Typography;

interface DuplicatePreviewModalProps {
  open: boolean;
  dupGroups: DupGroup[];
  onClose: () => void;
}

/**
 * 选择最旧（lastAccessed 最小；若相同取 id 最小）作为默认保留项
 *
 * @param group - 重复标签组
 * @returns 默认保留的标签 ID
 */
function pickDefaultKeeper(group: DupGroup): number {
  const sorted = [...group.tabs].sort(
    (a, b) => (a.lastAccessed || 0) - (b.lastAccessed || 0) || a.id - b.id,
  );
  return sorted[0]?.id ?? group.tabs[0]?.id ?? -1;
}

/**
 * 格式化时间戳为本地化字符串
 *
 * @param ts - 时间戳（毫秒）
 * @param locale - 语言区域
 * @returns 格式化后的日期时间字符串
 */
function formatOpenedAt(ts: number, locale: string): string {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString(locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

/**
 * 重复标签预览合并模态框
 *
 * 功能：
 *   · 按重复分组展示所有组
 *   · 每组内列出全部重复 Tab（title + url + 窗口 + 打开时间）
 *   · 默认勾选"最旧一条"作为保留项
 *   · 支持"全不勾选" / "全部勾选最旧" 快捷操作
 *   · 点击"合并"：批量关闭未勾选 Tab，单条 Undo + Toast
 *
 * @param props - 组件属性
 * @param props.open - 是否打开模态框
 * @param props.dupGroups - 重复标签组列表
 * @param props.onClose - 关闭回调
 * @returns 重复标签预览合并模态框 JSX 元素
 */
export function DuplicatePreviewModal({ open, dupGroups, onClose }: DuplicatePreviewModalProps) {
  const { t, locale: currentLocale } = useT();
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

  /**
   * 更新指定重复组的保留标签 ID
   *
   * @param canonicalUrl - 重复组的规范 URL
   * @param tabId - 要保留的标签 ID
   * @returns 无返回值
   */
  const handleKeeperChange = useCallback((canonicalUrl: string, tabId: number) => {
    setKeepers((prev) => ({ ...prev, [canonicalUrl]: tabId }));
  }, []);

  /**
   * 为所有重复组设置默认保留项（最旧的标签）
   *
   * @returns 无返回值
   */
  const handleKeepAllOldest = useCallback(() => {
    const next: Record<string, number> = {};
    for (const group of effectiveGroups) {
      next[group.canonicalUrl] = pickDefaultKeeper(group);
    }
    setKeepers(next);
  }, [effectiveGroups]);

  /**
   * 清除所有重复组的保留选择
   *
   * @returns 无返回值
   */
  const handleKeepNone = useCallback(() => {
    setKeepers({});
  }, []);

  /**
   * 执行重复标签合并
   *
   * 关闭所有未勾选的重复标签，保留选中的标签。
   * 合并后显示成功提示，并记录活动。
   *
   * @returns 无返回值
   */
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
      destroyOnHidden
      footer={
        <div className={styles['app-duplicate-footer']}>
          <Space>
            <Button size="small" onClick={handleKeepAllOldest}>
              {t('dedup.keepOldest')}
            </Button>
            <Button size="small" onClick={handleKeepNone}>
              {t('dedup.keepNone')}
            </Button>
          </Space>
          <Space>
            <Text type="secondary" className={styles['app-duplicate-summary']}>
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
      <div className={styles['app-duplicate-groups']}>
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
              locale={currentLocale}
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
  locale: string;
}

/**
 * 重复标签组区块组件
 *
 * 渲染单个重复标签组的预览，包含组名、待关闭数量和标签列表。
 * 支持选择保留项。
 *
 * @param props - 组件属性
 * @param props.group - 重复标签组
 * @param props.keeperId - 当前保留的标签 ID
 * @param props.onChange - 保留项变更回调
 * @param props.token - antd 主题 token（未使用）
 * @param props.t - 国际化翻译函数
 * @param props.locale - 当前语言区域
 * @returns 重复标签组区块 JSX 元素
 */
function GroupSection({ group, keeperId, onChange, token: _token, t, locale }: GroupSectionProps) {
  const closeCount = keeperId === undefined ? group.tabs.length : group.tabs.length - 1;
  return (
    <div className={styles['app-duplicate-group']}>
      <div className={styles['app-duplicate-group__header']}>
        <Text strong className={styles['app-duplicate-group__title']}>
          {group.canonicalUrl}
        </Text>
        <Tag color="gold" bordered={false} className={styles['app-duplicate-group__tag']}>
          {t('dedup.willClose', { count: closeCount })}
        </Tag>
      </div>
      <div className={styles['app-duplicate-group__list']}>
        {group.tabs.map((tab: LiveTab) => (
          <label
            key={tab.id}
            className={`${styles['app-duplicate-option']}${keeperId === tab.id ? ` ${styles['is-selected']}` : ''}`}
          >
            <input
              type="radio"
              name={`group-${group.canonicalUrl}`}
              checked={keeperId === tab.id}
              onChange={() => onChange(tab.id)}
              className={styles['app-duplicate-option__radio']}
            />
            {tab.favIconUrl !== '' && (
              <img src={tab.favIconUrl} alt="" className={styles['app-duplicate-option__favicon']} />
            )}
            <div className={styles['app-duplicate-option__content']}>
              <span className={styles['app-duplicate-option__title']}>
                {tab.title}
              </span>
              <span className={styles['app-duplicate-option__url']}>
                {tab.url}
              </span>
            </div>
            <div className={styles['app-duplicate-option__aside']}>
              <Text type="secondary" className={styles['app-duplicate-option__meta']}>
                {t('dedup.windowLabel', { id: tab.windowId })}
              </Text>
              <Text type="secondary" className={styles['app-duplicate-option__meta']}>
                {formatOpenedAt(tab.lastAccessed, locale)}
              </Text>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
