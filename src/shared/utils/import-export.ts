/**
 * 归档导入导出工具。
 */

import type { ArchivedSession, ArchivedTab } from '@/shared/types';
import { BRAND } from '@/shared/config/brand';
import { CONFIG } from '@/shared/config';
import { isSafeExternalUrl } from '@/shared/utils/url-safety';

const CURRENT_EXPORT_VERSION = 1;
const MAX_IMPORT_SESSIONS = CONFIG.business.maxImportSessions;
const MAX_IMPORT_TABS_PER_SESSION = CONFIG.business.maxImportTabsPerSession;
const MAX_STRING_LENGTH = CONFIG.business.maxStringLength;

/** 导出归档会话为 JSON 字符串。 */
export function exportSessionsJSON(sessions: ArchivedSession[]): string {
  return JSON.stringify({ version: CURRENT_EXPORT_VERSION, exportedAt: Date.now(), sessions }, null, 2);
}

/** 下载字符串内容为文件。 */
export function downloadFile(content: string, filename: string, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** 判断值是否为普通对象。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 把任意字符串字段规整到可接受长度。 */
function normalizeString(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, MAX_STRING_LENGTH);
}

/** URL 基础校验：仅允许可安全打开的 http/https 外部网页。 */
function isValidUrl(value: string): boolean {
  return isSafeExternalUrl(value);
}

/** 从 URL 推导 hostname，供导入时兜底。 */
function deriveHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/** 校验单个归档标签。 */
function parseArchivedTab(rawTab: unknown, sessionName: string, index: number, errors: string[]): ArchivedTab | null {
  if (!isRecord(rawTab)) {
    errors.push(`Invalid tab in session "${sessionName}" at index ${index}`);
    return null;
  }

  const url = normalizeString(rawTab.url);
  if (!url || !isValidUrl(url)) {
    errors.push(`Invalid tab URL in session "${sessionName}" at index ${index}`);
    return null;
  }

  return {
    url,
    title: normalizeString(rawTab.title),
    favIconUrl: normalizeString(rawTab.favIconUrl),
    hostname: normalizeString(rawTab.hostname, deriveHostname(url)),
    pinned: rawTab.pinned === true,
  };
}

/** 校验单个归档会话。 */
function parseArchivedSession(rawSession: unknown, index: number, errors: string[]): ArchivedSession | null {
  if (!isRecord(rawSession)) {
    errors.push(`Invalid session at index ${index}`);
    return null;
  }

  const id = normalizeString(rawSession.id);
  const name = normalizeString(rawSession.name, `Imported session ${index + 1}`);
  const createdAt = typeof rawSession.createdAt === 'number' && Number.isFinite(rawSession.createdAt)
    ? rawSession.createdAt
    : Date.now();
  const rawTabs = rawSession.tabs;

  if (!id) {
    errors.push(`Invalid session id at index ${index}`);
    return null;
  }
  if (!Array.isArray(rawTabs)) {
    errors.push(`Invalid tabs array in session "${name}"`);
    return null;
  }
  if (rawTabs.length === 0) {
    errors.push(`Session "${name}" has no tabs`);
    return null;
  }
  if (rawTabs.length > MAX_IMPORT_TABS_PER_SESSION) {
    errors.push(`Session "${name}" exceeds ${MAX_IMPORT_TABS_PER_SESSION} tabs`);
    return null;
  }

  const tabs: ArchivedTab[] = [];
  rawTabs.forEach((rawTab, tabIndex) => {
    const parsedTab = parseArchivedTab(rawTab, name, tabIndex, errors);
    if (parsedTab) {
      tabs.push(parsedTab);
    }
  });

  if (tabs.length !== rawTabs.length) {
    return null;
  }

  return {
    id,
    name,
    createdAt,
    tabs,
    tabCount: tabs.length,
  };
}

/** 解析导入 JSON，并做严格结构校验。 */
export function parseImportJSON(text: string): { sessions: ArchivedSession[]; errors: string[] } {
  const errors: string[] = [];

  try {
    const data = JSON.parse(text) as { version?: unknown; sessions?: unknown };
    if (!Array.isArray(data.sessions)) {
      errors.push('Invalid format: missing sessions array');
      return { sessions: [], errors };
    }
    if (data.sessions.length > MAX_IMPORT_SESSIONS) {
      errors.push(`Too many sessions: maximum is ${MAX_IMPORT_SESSIONS}`);
      return { sessions: [], errors };
    }
    if (data.version !== undefined && data.version !== CURRENT_EXPORT_VERSION) {
      const versionLabel = typeof data.version === 'string' || typeof data.version === 'number'
        ? String(data.version)
        : 'unknown';
      errors.push(`Unsupported import version: ${versionLabel}`);
      return { sessions: [], errors };
    }

    const sessions: ArchivedSession[] = [];
    data.sessions.forEach((rawSession, index) => {
      const parsedSession = parseArchivedSession(rawSession, index, errors);
      if (parsedSession) {
        sessions.push(parsedSession);
      }
    });

    return errors.length > 0
      ? { sessions: [], errors }
      : { sessions, errors };
  } catch (error) {
    errors.push('Invalid JSON: ' + (error instanceof Error ? error.message : String(error)));
    return { sessions: [], errors };
  }
}

