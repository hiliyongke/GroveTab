/**
 * flow-columns — 瀑布流列分配工具
 *
 * DomainGroupView 和 TabGroupView 共用，消除 ~30 行重复代码。
 */

import { cssVars } from "@/shared/utils/css-vars";

/**
 * 自动计算最优列数
 */
export function getAutoColumnCount(
  containerWidth: number,
  groupCount: number,
  options: { minWidth?: number; gap?: number; maxCols?: number } = {},
): number {
  const { minWidth = 380, gap = 16, maxCols = 6 } = options;
  if (groupCount <= 0 || containerWidth <= 0) return 1;

  const fitCount = Math.floor((containerWidth + gap) / (minWidth + gap));
  return Math.min(groupCount, Math.max(1, fitCount), maxCols);
}

/**
 * 生成列数的 CSS 变量
 */
export function getColumnVars(columnCount: number): React.CSSProperties {
  return cssVars({ "--app-domain-column-count": String(columnCount) });
}

/**
 * 瀑布流贪心分配：将元素均匀分配到各列
 */
export function splitIntoFlowColumns<T extends { tabs: { length: number } }>(
  items: T[],
  columnCount: number,
  estimateHeight: (item: T) => number,
): T[][] {
  if (columnCount <= 1) return [items];

  const columns: T[][] = Array.from({ length: columnCount }, () => []);
  const heights = new Array<number>(columnCount).fill(0);

  for (const item of items) {
    let minIdx = 0;
    for (let i = 1; i < columnCount; i++) {
      if (heights[i]! < heights[minIdx]!) minIdx = i;
    }
    columns[minIdx]!.push(item);
    heights[minIdx]! += estimateHeight(item);
  }

  return columns;
}

/**
 * 默认的域名组高度估算
 */
export function estimateGroupHeight(group: { tabs: { length: number } }): number {
  return 56 + group.tabs.length * 44 + 16;
}
