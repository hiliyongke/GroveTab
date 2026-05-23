/**
 * 搜索相关工具函数
 */

import type { ReactNode, CSSProperties } from "react";
import {
  LayoutGrid,
  Clock,
  Flame,
  Globe,
  Link,
  Search,
  Unlock,
  History,
  RotateCcw,
} from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { type IconRole } from "@/shared/utils/icon-colors";
import type { UniversalSearchItem } from "../types";

/**
 * 合并 CSS 类名
 *
 * 过滤掉 falsy 值（false、undefined、空字符串），用空格连接。
 *
 * @param classNames - CSS 类名列表
 * @returns 合并后的类名字符串
 */
export function cx(...classNames: Array<string | false | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

/**
 * 将 CSS 变量对象转为 React CSSProperties
 *
 * 用于通过 style 属性传递 CSS 变量。
 *
 * @param vars - CSS 变量键值对
 * @returns React CSSProperties 对象
 */
export function cssVars(vars: Record<string, string>): CSSProperties {
  return vars;
}

/**
 * 归一化 URL（与 metadata-slice 一致）
 *
 * 用于搜索时可靠地解析标签。
 * 去除 hash 并清理末尾斜杠。
 *
 * @param url - 待归一化的 URL
 * @returns 归一化后的 URL
 */
export function normalizeMetadataKey(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return url;
  }
}

/**
 * 归一化搜索文本
 *
 * 去除首尾空格并转为小写。
 *
 * @param text - 原始搜索文本
 * @returns 归一化后的文本
 */
export function normalizeSearchText(text: string): string {
  return text.trim().toLowerCase();
}

/**
 * 获取搜索结果项的图标和角色
 *
 * 根据搜索结果类型返回对应的图标和图标角色（用于颜色编码）。
 *
 * @param item - 搜索结果项
 * @param token - Ant Design 主题 token
 * @param active - 是否当前高亮项
 * @returns 图标和图标角色
 */
export function getItemIconMeta(item: UniversalSearchItem): {
  icon: ReactNode;
  iconRole: IconRole;
} {
  switch (item.type) {
    case "tab":
      return { icon: <LayoutGrid size={ICON_SIZE.TINY} />, iconRole: "tab" };
    case "history":
      return { icon: <Link size={ICON_SIZE.TINY} />, iconRole: "history" };
    case "closed":
      return { icon: <RotateCcw size={ICON_SIZE.TINY} />, iconRole: "history" };
    case "command":
      return { icon: <History size={ICON_SIZE.TINY} />, iconRole: "history" };
    case "web":
      return { icon: <Globe size={ICON_SIZE.TINY} />, iconRole: "web" };
    case "permission":
      return { icon: <Unlock size={ICON_SIZE.TINY} />, iconRole: "permission" };
    case "suggestion":
      return item.source === "hot"
        ? { icon: <Flame size={ICON_SIZE.TINY} />, iconRole: "hot" }
        : { icon: <Clock size={ICON_SIZE.TINY} />, iconRole: "recent" };
    default:
      return { icon: <Search size={ICON_SIZE.TINY} />, iconRole: "search" };
  }
}
