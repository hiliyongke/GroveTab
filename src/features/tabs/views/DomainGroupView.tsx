/**
 * DomainGroupView — 默认视图：按域名分组（antd 版）
 *
 * 虚拟滚动优化：
 *   - 当域名分组数量超过 20 时，对 masonry 列启用 @tanstack/react-virtual 虚拟滚动
 *   - 每列独立虚拟化，避免海量 DOM 节点导致的内存/渲染性能问题
 *   - 折叠/展开状态变化通过 measureElement 实时更新虚拟高度
 *
 * 自动域名排序：
 *   - 切换到域名分组视图时，自动按域名排序浏览器标签栏（同域名标签相邻）
 *   - 切离域名分组视图时，自动恢复浏览器标签栏的原始顺序
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Empty, Flex } from "antd";
import { useTabsStore, useMetadataStore, useSettingsStore } from "@/store";
import { groupTabsByDomain, type DomainGroup } from "@/shared/utils/domain";
import { cssVars } from "@/shared/utils/css-vars";
import { useT } from "@/shared/i18n";
import { moveTabs } from "@/chrome/tabs";
import { sortTabs } from "@/features/smart-sort/hooks/useSmartSort";
import type { LiveTab } from "@/shared/types";
import { DomainGroupCard } from "../components/DomainGroupCard";
import styles from "../styles/items.module.less";

/**
 * 将排序后的标签顺序同步到浏览器标签栏
 */
async function syncSortToBrowser(sortedTabs: LiveTab[]): Promise<void> {
  const currentWindow = await chrome.windows.getCurrent();
  const windowId = currentWindow.id;
  if (!windowId) return;

  const windowTabIds = sortedTabs
    .filter((t) => t.windowId === windowId)
    .map((t) => t.id);

  if (windowTabIds.length === 0) return;

  const allWindowTabs = await chrome.tabs.query({ windowId });
  const pinnedCount = allWindowTabs.filter((t) => t.pinned).length;

  try {
    await moveTabs(windowTabIds, windowId, pinnedCount);
  } catch {
    // 忽略移动失败
  }
}

/**
 * 恢复浏览器标签栏的原始顺序
 */
async function restoreBrowserOrder(originalTabIds: number[]): Promise<void> {
  const currentWindow = await chrome.windows.getCurrent();
  const windowId = currentWindow.id;
  if (!windowId) return;

  const allWindowTabs = await chrome.tabs.query({ windowId });
  const currentTabIds = new Set(allWindowTabs.map((t) => t.id));
  const validIds = originalTabIds.filter((id) => currentTabIds.has(id));
  if (validIds.length === 0) return;

  const pinnedCount = allWindowTabs.filter((t) => t.pinned).length;

  try {
    await moveTabs(validIds, windowId, pinnedCount);
  } catch {
    // 忽略恢复失败
  }
}

interface DomainGroupViewProps {
  filterQuery: string;
}

interface VirtualColumnProps {
  groups: DomainGroup[];
  useVirtual: boolean;
}

const DOMAIN_COLUMN_MIN_WIDTH = 380;
const DOMAIN_COLUMN_GAP = 16;
const DOMAIN_COLUMN_MAX_AUTO = 6;
const VIRTUALIZATION_THRESHOLD = 20; // 超过此数量才启用虚拟滚动

function getAutoColumnCount(containerWidth: number, groupCount: number): number {
  if (groupCount <= 0 || containerWidth <= 0) return 1;

  const fitCount = Math.floor(
    (containerWidth + DOMAIN_COLUMN_GAP) / (DOMAIN_COLUMN_MIN_WIDTH + DOMAIN_COLUMN_GAP),
  );

  return Math.min(groupCount, Math.max(1, fitCount), DOMAIN_COLUMN_MAX_AUTO);
}

function getColumnVars(columnCount: number): React.CSSProperties {
  return cssVars({
    "--app-domain-column-count": String(columnCount),
  });
}

function splitIntoFlowColumns(groups: DomainGroup[], columnCount: number): DomainGroup[][] {
  const safeColumnCount = Math.max(1, columnCount);
  const columns = Array.from({ length: safeColumnCount }, () => [] as DomainGroup[]);
  const columnHeights = Array.from({ length: safeColumnCount }, () => 0);

  groups.forEach((group) => {
    let targetColumnIndex = 0;

    for (let index = 1; index < columnHeights.length; index += 1) {
      if (columnHeights[index]! < columnHeights[targetColumnIndex]!) {
        targetColumnIndex = index;
      }
    }

    columns[targetColumnIndex]!.push(group);
    columnHeights[targetColumnIndex]! += group.tabs.length + 1;
  });

  return columns;
}

/** 估算单个 DomainGroupCard 的高度（展开状态） */
function estimateGroupHeight(group: DomainGroup): number {
  // 卡片头部 + 每个子项约 44px（+ padding/gap）
  return 56 + group.tabs.length * 44 + 16;
}

/**
 * 虚拟化列组件：独立管理内部虚拟滚动
 */
