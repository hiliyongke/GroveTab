/**
 * 开发工具栏页面 —— 专业开发者工作台
 *
 * 功能：
 *   - 紧凑工具列表 + 右侧工作台面板
 *   - 前端、后端、网络、数据、编码、加密等分类
 *   - 输入实时执行、复制输出、双向交换、错误提示
 *   - 收藏 / 最近使用 / 示例填充
 *   - 全部工具纯本地处理，零网络请求
 *
 * 滚动位置保护策略：
 *   - 收藏区、最近使用区不通过 React 状态驱动渲染，
 *     改为手动 DOM 维护（insert/remove），左侧列表 DOM 不重建，
 *     选中工具时滚动位置天然保留。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Empty, Input, Segmented, Tag, Tooltip, Typography } from 'antd';
import {
  Activity,
  ArrowRightLeft,
  Binary,
  Braces,
  Check,
  Clock,
  Code2,
  Copy,
  Dices,
  FileJson,
  FileType,
  GitCompare,
  Globe2,
  Hash,
  Heart,
  KeyRound,
  Link,
  Palette,
  Regex,
  Ruler,
  Search,
  Server,
  Shield,
  Terminal,
  Trash2,
  Type,
  Wrench,
} from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { useT } from '@/shared/i18n';
import { BRAND } from '@/shared/config/brand';
import type { DevToolCategory, DevToolDefinition } from './tool-registry';
import { DEV_TOOLS, getToolsByCategory, searchTools } from './tool-registry';
import type {
  Base64Action,
  HashAlgorithm,
  HtmlEntityAction,
  JsonAction,
  RandomAction,
  TimestampAction,
  UrlAction,
  UrlQueryAction,
} from './local-tools';
import {
  base64Transform,
  basicAuth,
  caseConvert,
  colorParse,
  cronDescribe,
  cssUnitConvert,
  csvToJson,
  curlToFetch,
  hashDigest,
  htmlEntityTransform,
  httpHeaderParse,
  httpStatusLookup,
  jsonPathQuery,
  jsonToCsv,
  jsonToTypeScript,
  jsonToYaml,
  jsonTransform,
  jwtDecode,
  mimeLookup,
  radixTransform,
  randomGenerate,
  regexTest,
  sqlFormat,
  stringEscape,
  textDiff,
  textStats,
  timestampTransform,
  urlParse,
  urlQueryTransform,
  urlTransform,
  yamlToJson,
} from './local-tools';
import './DeveloperToolsPage.css';

const { Text, Title } = Typography;

const STORAGE_KEY_FAV = 'devtools:favorites';
const STORAGE_KEY_RECENT = 'devtools:recent';
const MAX_RECENT = 6;

/** 支持自动实时执行的工具 */
const AUTO_EXECUTE_TOOL_IDS = new Set([
  'json-format', 'json-to-ts', 'json-path', 'yaml-json', 'csv-json',
  'jwt-decoder', 'basic-auth', 'sql-format',
  'url-parse', 'url-query', 'url-codec', 'curl-fetch',
  'http-status', 'http-header', 'ua-parse',
  'base64-codec', 'html-entity', 'string-escape',
  'regex-test', 'text-diff', 'case-convert', 'text-stats',
  'timestamp', 'cron', 'hash', 'radix', 'css-unit',
  'color-preview', 'mime-type',
]);

/** 防抖 hook */
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** 读取 localStorage 字符串数组 */
function readStringArray(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

/** 写入 localStorage 字符串数组 */
function writeStringArray(key: string, value: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 忽略写入失败
  }
}

