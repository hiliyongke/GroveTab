/**
 * DomainGroupView — 默认视图：按域名分组（antd 版）
 *
 * 虚拟滚动优化：
 *   - 当域名分组数量超过 20 时，对 masonry 列启用 @tanstack/react-virtual 虚拟滚动
 *   - 每列独立虚拟化，避免海量 DOM 节点导致的内存/渲染性能问题
 *   - 折叠/展开状态变化通过 measureElement 实时更新虚拟高度
 */

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Input, Empty, Flex, Segmented, Tooltip } from "antd";
import { Search, LayoutGrid, List, Grip } from "lucide-react";
import { useTabsStore, useMetadataStore, useSettingsStore } from "@/store";
import { groupTabsByDomain, type DomainGroup } from "@/shared/utils/domain";
import { cssVars } from "@/shared/utils/css-vars";
import { useT } from "@/shared/i18n";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { DomainGroupCard } from "./DomainGroupCard";
import styles from "./styles/items.module.less";

type TabsLayout = "masonry" | "compact" | "grid";
type LayoutDensity = "compact" | "default" | "comfortable";

const DOMAIN_COLUMN_MIN_WIDTH = 320;
const DOMAIN_COLUMN_GAP = 16;
const DOMAIN_COLUMN_MAX_AUTO = 8;
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
interface VirtualColumnProps {
  groups: DomainGroup[];
  useVirtual: boolean;
}

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
      className={styles["app-domain-masonry-column"]}
      style={{ overflowY: "auto", maxHeight: "calc(100vh - 200px)" }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualItem) => {
          const group = groups[virtualItem.index]!;
          return (
            <div
              key={group.domain}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`,
              }}
              className={styles["app-domain-masonry-item"]}
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
export function DomainGroupView() {
  const { t } = useT();
  const tabs = useTabsStore((s) => s.tabs);
  const pinnedUrls = useMetadataStore((s) => s.pinnedUrls);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [filterQuery, setFilterQuery] = useState("");
  // 仅当用户显式设置了 1–6 的有效数值时才锁定列数，'auto' 或 undefined 走响应式
  const forcedColumns = useSettingsStore((s) => {
    const v = s.settings.domainGroupColumns;
    return typeof v === "number" && v >= 1 && v <= 6 ? v : null;
  });
  /** 分组排序方式（默认按标签数量降序） */
  const sortBy = useSettingsStore((s) => s.settings.domainGroupSortBy ?? "tabCount");
  const tabsLayout = useSettingsStore((s) => s.settings.tabsLayout ?? "masonry");
  const layoutDensity = useSettingsStore((s) => s.settings.layoutDensity ?? "default");
  const updateSettings = useSettingsStore((s) => s.updateSettings);

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

  // 搜索过滤
  const filteredGroups = useMemo(() => {
    const query = filterQuery.trim().toLowerCase();
    if (!query) return sortedGroups;
    return sortedGroups.filter((group) => {
      if (group.domain.toLowerCase().includes(query)) return true;
      return group.tabs.some(
        (tab) =>
          tab.title.toLowerCase().includes(query) ||
          tab.url.toLowerCase().includes(query),
      );
    });
  }, [sortedGroups, filterQuery]);

  if (sortedGroups.length === 0) {
    return null;
  }

  const columnCount = forcedColumns ?? getAutoColumnCount(containerWidth, filteredGroups.length);
  const columns = splitIntoFlowColumns(filteredGroups, columnCount);

  // 虚拟滚动阈值：超过 VIRTUALIZATION_THRESHOLD 个分组时启用
  const useVirtualization = filteredGroups.length > VIRTUALIZATION_THRESHOLD;

  return (
    <Flex vertical gap="middle">
      {/* 搜索栏 + 布局/密度快捷切换 */}
      <Flex align="center" gap={8} className={styles["app-domain-toolbar"]}>
        <Input
          prefix={<Search size={ICON_SIZE.SMALL} />}
          placeholder={t("search.domainFilter")}
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          allowClear
          style={{ maxWidth: 400, flex: "1 1 auto" }}
        />
        <Flex align="center" gap={4} className={styles["app-domain-toolbar-controls"]}>
          <Tooltip title={t("headerLayout.title")}>
            <Segmented
              size="small"
              value={tabsLayout}
              onChange={(v) => void updateSettings({ tabsLayout: v as TabsLayout })}
              options={[
                { value: "masonry", icon: <LayoutGrid size={13} /> },
                { value: "compact", icon: <List size={13} /> },
                { value: "grid", icon: <Grip size={13} /> },
              ]}
            />
          </Tooltip>
          <Tooltip title={t("headerDensity.title")}>
            <Segmented
              size="small"
              value={layoutDensity}
              onChange={(v) => void updateSettings({ layoutDensity: v as LayoutDensity })}
              options={[
                { value: "compact", label: "S" },
                { value: "default", label: "M" },
                { value: "comfortable", label: "L" },
              ]}
            />
          </Tooltip>
        </Flex>
      </Flex>
      {filteredGroups.length === 0 ? (
        <Empty description={t("search.noDomainResults")} />
      ) : (
        <div
          ref={containerRef}
          className={styles["app-domain-masonry"]}
          style={getColumnVars(columnCount)}
        >
          {columns.map((columnGroups, columnIndex) => (
            <VirtualColumn key={columnIndex} groups={columnGroups} useVirtual={useVirtualization} />
          ))}
        </div>
      )}
    </Flex>
  );
}