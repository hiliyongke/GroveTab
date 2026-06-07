/**
 * event-format.tsx — 历史事件类型格式化
 *
 * 集中放：
 *   - 事件类型 → 图标
 *   - 事件类型 → 描述文本
 *   - 事件类型 → filter 桶
 *   - 相对时间 hook
 *
 * 把这些纯函数/常量集中后，HistoryView 主组件就不用关心类型 → 视觉 的映射细节。
 */

import { useCallback } from "react";
import type { ReactNode } from "react";
import {
  Layers,
  X,
  Pin,
  Tag as TagIcon,
  Archive as ArchiveIcon,
  Camera,
  Search,
  ArrowRightLeft,
  Clock,
  Globe,
} from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";
import type { HistoryEvent, HistoryEventType } from "@/shared/types";

/** 历史事件类型 → 图标 */
export function eventIcon(type: HistoryEventType): ReactNode {
  const size = ICON_SIZE.SMALL;
  switch (type) {
    case "tab_opened":
      return <Layers size={size} />;
    case "tab_closed":
      return <X size={size} />;
    case "window_closed":
      return <X size={size} />;
    case "tab_pinned":
      return <Pin size={size} />;
    case "tab_tagged":
      return <TagIcon size={size} />;
    case "archive_create":
    case "archive_restore":
      return <ArchiveIcon size={size} />;
    case "snapshot_create":
      return <Camera size={size} />;
    case "search_query":
    case "search_engine_open":
      return <Search size={size} />;
    case "workspace_switch":
      return <ArrowRightLeft size={size} />;
    default:
      return <Clock size={size} />;
  }
}

/** 全局可复用的小图标（在子组件里用） */
export const GlobeIcon = <Globe size={ICON_SIZE.SMALL} />;

/** 事件类型 → 过滤桶（"全部"以外的桶） */
export function eventBucket(type: HistoryEventType): "tabs" | "search" | "archive" {
  if (type === "search_query" || type === "search_engine_open") return "search";
  if (
    type === "archive_create" ||
    type === "archive_restore" ||
    type === "snapshot_create"
  )
    return "archive";
  return "tabs";
}

/** 事件 → 描述文本（含插值） */
export function getEventDescription(
  e: HistoryEvent,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  switch (e.type) {
    case "tab_opened":
      return t("打开了");
    case "tab_closed":
      return t("关闭了");
    case "window_closed":
      return t("关闭了一个窗口（{count} 个标签）", {
        count: typeof e.extra?.tabCount === "number" ? e.extra.tabCount : 0,
      });
    case "tab_pinned":
      return t("置顶了");
    case "tab_tagged":
      return t("加了标签");
    case "archive_create":
      return t("创建了归档");
    case "archive_restore":
      return t("恢复了归档");
    case "snapshot_create":
      return t("自动快照");
    case "search_query":
      return t('搜索了 "{query}"', {
        query: typeof e.extra?.query === "string" ? e.extra.query : "",
      });
    case "search_engine_open":
      return t('通过 {engine} 搜索了 "{query}"', {
        query: typeof e.extra?.query === "string" ? e.extra.query : "",
        engine: typeof e.extra?.engine === "string" ? e.extra.engine : "",
      });
    case "workspace_switch":
      return t("切换了工作区");
    default:
      return "";
  }
}

/**
 * 相对时间描述：刚刚 / N 分钟前 / N 小时前 / N 天前
 *
 * 包装为 hook 是因为需要 t()，且 t 引用每渲染都变，useCallback 稳定函数引用
 * 避免传给小组件时触发额外重渲染。
 */
export function useRelativeTime(): (ts: number) => string {
  const { t } = useT();
  return useCallback(
    (ts: number): string => {
      const diff = Date.now() - ts;
      const m = Math.floor(diff / 60000);
      if (m < 1) return t("刚刚");
      if (m < 60) return t("{n} 分钟前", { n: m });
      const h = Math.floor(m / 60);
      if (h < 24) return t("{n} 小时前", { n: h });
      const d = Math.floor(h / 24);
      return t("{n} 天前", { n: d });
    },
    [t],
  );
}

/** 复用：把 number 渲染为带 N 位小数的时间显示（毫秒级，调试用） */
export function formatMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}
