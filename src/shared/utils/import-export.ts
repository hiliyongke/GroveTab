/**
 * Import/Export utilities for archived sessions
 */

import type { ArchivedSession } from '@/shared/types';

/** Export sessions to JSON string */
export function exportSessionsJSON(sessions: ArchivedSession[]): string {
  return JSON.stringify({ version: 1, exportedAt: Date.now(), sessions }, null, 2);
}

/** Download a string as a file */
export function downloadFile(content: string, filename: string, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Parse imported JSON file */
export function parseImportJSON(text: string): { sessions: ArchivedSession[]; errors: string[] } {
  const errors: string[] = [];
  try {
    const data = JSON.parse(text);
    if (!data.sessions || !Array.isArray(data.sessions)) {
      errors.push('Invalid format: missing sessions array');
      return { sessions: [], errors };
    }
    const sessions = data.sessions.filter((s: Partial<ArchivedSession>) => {
      if (!s.id || !s.tabs || !Array.isArray(s.tabs)) {
        errors.push(`Invalid session: ${s.name || s.id || 'unknown'}`);
        return false;
      }
      return true;
    }) as ArchivedSession[];
    return { sessions, errors };
  } catch (e) {
    errors.push('Invalid JSON: ' + (e instanceof Error ? e.message : String(e)));
    return { sessions: [], errors };
  }
}
