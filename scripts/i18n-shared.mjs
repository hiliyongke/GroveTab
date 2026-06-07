/**
 * i18n 工具公共模块
 * scan / check / format 脚本共享
 */

import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

// ─── 中文提取正则 ────────────────────────────────────────────

/** 统一的 t() / translate() 提取正则（不排除 ) 字符） */
export const EXTRACT_PATTERNS = [
  { re: /\bt\s*\(\s*(['"\x60])([^'"\x60]*[\u4e00-\u9fff][^'"\x60]*)(\1)\s*(?:,|\))/gm, matchIdx: 2 },
  { re: /\btranslate\s*\(\s*(['"\x60])([^'"\x60]*[\u4e00-\u9fff][^'"\x60]*)(\1)\s*(?:,|\))/gm, matchIdx: 2 },
  { re: /\btranslateWithLocale\s*\([^,]+,\s*(['"\x60])([^'"\x60]*[\u4e00-\u9fff][^'"\x60]*)(\1)\s*(?:,|\))/gm, matchIdx: 2 },
  // 兼容 tRef.current(...) / tFn.current(...) 这类 ref 间接调用：仍视为已包裹
  { re: /\bt\w*Ref\.current\s*\(\s*(['"\x60])([^'"\x60]*[\u4e00-\u9fff][^'"\x60]*)(\1)\s*(?:,|\))/gm, matchIdx: 2 },
  { re: /\btranslate\w*Ref\.current\s*\(\s*(['"\x60])([^'"\x60]*[\u4e00-\u9fff][^'"\x60]*)(\1)\s*(?:,|\))/gm, matchIdx: 2 },
];

/** 兼容的"已包裹"调用删除模式（避免误报为裸中文） */
export const STRIP_WRAPPED_PATTERNS = [
  /\bt\s*\([^)]*\)/g,
  /\btranslate\s*\([^)]*\)/g,
  /\btranslateWithLocale\s*\([^)]*\)/g,
  // ref 间接调用：tRef.current(...) / tFnRef.current(...)
  /\bt\w*Ref\.current\s*\([^)]*\)/g,
  /\btranslate\w*Ref\.current\s*\([^)]*\)/g,
];

/**
 * 从文件内容提取所有中文 key（唯一）
 */
export function extractChineseKeys(content) {
  const results = new Set();
  for (const { re, matchIdx } of EXTRACT_PATTERNS) {
    const regex = new RegExp(re.source, re.flags);
    let m;
    while ((m = regex.exec(content)) !== null) {
      const text = m[matchIdx]?.trim();
      if (text) results.add(text);
    }
  }
  return [...results];
}

// ─── MD5 key 生成 ─────────────────────────────────────────────

export function textToKey(zhText) {
  return crypto.createHash('md5').update(zhText).digest('hex').slice(0, 8);
}

// ─── pangu 间距算法 ───────────────────────────────────────────

const CJK = '\u2e80-\u2eff\u2f00-\u2fdf\u3000-\u303f\u31c0-\u31ef\u3200-\u32ff' +
  '\u3300-\u33ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\ufe30-\ufe4f\uff00-\uffef';
