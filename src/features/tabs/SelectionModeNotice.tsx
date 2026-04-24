/**
 * SelectionModeNotice —— 多选模式提示条。
 *
 * 功能：显示当前已选标签页的数量/域名/窗口统计，并提供「全选 / 清空 / 退出」操作。
 * 从原 WorkspaceOverview.tsx 拆分独立，消除未使用的 WorkspaceOverview 组件（死代码）。
 */

import { Button, Card, Space, theme } from 'antd';
import type { LiveTab } from '@/shared/types';
import { useT } from '@/shared/i18n';

interface SelectionModeNoticeProps {
  selectedTabs: LiveTab[];
  onSelectAll: () => void;
  onClearSelection: () => void;
  onExitSelectionMode: () => void;
}

export function SelectionModeNotice({
  selectedTabs,
  onSelectAll,
  onClearSelection,
  onExitSelectionMode,
}: SelectionModeNoticeProps) {
  const { t } = useT();
  const { token } = theme.useToken();

  const selectedCount = selectedTabs.length;
  const selectedDomainCount = new Set(selectedTabs.map((tab) => tab.hostname)).size;
  const selectedWindowCount = new Set(selectedTabs.map((tab) => tab.windowId)).size;

  return (
    <Card
      size="small"
      style={{
        marginBottom: 16,
        borderRadius: token.borderRadiusLG,
        borderColor: token.colorPrimaryBorder,
        background: token.colorPrimaryBg,
      }}
      styles={{ body: { padding: '12px 14px' } }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: token.colorText }}>
            {t('selection.title')}
          </div>
          <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
            {selectedCount > 0
              ? t('selection.summary', {
                  count: selectedCount,
                  domains: selectedDomainCount,
                  windows: selectedWindowCount,
                })
              : t('selection.empty')}
          </div>
          <div style={{ fontSize: 11.5, color: token.colorTextTertiary }}>
            {t('selection.hint')}
          </div>
        </div>

        <Space size={6} wrap>
          <Button size="small" onClick={onSelectAll}>
            {t('selection.selectAll')}
          </Button>
          <Button size="small" onClick={onClearSelection} disabled={selectedCount === 0}>
            {t('selection.clear')}
          </Button>
          <Button size="small" type="text" onClick={onExitSelectionMode}>
            {t('selection.exit')}
          </Button>
        </Space>
      </div>
    </Card>
  );
}
