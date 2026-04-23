/**
 * PinyinSearch — Enhance search with pinyin initial matching
 */

import { pinyin } from 'pinyin-pro';

/** Extract pinyin initials from a string (e.g. "标签" → "bq") */
function getPinyinInitials(text: string): string {
  try {
    return pinyin(text, { pattern: 'first', toneType: 'none' }).replace(/\s/g, '');
  } catch {
    return '';
  }
}

/** Check if a query matches text via pinyin initials */
export function pinyinMatch(text: string, query: string): boolean {
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();

  // Direct match
  if (textLower.includes(queryLower)) return true;

  // Pinyin initials match (e.g. "bq" matches "标签")
  const initials = getPinyinInitials(text);
  if (initials.toLowerCase().includes(queryLower)) return true;

  // Full pinyin match
  const fullPinyin = pinyin(text, { pattern: 'pinyin', toneType: 'none' }).replace(/\s/g, '');
  if (fullPinyin.toLowerCase().includes(queryLower)) return true;

  return false;
}
