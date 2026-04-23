/**
 * TidySuggestionBar —— 智能整理建议栏（antd 版）
 *
 * 整合原 DedupInfoBar + 闲置检测，统一呈现"你的标签可以整理"的提示。
 *
 * 设计：
 *   - 同时检测"重复标签"和"闲置标签"
 *   - 用 antd Alert（type="info"）展示总体建议
 *   - 展开后分为两个区域：重复分组 + 闲置列表
 *   - 每个区域有独立操作按钮（合并/关闭/休眠）
 *   - 一键整理：合并所有重复 + 休眠所有闲置
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Alert, App, Button, Card, List, Space, Tooltip, Tag, theme } from 'antd';
import {
  ChevronDown,
  X,
  Merge,
  Moon,
  Zap,
} from 'lucide-react';
import { useTabsStore } from '@/store';
import { findDuplicates, type DupGroup } from '@/shared/utils/dedupe';
import { detectIdleTabs, formatIdleTime, type IdleTabInfo } from '@/shared/utils/idle-detect';
import { useT } from '@/shared/i18n';
import { iconColor } from '@/shared/utils/icon-colors';

interface TidySuggestionBarProps {
  /** 外部要求展开建议栏时递增该信号。 */
  expandSignal?: number;
}

/**
 * 智能整理建议栏
 */
