/**
 * VirtualizedSearchList —— 虚拟滚动搜索结果列表
 *
 * 当搜索结果超过 50 条时自动启用虚拟滚动，
 * 保持 60fps 滚动性能。
 *
 * 使用 @tanstack/react-virtual 实现，
 * 比 react-window 更轻量且 TypeScript 友好。
 */

import { useRef } from "react";
/* eslint-disable react-hooks/incompatible-library */
import { useVirtualizer } from "@tanstack/react-virtual";
import type { UniversalSearchItem } from "../types";
import { SearchResultItem } from "./SearchResultItem";

interface VirtualizedSearchListProps {
  items: UniversalSearchItem[];
  activeIndex: number;
  normalizedQuery: string;
  onActivate: (item: UniversalSearchItem) => void;
  onMouseEnter: (index: number) => void;
}

const VIRTUAL_THRESHOLD = 50;
const ESTIMATED_ROW_HEIGHT = 48;

export function VirtualizedSearchList({
  items,
  activeIndex,
  normalizedQuery,
  onActivate,
  onMouseEnter,
}: VirtualizedSearchListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 10,
  });

  // 超过阈值才启用虚拟滚动
  if (items.length < VIRTUAL_THRESHOLD) {
    return (
      <div role="listbox" className="search-box-list">
        {items.map((item, index) => (
          <SearchResultItem
            key={item.id}
            item={item}
            index={index}
            active={index === activeIndex}
            normalizedQuery={normalizedQuery}
            onActivate={onActivate}
            onMouseEnter={onMouseEnter}
          />
        ))}
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      role="listbox"
      className="search-box-list"
      style={{ height: 400, overflow: "auto" }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index];
          if (!item) return null;

          return (
            <div
              key={virtualItem.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <SearchResultItem
                item={item}
                index={virtualItem.index}
                active={virtualItem.index === activeIndex}
                normalizedQuery={normalizedQuery}
                onActivate={onActivate}
                onMouseEnter={onMouseEnter}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
