/**
 * 开发工具栏 —— 工具注册表
 *
 * 定义所有可用工具的分类、元信息、交互模式和 UI 常量。
 * 页面组件通过此注册表获取工具列表与图标/示例映射，与具体转换逻辑解耦。
 */

import React from 'react';
import {
  Activity,
  Binary,
  Braces,
  Clock,
  Code2,
  Dices,
  FileJson,
  FileType,
  Globe2,
  Hash,
  KeyRound,
  Link,
  Palette,
  GitCompare,
  Regex,
  Ruler,
  Server,
  Shield,
  Terminal,
  Type,
} from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { BRAND } from '@/shared/config/brand';

/** 开发工具分类 */
export type DevToolCategory =
  | 'data'
  | 'encoding'
  | 'time'
  | 'crypto'
  | 'number'
  | 'generator'
  | 'color'
  | 'frontend'
  | 'backend'
  | 'network';

/** 工具交互模式：transform（输入→输出双向） / action（一键执行） */
type DevToolMode = 'transform' | 'action';

/** 工具元信息定义 */
export interface DevToolDefinition {
  /** 唯一标识 */
  id: string;
  /** 分类 */
  category: DevToolCategory;
  /** 名称 i18n key */
  titleKey: string;
  /** 描述 i18n key */
  descriptionKey: string;
  /** 搜索别名（小写，用于模糊匹配） */
  aliases: string[];
  /** 交互模式 */
  mode: DevToolMode;
  /** 是否纯本地处理（全部工具首版均为 true） */
  localOnly: boolean;
  /** 排序权重，越小越靠前 */
  order: number;
}