export function TidySuggestionBar({ expandSignal = 0 }: TidySuggestionBarProps) {
  const tabs = useTabsStore((s) => s.tabs);
  const closeMultipleTabs = useTabsStore((s) => s.closeMultipleTabs);
  const discardMultipleTabs = useTabsStore((s) => s.discardMultipleTabs);
  const loadAllTabs = useTabsStore((s) => s.loadAllTabs);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const { t } = useT();
  const { token } = theme.useToken();
  const { message } = App.useApp();

  const dupGroups = useMemo(() => findDuplicates(tabs), [tabs]);
  const idleTabs = useMemo(() => detectIdleTabs(tabs), [tabs]);

  const totalDupTabs = dupGroups.reduce((sum, g) => sum + g.tabs.length - 1, 0);
  const staleCount = idleTabs.filter((i) => i.level === 'stale').length;
  const idleOnlyCount = idleTabs.filter((i) => i.level === 'idle').length;

  // 任何建议都没有时不渲染
  const hasSuggestions = dupGroups.length > 0 || idleTabs.length > 0;

  useEffect(() => {
    if (expandSignal <= 0 || !hasSuggestions) return;
    const timer = window.setTimeout(() => {
      setDismissed(false);
      setExpanded(true);
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [expandSignal, hasSuggestions]);

  /**
   * 安全执行批量操作：禁用按钮 → 执行 → 静默刷新 → 成功提示
   *
   * ⚠️ 所有 useCallback 必须在条件 return 之前声明（React hooks 规则）
   */
  const runAction = useCallback(async (action: () => Promise<void>, successMsg: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      await loadAllTabs({ silent: true });
      message.success(successMsg);
    } catch {
      // store 已 toast
    } finally {
      setBusy(false);
    }
  }, [busy, loadAllTabs, message]);

  /** 合并单个重复组 */
  const handleMergeGroup = useCallback((group: DupGroup) => {
    const toClose = group.tabs.slice(1).map((tab) => tab.id);
    void runAction(
      () => closeMultipleTabs(toClose),
      t('dedup.mergedOne', { count: toClose.length }),
    );
  }, [closeMultipleTabs, runAction, t]);

  /** 合并所有重复 */
  const handleMergeAll = useCallback(() => {
    const toClose = dupGroups.flatMap((g) => g.tabs.slice(1).map((tab) => tab.id));
    void runAction(
      () => closeMultipleTabs(toClose),
      t('dedup.mergedAll', { count: toClose.length }),
    );
  }, [closeMultipleTabs, dupGroups, runAction, t]);

  /** 休眠闲置标签 */
  const handleDiscardIdle = useCallback(async (items: IdleTabInfo[]) => {
    if (busy) return;
    setBusy(true);
    try {
      const ids = items.map((item) => item.tab.id);
      await discardMultipleTabs(ids);
      await loadAllTabs({ silent: true });
      message.success(t('tidy.discardedIdle', { count: ids.length }));
    } catch {
      // store 已 toast
    } finally {
      setBusy(false);
    }
  }, [busy, discardMultipleTabs, loadAllTabs, message, t]);

  /** 一键整理：合并重复 + 休眠闲置 */
  const handleTidyAll = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    let mergedCount = 0;
    let discardedCount = 0;

    // 1. 合并重复
    if (dupGroups.length > 0) {
      const toClose = dupGroups.flatMap((g) => g.tabs.slice(1).map((tab) => tab.id));
      try {
        await closeMultipleTabs(toClose);
        mergedCount = toClose.length;
      } catch {
        // store 已 toast
      }
    }

    // 2. 休眠闲置
    if (idleTabs.length > 0) {
      try {
        const idleIds = idleTabs.map((item) => item.tab.id);
        await discardMultipleTabs(idleIds);
        discardedCount = idleIds.length;
      } catch {
        // store 已 toast
      }
    }

    await loadAllTabs({ silent: true });
    setBusy(false);
    if (mergedCount > 0 || discardedCount > 0) {
      message.success(t('tidy.tidyAllDone', { merged: mergedCount, discarded: discardedCount }));
    }
  }, [busy, closeMultipleTabs, discardMultipleTabs, dupGroups, idleTabs, loadAllTabs, message, t]);

  // 条件渲染放在所有 hooks 之后
  if (dismissed || !hasSuggestions) return null;

  /** 构建建议摘要 */
  const summaryParts: string[] = [];
  if (totalDupTabs > 0) {
    summaryParts.push(t('tidy.dupSummary', { count: dupGroups.length, tabs: totalDupTabs }));
  }
  if (staleCount > 0) {
    summaryParts.push(t('tidy.staleSummary', { count: staleCount }));
  } else if (idleOnlyCount > 0) {
    summaryParts.push(t('tidy.idleSummary', { count: idleOnlyCount }));
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <Alert
        type="info"
        showIcon
        icon={<Zap size={14} style={{ color: iconColor('tidy', token) }} />}
        message={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>
              {summaryParts.join('；')}
            </span>
            <Space size={4}>
              <Button type="primary" size="small" loading={busy} onClick={() => { void handleTidyAll(); }}>
                {t('tidy.tidyAll')}
              </Button>
              <Tooltip title={expanded ? t('tabs.collapse') : t('tabs.expand')}>
                <Button
                  type="text"
                  size="small"
                  icon={
                    <ChevronDown
                      size={12}
                      style={{
                        transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: `transform ${token.motionDurationMid}`,
                      }}
                    />
                  }
                  onClick={() => setExpanded(!expanded)}
                />
              </Tooltip>
              <Tooltip title={t('dedup.dismiss')}>
                <Button
                  type="text"
                  size="small"
                  icon={<X size={12} style={{ color: iconColor('close', token) }} />}
                  onClick={() => setDismissed(true)}
                />
              </Tooltip>
            </Space>
          </div>
        }
        style={{ borderRadius: token.borderRadiusLG }}
      />

      {/* 详情区域 */}
      {expanded && (
        <Card
          size="small"
          style={{ marginTop: 8, borderRadius: token.borderRadiusLG }}
          styles={{ body: { padding: '8px 12px' } }}
        >
          {/* 重复标签 */}
          {dupGroups.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Merge size={13} style={{ color: iconColor('duplicates', token) }} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: token.colorText }}>
                  {t('tidy.dupSection')}
                </span>
                <Button
                  size="small"
                  type="link"
                  loading={busy}
                  onClick={handleMergeAll}
                  style={{ fontSize: 12, padding: 0, height: 'auto' }}
                >
                  {t('dedup.mergeAll')}
                </Button>
              </div>
              <List
                size="small"
                dataSource={dupGroups}
                renderItem={(group) => (
                  <List.Item
                    key={group.canonicalUrl}
                    style={{ padding: '4px 0', borderBottom: 'none' }}
                    actions={[
                      <Button
                        key="merge"
                        size="small"
                        loading={busy}
                        onClick={() => handleMergeGroup(group)}
                      >
                        {t('dedup.merge')}
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <span style={{ fontSize: 12, fontWeight: 500, color: token.colorText }}>
                          {group.tabs[0]?.title || group.canonicalUrl}
                        </span>
                      }
                      description={
                        <span style={{ fontSize: 11, color: token.colorTextTertiary }}>
                          {group.tabs.length}x
                        </span>
                      }
                    />
                  </List.Item>
                )}
              />
            </>
          )}

          {/* 闲置标签 */}
          {idleTabs.length > 0 && (
            <>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: dupGroups.length > 0 ? 12 : 0,
                marginBottom: 6,
              }}>
                <Moon size={13} style={{ color: iconColor('idle', token) }} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: token.colorText }}>
                  {t('tidy.idleSection')}
                </span>
                <Button
                  size="small"
                  type="link"
                  loading={busy}
                  onClick={() => { void handleDiscardIdle(idleTabs); }}
                  style={{ fontSize: 12, padding: 0, height: 'auto' }}
                >
                  {t('tidy.discardAllIdle')}
                </Button>
              </div>
              <List
                size="small"
                dataSource={idleTabs}
                renderItem={(item) => (
                  <List.Item
                    key={item.tab.id}
                    style={{ padding: '4px 0', borderBottom: 'none' }}
                    actions={[
                      <Tag
                        key="level"
                        color={item.level === 'stale' ? 'volcano' : 'default'}
                        style={{ margin: 0, fontSize: 10 }}
                      >
                        {item.level === 'stale' ? t('tidy.stale') : t('tidy.idle')}
                      </Tag>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <span style={{ fontSize: 12, fontWeight: 500, color: token.colorText }}>
                          {item.tab.title}
                        </span>
                      }
                      description={
                        <span style={{ fontSize: 11, color: token.colorTextTertiary }}>
                          {t('tidy.lastAccessed', { time: formatIdleTime(item.hoursSinceAccess) })}
                        </span>
                      }
                    />
                  </List.Item>
                )}
              />
            </>
          )}
        </Card>
      )}
    </div>
  );
}
