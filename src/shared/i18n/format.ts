import { translate } from "./core";

/**
 * i18n 翻译文本格式化插件 —— pangu 间距算法
 *
 * 规则（源自 W3C CLREQ / pangu.js）：
 *   CJK ↔ Latin letter        → 加空格
 *   CJK ↔ Digit               → 加空格
 *   CJK ↔ ASCII Symbol        → 加空格
 *
 * 豁免：
 *   - {placeholder} 占位符视为整体，不拆分
 *   - 全角标点「」（）【】《》前后不加多余空格
 *   - 中文语境下的 / 分隔符不加空格
 *   - 省略号 ... / … 在中文后不加前空格
 */

// ─── 字符检测 ────────────────────────────────────────────────

const CJK =
  '\u2e80-\u2eff\u2f00-\u2fdf\u3000-\u303f\u31c0-\u31ef\u3200-\u32ff' +
  '\u3300-\u33ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\ufe30-\ufe4f\uff00-\uffef';

const CJK_RE = new RegExp(`[${CJK}]`);
const isCJK = (c: string): boolean => CJK_RE.test(c);
const isLatin = (c: string): boolean => /[a-zA-Z\u00C0-\u024F]/.test(c);
const isDigit = (c: string): boolean => /[0-9]/.test(c);

/** ASCII 符号（半角） */
const isAsciiSymbol = (c: string): boolean =>
  /[!@#$%^&*()\-_=+\[\]{}|;:'",.<>?\\~`]/.test(c);

/** 全角左引号/括号 */
const isFullWidthOpen = (c: string): boolean => /[\u300c\u300e\u3010\u3014\u2018\u201c\uff08\uff3b\uff5b\uff62]/.test(c);

/** 全角右引号/括号 */
const isFullWidthClose = (c: string): boolean => /[\u300d\u300f\u3011\u3015\u2019\u201d\uff09\uff3d\uff5d\uff63]/.test(c);

/** 全角标点（逗号、句号、顿号等） */
const isFullWidthPunct = (c: string): boolean =>
  /[\u3001\u3002\uff0c\uff0e\uff1a\uff1b\uff1f\uff01]/.test(c);

/** 中文省略号 */
const isEllipsis = (chars: string[], i: number): boolean => {
  if (chars[i] === '\u2026') return true; // …
  if (chars[i] === '.' && chars[i + 1] === '.' && chars[i + 2] === '.') return true; // ...
  return false;
};

/** 占位符 {xxx} */
const isPlaceholderStart = (c: string): boolean => c === '{';
const isPlaceholderEnd = (c: string): boolean => c === '}';

// ─── 间距判断 ────────────────────────────────────────────────

function needSpace(prev: string, next: string): boolean {
  // 全角标点/引号前后不加空格
  if (isFullWidthOpen(prev) || isFullWidthClose(prev)) return false;
  if (isFullWidthOpen(next) || isFullWidthClose(next)) return false;
  if (isFullWidthPunct(prev) || isFullWidthPunct(next)) return false;

  // { 前 CJK → 不加（占位符开始）
  if (isPlaceholderStart(next)) return false;
  // } 后 CJK → 不加（占位符结束）
  if (isPlaceholderEnd(prev)) return false;

  // / 分隔符在中日文语境不加空格
  if (prev === '/' && (isCJK(next) || isDigit(next) || isLatin(next))) return false;
  if (next === '/' && (isCJK(prev) || isDigit(prev) || isLatin(prev))) return false;

  // 中文省略号前不加空格
  // (handled elsewhere)

  // CJK ↔ Latin/Digit/Symbol
  if (isCJK(prev) && (isLatin(next) || isDigit(next) || isAsciiSymbol(next))) return true;
  if ((isLatin(prev) || isDigit(prev) || isAsciiSymbol(prev)) && isCJK(next)) return true;

  return false;
}

// ─── 核心算法 ────────────────────────────────────────────────

export function panguSpacing(text: string): string {
  if (!text || typeof text !== 'string') return text;

  const chars = [...text];
  const result: string[] = [];
  let i = 0;

  while (i < chars.length) {
    const prev = result.length > 0 ? result[result.length - 1] : '';
    const curr = chars[i] as string;

    // 省略号处理：中文后的 ... 或 … 不加前空格
    if (isEllipsis(chars, i) && prev && isCJK(prev)) {
      // 直接输出省略号（不加空格）
      if (curr === '\u2026') {
        result.push(curr);
        i++;
      } else {
        result.push('...');
        i += 3;
      }
      continue;
    }

    // 占位符 {xxx}：整体输出
    if (isPlaceholderStart(curr) && prev && isCJK(prev)) {
      // 不加空格，占位符紧跟中文
      const end = chars.indexOf('}', i);
      if (end !== -1) {
        result.push(chars.slice(i, end + 1).join(''));
        i = end + 1;
        continue;
      }
    }

    // 跳过连续空格
    if (curr === ' ' || curr === '\u3000') {
      if (prev !== ' ') result.push(' ');
      i++;
      continue;
    }

    // 核心判断
    if (prev && prev !== ' ' && needSpace(prev, curr)) {
      result.push(' ');
    }

    result.push(curr);
    i++;
  }

  return result.join('').trim();
}

/**
 * 批量处理翻译字典 en 值
 */
export function formatEnDict(enDict: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  let count = 0;
  for (const [key, value] of Object.entries(enDict)) {
    if (value && typeof value === 'string') {
      const formatted = panguSpacing(value);
      result[key] = formatted;
      if (formatted !== value) count++;
    } else {
      result[key] = value;
    }
  }
  if (count > 0) console.log(translate("  [pangu] {count} 条翻译已自动调整间距", { count }));
  return result;
}
