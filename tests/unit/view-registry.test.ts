/**
 * view-registry 模块单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerView,
  registerViews,
  unregisterView,
  getViewRegistration,
  getEnabledViews,
  getViewComponentMap,
} from '@/shared/config/view-registry';
import { useFeatureFlagStore } from '@/shared/store/feature-flag-slice';

/** 简单的 mock 组件 */
const MockComponent = () => null;
const MockComponent2 = () => null;
const MockComponent3 = () => null;

describe('ViewRegistry', () => {
  beforeEach(() => {
    // 清空注册表（通过 unregisterView）
    const views = getEnabledViews();
    for (const v of views) unregisterView(v.id);
    // 关闭 unified_tabs_view flag，避免测试中的 timeline 注册被守卫拦截
    useFeatureFlagStore.setState({ flags: { ...useFeatureFlagStore.getState().flags, unified_tabs_view: false } });
  });

  it('注册并获取单个视图', () => {
    registerView({ id: 'tabs', component: MockComponent });
    const reg = getViewRegistration('tabs');
    expect(reg).toBeDefined();
    expect(reg!.id).toBe('tabs');
    expect(reg!.component).toBe(MockComponent);
  });

  it('批量注册视图', () => {
    registerViews([
      { id: 'tabs', component: MockComponent, order: 1 },
      { id: 'timeline', component: MockComponent2, order: 2 },
    ]);
    const views = getEnabledViews();
    expect(views).toHaveLength(2);
    expect(views[0].id).toBe('tabs');
    expect(views[1].id).toBe('timeline');
  });

  it('按 order 排序', () => {
    registerViews([
      { id: 'kanban', component: MockComponent, order: 3 },
      { id: 'tabs', component: MockComponent2, order: 1 },
      { id: 'timeline', component: MockComponent3, order: 2 },
    ]);
    const views = getEnabledViews();
    expect(views.map((v) => v.id)).toEqual(['tabs', 'timeline', 'kanban']);
  });

  it('取消注册视图', () => {
    registerView({ id: 'tabs', component: MockComponent });
    unregisterView('tabs');
    expect(getViewRegistration('tabs')).toBeUndefined();
  });

  it('enabled=false 的视图不出现在 getEnabledViews', () => {
    registerViews([
      { id: 'tabs', component: MockComponent, enabled: true },
      { id: 'bookmarks', component: MockComponent2, enabled: false },
    ]);
    const views = getEnabledViews();
    expect(views).toHaveLength(1);
    expect(views[0].id).toBe('tabs');
  });

  it('getViewComponentMap 返回组件映射', () => {
    registerViews([
      { id: 'tabs', component: MockComponent },
      { id: 'timeline', component: MockComponent2 },
    ]);
    const map = getViewComponentMap();
    expect(map.tabs).toBe(MockComponent);
    expect(map.timeline).toBe(MockComponent2);
  });
});