/** 全部注册工具 */
export const DEV_TOOLS: DevToolDefinition[] = [
  {
    id: 'json-format',
    category: 'data',
    titleKey: 'devtools.jsonFormat',
    descriptionKey: 'devtools.jsonFormatDesc',
    aliases: ['json', '格式化', '压缩', 'formatter', 'minify', 'validate'],
    mode: 'transform',
    localOnly: true,
    order: 1,
  },
  {
    id: 'json-to-ts',
    category: 'frontend',
    titleKey: 'devtools.jsonToTs',
    descriptionKey: 'devtools.jsonToTsDesc',
    aliases: ['json', 'typescript', 'interface', 'ts', '类型', '接口', '前端'],
    mode: 'transform',
    localOnly: true,
    order: 2,
  },
  {
    id: 'json-path',
    category: 'data',
    titleKey: 'devtools.jsonPath',
    descriptionKey: 'devtools.jsonPathDesc',
    aliases: ['json', 'path', 'jsonpath', '查询', 'query', '数据'],
    mode: 'transform',
    localOnly: true,
    order: 3,
  },
  {
    id: 'yaml-json',
    category: 'data',
    titleKey: 'devtools.yamlJson',
    descriptionKey: 'devtools.yamlJsonDesc',
    aliases: ['yaml', 'yml', 'json', '互转', '数据'],
    mode: 'transform',
    localOnly: true,
    order: 4,
  },
  {
    id: 'csv-json',
    category: 'data',
    titleKey: 'devtools.csvJson',
    descriptionKey: 'devtools.csvJsonDesc',
    aliases: ['csv', 'json', '互转', '表格', '数据'],
    mode: 'transform',
    localOnly: true,
    order: 5,
  },
  {
    id: 'jwt-decoder',
    category: 'backend',
    titleKey: 'devtools.jwtDecoder',
    descriptionKey: 'devtools.jwtDecoderDesc',
    aliases: ['jwt', 'token', 'auth', '鉴权', '认证', '后端'],
    mode: 'transform',
    localOnly: true,
    order: 6,
  },
  {
    id: 'basic-auth',
    category: 'backend',
    titleKey: 'devtools.basicAuth',
    descriptionKey: 'devtools.basicAuthDesc',
    aliases: ['basic', 'auth', '认证', '编码', '解码', '后端'],
    mode: 'transform',
    localOnly: true,
    order: 7,
  },
  {
    id: 'sql-format',
    category: 'backend',
    titleKey: 'devtools.sqlFormat',
    descriptionKey: 'devtools.sqlFormatDesc',
    aliases: ['sql', '格式化', '数据库', '后端'],
    mode: 'transform',
    localOnly: true,
    order: 8,
  },
  {
    id: 'url-parse',
    category: 'network',
    titleKey: 'devtools.urlParse',
    descriptionKey: 'devtools.urlParseDesc',
    aliases: ['url', '拆解', '解析', 'protocol', 'host', '网络'],
    mode: 'transform',
    localOnly: true,
    order: 9,
  },
  {
    id: 'url-query',
    category: 'network',
    titleKey: 'devtools.urlQuery',
    descriptionKey: 'devtools.urlQueryDesc',
    aliases: ['url', 'query', 'params', '参数', '解析', '构建', '网络'],
    mode: 'transform',
    localOnly: true,
    order: 10,
  },
  {
    id: 'curl-fetch',
    category: 'network',
    titleKey: 'devtools.curlFetch',
    descriptionKey: 'devtools.curlFetchDesc',
    aliases: ['curl', 'fetch', 'http', '请求', '转换', '网络'],
    mode: 'transform',
    localOnly: true,
    order: 11,
  },
  {
    id: 'http-status',
    category: 'network',
    titleKey: 'devtools.httpStatus',
    descriptionKey: 'devtools.httpStatusDesc',
    aliases: ['http', 'status', '状态码', 'code', 'network', '网络'],
    mode: 'transform',
    localOnly: true,
    order: 12,
  },
  {
    id: 'http-header',
    category: 'network',
    titleKey: 'devtools.httpHeader',
    descriptionKey: 'devtools.httpHeaderDesc',
    aliases: ['http', 'header', '请求头', '解析', '网络'],
    mode: 'transform',
    localOnly: true,
    order: 13,
  },
  {
    id: 'ua-parse',
    category: 'network',
    titleKey: 'devtools.uaParse',
    descriptionKey: 'devtools.uaParseDesc',
    aliases: ['ua', 'user-agent', '浏览器', '设备', '解析', '网络'],
    mode: 'transform',
    localOnly: true,
    order: 14,
  },
  {
    id: 'url-codec',
    category: 'encoding',
    titleKey: 'devtools.urlCodec',
    descriptionKey: 'devtools.urlCodecDesc',
    aliases: ['url', 'encode', 'decode', '编码', '解码', 'percent'],
    mode: 'transform',
    localOnly: true,
    order: 15,
  },
  {
    id: 'base64-codec',
    category: 'encoding',
    titleKey: 'devtools.base64Codec',
    descriptionKey: 'devtools.base64CodecDesc',
    aliases: ['base64', 'b64', '编码', '解码'],
    mode: 'transform',
    localOnly: true,
    order: 16,
  },
  {
    id: 'html-entity',
    category: 'frontend',
    titleKey: 'devtools.htmlEntity',
    descriptionKey: 'devtools.htmlEntityDesc',
    aliases: ['html', 'entity', '实体', '编码', '解码', '转义', 'escape', 'unescape', '前端'],
    mode: 'transform',
    localOnly: true,
    order: 17,
  },
  {
    id: 'string-escape',
    category: 'frontend',
    titleKey: 'devtools.stringEscape',
    descriptionKey: 'devtools.stringEscapeDesc',
    aliases: ['escape', 'string', '转义', 'js', 'json', 'regex', 'shell', '前端'],
    mode: 'transform',
    localOnly: true,
    order: 18,
  },
  {
    id: 'regex-test',
    category: 'data',
    titleKey: 'devtools.regexTest',
    descriptionKey: 'devtools.regexTestDesc',
    aliases: ['regex', 'regexp', '正则', '正则表达式', '匹配', 'match', 'pattern'],
    mode: 'transform',
    localOnly: true,
    order: 19,
  },
  {
    id: 'text-diff',
    category: 'data',
    titleKey: 'devtools.textDiff',
    descriptionKey: 'devtools.textDiffDesc',
    aliases: ['diff', '差异', '对比', 'compare', '比较', '不同'],
    mode: 'transform',
    localOnly: true,
    order: 20,
  },
  {
    id: 'case-convert',
    category: 'data',
    titleKey: 'devtools.caseConvert',
    descriptionKey: 'devtools.caseConvertDesc',
    aliases: ['case', 'camel', 'snake', 'kebab', 'pascal', '命名', '大小写'],
    mode: 'transform',
    localOnly: true,
    order: 21,
  },
  {
    id: 'text-stats',
    category: 'data',
    titleKey: 'devtools.textStats',
    descriptionKey: 'devtools.textStatsDesc',
    aliases: ['text', 'stats', '字数', '字符', '字节', '统计'],
    mode: 'transform',
    localOnly: true,
    order: 22,
  },
  {
    id: 'timestamp',
    category: 'time',
    titleKey: 'devtools.timestamp',
    descriptionKey: 'devtools.timestampDesc',
    aliases: ['timestamp', '时间戳', 'unix', 'epoch', '日期', 'date'],
    mode: 'transform',
    localOnly: true,
    order: 23,
  },
  {
    id: 'cron',
    category: 'backend',
    titleKey: 'devtools.cron',
    descriptionKey: 'devtools.cronDesc',
    aliases: ['cron', '定时', '调度', 'schedule', '后端'],
    mode: 'transform',
    localOnly: true,
    order: 24,
  },
  {
    id: 'hash',
    category: 'crypto',
    titleKey: 'devtools.hash',
    descriptionKey: 'devtools.hashDesc',
    aliases: ['hash', '哈希', 'sha1', 'sha-1', 'sha256', 'sha-256', 'sha512', 'sha-512', '摘要', 'digest'],
    mode: 'action',
    localOnly: true,
    order: 25,
  },
  {
    id: 'radix',
    category: 'number',
    titleKey: 'devtools.radix',
    descriptionKey: 'devtools.radixDesc',
    aliases: ['radix', '进制', 'binary', 'hex', 'octal', '二进制', '十六进制'],
    mode: 'transform',
    localOnly: true,
    order: 26,
  },
  {
    id: 'css-unit',
    category: 'frontend',
    titleKey: 'devtools.cssUnit',
    descriptionKey: 'devtools.cssUnitDesc',
    aliases: ['css', 'px', 'rem', 'em', '单位', '前端', '样式'],
    mode: 'transform',
    localOnly: true,
    order: 27,
  },
  {
    id: 'color-preview',
    category: 'frontend',
    titleKey: 'devtools.colorPreview',
    descriptionKey: 'devtools.colorPreviewDesc',
    aliases: ['color', '颜色', 'hex', 'rgb', 'hsl', '色彩', '前端'],
    mode: 'action',
    localOnly: true,
    order: 28,
  },
  {
    id: 'mime-type',
    category: 'backend',
    titleKey: 'devtools.mimeType',
    descriptionKey: 'devtools.mimeTypeDesc',
    aliases: ['mime', 'content-type', '扩展名', '文件类型', '后端'],
    mode: 'transform',
    localOnly: true,
    order: 29,
  },
  {
    id: 'random-gen',
    category: 'generator',
    titleKey: 'devtools.randomGen',
    descriptionKey: 'devtools.randomGenDesc',
    aliases: ['random', 'uuid', '随机', '随机数'],
    mode: 'action',
    localOnly: true,
    order: 30,
  },
];

