/**
 * PinyinSearch — Enhance search with pinyin initial matching.
 *
 * pinyin-pro (~295KB) is loaded lazily in the background to avoid
 * bloating the initial bundle. On first calls, pinyin matching is
 * skipped; direct text matching still works immediately.
 */

let _pinyin: typeof import('pinyin-pro').pinyin | undefined;

// Non-blocking lazy load — the module import is a separate chunk
import('pinyin-pro')
  .then((mod) => { _pinyin = mod.pinyin; })
  .catch(() => { /* pinyin optional, direct match fallback suffices */ });

/** Extract pinyin initials from a string (e.g. "标签" → "bq") */
function getPinyinInitials(text: string): string {
  if (!_pinyin) return '';
  try {
    return _pinyin(text, { pattern: 'first', toneType: 'none' }).replace(/\s/g, '');
  } catch {
    return '';
  }
}

/** Check if a query matches text via pinyin initials */
export function pinyinMatch(text: string, query: string): boolean {
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();

  // Direct match — always available
  if (textLower.includes(queryLower)) return true;

  // Pinyin match — only available after lazy chunk has loaded
  if (!_pinyin) return false;

  const initials = getPinyinInitials(text);
  if (initials.toLowerCase().includes(queryLower)) return true;

  const fullPinyin = _pinyin(text, { pattern: 'pinyin', toneType: 'none' }).replace(/\s/g, '');
  if (fullPinyin.toLowerCase().includes(queryLower)) return true;

  return false;
}
