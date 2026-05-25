import { Dropdown, Button } from 'antd';
import { TrendingUp, Wrench, MoreHorizontal } from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { useT } from '@/shared/i18n';
import type { NewtabPageMode } from '@/shared/types';

/**
 * 空间切换下拉菜单——将 trending / devtools 降为二级入口。
 */
export function DropdownMenu({
  currentPageMode,
  onPageModeChange,
}: {
  currentPageMode: NewtabPageMode;
  onPageModeChange: (mode: NewtabPageMode) => void;
}) {
  const { t } = useT();
  const items = [
    {
      key: 'trending',
      label: (
        <span className="app-space-menu-item">
          <TrendingUp size={ICON_SIZE.SMALL} />
          {t('热榜')}
        </span>
      ),
      onClick: () => onPageModeChange('trending'),
    },
    {
      key: 'devtools',
      label: (
        <span className="app-space-menu-item">
          <Wrench size={ICON_SIZE.SMALL} />
          {t('开发工具栏')}
        </span>
      ),
      onClick: () => onPageModeChange('devtools'),
    },
  ];

  return (
    <Dropdown menu={{ items }} trigger={['click']}>
      <Button
        size="small"
        type={currentPageMode !== 'workspace' ? 'primary' : 'text'}
        icon={<MoreHorizontal size={ICON_SIZE.SMALL} />}
      />
    </Dropdown>
  );
}
