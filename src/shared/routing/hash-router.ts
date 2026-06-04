/**
 * URL Hash 路由解析器
 *
 * 路由规范：
 *   #/space/{spaceId}[/view/{viewId}][/panel/{panelId}[/{subId}]]
 *
 * 示例：
 *   #/space/workspace                          → 主工作区
 *   #/space/workspace/view/timeline            → 工作区 + timeline 视图
 *   #/space/workspace/panel/settings           → 工作区 + 设置面板
 *   #/space/workspace/view/tabs/panel/search   → 工作区 + tabs 视图 + 搜索面板
 *   #/space/trending                           → 发现页
 *   #/space/devtools                           → 开发者工具
 *
 * 旧版 hash 兼容：
 *   #settings  → #/space/workspace/panel/settings
 *   #about     → #/space/workspace/panel/settings/about
 *   #search    → #/space/workspace/panel/search
 */

import type { ViewMode } from "@/shared/config/views";
import { VALID_VIEWS } from "@/shared/config/views";

// ── 类型定义 ──────────────────────────────────────────────────────────────────

/** 路由描述符：从 URL Hash 解析出的完整路由状态 */
export interface RouteDescriptor {
  /** 空间 ID：workspace / trending / devtools */
  spaceId: string;
  /** 视图 ID：tabs / timeline / tabgroup / window / kanban / frequency / archive */
  viewId?: ViewMode;
  /** 面板 ID：search / settings / insights / history / trash / commandPalette */
  panelId?: string;
  /** 面板子 ID：如 settings 的 about / appearance */
  subId?: string;
}

/** 路由变更来源 */
export type NavigationSource = "hash" | "programmatic" | "init";

/** 路由变更事件 */
export interface RouteChangeEvent {
  route: RouteDescriptor;
  previous: RouteDescriptor | null;
  source: NavigationSource;
}

type RouteChangeListener = (event: RouteChangeEvent) => void;

// ── 常量 ──────────────────────────────────────────────────────────────────────

const ROUTE_PREFIX = "#/space";
const VIEW_SEGMENT = "/view/";
const PANEL_SEGMENT = "/panel/";

/** 合法的空间 ID 集合 */
export const VALID_SPACES = ["workspace", "trending", "devtools"] as const;
export type SpaceId = (typeof VALID_SPACES)[number];

/** 合法的面板 ID 集合（仅浮层弹窗） */
export const VALID_PANELS = [
  "search",
  "settings",
  "commandPalette",
] as const;
export type PanelId = (typeof VALID_PANELS)[number];

// ── 旧版 hash 兼容映射 ────────────────────────────────────────────────────────

const LEGACY_HASH_MAP: Record<string, RouteDescriptor> = {
  "#settings": { spaceId: "workspace", panelId: "settings" },
  "#about": { spaceId: "workspace", panelId: "settings", subId: "about" },
  "#search": { spaceId: "workspace", panelId: "search" },
};

// ── 解析与序列化 ──────────────────────────────────────────────────────────────

/**
 * 将 URL Hash 字符串解析为 RouteDescriptor
 *
 * 优先检查旧版 hash 兼容映射，再按新规范解析。
 */
export function parseHash(hash: string): RouteDescriptor {
  // 旧版 hash 兼容
  const legacy = LEGACY_HASH_MAP[hash];
  if (legacy) return { ...legacy };

  // 非路由 hash 或空 hash → 默认 workspace
  if (!hash.startsWith(ROUTE_PREFIX)) {
    return { spaceId: "workspace" };
  }

  const path = hash.slice(ROUTE_PREFIX.length + 1); // 去掉 "#/space/"
  if (!path) return { spaceId: "workspace" };

  const segments = path.split("/").filter(Boolean);
  const result: RouteDescriptor = { spaceId: segments[0] ?? "workspace" };

  let i = 1;
  while (i < segments.length) {
    const segment = segments[i];

    if (segment === "view" && i + 1 < segments.length) {
      const viewId = segments[i + 1];
      if (VALID_VIEWS.includes(viewId as ViewMode)) {
        result.viewId = viewId as ViewMode;
      }
      i += 2;
    } else if (segment === "panel" && i + 1 < segments.length) {
      const panelId = segments[i + 1];
      if ((VALID_PANELS as readonly string[]).includes(panelId!)) {
        result.panelId = panelId;
      }
      // 检查 subId（面板后的下一个路径段，非关键字）
      if (i + 2 < segments.length && segments[i + 2] !== "view" && segments[i + 2] !== "panel") {
        result.subId = segments[i + 2];
      }
      i += result.subId ? 3 : 2;
    } else {
      i++;
    }
  }

  return result;
}

