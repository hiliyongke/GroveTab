import { nanoid } from 'nanoid';
import type { DashboardWidgetLayoutItem, DashboardWidgetType } from '@/shared/types';
import { isSafeExternalUrl } from '@/shared/utils/url-safety';
import {
  DASHBOARD_GRID_COLUMNS,
  DASHBOARD_MAX_ITEM_H,
  DASHBOARD_MAX_ITEM_W,
  DASHBOARD_MIN_ITEM_H,
  DASHBOARD_MIN_ITEM_W,
  getWidgetDefinition,
  normalizeLayoutItem,
} from './types';

export function createWidgetLayoutItem(
  type: DashboardWidgetType,
  seedY = 0,
): DashboardWidgetLayoutItem {
  const def = getWidgetDefinition(type);
  return {
    id: `${type}-${nanoid(6)}`,
    type,
    title: def.title,
    x: 0,
    y: seedY,
    w: def.defaultSize.w,
    h: def.defaultSize.h,
  };
}

export function normalizeWidgetLayout(
  items: DashboardWidgetLayoutItem[],
  columns: number = DASHBOARD_GRID_COLUMNS,
): DashboardWidgetLayoutItem[] {
  return items
    .map((item) => normalizeLayoutItem(item, columns))
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

export function getNextWidgetY(items: DashboardWidgetLayoutItem[]): number {
  if (items.length === 0) return 0;
  return Math.max(...items.map((item) => item.y + item.h));
}

/**
 * 为新增组件寻找最佳放置位置。
 * 策略：优先左上（y 最小，其次 x 最小），自动填补空隙。
 */
export function findBestWidgetPosition(
  items: DashboardWidgetLayoutItem[],
  w: number,
  h: number,
  columns: number = DASHBOARD_GRID_COLUMNS,
): { x: number; y: number } {
  const normalizedColumns = Math.max(1, Math.floor(columns));
  if (items.length === 0) return { x: 0, y: 0 };

  // 收集所有需要检查的 y 坐标：现有组件的顶部和底部
  const candidateYs = new Set<number>([0]);
  for (const item of items) {
    candidateYs.add(item.y);
    candidateYs.add(item.y + item.h);
  }
  const sortedYs = Array.from(candidateYs).sort((a, b) => a - b);

  // 按 y 从小到大、x 从小到大扫描，找到第一个能放下的位置
  const maxY = Math.max(...items.map((item) => item.y + item.h)) + h;
  for (const y of sortedYs) {
    if (y > maxY) break;
    for (let x = 0; x <= normalizedColumns - w; x++) {
      const rect = { x, y, w, h };
      const conflict = items.some((item) => {
        const overlapX = !(rect.x + rect.w <= item.x || item.x + item.w <= rect.x);
        const overlapY = !(rect.y + rect.h <= item.y || item.y + item.h <= rect.y);
        return overlapX && overlapY;
      });
      if (!conflict) {
        return { x, y };
      }
    }
  }

  // 兜底：放到最底部左侧
  return { x: 0, y: getNextWidgetY(items) };
}

export function moveWidgetItem(
  items: DashboardWidgetLayoutItem[],
  id: string,
  next: Partial<Pick<DashboardWidgetLayoutItem, 'x' | 'y' | 'w' | 'h'>>,
  columns: number = DASHBOARD_GRID_COLUMNS,
): DashboardWidgetLayoutItem[] {
  return normalizeWidgetLayout(
    items.map((item) => {
      if (item.id !== id) return item;
      return normalizeLayoutItem(
        {
          ...item,
          x: next.x ?? item.x,
          y: next.y ?? item.y,
          w: next.w ?? item.w,
          h: next.h ?? item.h,
        },
        columns,
      );
    }),
    columns,
  );
}

export function removeWidgetItem(
  items: DashboardWidgetLayoutItem[],
  id: string,
  columns: number = DASHBOARD_GRID_COLUMNS,
): DashboardWidgetLayoutItem[] {
  return normalizeWidgetLayout(
    items.filter((item) => item.id !== id),
    columns,
  );
}

export function ensureWithinGrid(
  item: DashboardWidgetLayoutItem,
  columns: number = DASHBOARD_GRID_COLUMNS,
): DashboardWidgetLayoutItem {
  const normalizedColumns = Math.max(1, Math.floor(columns));
  const minW = Math.min(DASHBOARD_MIN_ITEM_W, normalizedColumns);
  const maxW = Math.max(minW, Math.min(DASHBOARD_MAX_ITEM_W, normalizedColumns));
  const w = Math.min(maxW, Math.max(minW, item.w));
  return normalizeLayoutItem(
    {
      ...item,
      w,
      h: Math.min(DASHBOARD_MAX_ITEM_H, Math.max(DASHBOARD_MIN_ITEM_H, item.h)),
      x: Math.min(item.x, Math.max(0, normalizedColumns - w)),
    },
    normalizedColumns,
  );
}

export function formatDaysLeft(
  targetDate: string,
  now = new Date(),
): { label: string; days: number; overdue: boolean } {
  const target = new Date(`${targetDate}T00:00:00`);
  const diff = target.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (Number.isNaN(days)) {
    return { label: '日期无效', days: 0, overdue: false };
  }
  if (days === 0) {
    return { label: '就是今天', days: 0, overdue: false };
  }
  if (days < 0) {
    return { label: `已过去 ${Math.abs(days)} 天`, days, overdue: true };
  }
  return { label: `还有 ${days} 天`, days, overdue: false };
}

export function formatTimeLeftTo(
  hourMinute: string,
  now = new Date(),
): { label: string; finished: boolean } {
  const normalized = hourMinute.trim();
  if (!/^\d{1,2}:\d{2}$/.test(normalized)) {
    return { label: '时间未设置', finished: false };
  }
  const [hourText = '18', minuteText = '00'] = normalized.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return { label: '时间未设置', finished: false };
  }
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) {
    return { label: '今天收工啦', finished: true };
  }
  const totalMinutes = Math.ceil(diff / (1000 * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return { label: `${h} 小时 ${m} 分钟`, finished: false };
  return { label: `${m} 分钟`, finished: false };
}

export function buildFaviconUrl(url: string): string {
  if (!isSafeExternalUrl(url)) return '';
  try {
    const parsed = new URL(url);
    return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(parsed.origin)}`;
  } catch {
    return '';
  }
}

export function getHostnameLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function getInitials(title: string): string {
  return title.trim().slice(0, 2).toUpperCase() || '•';
}