// ── v1.0 封板：多格式导出（F-15） ──────────────────────

/**
 * Markdown 导出：`## 会话名` + `- [title](url)`。
 */
export function exportSessionsMarkdown(sessions: ArchivedSession[]): string {
  const lines: string[] = [`# ${BRAND.name} 归档 · ${new Date().toLocaleString()}`, ''];
  for (const s of sessions) {
    lines.push(`## ${s.name}`);
    for (const tab of s.tabs) {
      const title = tab.title !== '' ? tab.title : tab.url;
      lines.push(`- [${title}](${tab.url})`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * TXT 导出：一行一 URL，会话间空行分隔。
 */
export function exportSessionsText(sessions: ArchivedSession[]): string {
  const lines: string[] = [];
  for (const s of sessions) {
    for (const tab of s.tabs) lines.push(tab.url);
    lines.push('');
  }
  return lines.join('\n').trim() + '\n';
}

/**
 * HTML 导出：Netscape Bookmark File Format 1（可被其他浏览器导入）。
 */
export function exportSessionsHTML(sessions: ArchivedSession[]): string {
  const parts: string[] = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    `<H1>${BRAND.name} Export</H1>`,
    '<DL><p>',
  ];
  for (const s of sessions) {
    parts.push(`  <DT><H3>${escapeHtml(s.name)}</H3>`);
    parts.push('  <DL><p>');
    for (const tab of s.tabs) {
      const title = tab.title !== '' ? tab.title : tab.url;
      parts.push(`    <DT><A HREF="${escapeAttr(tab.url)}">${escapeHtml(title)}</A>`);
    }
    parts.push('  </DL><p>');
  }
  parts.push('</DL><p>');
  return parts.join('\n');
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}

// ── v1.0 封板：多格式导入（F-15） ──────────────────────

/**
 * 从 Netscape HTML 书签解析会话（H3 = 会话名，A = Tab；未分组归入"未命名"）。
 */
export function parseImportHTML(text: string): { sessions: ArchivedSession[]; errors: string[] } {
  const errors: string[] = [];
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    const sessions: ArchivedSession[] = [];

    // 找到每个 H3 对应的紧随其后的 DL
    const h3s = Array.from(doc.querySelectorAll('h3'));
    const handled = new Set<HTMLAnchorElement>();

    for (const h3 of h3s) {
      const name = h3.textContent?.trim() ?? '未命名';
      const dl = h3.nextElementSibling;
      if (dl?.tagName !== 'DL') continue;
      const anchors = Array.from(dl.querySelectorAll('a'));
      const tabs: ArchivedTab[] = [];
      for (const a of anchors) {
        handled.add(a);
        const url = a.getAttribute('href') ?? '';
        if (!isValidUrl(url)) continue;
        tabs.push({
          url,
          title: a.textContent?.trim() ?? url,
          favIconUrl: '',
          hostname: deriveHostname(url),
          pinned: false,
        });
      }
      if (tabs.length > 0) {
        sessions.push({
          id: `import-${Date.now()}-${sessions.length}`,
          name,
          createdAt: Date.now(),
          tabs,
          tabCount: tabs.length,
          source: 'import',
        });
      }
    }

    // 兜底：未分组的 A
    const allAnchors = Array.from(doc.querySelectorAll('a'));
    const orphanTabs: ArchivedTab[] = [];
    for (const a of allAnchors) {
      if (handled.has(a)) continue;
      const url = a.getAttribute('href') ?? '';
      if (!isValidUrl(url)) continue;
      orphanTabs.push({
        url,
        title: a.textContent?.trim() ?? url,
        favIconUrl: '',
        hostname: deriveHostname(url),
        pinned: false,
      });
    }
    if (orphanTabs.length > 0) {
      sessions.push({
        id: `import-${Date.now()}-orphan`,
        name: '未命名',
        createdAt: Date.now(),
        tabs: orphanTabs,
        tabCount: orphanTabs.length,
        source: 'import',
      });
    }

    return { sessions, errors };
  } catch (err) {
    errors.push('HTML parse failed: ' + (err instanceof Error ? err.message : String(err)));
    return { sessions: [], errors };
  }
}

/**
 * 从 OneTab 格式文本解析（URL | title，一行一条，空行分组）。
 */
export function parseImportOneTab(text: string): { sessions: ArchivedSession[]; errors: string[] } {
  const errors: string[] = [];
  const sessions: ArchivedSession[] = [];
  const lines = text.split('\n');
  let current: ArchivedTab[] = [];
  let groupIndex = 0;
  const flush = () => {
    if (current.length === 0) return;
    sessions.push({
      id: `onetab-${Date.now()}-${groupIndex++}`,
      name: `OneTab 组 ${groupIndex}`,
      createdAt: Date.now(),
      tabs: current,
      tabCount: current.length,
      source: 'import',
    });
    current = [];
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') {
      flush();
      continue;
    }
    const pipeIdx = trimmed.indexOf(' | ');
    const url = pipeIdx === -1 ? trimmed : trimmed.slice(0, pipeIdx).trim();
    const title = pipeIdx === -1 ? url : trimmed.slice(pipeIdx + 3).trim();
    if (!isValidUrl(url)) continue;
    current.push({
      url,
      title,
      favIconUrl: '',
      hostname: deriveHostname(url),
      pinned: false,
    });
  }
  flush();
  if (sessions.length === 0) errors.push('No valid URLs found');
  return { sessions, errors };
}

/**
 * 自动识别文本格式（JSON / HTML / OneTab）。
 */
export function parseImportAuto(text: string): { sessions: ArchivedSession[]; errors: string[] } {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return parseImportJSON(trimmed);
  }
  if (trimmed.toLowerCase().startsWith('<!doctype netscape-bookmark-file-1') ||
      trimmed.toLowerCase().includes('<dl>')) {
    return parseImportHTML(trimmed);
  }
  return parseImportOneTab(trimmed);
}