const CJK_RE = new RegExp(`[${CJK}]`);
const isCJK = (c) => CJK_RE.test(c);
const isLatin = (c) => /[a-zA-Z\u00C0-\u024F]/.test(c);
const isDigit = (c) => /[0-9]/.test(c);
const isAsciiSymbol = (c) => /[!@#$%^&*()\-_=+\[\]{}|;:'",.<>?\\~`]/.test(c);
const isFullWidthOpen = (c) => /[\u300c\u300e\u3010\u3014\u2018\u201c\uff08\uff3b\uff5b\uff62]/.test(c);
const isFullWidthClose = (c) => /[\u300d\u300f\u3011\u3015\u2019\u201d\uff09\uff3d\uff5d\uff63]/.test(c);
const isFullWidthPunct = (c) => /[\u3001\u3002\uff0c\uff0e\uff1a\uff1b\uff1f\uff01]/.test(c);

function isEllipsis(chars, i) {
  if (chars[i] === '\u2026') return true;
  return chars[i] === '.' && chars[i + 1] === '.' && chars[i + 2] === '.';
}

function needSpace(prev, next) {
  if (isFullWidthOpen(prev) || isFullWidthClose(prev) || isFullWidthOpen(next) || isFullWidthClose(next)) return false;
  if (isFullWidthPunct(prev) || isFullWidthPunct(next)) return false;
  if (next === '{' || prev === '}') return false;
  if ((prev === '/' && (isCJK(next) || isDigit(next) || isLatin(next))) ||
    (next === '/' && (isCJK(prev) || isDigit(prev) || isLatin(prev)))) return false;
  if (isCJK(prev) && (isLatin(next) || isDigit(next) || isAsciiSymbol(next))) return true;
  if ((isLatin(prev) || isDigit(prev) || isAsciiSymbol(prev)) && isCJK(next)) return true;
  return false;
}

export function pangu(text) {
  if (!text || typeof text !== 'string') return text;
  const chars = [...text];
  const result = [];
  let i = 0;
  while (i < chars.length) {
    const prev = result.length > 0 ? result[result.length - 1] : '';
    if (isEllipsis(chars, i) && prev && isCJK(prev)) {
      if (chars[i] === '\u2026') { result.push(chars[i]); i++; }
      else { result.push('...'); i += 3; }
      continue;
    }
    if (chars[i] === '{' && prev && isCJK(prev)) {
      const end = chars.indexOf('}', i);
      if (end !== -1) { result.push(chars.slice(i, end + 1).join('')); i = end + 1; continue; }
    }
    if (chars[i] === ' ' || chars[i] === '\u3000') { if (prev !== ' ') result.push(' '); i++; continue; }
    if (prev && prev !== ' ' && needSpace(prev, chars[i])) result.push(' ');
    result.push(chars[i]);
    i++;
  }
  return result.join('').trim();
}

// ─── 文件扫描 ─────────────────────────────────────────────────

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

export function collectFiles(rootDir) {
  const results = [];
  function walk(dir) {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fp = path.join(dir, item.name);
      if (item.isDirectory()) {
        if (item.name === 'node_modules' || item.name.startsWith('.')) continue;
        walk(fp);
      } else if (EXTENSIONS.some(e => item.name.endsWith(e))) {
        results.push(fp);
      }
    }
  }
  walk(rootDir);
  return results;
}

export function isNoScan(filePath) {
  return fs.readFileSync(filePath, 'utf-8').includes('@i18n-noscan');
}

// ─── 未 t() 包裹的中文检测 ────────────────────────────────────────

/**
 * 检测源码中未用 t()/translate() 包裹的中文字符串。
 * 排除：控制台日志、模板字符串插值、注释（已去除）
 * 返回：{ file: 短路径, lines: [{ line, text }] }
 */
export function findStrayChinese(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  // 去掉注释
  content = content.replace(/\/\/.*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  // 去掉 import 语句中的路径
  content = content.replace(/import\s+.*?from\s+['"]([^'"]*)['"]/g, '');

  // 提取所有 t/translate 包裹的中文（这些是合法的）
  const covered = new Set(extractChineseKeys(content));

  // 去掉所有 t/translate 调用本身（整个调用含内容全部删掉，防止内嵌引号残留）
  for (const { re } of EXTRACT_PATTERNS) {
    // 匹配整个 t(...)/translate(...) 调用，不留残余引号字符串
    content = content.replace(new RegExp(re.source.replace(/\([^)]*\)[^)]*$/, ')'), 'g'), '');
  }
  // 也用兼容模式删掉剩余的 t()/translate()/tRef.current() 等模式
  for (const pat of STRIP_WRAPPED_PATTERNS) {
    content = content.replace(pat, '');
  }

  // 找出剩余的中文字符串
  const lines = [];
  const strRe = /(['"\x60])([^'"\x60]*[\u4e00-\u9fff][^'"\x60]*)\1/g;
  let m;
  while ((m = strRe.exec(content)) !== null) {
    const text = m[2].trim();
    if (!text || covered.has(text)) continue;
    // 排除纯标点/格式字符串（不含任何实际中文内容）
    if (/^[，。！？、；：""''「」『』【】《》（）——……￥·–—]+$/.test(text)) continue;
    lines.push({ text: text.length > 50 ? text.slice(0, 50) + '…' : text });
  }

  const shortPath = filePath.replace(/^.*src\//, 'src/');
  return lines.length > 0 ? { file: shortPath, lines: [...new Set(lines.map(l => l.text))] } : null;
}
