import { nanoid } from 'nanoid';
import type { DashboardWidgetLayoutItem, DashboardWidgetType } from '@/shared/types';
import {
  DASHBOARD_GRID_COLUMNS,
  DASHBOARD_MAX_ITEM_H,
  DASHBOARD_MAX_ITEM_W,
  DASHBOARD_MIN_ITEM_H,
  DASHBOARD_MIN_ITEM_W,
  getWidgetDefinition,
  normalizeLayoutItem,
} from './types';

export function createWidgetLayoutItem(type: DashboardWidgetType, seedY = 0): DashboardWidgetLayoutItem {
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

export function normalizeWidgetLayout(items: DashboardWidgetLayoutItem[]): DashboardWidgetLayoutItem[] {
  return items.map((item) => normalizeLayoutItem(item)).sort((a, b) => (a.y - b.y) || (a.x - b.x));
}

export function getNextWidgetY(items: DashboardWidgetLayoutItem[]): number {
  if (items.length === 0) return 0;
  return Math.max(...items.map((item) => item.y + item.h));
}

export function moveWidgetItem(
  items: DashboardWidgetLayoutItem[],
  id: string,
  next: Partial<Pick<DashboardWidgetLayoutItem, 'x' | 'y' | 'w' | 'h'>>,
): DashboardWidgetLayoutItem[] {
  return normalizeWidgetLayout(
    items.map((item) => {
      if (item.id !== id) return item;
      return normalizeLayoutItem({
        ...item,
        x: next.x ?? item.x,
        y: next.y ?? item.y,
        w: next.w ?? item.w,
        h: next.h ?? item.h,
      });
    }),
  );
}

export function removeWidgetItem(items: DashboardWidgetLayoutItem[], id: string): DashboardWidgetLayoutItem[] {
  return normalizeWidgetLayout(items.filter((item) => item.id !== id));
}

export function ensureWithinGrid(item: DashboardWidgetLayoutItem): DashboardWidgetLayoutItem {
  const w = Math.min(DASHBOARD_MAX_ITEM_W, Math.max(DASHBOARD_MIN_ITEM_W, item.w));
  return normalizeLayoutItem({
    ...item,
    w,
    h: Math.min(DASHBOARD_MAX_ITEM_H, Math.max(DASHBOARD_MIN_ITEM_H, item.h)),
    x: Math.min(item.x, Math.max(0, DASHBOARD_GRID_COLUMNS - w)),
  });
}

export function formatDaysLeft(targetDate: string, now = new Date()): { label: string; days: number; overdue: boolean } {
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

export function formatTimeLeftTo(hourMinute: string, now = new Date()): { label: string; finished: boolean } {
  const [hourText = '18', minuteText = '00'] = hourMinute.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
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