const CATEGORY_ICONS: Record<DevToolCategory, React.ReactNode> = {
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

const CATEGORY_LABEL_KEYS: Record<DevToolCategory, string> = {
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
const TOOL_ICONS: Record<string, React.ReactNode> = {
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
const TOOL_EXAMPLES: Record<string, { input?: string; input2?: string; pattern?: string; flags?: string; mode?: string }> = {
  'json-format': { input: JSON.stringify({ name: BRAND.name, version: '1.3', features: ['tabs', 'widgets', 'devtools'] }) },
  'json-to-ts': { input: JSON.stringify({ id: 1, name: BRAND.name, active: true, profile: { role: 'admin', tags: ['dev', 'ops'] } }) },
  'json-path': { input: '{"user":{"name":"Tom","age":30,"address":{"city":"Beijing"}}}', pattern: '$.user.address.city' },
  'yaml-json': { input: `name: ${BRAND.name}\nversion: "1.3"\nfeatures:\n  - tabs\n  - widgets` },
  'csv-json': { input: 'name,age,city\nTom,30,Beijing\nJerry,25,Shanghai' },
  'jwt-decoder': { input: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c' },
  'basic-auth': { input: 'admin:secret123' },
  'sql-format': { input: 'select id,name from users where active=1 order by created_at desc limit 10' },
  'url-parse': { input: `${BRAND.productUrl}?tab=readme#overview` },
  'url-query': { input: 'https://example.com/search?q=devtools&lang=zh&page=1' },
  'url-codec': { input: 'https://example.com/search?q=开发工具&page=1' },
  'curl-fetch': { input: 'curl -X POST https://api.example.com/users -H "Content-Type: application/json" -d \'{"name":"Tom"}\'' },
  'http-status': { input: '404' },
  'http-header': { input: 'Content-Type: application/json\nAuthorization: Bearer token123\nX-Request-ID: abc-123' },
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

interface ToolCardProps {
  tool: DevToolDefinition;
  title: string;
  description: string;
  selected: boolean;
  favorited: boolean;
  onClick: () => void;
  onToggleFavorite: (event: React.MouseEvent) => void;
}

function ToolCard({ tool, title, description, selected, favorited, onClick, onToggleFavorite }: ToolCardProps) {
  return (
    <button
      type="button"
      className={`devtools-card${selected ? ' is-selected' : ''}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      <span className="devtools-card-icon">{TOOL_ICONS[tool.id] ?? <Wrench size={ICON_SIZE.DEFAULT} />}</span>
      <div className="devtools-card-body">
        <div className="devtools-card-title">
          <span>{title}</span>
          {tool.localOnly && <span className="devtools-local-badge">Local</span>}
        </div>
        <div className="devtools-card-desc">{description}</div>
      </div>
      <span
        className={`devtools-fav-btn${favorited ? ' is-active' : ''}`}
        onClick={onToggleFavorite}
        role="button"
        tabIndex={0}
        aria-label="收藏"
      >
        <Heart size={12} />
      </span>
    </button>
  );
}

interface ToolPanelProps {
  tool: DevToolDefinition;
  onUse: () => void;
}

function ToolPanel({ tool, onUse }: ToolPanelProps) {
  const { t } = useT();
  /** 当前工具 id，用于检测工具切换 */
  const toolIdRef = useRef(tool.id);
  const [input, setInput] = useState('');
  const [input2, setInput2] = useState('');
  const [output, setOutput] = useState('');
  const [meta, setMeta] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [colorValue, setColorValue] = useState<string | undefined>();

  /** 工具切换时重置所有内部状态，替代 key={selectedTool.id} 的重挂载行为 */
  useEffect(() => {
    if (toolIdRef.current !== tool.id) {
      toolIdRef.current = tool.id;
      setInput('');
      setInput2('');
      setOutput('');
      setMeta('');
      setError('');
      setColorValue(undefined);
      setJsonAction('format');
      setUrlAction('encode');
      setBase64Action('encode');
      setUrlQueryAction('parse');
      setHtmlEntityAction('encode');
      setTimestampAction('toDatetime');
      setFromRadix('dec');
      setToRadix('hex');
      setHashAlgo('sha256');
      setRegexPattern('');
      setRegexFlags('g');
      setRandomAction('uuid');
      setRandomLen(32);
      setRootName('Root');
      setBaseFontSize(16);
      setYamlAction('yamlToJson');
      setCsvAction('csvToJson');
      setBasicAuthAction('encode');
      setEscapeMode('js');
    }
  }, [tool.id]);

  const [jsonAction, setJsonAction] = useState<JsonAction>('format');
  const [urlAction, setUrlAction] = useState<UrlAction>('encode');
  const [base64Action, setBase64Action] = useState<Base64Action>('encode');
  const [urlQueryAction, setUrlQueryAction] = useState<UrlQueryAction>('parse');
  const [htmlEntityAction, setHtmlEntityAction] = useState<HtmlEntityAction>('encode');
  const [timestampAction, setTimestampAction] = useState<TimestampAction>('toDatetime');
  const [fromRadix, setFromRadix] = useState('dec');
  const [toRadix, setToRadix] = useState('hex');
  const [hashAlgo, setHashAlgo] = useState<HashAlgorithm>('sha256');
  const [regexPattern, setRegexPattern] = useState('');
  const [regexFlags, setRegexFlags] = useState('g');
  const [randomAction, setRandomAction] = useState<RandomAction>('uuid');
  const [randomLen, setRandomLen] = useState(32);
  const [rootName, setRootName] = useState('Root');
  const [baseFontSize, setBaseFontSize] = useState(16);
  const [yamlAction, setYamlAction] = useState<'yamlToJson' | 'jsonToYaml'>('yamlToJson');
  const [csvAction, setCsvAction] = useState<'csvToJson' | 'jsonToCsv'>('csvToJson');
  const [basicAuthAction, setBasicAuthAction] = useState<'encode' | 'decode'>('encode');
  const [escapeMode, setEscapeMode] = useState<'js' | 'json' | 'regex' | 'shell'>('js');
  const [computing, setComputing] = useState(false);

  const debouncedInput = useDebounce(input, 260);
  const debouncedInput2 = useDebounce(input2, 260);
  const debouncedPattern = useDebounce(regexPattern, 260);

  const isDualInput = tool.id === 'text-diff';
  const isAutoExecute = AUTO_EXECUTE_TOOL_IDS.has(tool.id);
  const isBidirectional = ['url-codec', 'base64-codec', 'timestamp', 'radix', 'html-entity', 'url-query'].includes(tool.id);
  const isMonospace = ['json-format', 'json-to-ts', 'json-path', 'jwt-decoder', 'regex-test', 'text-diff', 'hash', 'radix', 'url-query', 'case-convert', 'text-stats', 'yaml-json', 'csv-json', 'http-header', 'ua-parse', 'sql-format', 'string-escape', 'curl-fetch'].includes(tool.id);

  const runTool = useCallback(async (primary: string, secondary: string) => {
    switch (tool.id) {
      case 'json-format':
        return jsonTransform(primary, jsonAction);
      case 'json-to-ts':
        return jsonToTypeScript(primary, rootName || 'Root');
      case 'json-path':
        return jsonPathQuery(primary, regexPattern);
      case 'yaml-json':
        return yamlAction === 'yamlToJson' ? yamlToJson(primary) : jsonToYaml(primary);
      case 'csv-json':
        return csvAction === 'csvToJson' ? csvToJson(primary) : jsonToCsv(primary);
      case 'jwt-decoder':
        return jwtDecode(primary);
      case 'basic-auth':
        return basicAuth(primary, basicAuthAction);
      case 'sql-format':
        return sqlFormat(primary);
      case 'url-parse':
        return urlParse(primary);
      case 'url-query':
        return urlQueryTransform(primary, urlQueryAction);
      case 'url-codec':
        return urlTransform(primary, urlAction);
      case 'curl-fetch':
        return curlToFetch(primary);
      case 'http-status':
        return httpStatusLookup(primary);
      case 'http-header':
        return httpHeaderParse(primary);
      case 'ua-parse':
        return { output: '', error: 'ua-parse not implemented' };
      case 'base64-codec':
        return base64Transform(primary, base64Action);
      case 'html-entity':
        return htmlEntityTransform(primary, htmlEntityAction);
      case 'string-escape':
        return stringEscape(primary, escapeMode);
      case 'regex-test':
        return regexTest(primary, regexPattern, regexFlags);
      case 'text-diff':
        return textDiff(primary, secondary);
      case 'case-convert':
        return caseConvert(primary);
      case 'timestamp':
        return timestampTransform(primary, timestampAction);
      case 'cron':
        return cronDescribe(primary);
      case 'hash':
        return hashDigest(primary, hashAlgo);
      case 'radix':
        return radixTransform(primary, fromRadix, toRadix);
      case 'css-unit':
        return cssUnitConvert(primary, baseFontSize);
      case 'color-preview':
        return colorParse(primary);
      case 'mime-type':
        return mimeLookup(primary);
      case 'text-stats':
        return textStats(primary);
      case 'random-gen':
        return randomGenerate(randomAction, randomLen);
      default:
        return { output: '', error: '未知工具' };
    }
  }, [tool.id, jsonAction, rootName, yamlAction, csvAction, basicAuthAction, escapeMode, urlQueryAction, urlAction, base64Action, htmlEntityAction, regexPattern, regexFlags, timestampAction, hashAlgo, fromRadix, toRadix, baseFontSize, randomAction, randomLen]);

  const applyResult = useCallback((result: Awaited<ReturnType<typeof runTool>>) => {
    setOutput(result.output);
    setMeta(result.meta ?? '');
    setError(result.error ?? '');
    setColorValue(result.colorValue);
  }, []);

  const handleExecute = useCallback(async () => {
    setComputing(true);
    try {
      const result = await runTool(input, input2);
      applyResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setComputing(false);
    }
  }, [applyResult, input, input2, runTool]);

  useEffect(() => {
    if (!isAutoExecute) return;
    if (tool.id === 'regex-test' && !debouncedPattern.trim()) {
      setOutput(''); setMeta(''); setError(''); setColorValue(undefined);
      return;
    }
    if (tool.id !== 'text-stats' && !debouncedInput.trim() && !isDualInput) {
      setOutput(''); setMeta(''); setError(''); setColorValue(undefined);
      return;
    }
    if (isDualInput && !debouncedInput && !debouncedInput2) {
      setOutput(''); setMeta(''); setError(''); setColorValue(undefined);
      return;
    }
    let cancelled = false;
    (async () => {
      const result = await runTool(debouncedInput, debouncedInput2);
      if (!cancelled) applyResult(result);
    })().catch(() => undefined);
    return () => { cancelled = true; };
  }, [applyResult, debouncedInput, debouncedInput2, debouncedPattern, isAutoExecute, isDualInput, runTool, tool.id]);

  const handleCopy = useCallback(async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setError(t('devtools.copyFailed'));
    }
  }, [output, t]);

  const handleClear = useCallback(() => {
    setInput('');
    setInput2('');
    setOutput('');
    setMeta('');
    setError('');
    setColorValue(undefined);
  }, []);

  const handleSwap = useCallback(() => {
    setInput(output);
    setOutput('');
    setMeta('');
    setError('');
    setColorValue(undefined);
    if (tool.id === 'url-codec') setUrlAction((value) => value === 'encode' ? 'decode' : 'encode');
    if (tool.id === 'base64-codec') setBase64Action((value) => value === 'encode' ? 'decode' : 'encode');
    if (tool.id === 'html-entity') setHtmlEntityAction((value) => value === 'encode' ? 'decode' : 'encode');
    if (tool.id === 'url-query') setUrlQueryAction((value) => value === 'parse' ? 'build' : 'parse');
    if (tool.id === 'timestamp') setTimestampAction((value) => value === 'toDatetime' ? 'toTimestamp' : 'toDatetime');
    if (tool.id === 'radix') {
      const tmp = fromRadix;
      setFromRadix(toRadix);
      setToRadix(tmp);
    }
  }, [fromRadix, output, toRadix, tool.id]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      handleExecute();
    }
  }, [handleExecute]);

  const handleFillExample = useCallback(() => {
    const example = TOOL_EXAMPLES[tool.id];
    if (!example) return;
    if (example.input !== undefined) setInput(example.input);
    if (example.input2 !== undefined) setInput2(example.input2);
    if (example.pattern !== undefined) setRegexPattern(example.pattern);
    if (example.flags !== undefined) setRegexFlags(example.flags);
    onUse();
  }, [tool.id, onUse]);

  const renderDiffOutput = useCallback((value: string) => value.split('\n').map((line, index) => {
    const stateClass = line.startsWith('+ ') ? ' is-add' : line.startsWith('- ') ? ' is-remove' : '';
    return <div key={`${index}-${line}`} className={`devtools-diff-line${stateClass}`}>{line}</div>;
  }), []);

  const placeholder = useMemo(() => {
    switch (tool.id) {
      case 'json-format':
      case 'json-to-ts':
        return JSON.stringify({ id: 1, name: BRAND.name });
      case 'json-path':
        return '{"user":{"name":"Tom"}}';
      case 'yaml-json':
        return yamlAction === 'yamlToJson' ? `name: ${BRAND.name}\nversion: "1.3"` : JSON.stringify({ name: BRAND.name });
      case 'csv-json':
        return csvAction === 'csvToJson' ? 'name,age\nTom,30' : '[{"name":"Tom","age":30}]';
      case 'jwt-decoder':
        return 'eyJhbGciOi...';
      case 'basic-auth':
        return basicAuthAction === 'encode' ? 'admin:secret123' : 'Basic YWRtaW46c2VjcmV0MTIz';
      case 'sql-format':
        return 'select id,name from users where active=1';
      case 'url-parse':
        return `${BRAND.productUrl}?tab=readme#overview`;
      case 'url-query':
        return urlQueryAction === 'parse' ? 'https://example.com?a=1&b=2 或 a=1&b=2' : '{"a":1,"b":"hello"}';
      case 'url-codec':
        return 'https://example.com/search?q=开发工具';
      case 'curl-fetch':
        return 'curl -X POST https://api.example.com/users -H "Content-Type: application/json" -d \'{"name":"Tom"}\'';
      case 'http-status':
        return '404';
      case 'http-header':
        return 'Content-Type: application/json\nAuthorization: Bearer token123';
      case 'ua-parse':
        return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36...';
      case 'base64-codec':
        return '输入文本或 Base64 字符串';
      case 'html-entity':
        return '<div class="hello">Tom & Jerry</div>';
      case 'string-escape':
        return 'Hello "World"\nNew line\tTab';
      case 'regex-test':
        return '输入待测试文本';
      case 'case-convert':
        return 'user profile card';
      case 'timestamp':
        return '1700000000 或 2024-01-01';
      case 'cron':
        return '*/5 * * * *';
      case 'hash':
        return '输入要计算哈希的文本';
      case 'radix':
        return '255';
      case 'css-unit':
        return '16px 或 1rem';
      case 'color-preview':
        return '#1677FF 或 rgb(22, 119, 255)';
      case 'mime-type':
        return 'json 或 application/json';
      default:
        return '';
    }
  }, [tool.id, urlQueryAction, yamlAction, csvAction, basicAuthAction]);

  return (
    <div className="devtools-form" onKeyDown={handleKeyDown}>
      <div className="devtools-options">
        {tool.id === 'json-format' && (
          <Segmented size="small" value={jsonAction} onChange={(value) => setJsonAction(value as JsonAction)} options={[{ value: 'format', label: '格式化' }, { value: 'minify', label: '压缩' }, { value: 'validate', label: '校验' }]} />
        )}
        {tool.id === 'json-to-ts' && (
          <Input size="small" value={rootName} onChange={(event) => setRootName(event.target.value)} placeholder="Root" className="devtools-field-size--root" />
        )}
        {tool.id === 'yaml-json' && (
          <Segmented size="small" value={yamlAction} onChange={(value) => setYamlAction(value as 'yamlToJson' | 'jsonToYaml')} options={[{ value: 'yamlToJson', label: 'YAML → JSON' }, { value: 'jsonToYaml', label: 'JSON → YAML' }]} />
        )}
        {tool.id === 'csv-json' && (
          <Segmented size="small" value={csvAction} onChange={(value) => setCsvAction(value as 'csvToJson' | 'jsonToCsv')} options={[{ value: 'csvToJson', label: 'CSV → JSON' }, { value: 'jsonToCsv', label: 'JSON → CSV' }]} />
        )}
        {tool.id === 'url-query' && (
          <Segmented size="small" value={urlQueryAction} onChange={(value) => setUrlQueryAction(value as UrlQueryAction)} options={[{ value: 'parse', label: 'Parse' }, { value: 'build', label: 'Build' }]} />
        )}
        {tool.id === 'url-codec' && (
          <Segmented size="small" value={urlAction} onChange={(value) => setUrlAction(value as UrlAction)} options={[{ value: 'encode', label: 'Encode' }, { value: 'decode', label: 'Decode' }]} />
        )}
        {tool.id === 'base64-codec' && (
          <Segmented size="small" value={base64Action} onChange={(value) => setBase64Action(value as Base64Action)} options={[{ value: 'encode', label: 'Encode' }, { value: 'decode', label: 'Decode' }]} />
        )}
        {tool.id === 'html-entity' && (
          <Segmented size="small" value={htmlEntityAction} onChange={(value) => setHtmlEntityAction(value as HtmlEntityAction)} options={[{ value: 'encode', label: 'Encode' }, { value: 'decode', label: 'Decode' }]} />
        )}
        {tool.id === 'string-escape' && (
          <Segmented size="small" value={escapeMode} onChange={(value) => setEscapeMode(value as 'js' | 'json' | 'regex' | 'shell')} options={[{ value: 'js', label: 'JS' }, { value: 'json', label: 'JSON' }, { value: 'regex', label: 'Regex' }, { value: 'shell', label: 'Shell' }]} />
        )}
        {tool.id === 'timestamp' && (
          <Segmented size="small" value={timestampAction} onChange={(value) => setTimestampAction(value as TimestampAction)} options={[{ value: 'toDatetime', label: '→ 日期' }, { value: 'toTimestamp', label: '→ 时间戳' }]} />
        )}
        {tool.id === 'hash' && (
          <Segmented size="small" value={hashAlgo} onChange={(value) => setHashAlgo(value as HashAlgorithm)} options={[{ value: 'sha1', label: 'SHA-1' }, { value: 'sha256', label: 'SHA-256' }, { value: 'sha512', label: 'SHA-512' }]} />
        )}
        {tool.id === 'radix' && (
          <>
            <Segmented size="small" value={fromRadix} onChange={setFromRadix} options={[{ value: 'bin', label: '2' }, { value: 'oct', label: '8' }, { value: 'dec', label: '10' }, { value: 'hex', label: '16' }]} />
            <ArrowRightLeft size={14} className="devtools-option-arrow" />
            <Segmented size="small" value={toRadix} onChange={setToRadix} options={[{ value: 'bin', label: '2' }, { value: 'oct', label: '8' }, { value: 'dec', label: '10' }, { value: 'hex', label: '16' }]} />
          </>
        )}
        {tool.id === 'css-unit' && (
          <Input size="small" type="number" value={baseFontSize} onChange={(event) => setBaseFontSize(Number(event.target.value) || 16)} addonBefore="Base" addonAfter="px" className="devtools-field-size--base" />
        )}
        {tool.id === 'random-gen' && (
          <Segmented size="small" value={randomAction} onChange={(value) => setRandomAction(value as RandomAction)} options={[{ value: 'uuid', label: 'UUID' }, { value: 'randomInt', label: '随机整数' }, { value: 'randomHex', label: '随机 HEX' }]} />
        )}
        {tool.id === 'random-gen' && randomAction !== 'uuid' && (
          <Input size="small" type="number" value={randomLen} onChange={(event) => setRandomLen(Number(event.target.value) || 1)} min={1} max={128} addonBefore="长度" className="devtools-field-size--random" />
        )}
        {tool.id === 'basic-auth' && (
          <Segmented size="small" value={basicAuthAction} onChange={(value) => setBasicAuthAction(value as 'encode' | 'decode')} options={[{ value: 'encode', label: 'Encode' }, { value: 'decode', label: 'Decode' }]} />
        )}
      </div>

      {tool.id === 'regex-test' && (
        <div className="devtools-two-col">
          <Input size="small" prefix={<Regex size={14} />} placeholder={t('devtools.pattern')} value={regexPattern} onChange={(event) => setRegexPattern(event.target.value)} />
          <Input size="small" placeholder={t('devtools.flags')} value={regexFlags} onChange={(event) => setRegexFlags(event.target.value.replace(/[^gimsuy]/g, ''))} maxLength={7} />
        </div>
      )}
      {tool.id === 'json-path' && (
        <div className="devtools-two-col">
          <Input size="small" prefix={<Braces size={14} />} placeholder="JSON Path，如 $.user.name" value={regexPattern} onChange={(event) => setRegexPattern(event.target.value)} />
        </div>
      )}

      {isDualInput ? (
        <div className="devtools-two-col">
          <label>
            <span className="devtools-field-label">{t('devtools.leftText')}</span>
            <Input.TextArea value={input} onChange={(event) => setInput(event.target.value)} rows={7} placeholder="第一段文本" />
          </label>
          <label>
            <span className="devtools-field-label">{t('devtools.rightText')}</span>
            <Input.TextArea value={input2} onChange={(event) => setInput2(event.target.value)} rows={7} placeholder="第二段文本" />
          </label>
        </div>
      ) : tool.id !== 'random-gen' && (
        <label>
          <span className="devtools-field-label">{t('devtools.input')}</span>
          <Input.TextArea value={input} onChange={(event) => setInput(event.target.value)} rows={6} placeholder={placeholder} className={isMonospace ? 'devtools-input-mono' : undefined} />
        </label>
      )}

      <div className="devtools-actions">
        {!isAutoExecute && (
          <Button type="primary" onClick={handleExecute} loading={computing}>{t('devtools.execute')}</Button>
        )}
        {isAutoExecute && <Tag color="blue" className="devtools-tag devtools-tag--realtime">{t('devtools.realtime')}</Tag>}
        {isBidirectional && <Button onClick={handleSwap} icon={<ArrowRightLeft size={14} />}>{t('devtools.swap')}</Button>}
        <Button onClick={handleClear} icon={<Trash2 size={14} />}>{t('devtools.clear')}</Button>
        {TOOL_EXAMPLES[tool.id] && <Button onClick={handleFillExample} icon={<Terminal size={14} />}>{t('devtools.example')}</Button>}
        {tool.id === 'random-gen' && <Button type="primary" onClick={handleExecute} loading={computing}>{t('devtools.generate')}</Button>}
      </div>

      {tool.id === 'color-preview' && colorValue && (
        <div className="devtools-color-preview">
          <div className="devtools-color-swatch" style={{ background: colorValue }} />
          <Text code>{colorValue}</Text>
        </div>
      )}

      {output && (
        <div className="devtools-output">
          <div className="devtools-output-head">
            <Text type="secondary" className="devtools-output-label">{t('devtools.output')}</Text>
            <Tooltip title={copied ? t('devtools.copied') : t('devtools.copy')}>
              <Button size="small" type="text" onClick={handleCopy} icon={copied ? <Check size={14} /> : <Copy size={14} />} />
            </Tooltip>
          </div>
          <div className="devtools-output-body">
            {tool.id === 'text-diff' ? renderDiffOutput(output) : <pre className="devtools-pre">{output}</pre>}
          </div>
          {meta && <div className="devtools-output-meta"><Text type="secondary" className="devtools-output-meta-text">{meta}</Text></div>}
        </div>
      )}

      {error && (
        <div className="devtools-error">
          <Text type="danger" className="devtools-error-text">{error}</Text>
        </div>
      )}
    </div>
  );
}

/**
 * 开发工具栏主页面
 *
 * 滚动保护策略：
 *   - 收藏区（fav-section）和最近使用区（recent-section）
 *     的 DOM 元素不通过 React 渲染，改为手动维护：
 *     - 选中工具时，仅更新 recent 状态并写入 localStorage，
 *       不触发左侧列表重新渲染；
 *     - 收藏/取消收藏时，直接操作 DOM 插入或移除对应卡片，
 *       不触发左侧列表重新渲染。
 *   - 切换分类/搜索时，全部工具列表会重新渲染，
 *       此时需要重建 fav-section 和 recent-section。
 */
export function DeveloperToolsPage() {
  const { t } = useT();
  const [category, setCategory] = useState<DevToolCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedToolId, setSelectedToolId] = useState(DEV_TOOLS[0]?.id ?? 'json-format');
  const [favorites, setFavorites] = useState<string[]>(() => readStringArray(STORAGE_KEY_FAV));
  const [recent, setRecent] = useState<string[]>(() => readStringArray(STORAGE_KEY_RECENT));

  /** 左侧列表容器 ref */
  const listPaneRef = useRef<HTMLDivElement>(null);
  /** fav-section DOM 容器 ref */
  const favSectionRef = useRef<HTMLDivElement | null>(null);
  /** recent-section DOM 容器 ref */
  const recentSectionRef = useRef<HTMLDivElement | null>(null);

  const categoryCounts = useMemo(() => DEV_TOOLS.reduce<Record<string, number>>((acc, tool) => {
    acc[tool.category] = (acc[tool.category] ?? 0) + 1;
    return acc;
  }, {}), []);

  const categoryOptions = useMemo(() => [
    {
      value: 'all' as const,
      label: <span className="devtools-category-label"><Wrench size={ICON_SIZE.DEFAULT} />{t('devtools.catAll')} · {DEV_TOOLS.length}</span>,
    },
    ...Object.entries(CATEGORY_LABEL_KEYS).map(([cat, key]) => ({
      value: cat as DevToolCategory,
      label: <span className="devtools-category-label">{CATEGORY_ICONS[cat as DevToolCategory]}{t(key)} · {categoryCounts[cat] ?? 0}</span>,
    })),
  ], [categoryCounts, t]);

  const filteredTools = useMemo(() => {
    const byCategory = getToolsByCategory(category);
    if (!searchQuery.trim()) return byCategory;
    return searchTools(searchQuery).filter((tool) => category === 'all' || tool.category === category);
  }, [category, searchQuery]);

  const selectedTool = useMemo(
    () => DEV_TOOLS.find((tool) => tool.id === selectedToolId) ?? DEV_TOOLS[0],
    [selectedToolId],
  );

  /** 工具 id → 翻译标题/描述（缓存，避免每次渲染都调用 t()） */
  const toolTexts = useMemo(() => {
    const map: Record<string, { title: string; desc: string }> = {};
    DEV_TOOLS.forEach((tool) => {
      map[tool.id] = {
        title: t(tool.titleKey),
        desc: t(tool.descriptionKey),
      };
    });
    return map;
  }, [t]);

  /** 向 fav-section 或 recent-section 插入一张工具卡片 */
  const insertCard = useCallback((container: HTMLDivElement, tool: DevToolDefinition, isFav: boolean) => {
    const texts = toolTexts[tool.id];
    const card = document.createElement('button');
    card.className = `devtools-card${selectedToolId === tool.id ? ' is-selected' : ''}`;
    card.type = 'button';
    card.setAttribute('aria-pressed', String(selectedToolId === tool.id));
    card.innerHTML = `
      <span class="devtools-card-icon">${tool.id}</span>
      <div class="devtools-card-body">
        <div class="devtools-card-title">
          <span>${texts.title}</span>
          ${tool.localOnly ? '<span class="devtools-local-badge">Local</span>' : ''}
        </div>
        <div class="devtools-card-desc">${texts.desc}</div>
      </div>
      <span class="devtools-fav-btn${isFav ? ' is-active' : ''}" role="button" tabindex="0" aria-label="收藏">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>
      </span>
    `;
    card.addEventListener('click', () => {
      setSelectedToolId(tool.id);
    });
    card.querySelector('.devtools-fav-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const next = favorites.includes(tool.id)
        ? favorites.filter((id) => id !== tool.id)
        : [...favorites, tool.id];
      setFavorites(next);
      writeStringArray(STORAGE_KEY_FAV, next);
    });
    container.appendChild(card);
  }, [favorites, selectedToolId, toolTexts]);

  /** 重建 fav-section */
  const rebuildFavSection = useCallback(() => {
    const pane = listPaneRef.current;
    if (!pane) return;
    // 移除旧的 fav-section
    favSectionRef.current?.remove();
    favSectionRef.current = null;
    if (favorites.length === 0) return;
    const section = document.createElement('div');
    section.className = 'devtools-section';
    section.innerHTML = `
      <div class="devtools-section-head">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="devtools-section-icon devtools-section-icon--fav"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>
        <strong class="devtools-section-title">${t('devtools.favorites')}</strong>
      </div>
      <div class="devtools-grid"></div>
    `;
    const grid = section.querySelector('.devtools-grid') as HTMLDivElement;
    favorites.forEach((id) => {
      const tool = DEV_TOOLS.find((t) => t.id === id);
      if (tool) insertCard(grid, tool, true);
    });
    // 插入到 list-pane 的最前面
    pane.insertBefore(section, pane.firstChild);
    favSectionRef.current = section;
  }, [favorites, insertCard, t]);

  /** 重建 recent-section */
  const rebuildRecentSection = useCallback(() => {
    const pane = listPaneRef.current;
    if (!pane) return;
    recentSectionRef.current?.remove();
    recentSectionRef.current = null;
    if (recent.length === 0 || searchQuery.trim() || category !== 'all') return;
    const section = document.createElement('div');
    section.className = 'devtools-section';
    section.innerHTML = `
      <div class="devtools-section-head">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="devtools-section-icon devtools-section-icon--recent"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <strong class="devtools-section-title">${t('devtools.recent')}</strong>
      </div>
      <div class="devtools-grid"></div>
    `;
    const grid = section.querySelector('.devtools-grid') as HTMLDivElement;
    recent.forEach((id) => {
      const tool = DEV_TOOLS.find((t) => t.id === id);
      if (tool) insertCard(grid, tool, favorites.includes(tool.id));
    });
    // 插入到 fav-section 后面，或 list-pane 最前面
    if (favSectionRef.current) {
      favSectionRef.current.after(section);
    } else {
      pane.insertBefore(section, pane.firstChild);
    }
    recentSectionRef.current = section;
  }, [recent, favorites, searchQuery, category, insertCard, t]);

  /** 初始化：构建 fav-section 和 recent-section */
  useEffect(() => {
    rebuildFavSection();
    rebuildRecentSection();
  }, [rebuildFavSection, rebuildRecentSection]);

  /** favorites 变化时，仅重建 fav-section（不重建全部工具列表） */
  useEffect(() => {
    rebuildFavSection();
  }, [favorites, rebuildFavSection]);

  /** recent 变化时，仅重建 recent-section */
  useEffect(() => {
    rebuildRecentSection();
  }, [recent, rebuildRecentSection]);

  const handleSelectTool = useCallback((toolId: string) => {
    setSelectedToolId(toolId);
    setRecent((prev) => {
      const next = [toolId, ...prev.filter((id) => id !== toolId)].slice(0, MAX_RECENT);
      writeStringArray(STORAGE_KEY_RECENT, next);
      return next;
    });
  }, []);

  const handleToggleFavorite = useCallback((toolId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(toolId) ? prev.filter((id) => id !== toolId) : [...prev, toolId];
      writeStringArray(STORAGE_KEY_FAV, next);
      return next;
    });
  }, []);

  /** 需要隐藏的工具 id（已在 fav-section 或 recent-section 中展示） */
  const hiddenIds = useMemo(() => {
    const ids = new Set<string>(favorites);
    if (!searchQuery.trim() && category === 'all') {
      recent.forEach((id) => ids.add(id));
    }
    return ids;
  }, [favorites, recent, searchQuery, category]);

  return (
    <section className="devtools-page">
      <div className="devtools-shell">
        <header className="devtools-hero">
          <div className="devtools-title-row">
            <div className="devtools-brand">
              <span className="devtools-logo"><Wrench size={ICON_SIZE.LARGE} /></span>
              <Title level={4} className="devtools-title">{t('devtools.title')}</Title>
              <Tag color="green" className="devtools-tag devtools-tag--local">{t('devtools.localOnly')}</Tag>
            </div>
            <div className="devtools-stats">
              <span className="devtools-stat-pill">{DEV_TOOLS.length} tools</span>
              <span className="devtools-stat-pill">{Object.keys(categoryCounts).length} categories</span>
              <span className="devtools-stat-pill">100% local</span>
            </div>
          </div>
          <div className="devtools-subtitle">{t('devtools.subtitle')}</div>
        </header>

        <div className="devtools-toolbar">
          <Segmented value={category} onChange={(value) => setCategory(value as DevToolCategory | 'all')} options={categoryOptions} size="small" className="devtools-segmented" />
          <Input prefix={<Search size={14} />} placeholder={t('devtools.searchPlaceholder')} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} allowClear size="small" className="devtools-search" />
        </div>

        <div className="devtools-workbench">
          <div className="devtools-list-pane" ref={listPaneRef}>
            {/* fav-section 和 recent-section 由 useEffect 手动插入 */}
            {filteredTools.filter((tool) => !hiddenIds.has(tool.id)).map((tool) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                title={toolTexts[tool.id].title}
                description={toolTexts[tool.id].desc}
                selected={selectedToolId === tool.id}
                favorited={favorites.includes(tool.id)}
                onClick={() => handleSelectTool(tool.id)}
                onToggleFavorite={(e) => { e.stopPropagation(); handleToggleFavorite(tool.id); }}
              />
            ))}
            {filteredTools.length === 0 && (
              <Empty description={t('devtools.searchPlaceholder')} className="devtools-empty-state" />
            )}
          </div>

          <aside className="devtools-panel-pane">
            <div className="devtools-panel-card">
              <div className="devtools-panel-head">
                <div className="devtools-panel-title">
                  <span className="devtools-panel-icon">{TOOL_ICONS[selectedTool.id] ?? <Wrench size={ICON_SIZE.LARGE} />}</span>
                  <Title level={5} className="devtools-panel-heading">{toolTexts[selectedTool.id]?.title ?? selectedTool.titleKey}</Title>
                  <span
                    className={`devtools-fav-btn${favorites.includes(selectedTool.id) ? ' is-active' : ''}`}
                    onClick={() => handleToggleFavorite(selectedTool.id)}
                    role="button"
                    tabIndex={0}
                    aria-label="收藏"
                  >
                    <Heart size={14} />
                  </span>
                </div>
                <div className="devtools-panel-desc">{toolTexts[selectedTool.id]?.desc ?? selectedTool.descriptionKey}</div>
              </div>
              <div className="devtools-panel-body">
                <ToolPanel tool={selectedTool} onUse={() => handleSelectTool(selectedTool.id)} />
              </div>
            </div>
          </aside>
        </div>
      </div>

      <div className="devtools-privacy">
        <Shield size={12} />
        <span>{t('devtools.privacyNote')}</span>
      </div>
    </section>
  );
}

export default DeveloperToolsPage;
