/**
 * 归档导入导出工具。
 */

import type { ArchivedSession, ArchivedTab } from '@/shared/types';

const CURRENT_EXPORT_VERSION = 1;
const MAX_IMPORT_SESSIONS = 500;
const MAX_IMPORT_TABS_PER_SESSION = 500;
const MAX_STRING_LENGTH = 2048;

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

/** URL 基础校验。 */
function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return !['chrome:', 'chrome-extension:', 'about:'].includes(url.protocol);
  } catch {
    return false;
  }
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