/**
 * 按分类筛选工具
 * @param category - 工具分类或 'all'
 * @returns {DevToolDefinition[]} 返回指定分类的工具定义列表
 */
export function getToolsByCategory(category: DevToolCategory | 'all'): DevToolDefinition[] {
  const tools = category === 'all' ? DEV_TOOLS : DEV_TOOLS.filter((tool) => tool.category === category);
  return [...tools].sort((a, b) => a.order - b.order);
}

/**
 * 搜索工具（匹配 id、标题 key、别名）
 * @param query - 搜索关键词
 * @returns {DevToolDefinition[]} 返回匹配搜索关键词的工具定义列表
 */
export function searchTools(query: string): DevToolDefinition[] {
  const q = query.toLowerCase().trim();
  if (!q) return getToolsByCategory('all');
  return DEV_TOOLS
    .filter((tool) => {
      const haystack = [tool.id, tool.titleKey, tool.descriptionKey, ...tool.aliases].join(' ').toLowerCase();
      return haystack.includes(q);
    })
    .sort((a, b) => a.order - b.order);
}

// ── UI 常量 ──────────────────────────────────────────

/** 支持自动实时执行的工具 */
export const AUTO_EXECUTE_TOOL_IDS = new Set([
  'json-format', 'json-to-ts', 'json-path', 'yaml-json', 'csv-json',
  'jwt-decoder', 'basic-auth', 'sql-format',
  'url-parse', 'url-query', 'url-codec', 'curl-fetch',
  'http-status', 'http-header', 'ua-parse',
  'base64-codec', 'html-entity', 'string-escape',
  'regex-test', 'text-diff', 'case-convert', 'text-stats',
  'timestamp', 'cron', 'hash', 'radix', 'css-unit',
  'color-preview', 'mime-type',
]);

