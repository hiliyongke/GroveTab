import { describe, it, expect } from 'vitest';
import {
  exportSessionsMarkdown,
  exportSessionsText,
  exportSessionsHTML,
  parseImportOneTab,
  parseImportHTML,
  parseImportAuto,
  applyImport,
  validateImportSizeLimits,
} from '@/shared/utils/import-export';
import type { ArchivedSession } from '@/shared/types';

function mk(id: string, name: string, urls: string[]): ArchivedSession {
  return {
    id,
    name,
    createdAt: Date.now(),
    tabCount: urls.length,
    tabs: urls.map((u) => ({
      url: u,
      title: `Tab ${u}`,
      favIconUrl: '',
      hostname: new URL(u).hostname,
      pinned: false,
    })),
  };
}

describe('import-export multi-format', () => {
  const sample = [
    mk('s1', 'Work', ['https://a.com/1', 'https://b.com/2']),
    mk('s2', 'Study', ['https://c.com/3']),
  ];

  it('exports Markdown with sections', () => {
    const md = exportSessionsMarkdown(sample);
    expect(md).toContain('## Work');
    expect(md).toContain('## Study');
    expect(md).toContain('- [Tab https://a.com/1](https://a.com/1)');
  });

  it('exports plain text URLs', () => {
    const txt = exportSessionsText(sample);
    expect(txt).toContain('https://a.com/1');
    expect(txt).toContain('https://c.com/3');
  });

  it('exports Netscape bookmarks HTML', () => {
    const html = exportSessionsHTML(sample);
    expect(html).toContain('<!DOCTYPE NETSCAPE-Bookmark-file-1>');
    expect(html).toContain('<H3>Work</H3>');
    expect(html).toContain('HREF="https://a.com/1"');
  });

  it('parses OneTab format', () => {
    const text = [
      'https://a.com/1 | Page A',
      'https://b.com/2 | Page B',
      '',
      'https://c.com/3 | Page C',
    ].join('\n');
    const { sessions, errors } = parseImportOneTab(text);
    expect(errors).toEqual([]);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].tabs).toHaveLength(2);
    expect(sessions[0].tabs[0].title).toBe('Page A');
  });

  it('parses OneTab returns error when no valid URL', () => {
    const { sessions, errors } = parseImportOneTab('   \n   ');
    expect(sessions).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('parses Netscape HTML', () => {
    const html = `
      <!DOCTYPE NETSCAPE-Bookmark-file-1>
      <DL>
        <DT><H3>Reading</H3>
        <DL>
          <DT><A HREF="https://x.com/p">X</A>
          <DT><A HREF="https://y.com/q">Y</A>
        </DL>
      </DL>
    `;
    const { sessions, errors } = parseImportHTML(html);
    expect(errors).toEqual([]);
    expect(sessions.length).toBeGreaterThanOrEqual(1);
    const reading = sessions.find((s) => s.name === 'Reading');
    expect(reading).toBeDefined();
    expect(reading!.tabs).toHaveLength(2);
  });

  it('parseImportAuto dispatches by shape', () => {
    const json = JSON.stringify({ version: 1, sessions: [] });
    expect(parseImportAuto(json).errors).toEqual([]);

    const onetab = 'https://a.com/1 | A\n';
    const r1 = parseImportAuto(onetab);
    expect(r1.sessions.length).toBeGreaterThan(0);
  });
});

describe('applyImport conflict strategies', () => {
  const existing = [mk('e1', 'Old', ['https://a.com/1'])];
  const incoming = [mk('n1', 'New', ['https://a.com/1', 'https://b.com/2'])];

  it('skip strategy drops duplicate URLs', () => {
    const { sessions, stats } = applyImport(existing, incoming, 'skip');
    expect(stats.skippedDuplicates).toBe(1);
    expect(stats.importedTabs).toBe(1);
    // 新会话仅保留未重复的 1 条
    expect(sessions[0].tabs).toHaveLength(1);
    expect(sessions[0].tabs[0].url).toBe('https://b.com/2');
  });

  it('append strategy keeps all', () => {
    const { sessions, stats } = applyImport(existing, incoming, 'append');
    expect(stats.skippedDuplicates).toBe(0);
    expect(stats.importedTabs).toBe(2);
    expect(sessions).toHaveLength(2);
  });

  it('replace strategy wipes existing', () => {
    const { sessions, stats } = applyImport(existing, incoming, 'replace');
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe('n1');
    expect(stats.importedSessions).toBe(1);
  });
});

describe('validateImportSizeLimits', () => {
  it('passes small input', () => {
    expect(validateImportSizeLimits('hello')).toBeNull();
  });
  it('flags oversized', () => {
    const huge = 'a'.repeat(6 * 1024 * 1024);
    expect(validateImportSizeLimits(huge)).not.toBeNull();
  });
});
