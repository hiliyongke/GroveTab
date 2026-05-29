/**
 * Routing 模块公共导出
 *
 * 外部消费路径：
 *   import { useUrlSync, getRouter, parseHash, serializeRoute } from '@/shared/routing';
 */

export { HashRouter, getRouter, parseHash, serializeRoute } from "./hash-router";
export type {
  RouteDescriptor,
  NavigationSource,
  RouteChangeEvent,
  SpaceId,
  PanelId,
} from "./hash-router";
export { useUrlSync, getInitialRoute } from "./use-url-sync";
export type { UrlSyncAPI } from "./use-url-sync";
