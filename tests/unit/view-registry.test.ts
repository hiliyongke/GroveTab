/**
 * workspace view catalog 模块单元测试
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/features/tabs/DomainGroupView', () => ({
  DomainGroupView: () => null,
}));
import {
  WORKSPACE_VIEW_CONFIGS,
  VALID_VIEWS,
  getWorkspaceViewComponent,
  isValidViewMode,
} from '@/features/workspace/view-catalog';

describe('workspace view catalog', () => {
  it('按 order 暴露完整视图列表', () => {
    expect(WORKSPACE_VIEW_CONFIGS.map((view) => view.id)).toEqual([
      'domain',
      'compact',
      'timeline',
      'tabgroup',
      'window',
      'kanban',
      'bookmarks',
      'frequency',
      'grid',
      'archive',
    ]);
  });

  it('VALID_VIEWS 与目录保持一致', () => {
    expect(VALID_VIEWS).toEqual(WORKSPACE_VIEW_CONFIGS.map((view) => view.id));
  });

  it('可以校验非法视图值', () => {
    expect(isValidViewMode('domain')).toBe(true);
    expect(isValidViewMode('archive')).toBe(true);
    expect(isValidViewMode('invalid-view')).toBe(false);
  });

  it('可以读取视图组件', () => {
    expect(getWorkspaceViewComponent('domain')).toBe(WORKSPACE_VIEW_CONFIGS[0]?.component);
    expect(getWorkspaceViewComponent('archive')).toBe(WORKSPACE_VIEW_CONFIGS.at(-1)?.component);
  });
});