/** 分类图标映射 */
export const CATEGORY_ICONS: Record<DevToolCategory, React.ReactNode> = {
  data: <Braces size={ICON_SIZE.DEFAULT} />,
  encoding: <Link size={ICON_SIZE.DEFAULT} />,
  time: <Clock size={ICON_SIZE.DEFAULT} />,
  crypto: <Shield size={ICON_SIZE.DEFAULT} />,
  number: <Hash size={ICON_SIZE.DEFAULT} />,
  generator: <Dices size={ICON_SIZE.DEFAULT} />,
  color: <Palette size={ICON_SIZE.DEFAULT} />,
  frontend: <Code2 size={ICON_SIZE.DEFAULT} />,
  backend: <Server size={ICON_SIZE.DEFAULT} />,
  network: <Globe2 size={ICON_SIZE.DEFAULT} />,
};

/** 分类国际化 key 映射 */
export const CATEGORY_LABEL_KEYS: Record<DevToolCategory, string> = {
  data: 'devtools.catData',
  encoding: 'devtools.catEncoding',
  time: 'devtools.catTime',
  crypto: 'devtools.catCrypto',
  number: 'devtools.catNumber',
  generator: 'devtools.catGenerator',
  color: 'devtools.catColor',
  frontend: 'devtools.catFrontend',
  backend: 'devtools.catBackend',
  network: 'devtools.catNetwork',
};

