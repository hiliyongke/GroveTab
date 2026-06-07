/**
 * 开发工具栏 —— 工具注册表
 *
 * 定义所有可用工具的分类、元信息和交互模式。
 * 页面组件通过此注册表获取工具列表，与具体转换逻辑解耦。
 */

import { translate } from '@/shared/i18n/core';

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
    titleKey: translate('JSON 格式化'),
    descriptionKey: translate('格式化、压缩或验证 JSON 文本'),
    aliases: ['json', translate('格式化'), translate('压缩'), 'formatter', 'minify', 'validate'],
    mode: 'transform',
    localOnly: true,
    order: 1,
  },
  {
    id: 'json-to-ts',
    category: 'frontend',
    titleKey: translate('JSON 转 TypeScript'),
    descriptionKey: translate('将 JSON 对象转换为 TypeScript 类型定义'),
    aliases: ['json', 'typescript', 'interface', 'ts', translate('类型'), translate('接口'), translate('前端')],
    mode: 'transform',
    localOnly: true,
    order: 2,
  },
  {
    id: 'json-path',
    category: 'data',
    titleKey: translate('JSON 路径查询'),
    descriptionKey: translate('使用 JSONPath 语法提取嵌套 JSON 中的数据节点'),
    aliases: ['json', 'path', 'jsonpath', translate('查询'), 'query', translate('数据')],
    mode: 'transform',
    localOnly: true,
    order: 3,
  },
  {
    id: 'yaml-json',
    category: 'data',
    titleKey: translate('YAML/JSON 互转'),
    descriptionKey: translate('在 YAML 和 JSON 格式之间互相转换'),
    aliases: ['yaml', 'yml', 'json', translate('互转'), translate('数据')],
    mode: 'transform',
    localOnly: true,
    order: 4,
  },
  {
    id: 'csv-json',
    category: 'data',
    titleKey: translate('CSV/JSON 互转'),
    descriptionKey: translate('在 CSV 和 JSON 格式之间互相转换'),
    aliases: ['csv', 'json', translate('互转'), translate('表格'), translate('数据')],
    mode: 'transform',
    localOnly: true,
    order: 5,
  },
  {
    id: 'jwt-decoder',
    category: 'backend',
    titleKey: translate('JWT 解码器'),
    descriptionKey: translate('解码 JWT Token 的 Header 和 Payload 内容'),
    aliases: ['jwt', 'token', 'auth', translate('鉴权'), translate('认证'), translate('后端')],
    mode: 'transform',
    localOnly: true,
    order: 6,
  },
  {
    id: 'basic-auth',
    category: 'backend',
    titleKey: translate('Basic Auth 编解码'),
    descriptionKey: translate('HTTP 基本认证信息的编码与解码'),
    aliases: ['basic', 'auth', translate('认证'), translate('编码'), translate('解码'), translate('后端')],
    mode: 'transform',
    localOnly: true,
    order: 7,
  },
  {
    id: 'sql-format',
    category: 'backend',
    titleKey: translate('SQL 格式化'),
    descriptionKey: translate('格式化或压缩 SQL 语句，提高可读性'),
    aliases: ['sql', translate('格式化'), translate('数据库'), translate('后端')],
    mode: 'transform',
    localOnly: true,
    order: 8,
  },
  {
    id: 'url-parse',
    category: 'network',
    titleKey: translate('URL 拆解'),
    descriptionKey: translate('将 URL 拆解为协议、主机、端口、路径等组成部分'),
    aliases: ['url', translate('拆解'), translate('解析'), 'protocol', 'host', translate('网络')],
    mode: 'transform',
    localOnly: true,
    order: 9,
  },
  {
    id: 'url-query',
    category: 'network',
    titleKey: translate('URL 参数解析'),
    descriptionKey: translate('解析查询参数为 Key-Value，或反向构建查询字符串'),
    aliases: ['url', 'query', 'params', translate('参数'), translate('解析'), translate('构建'), translate('网络')],
    mode: 'transform',
    localOnly: true,
    order: 10,
  },
  {
    id: 'curl-fetch',
    category: 'network',
    titleKey: translate('cURL 转 Fetch'),
    descriptionKey: translate('将 cURL 命令转换为 JavaScript Fetch 代码'),
    aliases: ['curl', 'fetch', 'http', translate('请求'), translate('转换'), translate('网络')],
    mode: 'transform',
    localOnly: true,
    order: 11,
  },
  {
    id: 'http-status',
    category: 'network',
    titleKey: translate('HTTP 状态码查询'),
    descriptionKey: translate('查看各 HTTP 状态码的含义和描述'),
    aliases: ['http', 'status', translate('状态码'), 'code', 'network', translate('网络')],
    mode: 'transform',
    localOnly: true,
    order: 12,
  },
  {
    id: 'http-header',
    category: 'network',
    titleKey: translate('HTTP 请求头解析'),
    descriptionKey: translate('将原始 HTTP 请求头文本解析为结构化 Key-Value 对'),
    aliases: ['http', 'header', translate('请求头'), translate('解析'), translate('网络')],
    mode: 'transform',
    localOnly: true,
    order: 13,
  },
  {
    id: 'ua-parse',
    category: 'network',
    titleKey: translate('User-Agent 解析'),
    descriptionKey: translate('解析 User-Agent 字符串，识别浏览器、操作系统和设备'),
    aliases: ['ua', 'user-agent', translate('浏览器'), translate('设备'), translate('解析'), translate('网络')],
    mode: 'transform',
    localOnly: true,
    order: 14,
  },
  {
    id: 'url-codec',
    category: 'encoding',
    titleKey: translate('URL 编解码'),
    descriptionKey: translate('百分号编码（Percent-Encoding）的编码与解码'),
    aliases: ['url', 'encode', 'decode', translate('编码'), translate('解码'), 'percent'],
    mode: 'transform',
    localOnly: true,
    order: 15,
  },
  {
    id: 'base64-codec',
    category: 'encoding',
    titleKey: translate('Base64 编解码'),
    descriptionKey: translate('Base64 文本编码与解码'),
    aliases: ['base64', 'b64', translate('编码'), translate('解码')],
    mode: 'transform',
    localOnly: true,
    order: 16,
  },
  {
    id: 'html-entity',
    category: 'frontend',
    titleKey: translate('HTML 实体编解码'),
    descriptionKey: translate('HTML 实体字符的编码与解码'),
    aliases: ['html', 'entity', translate('实体'), translate('编码'), translate('解码'), translate('转义'), 'escape', 'unescape', translate('前端')],
    mode: 'transform',
    localOnly: true,
    order: 17,
  },
  {
    id: 'string-escape',
    category: 'frontend',
    titleKey: translate('字符串转义/反转义'),
    descriptionKey: translate('对 JS/JSON/Regex/Shell 等场景的字符串进行转义或反转义'),
    aliases: ['escape', 'string', translate('转义'), 'js', 'json', 'regex', 'shell', translate('前端')],
    mode: 'transform',
    localOnly: true,
    order: 18,
  },
  {
    id: 'regex-test',
    category: 'data',
    titleKey: translate('正则表达式测试'),
    descriptionKey: translate('测试正则表达式，高亮显示匹配结果和捕获组'),
    aliases: ['regex', 'regexp', translate('正则'), translate('正则表达式'), translate('匹配'), 'match', 'pattern'],
    mode: 'transform',
    localOnly: true,
    order: 19,
  },
  {
    id: 'text-diff',
    category: 'data',
    titleKey: translate('文本差异对比'),
    descriptionKey: translate('并排对比两段文本的逐行差异'),
    aliases: ['diff', translate('差异'), translate('对比'), 'compare', translate('比较'), translate('不同')],
    mode: 'transform',
    localOnly: true,
    order: 20,
  },
  {
    id: 'case-convert',
    category: 'data',
    titleKey: translate('命名风格转换'),
    descriptionKey: translate('在 camel、snake、kebab、Pascal 等命名风格之间互转'),
    aliases: ['case', 'camel', 'snake', 'kebab', 'pascal', translate('命名'), translate('大小写')],
    mode: 'transform',
    localOnly: true,
    order: 21,
  },
  {
    id: 'text-stats',
    category: 'data',
    titleKey: translate('文本统计'),
    descriptionKey: translate('统计文本的字数、字符数、字节数、行数等'),
    aliases: ['text', 'stats', translate('字数'), translate('字符'), translate('字节'), translate('统计')],
    mode: 'transform',
    localOnly: true,
    order: 22,
  },
  {
    id: 'timestamp',
    category: 'time',
    titleKey: translate('时间戳转换'),
    descriptionKey: translate('Unix 时间戳与日期时间字符串互相转换'),
    aliases: ['timestamp', translate('时间戳'), 'unix', 'epoch', translate('日期'), 'date'],
    mode: 'transform',
    localOnly: true,
    order: 23,
  },
  {
    id: 'cron',
    category: 'backend',
    titleKey: translate('Cron 表达式解析'),
    descriptionKey: translate('解析 Cron 表达式，查看调度执行计划和下次执行时间'),
    aliases: ['cron', translate('定时'), translate('调度'), 'schedule', translate('后端')],
    mode: 'transform',
    localOnly: true,
    order: 24,
  },
  {
    id: 'hash',
    category: 'crypto',
    titleKey: translate('哈希摘要计算'),
    descriptionKey: translate('计算字符串的 MD5/SHA-1/SHA-256/SHA-512 哈希值'),
    aliases: ['hash', translate('哈希'), 'sha1', 'sha-1', 'sha256', 'sha-256', 'sha512', 'sha-512', translate('摘要'), 'digest'],
    mode: 'action',
    localOnly: true,
    order: 25,
  },
  {
    id: 'radix',
    category: 'number',
    titleKey: translate('进制转换'),
    descriptionKey: translate('二进制、八进制、十进制、十六进制之间互相转换'),
    aliases: ['radix', translate('进制'), 'binary', 'hex', 'octal', translate('二进制'), translate('十六进制')],
    mode: 'transform',
    localOnly: true,
    order: 26,
  },
  {
    id: 'css-unit',
    category: 'frontend',
    titleKey: translate('CSS 单位换算'),
    descriptionKey: translate('在 px、rem、em、vw、vh 等 CSS 单位之间进行换算'),
    aliases: ['css', 'px', 'rem', 'em', translate('单位'), translate('前端'), translate('样式')],
    mode: 'transform',
    localOnly: true,
    order: 27,
  },
  {
    id: 'color-preview',
    category: 'frontend',
    titleKey: translate('颜色预览与转换'),
    descriptionKey: translate('输入 HEX/RGB/HSL 值，实时预览颜色并在格式间互转'),
    aliases: ['color', translate('颜色'), 'hex', 'rgb', 'hsl', translate('色彩'), translate('前端')],
    mode: 'action',
    localOnly: true,
    order: 28,
  },
  {
    id: 'mime-type',
    category: 'backend',
    titleKey: translate('MIME 类型查询'),
    descriptionKey: translate('根据文件扩展名查询 MIME 类型，或反向查询'),
    aliases: ['mime', 'content-type', translate('扩展名'), translate('文件类型'), translate('后端')],
    mode: 'transform',
    localOnly: true,
    order: 29,
  },
  {
    id: 'random-gen',
    category: 'generator',
    titleKey: translate('随机生成器'),
    descriptionKey: translate('生成 UUID、随机字符串、随机数字等'),
    aliases: ['random', 'uuid', translate('随机'), translate('随机数')],
    mode: 'action',
    localOnly: true,
    order: 30,
  },
];

/** 按分类筛选工具 */
function getToolsByCategory(category: DevToolCategory | 'all'): DevToolDefinition[] {
  const tools = category === 'all' ? DEV_TOOLS : DEV_TOOLS.filter((tool) => tool.category === category);
  return [...tools].sort((a, b) => a.order - b.order);
}

/** 搜索工具（匹配 id、标题 key、别名） */
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
