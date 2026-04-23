/**
 * URL 展示工具函数单元测试
 */
import { describe, it, expect } from 'vitest';
import { formatUrlForDisplay, findAmbiguousTitleIds } from '@/shared/utils/url-display';

describe('formatUrlForDisplay', () => {
  it('应从 URL 提取路径和 query', () => {
    expect(formatUrlForDisplay('https://x.com/app/page?tab=a')).toBe('/app/page?tab=a');
  });

  it('应压缩长路径为首段+…+末段', () => {
    const result = formatUrlForDisplay('https://x.com/app/very/long/path/detail/123');
    expect(result).toBe('/app/…/123');
  });

  it('应保留 hash 路由', () => {
    const result = formatUrlForDisplay('https://x.com/#/settings/profile');
    expect(result).toContain('#/settings/profile');
  });

  it('应在纯根路径时返回 /', () => {
    expect(formatUrlForDisplay('https://x.com/')).toBe('/');
  });

  it('应截断过长的 URL', () => {
    const longUrl = 'https://x.com/' + 'a'.repeat(100) + '?key=' + 'v'.repeat(50);
    const result = formatUrlForDisplay(longUrl);
    expect(result.length).toBeLessThanOrEqual(60);
  });

  it('应只展示前 2 个 query 参数', () => {
    const result = formatUrlForDisplay('https://x.com/path?a=1&b=2&c=3');
    expect(result).toContain('a=1');
    expect(result).toContain('b=2');
    expect(result).toContain('…');
  });

  it('应在非法 URL 时做中间省略', () => {
    const result = formatUrlForDisplay('not-a-url-at-all-very-long-string');
    expect(result.length).toBeLessThanOrEqual(60);
  });
});

describe('findAmbiguousTitleIds', () => {
  it('应在无重复标题时返回空集合', () => {
    const tabs = [
      { id: 1, title: 'Title A' },
      { id: 2, title: 'Title B' },
    ];
    expect(findAmbiguousTitleIds(tabs)).toEqual(new Set());
  });

  it('应找出重复标题的 tab ID', () => {
    const tabs = [
      { id: 1, title: 'Same Title' },
      { id: 2, title: 'Same Title' },
      { id: 3, title: 'Unique' },
    ];
    expect(findAmbiguousTitleIds(tabs)).toEqual(new Set([1, 2]));
  });

  it('应忽略空标题', () => {
    const tabs = [
      { id: 1, title: '' },
      { id: 2, title: '' },
    ];
    expect(findAmbiguousTitleIds(tabs)).toEqual(new Set());
  });

  it('应 trim 后比较标题', () => {
    const tabs = [
      { id: 1, title: '  Hello  ' },
      { id: 2, title: 'Hello' },
    ];
    expect(findAmbiguousTitleIds(tabs)).toEqual(new Set([1, 2]));
  });
});
