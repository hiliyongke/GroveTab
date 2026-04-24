import { describe, it, expect } from 'vitest';
import { parseQuery, matchesSiteFilter } from '@/features/search/parseQuery';

describe('parseQuery', () => {
  it('returns empty when input is empty', () => {
    const result = parseQuery('');
    expect(result.text).toBe('');
    expect(result.keywords).toEqual([]);
    expect(result.filters).toEqual({});
  });

  it('extracts pure keywords', () => {
    const r = parseQuery('hello world');
    expect(r.keywords).toEqual(['hello', 'world']);
    expect(r.text).toBe('hello world');
    expect(r.filters).toEqual({});
  });

  it('recognizes site: filter', () => {
    const r = parseQuery('site:github.com react hooks');
    expect(r.filters.sites).toEqual(['github.com']);
    expect(r.text).toBe('react hooks');
  });

  it('recognizes in: scopes', () => {
    const r = parseQuery('in:archive keyword');
    expect(r.filters.scopes).toEqual(['archive']);
    expect(r.keywords).toEqual(['keyword']);
  });

  it('treats unknown in: values as keywords', () => {
    const r = parseQuery('in:unknown');
    expect(r.filters.scopes).toBeUndefined();
    expect(r.keywords).toEqual(['in:unknown']);
  });

  it('recognizes tag:/has:note/pinned:true', () => {
    const r = parseQuery('tag:work has:note pinned:true deep');
    expect(r.filters.tags).toEqual(['work']);
    expect(r.filters.hasNote).toBe(true);
    expect(r.filters.pinnedTrue).toBe(true);
    expect(r.text).toBe('deep');
  });

  it('combines multiple filters (AND)', () => {
    const r = parseQuery('site:docs.rs site:mdn.io tag:rust async');
    expect(r.filters.sites).toEqual(['docs.rs', 'mdn.io']);
    expect(r.filters.tags).toEqual(['rust']);
    expect(r.text).toBe('async');
  });

  it('empty value after colon falls back to keyword', () => {
    const r = parseQuery('site: alone');
    // "site:" has empty value -> treat rest normally; but colon-last-char is keyword
    // Our current rule: idx === part.length - 1 treats as keyword
    expect(r.keywords).toContain('site:');
  });
});

describe('matchesSiteFilter', () => {
  it('passes when no filter', () => {
    expect(matchesSiteFilter('https://a.com/x', undefined)).toBe(true);
    expect(matchesSiteFilter('https://a.com/x', [])).toBe(true);
  });
  it('matches exact hostname', () => {
    expect(matchesSiteFilter('https://example.com/', ['example.com'])).toBe(true);
  });
  it('matches subdomain suffix', () => {
    expect(matchesSiteFilter('https://api.example.com/', ['example.com'])).toBe(true);
  });
  it('rejects unrelated hosts', () => {
    expect(matchesSiteFilter('https://evil.com/', ['example.com'])).toBe(false);
  });
  it('returns false for invalid URL', () => {
    expect(matchesSiteFilter('not-a-url', ['example.com'])).toBe(false);
  });
});
