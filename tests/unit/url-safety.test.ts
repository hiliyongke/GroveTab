/**
 * URL 安全校验工具单元测试
 */
import { describe, it, expect } from 'vitest';
import { isSafeExternalUrl, filterSafeExternalUrls } from '@/shared/utils/url-safety';

describe('isSafeExternalUrl', () => {
  // ── 应阻止的协议 ──────────────────────────────────

  it('应阻止 javascript: URL', () => {
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeExternalUrl('javascript:void(0)')).toBe(false);
    expect(isSafeExternalUrl('JAVASCRIPT:alert(1)')).toBe(false);
  });

  it('应阻止 data: URL', () => {
    expect(isSafeExternalUrl('data:text/html,<h1>hi</h1>')).toBe(false);
    expect(isSafeExternalUrl('data:image/png;base64,abc')).toBe(false);
  });

  it('应阻止 file: URL', () => {
    expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false);
  });

  it('应阻止 blob: URL', () => {
    expect(isSafeExternalUrl('blob:https://example.com/uuid')).toBe(false);
  });

  it('应阻止 chrome: / chrome-extension: URL', () => {
    expect(isSafeExternalUrl('chrome://settings')).toBe(false);
    expect(isSafeExternalUrl('chrome-extension://abc/popup.html')).toBe(false);
  });

  // ── 应允许的协议 ──────────────────────────────────

  it('应允许 http: URL', () => {
    expect(isSafeExternalUrl('http://example.com')).toBe(true);
    expect(isSafeExternalUrl('http://localhost:3000')).toBe(true);
  });

  it('应允许 https: URL', () => {
    expect(isSafeExternalUrl('https://example.com')).toBe(true);
    expect(isSafeExternalUrl('https://example.com/path?query=1#hash')).toBe(true);
  });

  // ── 边界情况 ──────────────────────────────────────

  it('空字符串应返回 false', () => {
    expect(isSafeExternalUrl('')).toBe(false);
  });

  it('纯空格应返回 false', () => {
    expect(isSafeExternalUrl('   ')).toBe(false);
  });

  it('无协议的字符串应返回 false', () => {
    expect(isSafeExternalUrl('example.com')).toBe(false);
    expect(isSafeExternalUrl('www.example.com')).toBe(false);
  });

  it('前后空格应被 trim 后再判断', () => {
    expect(isSafeExternalUrl('  https://example.com  ')).toBe(true);
    expect(isSafeExternalUrl('  javascript:alert(1)  ')).toBe(false);
  });

  it('大小写混合的协议应正确判断', () => {
    expect(isSafeExternalUrl('HTTPS://example.com')).toBe(true);
    expect(isSafeExternalUrl('HtTp://example.com')).toBe(true);
  });
});

describe('filterSafeExternalUrls', () => {
  it('应仅保留 http/https URL', () => {
    const input = [
      'https://example.com',
      'http://localhost',
      'javascript:alert(1)',
      'data:text/html,<h1>hi</h1>',
      'https://google.com/search?q=test',
    ];
    expect(filterSafeExternalUrls(input)).toEqual([
      'https://example.com',
      'http://localhost',
      'https://google.com/search?q=test',
    ]);
  });

  it('全部不安全时应返回空数组', () => {
    const input = [
      'javascript:void(0)',
      'data:text/html,<h1>hi</h1>',
      'file:///etc/passwd',
    ];
    expect(filterSafeExternalUrls(input)).toEqual([]);
  });

  it('空数组应返回空数组', () => {
    expect(filterSafeExternalUrls([])).toEqual([]);
  });
});
