/**
 * DedupInfoBar —— 重复标签页提示条（antd 版）
 *
 * 设计：
 *   - 使用 antd Alert 作为视觉主体（type="warning"、showIcon）
 *   - 主操作 "一键合并"、展开/折叠、关闭 全部走 antd Button
 *   - 展开后用 List 列出所有重复分组
 */

import { useState, useMemo } from 'react';
import { Alert, App, Button, Card, List, Space, Tooltip, theme } from 'antd';
import { DownOutlined, CloseOutlined } from '@ant-design/icons';
import { useTabsStore } from '@/store';
import { findDuplicates, type DupGroup } from '@/shared/utils/dedupe';
import { useT } from '@/shared/i18n';

/**
 * 重复标签页提示条
 */
export function DedupInfoBar() {
  const tabs = useTabsStore((s) => s.tabs);
  const closeMultipleTabs = useTabsStore((s) => s.closeMultipleTabs);
  const loadAllTabs = useTabsStore((s) => s.loadAllTabs);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const { t } = useT();
  const { token } = theme.useToken();
  const { message } = App.useApp();

  const dupGroups = useMemo(() => findDuplicates(tabs), [tabs]);

  if (dismissed || dupGroups.length === 0) return null;

  const totalDupTabs = dupGroups.reduce((sum, g) => sum + g.tabs.length - 1, 0);

  /**
   * 执行合并（关闭冗余标签页）。
   *
   * closeMultipleTabs 内部已统一处理失败 toast + 兜底刷新，这里只负责：
   *   1. 立即禁用按钮防止重复点击
   *   2. 成功时展示更精准的 "已合并 X 组" 反馈（store 默认的 "已关闭 N 个" 不够精准）
   *   3. 失败时切回非 busy 状态即可，toast 已由 store 弹出
   */
  const runClose = async (ids: number[], label: string) => {
    if (busy || ids.length === 0) return;
    setBusy(true);
    try {
      await closeMultipleTabs(ids);
      // 兜底刷新走静默模式，避免把整个主视图遮成 Spin
      await loadAllTabs({ silent: true });
      message.success(label);
    } catch {
      // store 已统一 toast 失败原因，这里不再重复
    } finally {
      setBusy(false);
    }
  };

  const handleMergeGroup = (group: DupGroup) => {
    const toClose = group.tabs.slice(1).map((tab) => tab.id);
    runClose(toClose, t('dedup.mergedOne', { count: toClose.length }));
  };

  const handleMergeAll = () => {
    const toClose = dupGroups.flatMap((g) => g.tabs.slice(1).map((tab) => tab.id));
    runClose(toClose, t('dedup.mergedAll', { count: toClose.length }));
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <Alert
        type="warning"
        showIcon
        message={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>
              {t('dedup.found', { count: dupGroups.length, tabs: totalDupTabs })}
            </span>
            <Space size={4}>
              <Button type="primary" size="small" loading={busy} onClick={handleMergeAll}>
                {t('dedup.mergeAll')}
              </Button>
              <Tooltip title={expanded ? t('tabs.collapse') : t('tabs.expand')}>
                <Button
                  type="text"
                  size="small"
                  icon={
                    <DownOutlined
                      style={{
                        fontSize: 12,
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
                  icon={<CloseOutlined style={{ fontSize: 12 }} />}
                  onClick={() => setDismissed(true)}
                />
              </Tooltip>
            </Space>
          </div>
        }
        style={{
          borderRadius: token.borderRadiusLG,
        }}
      />

      {/* 详情列表 */}
      {expanded && (
        <Card
          size="small"
          style={{
            marginTop: 8,
            borderRadius: token.borderRadiusLG,
          }}
          styles={{ body: { padding: '8px 12px' } }}
        >
          <List
            size="small"
            dataSource={dupGroups}
            renderItem={(group) => (
              <List.Item
                key={group.canonicalUrl}
                style={{ padding: '6px 0', borderBottom: 'none' }}
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
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: token.colorText }}>
                      {group.tabs[0]?.title || group.canonicalUrl}
                    </span>
                  }
                  description={
                    <span style={{ fontSize: 11, color: token.colorTextTertiary }}>
                      {group.tabs.length}x {t('dedup.merge').toLowerCase()}
                    </span>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      )}
    </div>
  );
}
