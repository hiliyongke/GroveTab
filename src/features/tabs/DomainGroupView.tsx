/**
 * DomainGroupView — 默认视图：按域名分组（antd 版）
 *
 * 设计：
 *   - 完全响应式列数：`column-width: 320px` 让浏览器按容器宽度自动决定列数
 *   - settings 里的 domainGroupColumns 仍作"是否固定列数"的可选 override
 *   - 使用 CSS multi-column 实现伪瀑布流：高矮不一的分组自然错位排布
 *   - 列间距 16px、卡片垂直间距 14px
 */

import { useMemo, memo, type CSSProperties } from 'react';
import { useTabsStore, useMetadataStore, useSettingsStore } from '@/store';
import { groupTabsByDomain } from '@/shared/utils/domain';
import { cssVars } from '@/shared/utils/css-vars';
import { DomainGroupCard } from './DomainGroupCard';
import styles from './styles/items.module.less';

/**
 * 域名分组视图（默认视图）
 *
 * 设计：
 *   - 完全响应式列数：`column-width: 320px` 让浏览器按容器宽度自动决定列数
 *   - settings 里的 domainGroupColumns 仍作"是否固定列数"的可选 override
 *   - 使用 CSS multi-column 实现伪瀑布流：高矮不一的分组自然错位排布
 *   - 列间距 16px、卡片垂直间距 14px
 *
 * @returns 域名分组视图 JSX 元素
 */
export const DomainGroupView = memo(function DomainGroupView() {
  const tabs = useTabsStore((s) => s.tabs);
  const pinnedUrls = useMetadataStore((s) => s.pinnedUrls);
  // 仅当用户显式设置了 1–6 的有效数值时才锁定列数，'auto' 或 undefined 走响应式
  const forcedColumns = useSettingsStore((s) => {
    const v = s.settings.domainGroupColumns;
    return typeof v === 'number' && v >= 1 && v <= 6 ? v : null;
  });
  /** 分组排序方式（默认按标签数量降序） */
  const sortBy = useSettingsStore((s) => s.settings.domainGroupSortBy ?? 'tabCount');

  const groups = useMemo(() => groupTabsByDomain(tabs), [tabs]);

  // 根据 sortBy 配置排序分组；固定分组始终优先
  const sortedGroups = useMemo(() => {
    return [...groups].sort((a, b) => {
      // 固定（pinned）分组始终优先
      const aHasPinned = a.tabs.some((tab) =>
        pinnedUrls.has(tab.url.replace(/#.*$/, '').replace(/\/+$/, ''))
      );
      const bHasPinned = b.tabs.some((tab) =>
        pinnedUrls.has(tab.url.replace(/#.*$/, '').replace(/\/+$/, ''))
      );
      if (aHasPinned && !bHasPinned) return -1;
      if (!aHasPinned && bHasPinned) return 1;

      // 按 sortBy 配置排序
      switch (sortBy) {
        case 'alphabetical':
          return a.domain.localeCompare(b.domain);
        case 'recentAccess': {
          const aMax = Math.max(...a.tabs.map((t) => t.lastAccessed || 0));
          const bMax = Math.max(...b.tabs.map((t) => t.lastAccessed || 0));
          return bMax - aMax;
        }
        case 'tabCount':
        default:
          return b.tabs.length - a.tabs.length;
      }
    });
  }, [groups, pinnedUrls, sortBy]);

  if (sortedGroups.length === 0) {
    return null;
  }

  // 缓存列样式对象，避免每次渲染创建新对象
  const columnStyle = useMemo<CSSProperties>(
    () => {
      if (forcedColumns !== null) {
        return cssVars({ '--app-domain-column-count': String(forcedColumns) });
      }
      return cssVars({ '--app-domain-column-width': '320px' });
    },
    [forcedColumns],
  );

  return (
    <div
      className={`${styles['app-domain-masonry']}${forcedColumns !== null ? ` ${styles['is-fixed-columns']}` : ''}`}
      style={columnStyle}
    >
      {sortedGroups.map((group) => (
        <div key={group.domain} className={styles['app-domain-masonry-item']}>
          <DomainGroupCard
            group={group}
            initialCollapsed={false}
          />
        </div>
      ))}
    </div>
  );
});
