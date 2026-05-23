/**
 * 拼音搜索增强 —— 支持拼音首字母匹配
 *
 * 允许用户输入拼音首字母（如 "bq"）来搜索中文内容（如 "标签"）。
 */

import { pinyin } from 'pinyin-pro';

/**
 * 提取字符串的拼音首字母（如 "标签" → "bq"）
 *
 * @param text 输入字符串
 * @returns 拼音首字母串（无空格）
 */
function getPinyinInitials(text: string): string {
  try {
    return pinyin(text, { pattern: 'first', toneType: 'none' }).replace(/\s/g, '');
  } catch {
    return '';
  }
}

/**
 * 判断查询字符串是否通过拼音首字母匹配目标文本
 *
 * 匹配策略（优先级从高到低）：
 *   1. 直接包含（如 "标签" 包含 "标签"）
 *   2. 拼音首字母匹配（如 "bq" 匹配 "标签"）
 *   3. 全拼匹配（如 "biaoqian" 匹配 "标签"）
 *
 * @param text  目标文本（如标签页标题）
 * @param query 查询字符串（支持中文或拼音）
 * @returns 是否匹配
 */
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
