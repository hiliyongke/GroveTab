/**
 * DomainGroupView — 默认视图：按域名分组（antd 版）
 *
 * 设计：
 *   - 完全响应式列数：`column-width: 320px` 让浏览器按容器宽度自动决定列数
 *   - settings 里的 domainGroupColumns 仍作"是否固定列数"的可选 override
 *   - 使用 CSS multi-column 实现伪瀑布流：高矮不一的分组自然错位排布
 *   - 列间距 16px、卡片垂直间距 14px
 */

import { useMemo } from 'react';
import { useTabsStore, useMetadataStore, useSettingsStore } from '@/store';
import { groupTabsByDomain, getGroupFavicon } from '@/shared/utils/domain';
import { useGroupAccents } from '@/shared/hooks/useGroupAccents';
import { DomainGroupCard } from './DomainGroupCard';

/**
 * 构造响应式 multi-column 布局样式
 *
 * @param forcedColumns - 若用户在设置中显式指定列数（1–6），则强制使用该列数；
 *                        否则返回纯响应式配置（按 `column-width` 自适应）
 */
function getColumnStyle(forcedColumns: number | null): React.CSSProperties {
  const base: React.CSSProperties = {
    columnGap: '16px',
    columnFill: 'balance',
  };
  if (forcedColumns && forcedColumns >= 1 && forcedColumns <= 6) {
    return { ...base, columnCount: forcedColumns };
  }
  // 纯响应式：每列最少 320px，宽屏自动增加列数
  return { ...base, columnWidth: '320px' };
}

/**
 * 域名分组视图
 */
export function DomainGroupView() {
  const tabs = useTabsStore((s) => s.tabs);
  const pinnedUrls = useMetadataStore((s) => s.pinnedUrls);
  // 仅当用户显式设置了 1–6 的有效数值时才锁定列数，'auto' 或 undefined 走响应式
  const forcedColumns = useSettingsStore((s) => {
    const v = s.settings.domainGroupColumns;
    return typeof v === 'number' && v >= 1 && v <= 6 ? v : null;
  });

  const groups = useMemo(() => groupTabsByDomain(tabs), [tabs]);

  // 固定分组优先、按标签数量降序
  const sortedGroups = useMemo(() => {
    return [...groups].sort((a, b) => {
      const aHasPinned = a.tabs.some((tab) =>
        pinnedUrls.has(tab.url.replace(/#.*$/, '').replace(/\/+$/, ''))
      );
      const bHasPinned = b.tabs.some((tab) =>
        pinnedUrls.has(tab.url.replace(/#.*$/, '').replace(/\/+$/, ''))
      );
      if (aHasPinned && !bHasPinned) return -1;
      if (!aHasPinned && bHasPinned) return 1;
      if (b.tabs.length !== a.tabs.length) return b.tabs.length - a.tabs.length;
      return 0;
    });
  }, [groups, pinnedUrls]);

  /**
   * 批次内去重分配 Accent——解决"相邻卡颜色太近几乎没法区分"的问题。
   * inputs 顺序 = 渲染顺序，越靠前的分组越倾向于保住自己的 favicon 主色，
   * 冲突时后面的分组会被推到色相圆上的最远空位。
   * 注意：hooks 必须在 early return 前调用，保持调用顺序稳定。
   */
  const accentInputs = useMemo(
    () =>
      sortedGroups.map((g) => ({
        colorKey: g.colorKey,
        favicon: getGroupFavicon(g.tabs),
      })),
    [sortedGroups],
  );
  const accentMap = useGroupAccents(accentInputs);

  if (sortedGroups.length === 0) {
    return null;
  }

  return (
    <div style={getColumnStyle(forcedColumns)}>
      {sortedGroups.map((group) => (
        <div
          key={group.domain}
          style={{
            marginBottom: 14,
            breakInside: 'avoid',
            pageBreakInside: 'avoid',
          }}
        >
          <DomainGroupCard
            group={group}
            initialCollapsed={false}
            accentOverride={accentMap[group.colorKey]}
          />
        </div>
      ))}
    </div>
  );
}
