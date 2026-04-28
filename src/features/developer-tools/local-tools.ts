/**
 * 开发工具栏 —— 本地纯函数工具集
 *
 * 所有转换逻辑均为纯函数，无副作用，便于测试。
 * 首版不引入任何第三方依赖，优先使用浏览器 Web API。
 */

/** 工具执行结果 */
export interface DevToolResult {
  /** 转换输出文本 */
  output: string;
  /** 附加信息（如时间戳的可读日期） */
  meta?: string;
  /** 错误信息（非空时表示转换失败） */
  error?: string;
  /** 颜色预览附加：CSS 可用的颜色值 */
  colorValue?: string;
}

// ── JSON 格式化 ──────────────────────────────────────

/** JSON 操作模式 */
export type JsonAction = 'format' | 'minify' | 'validate';

/**
 * JSON 格式化 / 压缩 / 校验
 *
 * @param input - 原始 JSON 文本
 * @param action - 操作类型
 * @returns 格式化或压缩后的文本，校验时原样返回
 */
export function jsonTransform(input: string, action: JsonAction): DevToolResult {
  if (!input.trim()) return { output: '', error: '输入为空' };
  try {
    const parsed = JSON.parse(input);
    switch (action) {
      case 'format':
        return { output: JSON.stringify(parsed, null, 2) };
      case 'minify':
        return { output: JSON.stringify(parsed) };
      case 'validate':
        return { output: input, meta: 'JSON 格式正确 ✓' };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { output: '', error: `JSON 解析失败：${msg}` };
  }
}

// ── URL 编解码 ────────────────────────────────────────

/** URL 操作模式 */
export type UrlAction = 'encode' | 'decode';

/**
 * URL 编码或解码
 *
 * @param input - 原始文本
 * @param action - 编码或解码
 */
export function urlTransform(input: string, action: UrlAction): DevToolResult {
  if (!input) return { output: '', error: '输入为空' };
  try {
    switch (action) {
      case 'encode':
        return { output: encodeURIComponent(input) };
      case 'decode':
        return { output: decodeURIComponent(input) };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { output: '', error: `URL ${action === 'encode' ? '编码' : '解码'}失败：${msg}` };
  }
}

// ── Base64 编解码 ─────────────────────────────────────

/** Base64 操作模式 */
export type Base64Action = 'encode' | 'decode';

/**
 * Base64 编码或解码（支持 Unicode）
 *
 * 编码时先通过 TextEncoder 转为 Uint8Array 再 btoa；
 * 解码时先 atob 再通过 TextDecoder 还原。
 */
export function base64Transform(input: string, action: Base64Action): DevToolResult {
  if (!input) return { output: '', error: '输入为空' };
  try {
    switch (action) {
      case 'encode': {
        const bytes = new TextEncoder().encode(input);
        const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
        return { output: btoa(binary) };
      }
      case 'decode': {
        const binary = atob(input.trim());
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        return { output: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { output: '', error: `Base64 ${action === 'encode' ? '编码' : '解码'}失败：${msg}` };
  }
}

// ── 时间戳转换 ────────────────────────────────────────

/** 时间戳操作模式 */
export type TimestampAction = 'toDatetime' | 'toTimestamp';

/**
 * Unix 时间戳与日期时间互转
 *
 * 自动识别秒（10 位）和毫秒（13 位）时间戳。
 */
export function timestampTransform(input: string, action: TimestampAction): DevToolResult {
  if (!input.trim()) return { output: '', error: '输入为空' };
  try {
    switch (action) {
      case 'toDatetime': {
        const num = Number(input.trim());
        if (!Number.isFinite(num) || num < 0) {
          return { output: '', error: '无效的时间戳' };
        }
        // 自动识别秒/毫秒：10 位以下视为秒
        const ms = num > 9999999999 ? num : num * 1000;
        const date = new Date(ms);
        if (isNaN(date.getTime())) {
          return { output: '', error: '无效的时间戳' };
        }
        const iso = date.toISOString();
        const local = date.toLocaleString('zh-CN', { hour12: false });
        return {
          output: iso,
          meta: `本地时间：${local}`,
        };
      }
      case 'toTimestamp': {
        const date = new Date(input.trim());
        if (isNaN(date.getTime())) {
          return { output: '', error: '无效的日期时间，请输入如 2024-01-01 或 ISO 格式' };
        }
        const sec = Math.floor(date.getTime() / 1000);
        const ms = date.getTime();
        return {
          output: String(sec),
          meta: `毫秒：${ms}`,
        };
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { output: '', error: `时间戳转换失败：${msg}` };
  }
}

// ── SHA-256 摘要 ─────────────────────────────────────

/**
 * 计算文本的 SHA-256 哈希值
 *
 * 使用 Web Crypto API（浏览器原生，无需第三方依赖）。
 */
export async function sha256Digest(input: string): Promise<DevToolResult> {
  if (!input) return { output: '', error: '输入为空' };
  try {
    const bytes = new TextEncoder().encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return { output: hex };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { output: '', error: `SHA-256 计算失败：${msg}` };
  }
}

// ── 进制转换 ──────────────────────────────────────────

/** 进制名称到基数的映射 */
const RADIX_MAP: Record<string, number> = {
  bin: 2,
  oct: 8,
  dec: 10,
  hex: 16,
};

/** 进制转换操作模式 */
export type RadixAction = 'toDec' | 'toBin' | 'toOct' | 'toHex';

/**
 * 进制转换
 *
 * @param input - 输入数字文本
 * @param fromRadix - 输入进制：'bin' | 'oct' | 'dec' | 'hex'
 * @param toRadix - 输出进制：'bin' | 'oct' | 'dec' | 'hex'
 */
export function radixTransform(input: string, fromRadix: string, toRadix: string): DevToolResult {
  if (!input.trim()) return { output: '', error: '输入为空' };
  const fromBase = RADIX_MAP[fromRadix];
  const toBase = RADIX_MAP[toRadix];
  if (!fromBase || !toBase) return { output: '', error: '不支持的进制' };
  try {
    const num = parseInt(input.trim(), fromBase);
    if (isNaN(num)) {
      return { output: '', error: `无效的${fromRadix === 'bin' ? '二进制' : fromRadix === 'oct' ? '八进制' : fromRadix === 'hex' ? '十六进制' : '十进制'}数` };
    }
    const result = num.toString(toBase).toUpperCase();
    return { output: result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { output: '', error: `进制转换失败：${msg}` };
  }
}

// ── 随机数 / UUID ─────────────────────────────────────

/** 随机生成操作模式 */
export type RandomAction = 'uuid' | 'randomInt' | 'randomHex';

/**
 * 生成随机数或 UUID
 *
 * UUID v4 使用 crypto.randomUUID（浏览器原生）；
 * 随机整数和十六进制使用 crypto.getRandomValues。
 */
export function randomGenerate(action: RandomAction, length?: number): DevToolResult {
  try {
    switch (action) {
      case 'uuid': {
        const uuid = crypto.randomUUID();
        return { output: uuid };
      }
      case 'randomInt': {
        const len = Math.max(1, Math.min(length ?? 6, 16));
        const values = new Uint32Array(1);
        crypto.getRandomValues(values);
        const min = Math.pow(10, len - 1);
        const max = Math.pow(10, len) - 1;
        const result = min + (values[0] % (max - min + 1));
        return { output: String(result) };
      }
      case 'randomHex': {
        const len = Math.max(1, Math.min(length ?? 32, 128));
        const bytes = new Uint8Array(Math.ceil(len / 2));
        crypto.getRandomValues(bytes);
        const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, len);
        return { output: hex };
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { output: '', error: `随机生成失败：${msg}` };
  }
}

// ── 颜色值预览 ────────────────────────────────────────

/** 解析颜色值 */
export function colorParse(input: string): DevToolResult {
  const trimmed = input.trim();
  if (!trimmed) return { output: '', error: '输入为空' };

  // 尝试解析 HEX
  const hexMatch = trimmed.match(/^#?([0-9a-fA-F]{3,8})$/);
  if (hexMatch) {
    const hex = hexMatch[1];
    // 校验有效长度
    if (![3, 4, 6, 8].includes(hex.length)) {
      return { output: '', error: 'HEX 颜色值应为 3/4/6/8 位' };
    }
    const fullHex = hex.length === 3
      ? `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
      : `#${hex}`;
    return { output: fullHex.toUpperCase(), colorValue: fullHex };
  }

  // 尝试解析 rgb/rgba
  const rgbMatch = trimmed.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+))?\s*\)$/i);
  if (rgbMatch) {
    const [, r, g, b, a] = rgbMatch;
    const ri = Number(r), gi = Number(g), bi = Number(b);
    if (ri > 255 || gi > 255 || bi > 255) {
      return { output: '', error: 'RGB 值应在 0-255 之间' };
    }
    const hexColor = `#${ri.toString(16).padStart(2, '0')}${gi.toString(16).padStart(2, '0')}${bi.toString(16).padStart(2, '0')}`;
    const output = a !== undefined
      ? `rgba(${ri}, ${gi}, ${bi}, ${a})`
      : `rgb(${ri}, ${gi}, ${bi})`;
    return { output, meta: `HEX: ${hexColor.toUpperCase()}`, colorValue: hexColor };
  }

  // 尝试解析 hsl/hsla
  const hslMatch = trimmed.match(/^hsla?\(\s*(\d{1,3})\s*,\s*(\d{1,3})%?\s*,\s*(\d{1,3})%?\s*(?:,\s*([\d.]+))?\s*\)$/i);
  if (hslMatch) {
    const [, h, s, l, a] = hslMatch;
    const hi = Number(h), si = Number(s), li = Number(l);
    if (hi > 360 || si > 100 || li > 100) {
      return { output: '', error: 'HSL 值超出范围（H:0-360, S:0-100, L:0-100）' };
    }
    const output = a !== undefined
      ? `hsla(${hi}, ${si}%, ${li}%, ${a})`
      : `hsl(${hi}, ${si}%, ${li}%)`;
    return { output, colorValue: output };
  }

  return { output: '', error: '无法识别的颜色格式，请输入 HEX / RGB / HSL' };
}

// ── 多算法哈希 ────────────────────────────────────────

/** 哈希算法类型 */
export type HashAlgorithm = 'sha256' | 'sha1' | 'sha512';

/**
 * 计算文本的哈希摘要
 *
 * 使用 Web Crypto API，支持 SHA-1 / SHA-256 / SHA-512。
 *
 * @param input - 原始文本
 * @param algorithm - 哈希算法
 */
export async function hashDigest(input: string, algorithm: HashAlgorithm = 'sha256'): Promise<DevToolResult> {
  if (!input) return { output: '', error: '输入为空' };
  try {
    const algoName = algorithm === 'sha1' ? 'SHA-1' : algorithm === 'sha512' ? 'SHA-512' : 'SHA-256';
    const bytes = new TextEncoder().encode(input);
    const hashBuffer = await crypto.subtle.digest(algoName, bytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return { output: hex, meta: `${algoName} · ${hashArray.length * 8} bit` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { output: '', error: `哈希计算失败：${msg}` };
  }
}

// ── 正则测试 ──────────────────────────────────────────

/**
 * 正则表达式匹配测试
 *
 * @param input - 待测试文本
 * @param pattern - 正则表达式字符串
 * @param flags - 正则标志（如 g、i、m）
 */
export function regexTest(input: string, pattern: string, flags: string): DevToolResult {
  if (!pattern.trim()) return { output: '', error: '正则表达式为空' };
  try {
    const regex = new RegExp(pattern, flags);
    const matches: string[] = [];
    let match: RegExpExecArray | null;
    if (regex.global) {
      while ((match = regex.exec(input)) !== null) {
        matches.push(match[0]);
        if (match[0] === '') regex.lastIndex++; // 防止零宽匹配死循环
      }
    } else {
      match = regex.exec(input);
      if (match) matches.push(...match.filter((_, i) => i > 0 && _ !== undefined));
    }
    if (matches.length === 0) {
      return { output: '无匹配', meta: `正则 /${pattern}/${flags} 未匹配到任何内容` };
    }
    const unique = [...new Set(matches)];
    return {
      output: unique.join('\n'),
      meta: `匹配 ${matches.length} 处（${unique.length} 种）`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { output: '', error: `正则语法错误：${msg}` };
  }
}

// ── 文本差异对比 ──────────────────────────────────────

/** 差异行类型 */
type DiffLineType = 'equal' | 'add' | 'remove';

interface DiffLine {
  type: DiffLineType;
  content: string;
}

/**
 * 简易文本差异对比（基于行级 LCS）
 *
 * 不引入第三方 diff 库，使用经典 LCS 算法实现行级对比。
 *
 * @param left - 左侧文本
 * @param right - 右侧文本
 */
export function textDiff(left: string, right: string): DevToolResult {
  const linesA = left.split('\n');
  const linesB = right.split('\n');

  // 构建 LCS 表
  const m = linesA.length;
  const n = linesB.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = linesA[i - 1] === linesB[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // 回溯差异
  const diff: DiffLine[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      diff.unshift({ type: 'equal', content: linesA[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({ type: 'add', content: linesB[j - 1] });
      j--;
    } else {
      diff.unshift({ type: 'remove', content: linesA[i - 1] });
      i--;
    }
  }

  const added = diff.filter((d) => d.type === 'add').length;
  const removed = diff.filter((d) => d.type === 'remove').length;
  const output = diff.map((d) => {
    const prefix = d.type === 'add' ? '+ ' : d.type === 'remove' ? '- ' : '  ';
    return `${prefix}${d.content}`;
  }).join('\n');

  return {
    output,
    meta: added + removed === 0 ? '文本完全相同' : `+${added} 行  -${removed} 行`,
  };
}

// ── HTML 实体编解码 ───────────────────────────────────

/** HTML 实体操作模式 */
export type HtmlEntityAction = 'encode' | 'decode';

/** 需要编码的 HTML 特殊字符映射 */
const HTML_ENTITIES: [RegExp, string][] = [
  [/&/g, '&amp;'],
  [/</g, '&lt;'],
  [/>/g, '&gt;'],
  [/"/g, '&quot;'],
  [/'/g, '&#39;'],
];

/**
 * HTML 实体编码或解码
 *
 * @param input - 原始文本
 * @param action - 编码或解码
 */
export function htmlEntityTransform(input: string, action: HtmlEntityAction): DevToolResult {
  if (!input) return { output: '', error: '输入为空' };
  try {
    switch (action) {
      case 'encode': {
        let result = input;
        for (const [regex, entity] of HTML_ENTITIES) {
          result = result.replace(regex, entity);
        }
        return { output: result };
      }
      case 'decode': {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = input;
        return { output: textarea.value };
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { output: '', error: `HTML 实体${action === 'encode' ? '编码' : '解码'}失败：${msg}` };
  }
}

// ── JWT 解码 ──────────────────────────────────────────

/** Base64URL 解码 */
function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/**
 * 解码 JWT 令牌
 *
 * 仅做本地解析，不校验签名，适合快速查看 header / payload。
 *
 * @param input - JWT 字符串
 */
export function jwtDecode(input: string): DevToolResult {
  const token = input.trim();
  if (!token) return { output: '', error: '输入为空' };
  const parts = token.split('.');
  if (parts.length < 2) return { output: '', error: 'JWT 至少应包含 header 和 payload 两段' };
  try {
    const header = JSON.parse(decodeBase64Url(parts[0]));
    const payload = JSON.parse(decodeBase64Url(parts[1]));
    const exp = typeof payload.exp === 'number' ? new Date(payload.exp * 1000) : null;
    const meta = exp
      ? `过期时间：${exp.toLocaleString('zh-CN', { hour12: false })}`
      : '未发现 exp 过期时间字段';
    return {
      output: JSON.stringify({ header, payload }, null, 2),
      meta,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { output: '', error: `JWT 解码失败：${msg}` };
  }
}

// ── URL Query 解析 / 构建 ─────────────────────────────

/** URL Query 操作模式 */
export type UrlQueryAction = 'parse' | 'build';

/**
 * URL Query 解析或构建
 *
 * @param input - URL、query 字符串或 JSON 对象文本
 * @param action - 解析或构建
 */
export function urlQueryTransform(input: string, action: UrlQueryAction): DevToolResult {
  if (!input.trim()) return { output: '', error: '输入为空' };
  try {
    if (action === 'parse') {
      const trimmed = input.trim();
      const search = /^https?:\/\//i.test(trimmed)
        ? new URL(trimmed).search
        : trimmed.startsWith('?') ? trimmed : `?${trimmed}`;
      const params = new URLSearchParams(search);
      const result: Record<string, string | string[]> = {};
      params.forEach((value, key) => {
        const old = result[key];
        if (old === undefined) result[key] = value;
        else if (Array.isArray(old)) old.push(value);
        else result[key] = [old, value];
      });
      return { output: JSON.stringify(result, null, 2), meta: `${Array.from(params.keys()).length} 个参数` };
    }

    const parsed = JSON.parse(input) as Record<string, unknown>;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(parsed)) {
      if (Array.isArray(value)) {
        value.forEach((item) => params.append(key, String(item)));
      } else if (value !== null && value !== undefined) {
        params.set(key, String(value));
      }
    }
    return { output: params.toString() };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { output: '', error: `URL Query ${action === 'parse' ? '解析' : '构建'}失败：${msg}` };
  }
}

// ── 命名风格转换 ──────────────────────────────────────

/** 拆分单词 */
function splitWords(input: string): string[] {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}

/** 首字母大写 */
function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * 命名风格转换
 *
 * @param input - 原始命名文本
 */
export function caseConvert(input: string): DevToolResult {
  const words = splitWords(input);
  if (words.length === 0) return { output: '', error: '输入为空' };
  const pascal = words.map(capitalize).join('');
  const camel = words[0] + words.slice(1).map(capitalize).join('');
  const result = {
    camelCase: camel,
    PascalCase: pascal,
    snake_case: words.join('_'),
    kebab_case: words.join('-'),
    CONSTANT_CASE: words.join('_').toUpperCase(),
    'Title Case': words.map(capitalize).join(' '),
  };
  return { output: JSON.stringify(result, null, 2) };
}

// ── JSON 转 TypeScript ───────────────────────────────

/** 推断 TS 类型 */
function inferTsType(value: unknown, name: string, interfaces: string[]): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'unknown[]';
    return `${inferTsType(value[0], name, interfaces)}[]`;
  }
  switch (typeof value) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'object': {
      const interfaceName = name.replace(/[^a-zA-Z0-9]/g, '') || 'Nested';
      const fields = Object.entries(value as Record<string, unknown>).map(([key, child]) => {
        const safeKey = /^[a-zA-Z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
        const childName = `${interfaceName}${capitalize(key.replace(/[^a-zA-Z0-9]/g, ''))}`;
        return `  ${safeKey}: ${inferTsType(child, childName, interfaces)};`;
      });
      interfaces.push(`export interface ${interfaceName} {\n${fields.join('\n')}\n}`);
      return interfaceName;
    }
    default:
      return 'unknown';
  }
}

/**
 * JSON 生成 TypeScript interface
 *
 * @param input - JSON 文本
 * @param rootName - 根 interface 名称
 */
export function jsonToTypeScript(input: string, rootName = 'Root'): DevToolResult {
  if (!input.trim()) return { output: '', error: '输入为空' };
  try {
    const parsed = JSON.parse(input);
    const interfaces: string[] = [];
    inferTsType(parsed, rootName, interfaces);
    return { output: interfaces.reverse().join('\n\n') };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { output: '', error: `JSON 转 TypeScript 失败：${msg}` };
  }
}

// ── HTTP 状态码查询 ───────────────────────────────────

const HTTP_STATUS_MAP: Record<number, string> = {
  100: 'Continue', 101: 'Switching Protocols', 102: 'Processing',
  200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content', 206: 'Partial Content',
  301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified', 307: 'Temporary Redirect', 308: 'Permanent Redirect',
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed', 408: 'Request Timeout', 409: 'Conflict', 410: 'Gone', 413: 'Payload Too Large', 415: 'Unsupported Media Type', 422: 'Unprocessable Content', 429: 'Too Many Requests',
  500: 'Internal Server Error', 501: 'Not Implemented', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout',
};

/** 查询 HTTP 状态码 */
export function httpStatusLookup(input: string): DevToolResult {
  const code = Number(input.trim());
  if (!Number.isInteger(code)) return { output: '', error: '请输入 HTTP 状态码数字' };
  const text = HTTP_STATUS_MAP[code];
  if (!text) return { output: '', error: '未收录该 HTTP 状态码' };
  const family = Math.floor(code / 100);
  const meta = family === 2 ? '成功响应' : family === 3 ? '重定向' : family === 4 ? '客户端错误' : family === 5 ? '服务端错误' : '信息响应';
  return { output: `${code} ${text}`, meta };
}

// ── MIME 类型查询 ─────────────────────────────────────

const MIME_MAP: Record<string, string> = {
  html: 'text/html', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript', json: 'application/json', xml: 'application/xml', txt: 'text/plain', csv: 'text/csv',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon',
  pdf: 'application/pdf', zip: 'application/zip', gz: 'application/gzip', wasm: 'application/wasm', mp4: 'video/mp4', mp3: 'audio/mpeg', wav: 'audio/wav',
  form: 'application/x-www-form-urlencoded', multipart: 'multipart/form-data',
};

/** 查询 MIME 类型或扩展名 */
export function mimeLookup(input: string): DevToolResult {
  const key = input.trim().replace(/^\./, '').toLowerCase();
  if (!key) return { output: '', error: '输入为空' };
  if (key.includes('/')) {
    const entries = Object.entries(MIME_MAP).filter(([, mime]) => mime === key);
    return entries.length > 0
      ? { output: entries.map(([ext]) => `.${ext}`).join('\n'), meta: `${entries.length} 个扩展名` }
      : { output: '', error: '未收录该 MIME 类型' };
  }
  const mime = MIME_MAP[key];
  return mime ? { output: mime } : { output: '', error: '未收录该扩展名' };
}

// ── CSS 单位转换 ──────────────────────────────────────

/** CSS 单位转换 */
export function cssUnitConvert(input: string, baseFontSize = 16): DevToolResult {
  const match = input.trim().match(/^(-?\d+(?:\.\d+)?)(px|rem|em)$/i);
  if (!match) return { output: '', error: '请输入形如 16px、1rem、1.5em 的值' };
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  const px = unit === 'px' ? value : value * baseFontSize;
  const rem = px / baseFontSize;
  const result = {
    px: `${Number(px.toFixed(4))}px`,
    rem: `${Number(rem.toFixed(4))}rem`,
    em: `${Number(rem.toFixed(4))}em`,
  };
  return { output: JSON.stringify(result, null, 2), meta: `基准字号：${baseFontSize}px` };
}

// ── 文本统计 ──────────────────────────────────────────

/** 文本统计 */
export function textStats(input: string): DevToolResult {
  const bytes = new TextEncoder().encode(input).length;
  const lines = input ? input.split('\n').length : 0;
  const words = input.trim() ? input.trim().split(/\s+/).length : 0;
  const chars = Array.from(input).length;
  return {
    output: JSON.stringify({ chars, words, lines, bytes }, null, 2),
    meta: `${chars} 字符 · ${bytes} 字节`,
  };
}

// ── Cron 表达式说明 ───────────────────────────────────

/** Cron 字段说明 */
function describeCronField(value: string, unit: string): string {
  if (value === '*') return `每${unit}`;
  if (value.startsWith('*/')) return `每 ${value.slice(2)} ${unit}`;
  if (value.includes(',')) return `${unit}为 ${value.split(',').join('、')}`;
  if (value.includes('-')) return `${unit}范围 ${value}`;
  return `${unit}为 ${value}`;
}

/** Cron 表达式说明（5 字段） */
export function cronDescribe(input: string): DevToolResult {
  const parts = input.trim().split(/\s+/);
  if (parts.length !== 5) return { output: '', error: '请输入 5 段 Cron 表达式：分 时 日 月 周' };
  const [minute, hour, day, month, week] = parts;
  const lines = [
    describeCronField(minute, '分钟'),
    describeCronField(hour, '小时'),
    describeCronField(day, '日期'),
    describeCronField(month, '月份'),
    describeCronField(week, '星期'),
  ];
  return { output: lines.join('\n'), meta: '标准 5 字段 Cron：分 时 日 月 周' };
}

// ── URL 拆解器 ────────────────────────────────────────

/** 拆解 URL 为各个组成部分 */
export function urlParse(input: string): DevToolResult {
  const trimmed = input.trim();
  if (!trimmed) return { output: '', error: '输入为空' };
  try {
    const url = new URL(trimmed);
    const result = {
      href: url.href,
      protocol: url.protocol,
      host: url.host,
      hostname: url.hostname,
      port: url.port || '默认端口',
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
      origin: url.origin,
    };
    return { output: JSON.stringify(result, null, 2) };
  } catch {
    return { output: '', error: '无效的 URL 格式' };
  }
}

// ── Curl 转 Fetch ─────────────────────────────────────

/** 简易 Curl 转 Fetch */
export function curlToFetch(input: string): DevToolResult {
  const trimmed = input.trim();
  if (!trimmed) return { output: '', error: '输入为空' };
  if (!trimmed.toLowerCase().startsWith('curl')) return { output: '', error: '输入应以 curl 开头' };
  try {
    const urlMatch = trimmed.match(/curl\s+['"]?([^'"\s]+)['"]?/);
    const url = urlMatch ? urlMatch[1] : '';
    const methodMatch = trimmed.match(/-X\s+(\w+)/i);
    const method = methodMatch ? methodMatch[1].toUpperCase() : 'GET';
    const headers: Record<string, string> = {};
    const headerMatches = trimmed.matchAll(/-H\s+['"]([^:]+):\s*([^'"]+)['"]/g);
    for (const [, key, value] of headerMatches) {
      headers[key] = value;
    }
    const bodyMatch = trimmed.match(/-d\s+['"]([^'"]*)['"]/);
    const body = bodyMatch ? bodyMatch[1] : undefined;
    const options: Record<string, unknown> = { method, headers };
    if (body) options.body = body;
    const code = `fetch('${url}', ${JSON.stringify(options, null, 2)})\n  .then(res => res.json())\n  .then(data => console.log(data))\n  .catch(err => console.error(err));`;
    return { output: code };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { output: '', error: `转换失败：${msg}` };
  }
}

// ── JSON Path 查询 ────────────────────────────────────

/** 简易 JSON Path 查询 */
export function jsonPathQuery(input: string, path: string): DevToolResult {
  if (!input.trim() || !path.trim()) return { output: '', error: '输入为空' };
  try {
    const data = JSON.parse(input);
    const keys = path.replace(/^\$\.?/, '').split('.').filter(Boolean);
    let current: unknown = data;
    for (const key of keys) {
      if (current && typeof current === 'object') {
        current = (current as Record<string, unknown>)[key];
      } else {
        return { output: '', error: `路径 ${path} 不存在` };
      }
    }
    return { output: JSON.stringify(current, null, 2) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { output: '', error: `JSON Path 查询失败：${msg}` };
  }
}

// ── YAML ↔ JSON ───────────────────────────────────────

/** 简易 YAML 解析（支持对象、数组、基本类型） */
function parseYaml(text: string): unknown {
  const lines = text.split('\n');
  const root: Record<string, unknown> = {};
  let current = root;
  const stack: { obj: Record<string, unknown>; indent: number }[] = [];

  for (const raw of lines) {
    const trimmed = raw.trimEnd();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const indent = raw.length - raw.trimStart().length;
    const line = trimmed.trimStart();

    if (line.startsWith('- ')) {
      const val = line.slice(2).trim();
      const arr = current['__array'] as unknown[] ?? [];
      arr.push(parseYamlValue(val));
      current['__array'] = arr;
      continue;
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();

    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    if (stack.length > 0) {
      current = stack[stack.length - 1].obj;
    } else {
      current = root;
    }

    if (!value) {
      const nested: Record<string, unknown> = {};
      current[key] = nested;
      stack.push({ obj: nested, indent });
      current = nested;
    } else {
      current[key] = parseYamlValue(value);
    }
  }

  if (root['__array']) return root['__array'];
  return root;
}

function parseYamlValue(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null' || value === '~') return null;
  if (/^-?\d+$/.test(value)) return Number(value);
  if (/^-?\d+\.\d+$/.test(value)) return Number(value);
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

/** YAML 转 JSON */
export function yamlToJson(input: string): DevToolResult {
  if (!input.trim()) return { output: '', error: '输入为空' };
  try {
    const parsed = parseYaml(input);
    return { output: JSON.stringify(parsed, null, 2) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { output: '', error: `YAML 解析失败：${msg}` };
  }
}

/** JSON 转 YAML */
export function jsonToYaml(input: string): DevToolResult {
  if (!input.trim()) return { output: '', error: '输入为空' };
  try {
    const parsed = JSON.parse(input);
    return { output: objectToYaml(parsed) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { output: '', error: `JSON 解析失败：${msg}` };
  }
}

function objectToYaml(value: unknown, indent = 0): string {
  const prefix = '  '.repeat(indent);
  if (value === null) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map((item) => `${prefix}- ${objectToYaml(item, indent + 1).trimStart()}`).join('\n');
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => {
        if (val && (typeof val === 'object')) {
          return `${prefix}${key}:\n${objectToYaml(val, indent + 1)}`;
        }
        return `${prefix}${key}: ${objectToYaml(val, 0)}`;
      })
      .join('\n');
  }
  return String(value);
}

// ── CSV ↔ JSON ────────────────────────────────────────

/** CSV 转 JSON */
export function csvToJson(input: string): DevToolResult {
  if (!input.trim()) return { output: '', error: '输入为空' };
  try {
    const lines = input.trim().split('\n');
    if (lines.length < 2) return { output: '', error: 'CSV 至少需要表头和一行数据' };
    const headers = lines[0].split(',').map((h) => h.trim());
    const rows = lines.slice(1).map((line) => {
      const values = line.split(',').map((v) => v.trim());
      return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
    });
    return { output: JSON.stringify(rows, null, 2), meta: `${rows.length} 行数据` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { output: '', error: `CSV 解析失败：${msg}` };
  }
}

/** JSON 转 CSV */
export function jsonToCsv(input: string): DevToolResult {
  if (!input.trim()) return { output: '', error: '输入为空' };
  try {
    const data = JSON.parse(input) as Record<string, unknown>[];
    if (!Array.isArray(data) || data.length === 0) return { output: '', error: 'JSON 应为对象数组' };
    const headers = Object.keys(data[0]);
    const rows = data.map((row) => headers.map((h) => String(row[h] ?? '')).join(','));
    return { output: [headers.join(','), ...rows].join('\n'), meta: `${data.length} 行数据` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { output: '', error: `JSON 转 CSV 失败：${msg}` };
  }
}

// ── HTTP Header 解析 ──────────────────────────────────

/** 解析 HTTP Header 字符串 */
export function httpHeaderParse(input: string): DevToolResult {
  if (!input.trim()) return { output: '', error: '输入为空' };
  try {
    const lines = input.trim().split('\n');
    const headers: Record<string, string> = {};
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        const value = line.slice(colonIndex + 1).trim();
        headers[key] = value;
      }
    }
    return { output: JSON.stringify(headers, null, 2), meta: `${Object.keys(headers).length} 个 Header` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { output: '', error: `解析失败：${msg}` };
  }
}

// ── User-Agent 解析 ───────────────────────────────────

/** 简易 User-Agent 解析 */
export function uaParse(input: string): DevToolResult {
  const ua = input.trim();
  if (!ua) return { output: '', error: '输入为空' };
  const result: Record<string, string> = { raw: ua };
  const browserMatch = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/(\d+\.\d+)/);
  if (browserMatch) {
    result.browser = `${browserMatch[1]} ${browserMatch[2]}`;
  }
  const osMatch = ua.match(/\(([^)]+)\)/);
  if (osMatch) {
    result.os = osMatch[1];
  }
  const mobileMatch = ua.match(/Mobile|Android|iPhone|iPad/);
  result.device = mobileMatch ? 'Mobile' : 'Desktop';
  return { output: JSON.stringify(result, null, 2) };
}

// ── Basic Auth 编解码 ─────────────────────────────────

/** Basic Auth 编码 */
export function basicAuth(input: string, action: 'encode' | 'decode'): DevToolResult {
  if (!input.trim()) return { output: '', error: '输入为空' };
  try {
    if (action === 'encode') {
      const [username, password] = input.split(':');
      if (!username) return { output: '', error: '格式应为 username:password' };
      const encoded = btoa(`${username}:${password ?? ''}`);
      return { output: `Basic ${encoded}` };
    }
    const base64 = input.replace(/^Basic\s+/i, '').trim();
    const decoded = atob(base64);
    return { output: decoded };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { output: '', error: `Basic Auth ${action === 'encode' ? '编码' : '解码'}失败：${msg}` };
  }
}

// ── SQL 格式化 ────────────────────────────────────────

/** 简易 SQL 格式化 */
export function sqlFormat(input: string): DevToolResult {
  if (!input.trim()) return { output: '', error: '输入为空' };
  const keywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'GROUP', 'ORDER', 'BY', 'HAVING', 'LIMIT', 'OFFSET', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'ALTER', 'DROP', 'INDEX', 'UNION', 'ALL', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'IS', 'NULL', 'AS', 'DISTINCT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END'];
  let sql = input
    .replace(/\s+/g, ' ')
    .trim();
  for (const kw of keywords) {
    const regex = new RegExp(`\\b${kw}\\b`, 'gi');
    sql = sql.replace(regex, (match) => match.toUpperCase());
  }
  sql = sql
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s*\(\s*/g, ' (')
    .replace(/\s*\)\s*/g, ') ')
    .replace(/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/gi, '\n$1')
    .replace(/\b(FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|GROUP|ORDER|HAVING|LIMIT|OFFSET|UNION)\b/gi, '\n$1')
    .replace(/\b(ON|AND|OR)\b/gi, '\n  $1')
    .trim();
  return { output: sql };
}

// ── 字符串转义 ────────────────────────────────────────

/** 字符串转义工具 */
export function stringEscape(input: string, mode: 'js' | 'json' | 'regex' | 'shell'): DevToolResult {
  if (!input) return { output: '', error: '输入为空' };
  switch (mode) {
    case 'js':
      return { output: JSON.stringify(input).slice(1, -1) };
    case 'json':
      return { output: JSON.stringify(input) };
    case 'regex':
      return { output: input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') };
    case 'shell':
      return { output: input.replace(/'/g, "'\"'\"'") };
    default:
      return { output: '', error: '未知模式' };
  }
}
