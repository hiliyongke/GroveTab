import { Dropdown, Button } from 'antd';
import { TrendingUp, Wrench, MoreHorizontal } from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { useT } from '@/shared/i18n';
import type { NewtabPageMode } from '@/shared/types';

/**
 * 空间切换下拉菜单
 *
 * 将 trending / devtools 降为二级入口。
 *
 * @param props - 组件属性
 * @param props.currentPageMode - 当前页面模式
 * @param props.onPageModeChange - 页面模式切换回调
 * @returns {void} 无返回值
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
          {t('pageMode.trending')}
        </span>
      ),
      onClick: () => onPageModeChange('trending'),
    },
    {
      key: 'devtools',
      label: (
        <span className="app-space-menu-item">
          <Wrench size={ICON_SIZE.SMALL} />
          {t('pageMode.devtools')}
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