// ── 冲突策略 ──────────────────────────────────────────

export type ImportConflictStrategy = 'skip' | 'append' | 'replace';

export interface ImportApplyResult {
  importedSessions: number;
  importedTabs: number;
  skippedDuplicates: number;
}

/**
 * 把解析到的 sessions 按策略合并进已有 sessions，返回新的 sessions 数组与统计。
 */
export function applyImport(
  existing: ArchivedSession[],
  incoming: ArchivedSession[],
  strategy: ImportConflictStrategy,
): { sessions: ArchivedSession[]; stats: ImportApplyResult } {
  let importedSessions = 0;
  let importedTabs = 0;
  let skippedDuplicates = 0;

  if (strategy === 'replace') {
    for (const s of incoming) {
      importedSessions += 1;
      importedTabs += s.tabs.length;
    }
    return {
      sessions: incoming,
      stats: { importedSessions, importedTabs, skippedDuplicates },
    };
  }

  if (strategy === 'append') {
    // 全部追加为新会话
    for (const s of incoming) {
      importedSessions += 1;
      importedTabs += s.tabs.length;
    }
    return {
      sessions: [...incoming, ...existing],
      stats: { importedSessions, importedTabs, skippedDuplicates },
    };
  }

  // skip（默认）：URL 已存在则跳过
  const existingUrls = new Set<string>();
  for (const s of existing) {
    for (const tab of s.tabs) existingUrls.add(tab.url);
  }

  const accepted: ArchivedSession[] = [];
  for (const s of incoming) {
    const filteredTabs: ArchivedTab[] = [];
    for (const tab of s.tabs) {
      if (existingUrls.has(tab.url)) {
        skippedDuplicates += 1;
      } else {
        existingUrls.add(tab.url);
        filteredTabs.push(tab);
      }
    }
    if (filteredTabs.length > 0) {
      accepted.push({ ...s, tabs: filteredTabs, tabCount: filteredTabs.length });
      importedSessions += 1;
      importedTabs += filteredTabs.length;
    }
  }

  return {
    sessions: [...accepted, ...existing],
    stats: { importedSessions, importedTabs, skippedDuplicates },
  };
}

/**
 * 校验导入源体量限制：5MB / 20K 行 / 单会话 500KB。
 */
export function validateImportSizeLimits(text: string): string | null {
  const byteLength = new Blob([text]).size;
  if (byteLength > 5 * 1024 * 1024) return '导入源超过 5 MB 限制';
  const lines = text.split('\n').length;
  if (lines > 20000) return '导入源超过 20K 行限制';
  return null;
}
