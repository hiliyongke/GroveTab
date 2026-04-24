/**
 * WorkspaceSwitcher —— Header 上的工作区切换器（F-29）
 *
 * 展示当前 active workspace 高亮 chip + 下拉切换所有 workspaces + 清除筛选。
 * 不含创建/编辑 UI —— 那些由 DataPanel 中的"工作区"区块承担。
 */

import { useCallback } from 'react';
import { Dropdown, Tag, Button, theme } from 'antd';
import { FolderOpen, X } from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { useMetadataStore, useSettingsStore } from '@/store';
import { useT } from '@/shared/i18n';

export function WorkspaceSwitcher() {
  const { t } = useT();
  const { token } = theme.useToken();
  const workspaces = useMetadataStore((s) => s.workspaces);
  const activeId = useSettingsStore((s) => s.settings.lastActiveWorkspaceId);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const active = workspaces.find((w) => w.id === activeId);

  const handleSwitch = useCallback(
    (id: string | undefined) => {
      void updateSettings({ lastActiveWorkspaceId: id });
    },
    [updateSettings],
  );

  if (workspaces.length === 0) return null;

  const items = [
    ...workspaces.map((w) => ({
      key: w.id,
      label: w.name,
      onClick: () => handleSwitch(w.id),
    })),
    { type: 'divider' as const },
    {
      key: 'clear',
      label: t('workspace.clear'),
      onClick: () => handleSwitch(undefined),
    },
  ];

  if (active === undefined) {
    return (
      <Dropdown menu={{ items }} trigger={['click']}>
<Button size="small" type="text" icon={<FolderOpen size={ICON_SIZE.DEFAULT} />}>
          {t('workspace.title')}
        </Button>
      </Dropdown>
    );
  }

  return (
    <Tag
      closable
      onClose={(e) => {
        e.preventDefault();
        handleSwitch(undefined);
      }}
closeIcon={<X size={ICON_SIZE.MICRO} />}
      style={{
        margin: 0,
        borderRadius: 999,
        background: token.colorPrimaryBg,
        color: token.colorPrimary,
        border: `1px solid ${token.colorPrimaryBorder}`,
        cursor: 'pointer',
        padding: '2px 10px',
      }}
    >
      <Dropdown menu={{ items }} trigger={['click']}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
<FolderOpen size={ICON_SIZE.TINY} />
          {active.name}
        </span>
      </Dropdown>
    </Tag>
  );
}

export default WorkspaceSwitcher;