function VirtualColumn({ groups, useVirtual }: VirtualColumnProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: groups.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => estimateGroupHeight(groups[index]!),
    overscan: 3,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  const virtualItems = virtualizer.getVirtualItems();

  if (!useVirtual) {
    // 非虚拟模式：直接渲染所有卡片
    return (
      <div className={styles["app-domain-masonry-column"]}>
        {groups.map((group) => (
          <div key={group.domain} className={styles["app-domain-masonry-item"]}>
            <DomainGroupCard group={group} initialCollapsed={false} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={`${styles["app-domain-masonry-column"]} ${styles["domain-group-scroll-area"]}`}
    >
      <div
        className={styles["domain-group-virtual-container"]}
        style={{
          height: `${virtualizer.getTotalSize()}px`,
        }}
      >
        {virtualItems.map((virtualItem) => {
          const group = groups[virtualItem.index]!;
          return (
            <div
              key={group.domain}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              className={`${styles["app-domain-masonry-item"]} ${styles["domain-group-virtual-item"]}`}
              style={{
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <DomainGroupCard group={group} initialCollapsed={false} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 域名分组视图
 */
export function DomainGroupView({ filterQuery }: DomainGroupViewProps) {
  const { t } = useT();
  const tabs = useTabsStore((s) => s.tabs);
  const pinnedUrls = useMetadataStore((s) => s.pinnedUrls);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // ── 自动域名排序：切换到域名分组视图时按域名排序浏览器标签栏 ──
  const originalTabIdsRef = useRef<number[] | null>(null);

  useEffect(() => {
    // 保存原始顺序（仅首次进入域名分组视图时）
    const currentTabs = useTabsStore.getState().tabs;
    if (!originalTabIdsRef.current) {
      originalTabIdsRef.current = currentTabs.map((t) => t.id);
    }

    // 按域名排序
    const sorted = sortTabs(currentTabs, "domain", [], {});

    // 立即更新 store（UI 马上生效）
    useTabsStore.setState({ tabs: sorted });

    // 后台异步同步到浏览器标签栏
    void syncSortToBrowser(sorted).catch(() => {
      // 忽略同步失败
    });

    // 卸载时恢复浏览器原始顺序
    return () => {
      const originalIds = originalTabIdsRef.current;
      if (originalIds) {
        void restoreBrowserOrder(originalIds);
        originalTabIdsRef.current = null;
      }
    };
  }, []);
  // 仅当用户显式设置了 1–6 的有效数值时才锁定列数，'auto' 或 undefined 走响应式
  const forcedColumns = useSettingsStore((s) => {
    const v = s.settings.domainGroupColumns;
    return typeof v === "number" && v >= 1 && v <= 6 ? v : null;
  });
  /** 分组排序方式（默认按标签数量降序） */
  const sortBy = useSettingsStore((s) => s.settings.domainGroupSortBy ?? "tabCount");

  const groups = useMemo(() => groupTabsByDomain(tabs), [tabs]);

  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node || forcedColumns !== null) return;

    const updateWidth = () => {
      setContainerWidth(node.clientWidth);
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const width = entry?.contentRect.width ?? node.clientWidth;
      setContainerWidth(width);
    });
    observer.observe(node);

    return () => observer.disconnect();
  }, [forcedColumns, groups.length]);

  // 根据 sortBy 配置排序分组；固定分组始终优先
  const sortedGroups = useMemo(() => {
    return [...groups].sort((a, b) => {
      // 固定（pinned）分组始终优先
      const aHasPinned = a.tabs.some((tab) =>
        pinnedUrls.has(tab.url.replace(/#.*$/, "").replace(/\/+$/, "")),
      );
      const bHasPinned = b.tabs.some((tab) =>
        pinnedUrls.has(tab.url.replace(/#.*$/, "").replace(/\/+$/, "")),
      );
      if (aHasPinned && !bHasPinned) return -1;
      if (!aHasPinned && bHasPinned) return 1;

      // 按 sortBy 配置排序
      switch (sortBy) {
        case "alphabetical":
          return a.domain.localeCompare(b.domain);
        case "recentAccess": {
          const aMax = Math.max(...a.tabs.map((t) => t.lastAccessed || 0));
          const bMax = Math.max(...b.tabs.map((t) => t.lastAccessed || 0));
          return bMax - aMax;
        }
        case "tabCount":
        default:
          return b.tabs.length - a.tabs.length;
      }
    });
  }, [groups, pinnedUrls, sortBy]);

  // 搜索过滤（域名 + 标签标题/URL）
  const filteredGroups = useMemo(() => {
    const query = filterQuery.trim().toLowerCase();
    if (!query) return sortedGroups;
    return sortedGroups.filter((group) => {
      if (group.domain.toLowerCase().includes(query)) return true;
      return group.tabs.some(
        (tab) => tab.title.toLowerCase().includes(query) || tab.url.toLowerCase().includes(query),
      );
    });
  }, [sortedGroups, filterQuery]);

  const columnCount = forcedColumns ?? getAutoColumnCount(containerWidth, filteredGroups.length);
  const columns = splitIntoFlowColumns(filteredGroups, columnCount);

  // 虚拟滚动阈值：超过 VIRTUALIZATION_THRESHOLD 个分组时启用
  const useVirtualization = filteredGroups.length > VIRTUALIZATION_THRESHOLD;

  return (
    <Flex vertical gap="middle">
      {sortedGroups.length === 0 ? null : (
        <div
          ref={containerRef}
          className={styles["app-domain-masonry"]}
          style={getColumnVars(columnCount)}
        >
          {filteredGroups.length === 0 ? (
            <Empty description={t("search.noDomainResults")} />
          ) : (
            columns.map((columnGroups, columnIndex) => (
              <VirtualColumn
                key={columnIndex}
                groups={columnGroups}
                useVirtual={useVirtualization}
              />
            ))
          )}
        </div>
      )}
    </Flex>
  );
}
