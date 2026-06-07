/**
 * 跨视图筛选信使（P1-06）
 *
 * Insights 卡片被点击时设置 domain filter, TabsView 在渲染时消费。
 * 轻量模块级共享，无需引入 Zustand store。
 */

let _domainFilter: string | null = null;
let _onNavigateToTabs: (() => void) | null = null;

/** 注册导航回调（由 App.tsx 在初始化时调用） */
export function registerInsightsNavigation(navigateToTabs: () => void): void {
  _onNavigateToTabs = navigateToTabs;
}

/** Insights 域名卡片点击 → 设置筛选 + 导航到 tabs 视图 */
export function navigateToTabsWithDomainFilter(domain: string): void {
  _domainFilter = domain;
  _onNavigateToTabs?.();
}

/** 消费并清除域名筛选器，返回域名或 null */
export function consumeInsightsDomainFilter(): string | null {
  const d = _domainFilter;
  _domainFilter = null;
  return d;
}