/**
 * 将 RouteDescriptor 序列化为 URL Hash 字符串
 */
export function serializeRoute(route: RouteDescriptor): string {
  const parts: string[] = [ROUTE_PREFIX, "/", route.spaceId];

  if (route.viewId) {
    parts.push(VIEW_SEGMENT, route.viewId);
  }

  if (route.panelId) {
    parts.push(PANEL_SEGMENT, route.panelId);
    if (route.subId) {
      parts.push("/", route.subId);
    }
  }

  return parts.join("");
}

// ── 路由器类 ──────────────────────────────────────────────────────────────────

/**
 * HashRouter —— 单例路由器
 *
 * 职责：
 *   1. 监听 hashchange 事件
 *   2. 解析当前 hash → RouteDescriptor
 *   3. 通知所有 listener
 *   4. 提供程序化导航 API
 */
export class HashRouter {
  private current: RouteDescriptor;
  private listeners: Set<RouteChangeListener> = new Set<RouteChangeListener>();
  private hashChangeHandler: (() => void) | null = null;

  constructor() {
    this.current = parseHash(window.location.hash);
  }

  /** 启动 hashchange 监听 */
  start(): void {
    if (this.hashChangeHandler) return; // 已启动

    this.hashChangeHandler = () => {
      const newRoute = parseHash(window.location.hash);
      if (!this.routeEquals(this.current, newRoute)) {
        const previous = this.current;
        this.current = newRoute;
        this.notify({ route: newRoute, previous, source: "hash" });
      }
    };
    window.addEventListener("hashchange", this.hashChangeHandler);
  }

  /** 停止 hashchange 监听 */
  stop(): void {
    if (this.hashChangeHandler) {
      window.removeEventListener("hashchange", this.hashChangeHandler);
      this.hashChangeHandler = null;
    }
  }

  /** 获取当前路由 */
  getRoute(): RouteDescriptor {
    return { ...this.current };
  }

  /**
   * 程序化导航
   *
   * 更新 hash 并触发路由变更（会触发 hashchange → listener 通知）。
   * 如果 replace=true，使用 replaceState 替换当前历史记录条目。
   */
  navigate(route: Partial<RouteDescriptor>, options?: { replace?: boolean }): void {
    const newRoute: RouteDescriptor = { ...this.current, ...route };
    const hash = serializeRoute(newRoute);

    if (options?.replace) {
      history.replaceState(null, "", hash);
      // replaceState 不触发 hashchange，手动通知
      const previous = this.current;
      this.current = newRoute;
      this.notify({ route: newRoute, previous, source: "programmatic" });
    } else {
      // 直接赋值 hash 会触发 hashchange
      window.location.hash = hash;
    }
  }

  /** 返回上一页 */
  back(): void {
    history.back();
  }

  /** 注册路由变更监听 */
  subscribe(listener: RouteChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 路由相等性比较（浅比较） */
  private routeEquals(a: RouteDescriptor, b: RouteDescriptor): boolean {
    return (
      a.spaceId === b.spaceId &&
      a.viewId === b.viewId &&
      a.panelId === b.panelId &&
      a.subId === b.subId
    );
  }

  /** 通知所有 listener */
  private notify(event: RouteChangeEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

// ── 全局单例 ──────────────────────────────────────────────────────────────────

let routerInstance: HashRouter | null = null;

/**
 * 获取全局路由器实例（懒初始化）
 */
export function getRouter(): HashRouter {
  return routerInstance ??= new HashRouter();
}