/** 工具图标映射 */
export const TOOL_ICONS: Record<string, React.ReactNode> = {
  'json-format': <Braces size={ICON_SIZE.LARGE} />,
  'json-to-ts': <FileJson size={ICON_SIZE.LARGE} />,
  'json-path': <Braces size={ICON_SIZE.LARGE} />,
  'yaml-json': <FileJson size={ICON_SIZE.LARGE} />,
  'csv-json': <FileType size={ICON_SIZE.LARGE} />,
  'jwt-decoder': <KeyRound size={ICON_SIZE.LARGE} />,
  'basic-auth': <Shield size={ICON_SIZE.LARGE} />,
  'sql-format': <Terminal size={ICON_SIZE.LARGE} />,
  'url-parse': <Globe2 size={ICON_SIZE.LARGE} />,
  'url-query': <Globe2 size={ICON_SIZE.LARGE} />,
  'url-codec': <Link size={ICON_SIZE.LARGE} />,
  'curl-fetch': <Terminal size={ICON_SIZE.LARGE} />,
  'http-status': <Activity size={ICON_SIZE.LARGE} />,
  'http-header': <Globe2 size={ICON_SIZE.LARGE} />,
  'ua-parse': <Globe2 size={ICON_SIZE.LARGE} />,
  'base64-codec': <Binary size={ICON_SIZE.LARGE} />,
  'html-entity': <Code2 size={ICON_SIZE.LARGE} />,
  'string-escape': <Code2 size={ICON_SIZE.LARGE} />,
  'regex-test': <Regex size={ICON_SIZE.LARGE} />,
  'text-diff': <GitCompare size={ICON_SIZE.LARGE} />,
  'case-convert': <Type size={ICON_SIZE.LARGE} />,
  'text-stats': <Type size={ICON_SIZE.LARGE} />,
  timestamp: <Clock size={ICON_SIZE.LARGE} />,
  cron: <Clock size={ICON_SIZE.LARGE} />,
  hash: <Shield size={ICON_SIZE.LARGE} />,
  radix: <Hash size={ICON_SIZE.LARGE} />,
  'css-unit': <Ruler size={ICON_SIZE.LARGE} />,
  'color-preview': <Palette size={ICON_SIZE.LARGE} />,
  'mime-type': <FileType size={ICON_SIZE.LARGE} />,
  'random-gen': <Dices size={ICON_SIZE.LARGE} />,
};

/** 工具示例数据 */
export const TOOL_EXAMPLES: Record<string, { input?: string; input2?: string; pattern?: string; flags?: string; mode?: string }> = {
  'json-format': { input: JSON.stringify({ name: BRAND.name, version: '1.3', features: ['tabs', 'widgets', 'devtools'] }) },
  'json-to-ts': { input: JSON.stringify({ id: 1, name: BRAND.name, active: true, profile: { role: 'admin', tags: ['dev', 'ops'] } }) },
  'json-path': { input: '{"user":{"name":"Tom","age":30,"address":{"city":"Beijing"}}}', pattern: '$.user.address.city' },
  'yaml-json': { input: `name: ${BRAND.name}\nversion: "1.3"\nfeatures:\n  - tabs\n  - widgets` },
  'csv-json': { input: 'name,age,city\nTom,30,Beijing\nJerry,25,Shanghai' },
  'jwt-decoder': { input: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c' },
  'basic-auth': { input: 'username:password' },
  'sql-format': { input: 'select id,name from users where active=1 order by created_at desc limit 10' },
  'url-parse': { input: `${BRAND.productUrl}?tab=readme#overview` },
  'url-query': { input: 'https://example.com/search?q=devtools&lang=zh&page=1' },
  'url-codec': { input: 'https://example.com/search?q=开发工具&page=1' },
  'curl-fetch': { input: 'curl -X POST https://api.example.com/users -H "Content-Type: application/json" -d \'{"name":"Tom"}\'' },
  'http-status': { input: '404' },
  'http-header': { input: 'Content-Type: application/json\nAuthorization: Bearer eyJhbGci...\nX-Request-ID: abc-123' },
  'ua-parse': { input: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
  'base64-codec': { input: 'Hello 世界' },
  'html-entity': { input: '<div class="container">Tom & Jerry</div>' },
  'string-escape': { input: 'Hello "World"\nNew line\tTab' },
  'regex-test': { input: 'hello world hello', pattern: 'hello', flags: 'g' },
  'text-diff': { input: 'line1\nline2\nline3', input2: 'line1\nline2 modified\nline4' },
  'case-convert': { input: 'user profile card' },
  'text-stats': { input: 'Hello world!\n你好，世界！\nThis is a test.' },
  timestamp: { input: '1700000000' },
  cron: { input: '*/5 * * * *' },
  hash: { input: `${BRAND.name} DevTools` },
  radix: { input: '255' },
  'css-unit': { input: '16px' },
  'color-preview': { input: '#1677FF' },
  'mime-type': { input: 'json' },
};
