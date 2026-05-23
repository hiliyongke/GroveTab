/**
 * 开发工具栏页面 —— 专业开发者工作台
 *
 * 功能：
 *   - 紧凑工具列表 + 右侧工作台面板
 *   - 前端、后端、网络、数据、编码、加密等分类
 *   - 输入实时执行、复制输出、双向交换、错误提示
 *   - 收藏置顶 / 示例填充
 *   - 全部工具纯本地处理，零网络请求
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Empty, Input, Segmented, Tag, Tooltip, Typography } from 'antd';
import {
  ArrowRightLeft,
  Braces,
  Check,
  Copy,
  Heart,
  Regex,
  Search,
  Shield,
  Star,
  Terminal,
  Trash2,
  Wrench,
} from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { cssVars } from '@/shared/utils/css-vars';
import { useT } from '@/shared/i18n';
import { BRAND } from '@/shared/config/brand';
import type { DevToolCategory, DevToolDefinition } from './tool-registry';
import {
  AUTO_EXECUTE_TOOL_IDS,
  CATEGORY_ICONS,
  CATEGORY_LABEL_KEYS,
  DEV_TOOLS,
  TOOL_EXAMPLES,
  TOOL_ICONS,
  getToolsByCategory,
  searchTools,
} from './tool-registry';
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
import type { ToolExecutorParams } from './tool-executor';
import { executeTool } from './tool-executor';
import styles from './DeveloperToolsPage.module.less';

const { Text, Title } = Typography;

const STORAGE_KEY_FAV = 'devtools:favorites';

/**
 * 防抖 hook
 * @param value - 需要防抖的值
 * @param delay - 防抖延迟毫秒数
 * @returns {T} 返回防抖后的状态值
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * 读取 localStorage 字符串数组
 * @param key - localStorage 的键名
 * @returns {string[]} 返回解析后的字符串数组，解析失败返回空数组
 */
function readStringArray(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * 写入 localStorage 字符串数组
 * @param key - localStorage 的键名
 * @param value - 待写入的字符串数组
 * @returns {void}
 */
function writeStringArray(key: string, value: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 忽略写入失败
  }
}

interface ToolCardProps {
  tool: DevToolDefinition;
  title: string;
  description: string;
  selected: boolean;
  favorited: boolean;
  onClick: () => void;
  onToggleFavorite: (event: React.MouseEvent) => void;
}

/**
 * 工具卡片组件
 * @param root0 - 组件属性
 * @param root0.tool - 工具定义
 * @param root0.title - 标题
 * @param root0.description - 描述
 * @param root0.selected - 是否选中
 * @param root0.favorited - 是否已收藏
 * @param root0.onClick - 点击回调
 * @param root0.onToggleFavorite - 切换收藏回调
 * @returns {JSX.Element} 返回工具卡片 JSX 元素
 */
function ToolCard({ tool, title, description, selected, favorited, onClick, onToggleFavorite }: ToolCardProps) {
  return (
    <button
      type="button"
      className={`${styles['devtools-card']}${selected ? ` ${styles['devtools-card--selected']}` : ''}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      <span className={styles['devtools-card-icon']}>{TOOL_ICONS[tool.id] ?? <Wrench size={ICON_SIZE.DEFAULT} />}</span>
      <div className={styles['devtools-card-body']}>
        <div className={styles['devtools-card-title']}>
          <span>{title}</span>
          {tool.localOnly && <span className={styles['devtools-local-badge']}>Local</span>}
        </div>
        <div className={styles['devtools-card-desc']}>{description}</div>
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

/**
 * 工具面板组件
 *
 * @param root0 - 组件属性
 * @param root0.tool - 工具定义
 * @param root0.onUse - 使用回调
 * @returns {JSX.Element} 返回工具面板 JSX 元素
 */
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

  const debouncedInput = useDebounce(input, 260);
  const debouncedInput2 = useDebounce(input2, 260);
  const debouncedPattern = useDebounce(regexPattern, 260);

  const isDualInput = tool.id === 'text-diff';
  const isAutoExecute = AUTO_EXECUTE_TOOL_IDS.has(tool.id);
  const isBidirectional = ['url-codec', 'base64-codec', 'timestamp', 'radix', 'html-entity', 'url-query'].includes(tool.id);
  const isMonospace = ['json-format', 'json-to-ts', 'json-path', 'jwt-decoder', 'regex-test', 'text-diff', 'hash', 'radix', 'url-query', 'case-convert', 'text-stats', 'yaml-json', 'csv-json', 'http-header', 'ua-parse', 'sql-format', 'string-escape', 'curl-fetch'].includes(tool.id);
  const colorSwatchStyle: React.CSSProperties = useMemo(
    () => cssVars({ '--devtools-color-swatch-bg': colorValue ?? 'transparent' }),
    [colorValue],
  );

  const executorParams: ToolExecutorParams = useMemo(() => ({
    jsonAction,
    rootName,
    yamlAction,
    csvAction,
    basicAuthAction,
    escapeMode,
    urlQueryAction,
    urlAction,
    base64Action,
    htmlEntityAction,
    regexPattern,
    regexFlags,
    timestampAction,
    hashAlgo,
    fromRadix,
    toRadix,
    baseFontSize,
    randomAction,
    randomLen,
  }), [jsonAction, rootName, yamlAction, csvAction, basicAuthAction, escapeMode, urlQueryAction, urlAction, base64Action, htmlEntityAction, regexPattern, regexFlags, timestampAction, hashAlgo, fromRadix, toRadix, baseFontSize, randomAction, randomLen]);

  const runTool = useCallback(async (primary: string, secondary: string) => {
    return executeTool(tool.id, primary, secondary, executorParams);
  }, [tool.id, executorParams]);

  const applyResult = useCallback((result: Awaited<ReturnType<typeof executeTool>>) => {
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
      applyResult({ output: '', meta: '', error: '', colorValue: undefined });
      return;
    }
    if (tool.id !== 'text-stats' && !debouncedInput.trim() && !isDualInput) {
      applyResult({ output: '', meta: '', error: '', colorValue: undefined });
      return;
    }
    if (isDualInput && !debouncedInput && !debouncedInput2) {
      applyResult({ output: '', meta: '', error: '', colorValue: undefined });
      return;
    }
    let cancelled = false;
    void (async () => {
      const result = await runTool(debouncedInput, debouncedInput2);
      if (!cancelled) applyResult(result);
    })();
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
      void handleExecute();
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
        return basicAuthAction === 'encode' ? 'username:password' : 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=';
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
        return 'Content-Type: application/json\nAuthorization: Bearer eyJhbGci...';
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
    <div className={styles['devtools-form']} onKeyDown={handleKeyDown}>
      <div className={styles['devtools-options']}>
        {tool.id === 'json-format' && (
          <Segmented size="small" value={jsonAction} onChange={(value) => setJsonAction(value as JsonAction)} options={[{ value: 'format', label: '格式化' }, { value: 'minify', label: '压缩' }, { value: 'validate', label: '校验' }]} />
        )}
        {tool.id === 'json-to-ts' && (
          <Input size="small" value={rootName} onChange={(event) => setRootName(event.target.value)} placeholder="Root" className={styles['devtools-field-size--root']} />
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
            <ArrowRightLeft size={14} className={styles['devtools-option-arrow']} />
            <Segmented size="small" value={toRadix} onChange={setToRadix} options={[{ value: 'bin', label: '2' }, { value: 'oct', label: '8' }, { value: 'dec', label: '10' }, { value: 'hex', label: '16' }]} />
          </>
        )}
        {tool.id === 'css-unit' && (
          <Input size="small" type="number" value={baseFontSize} onChange={(event) => setBaseFontSize(Number(event.target.value) || 16)} addonBefore="Base" addonAfter="px" className={styles['devtools-field-size--base']} />
        )}
        {tool.id === 'random-gen' && (
          <Segmented size="small" value={randomAction} onChange={(value) => setRandomAction(value as RandomAction)} options={[{ value: 'uuid', label: 'UUID' }, { value: 'randomInt', label: '随机整数' }, { value: 'randomHex', label: '随机 HEX' }]} />
        )}
        {tool.id === 'random-gen' && randomAction !== 'uuid' && (
          <Input size="small" type="number" value={randomLen} onChange={(event) => setRandomLen(Number(event.target.value) || 1)} min={1} max={128} addonBefore="长度" className={styles['devtools-field-size--random']} />
        )}
        {tool.id === 'basic-auth' && (
          <Segmented size="small" value={basicAuthAction} onChange={(value) => setBasicAuthAction(value as 'encode' | 'decode')} options={[{ value: 'encode', label: 'Encode' }, { value: 'decode', label: 'Decode' }]} />
        )}
      </div>

      {tool.id === 'regex-test' && (
        <div className={styles['devtools-two-col']}>
          <Input size="small" prefix={<Regex size={14} />} placeholder={t('devtools.pattern')} value={regexPattern} onChange={(event) => setRegexPattern(event.target.value)} />
          <Input size="small" placeholder={t('devtools.flags')} value={regexFlags} onChange={(event) => setRegexFlags(event.target.value.replace(/[^gimsuy]/g, ''))} maxLength={7} />
        </div>
      )}
      {tool.id === 'json-path' && (
        <div className={styles['devtools-two-col']}>
          <Input size="small" prefix={<Braces size={14} />} placeholder="JSON Path，如 $.user.name" value={regexPattern} onChange={(event) => setRegexPattern(event.target.value)} />
        </div>
      )}

      {isDualInput ? (
        <div className={styles['devtools-two-col']}>
          <label>
            <span className={styles['devtools-field-label']}>{t('devtools.leftText')}</span>
            <Input.TextArea value={input} onChange={(event) => setInput(event.target.value)} rows={7} placeholder="第一段文本" />
          </label>
          <label>
            <span className={styles['devtools-field-label']}>{t('devtools.rightText')}</span>
            <Input.TextArea value={input2} onChange={(event) => setInput2(event.target.value)} rows={7} placeholder="第二段文本" />
          </label>
        </div>
      ) : tool.id !== 'random-gen' && (
        <label>
          <span className={styles['devtools-field-label']}>{t('devtools.input')}</span>
          <Input.TextArea value={input} onChange={(event) => setInput(event.target.value)} rows={6} placeholder={placeholder} className={isMonospace ? 'devtools-input-mono' : undefined} />
        </label>
      )}

      <div className={styles['devtools-actions']}>
        {!isAutoExecute && (
          <Button type="primary" onClick={() => { void handleExecute(); }} loading={computing}>{t('devtools.execute')}</Button>
        )}
        {isAutoExecute && <Tag color="blue" className={`${styles['devtools-tag']} ${styles['devtools-tag--realtime']}`}>{t('devtools.realtime')}</Tag>}
        {isBidirectional && <Button onClick={handleSwap} icon={<ArrowRightLeft size={14} />}>{t('devtools.swap')}</Button>}
        <Button onClick={handleClear} icon={<Trash2 size={14} />}>{t('devtools.clear')}</Button>
        {TOOL_EXAMPLES[tool.id] && <Button onClick={handleFillExample} icon={<Terminal size={14} />}>{t('devtools.example')}</Button>}
        {tool.id === 'random-gen' && <Button type="primary" onClick={() => { void handleExecute(); }} loading={computing}>{t('devtools.generate')}</Button>}
      </div>

      {tool.id === 'color-preview' && colorValue && (
        <div className={styles['devtools-color-preview']}>
          <div className={styles['devtools-color-swatch']} style={colorSwatchStyle} />
          <Text code>{colorValue}</Text>
        </div>
      )}

      {output && (
        <div className={styles['devtools-output']}>
          <div className={styles['devtools-output-head']}>
            <Text type="secondary" className={styles['devtools-output-label']}>{t('devtools.output')}</Text>
            <Tooltip title={copied ? t('devtools.copied') : t('devtools.copy')}>
              <Button size="small" type="text" onClick={() => void handleCopy()} icon={copied ? <Check size={14} /> : <Copy size={14} />} />
            </Tooltip>
          </div>
          <div className={styles['devtools-output-body']}>
            {tool.id === 'text-diff' ? renderDiffOutput(output) : <pre className={styles['devtools-pre']}>{output}</pre>}
          </div>
          {meta && <div className={styles['devtools-output-meta']}><Text type="secondary" className={styles['devtools-output-meta-text']}>{meta}</Text></div>}
        </div>
      )}

      {error && (
        <div className={styles['devtools-error']}>
          <Text type="danger" className={styles['devtools-error-text']}>{error}</Text>
        </div>
      )}
    </div>
  );
}

/**
 * 开发工具栏主页面
 *
 * 列表组织：
 *   - 顶部：收藏区（仅当无搜索 / category=all 时展示）
 *   - 主体：根据分类与搜索过滤后的工具列表
 *   - 收藏区与主列表共用同一份 React 渲染逻辑，避免手动 DOM 操作引发的状态错位
 *
 * @returns {JSX.Element} 返回开发工具栏主页面 JSX 元素
 */
export function DeveloperToolsPage() {
  const { t } = useT();
  const [category, setCategory] = useState<DevToolCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedToolId, setSelectedToolId] = useState(DEV_TOOLS[0]?.id ?? 'json-format');
  const [favorites, setFavorites] = useState<string[]>(() => readStringArray(STORAGE_KEY_FAV));

  const categoryCounts = useMemo(() => DEV_TOOLS.reduce<Record<string, number>>((acc, tool) => {
    acc[tool.category] = (acc[tool.category] ?? 0) + 1;
    return acc;
  }, {}), []);

  const categoryOptions = useMemo(() => [
    {
      value: 'all' as const,
      label: <span className={styles['devtools-category-label']}><Wrench size={ICON_SIZE.DEFAULT} />{t('devtools.catAll')} · {DEV_TOOLS.length}</span>,
    },
    ...Object.entries(CATEGORY_LABEL_KEYS).map(([cat, key]) => ({
      value: cat as DevToolCategory,
      label: <span className={styles['devtools-category-label']}>{CATEGORY_ICONS[cat as DevToolCategory]}{t(key)} · {categoryCounts[cat] ?? 0}</span>,
    })),
  ], [categoryCounts, t]);

  const filteredTools = useMemo(() => {
    const byCategory = getToolsByCategory(category);
    if (!searchQuery.trim()) return byCategory;
    return searchTools(searchQuery).filter((tool) => category === 'all' || tool.category === category);
  }, [category, searchQuery]);

  const selectedTool = useMemo(
    () => DEV_TOOLS.find((tool) => tool.id === selectedToolId) ?? DEV_TOOLS[0]!,
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

  const handleSelectTool = useCallback((toolId: string) => {
    setSelectedToolId(toolId);
  }, []);

  const handleToggleFavorite = useCallback((toolId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(toolId) ? prev.filter((id) => id !== toolId) : [...prev, toolId];
      writeStringArray(STORAGE_KEY_FAV, next);
      return next;
    });
  }, []);

  /** 收藏区是否展示：无搜索时即可展示，分类筛选时也允许展示（仅显示该分类下的收藏） */
  const favoriteTools = useMemo(() => {
    if (favorites.length === 0) return [];
    const lookup = new Map(DEV_TOOLS.map((tool) => [tool.id, tool]));
    return favorites
      .map((id) => lookup.get(id))
      .filter((tool): tool is DevToolDefinition => Boolean(tool))
      .filter((tool) => category === 'all' || tool.category === category)
      .filter((tool) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.trim().toLowerCase();
        const texts = toolTexts[tool.id];
        return (
          tool.id.toLowerCase().includes(q)
          || (texts?.title.toLowerCase().includes(q) ?? false)
          || (texts?.desc.toLowerCase().includes(q) ?? false)
        );
      });
  }, [favorites, category, searchQuery, toolTexts]);

  /** 主列表中需要隐藏（已在收藏区展示）的工具 id */
  const hiddenIds = useMemo(() => new Set(favoriteTools.map((tool) => tool.id)), [favoriteTools]);

  return (
    <section className={styles['devtools-page']}>
      <div className={styles['devtools-shell']}>
        <header className={styles['devtools-hero']}>
          <div className={styles['devtools-title-row']}>
            <div className={styles['devtools-brand']}>
              <span className={styles['devtools-logo']}><Wrench size={ICON_SIZE.LARGE} /></span>
              <Title level={4} className={styles['devtools-title']}>{t('devtools.title')}</Title>
      <Tag color="green" className={`${styles['devtools-tag']} ${styles['devtools-tag--local']}`}>{t('devtools.localOnly')}</Tag>
            </div>
            <div className={styles['devtools-stats']}>
              <span className={styles['devtools-stat-pill']}>{DEV_TOOLS.length} tools</span>
              <span className={styles['devtools-stat-pill']}>{Object.keys(categoryCounts).length} categories</span>
              <span className={styles['devtools-stat-pill']}>100% local</span>
            </div>
          </div>
          <div className={styles['devtools-subtitle']}>{t('devtools.subtitle')}</div>
        </header>

        <div className={styles['devtools-toolbar']}>
          <Segmented value={category} onChange={(value) => setCategory(value)} options={categoryOptions} size="small" className={styles['devtools-segmented']} />
          <Input prefix={<Search size={14} />} placeholder={t('devtools.searchPlaceholder')} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} allowClear size="small" className={styles['devtools-search']} />
        </div>

        <div className={styles['devtools-workbench']}>
          <div className={styles['devtools-list-pane']}>
            {favoriteTools.length > 0 && (
              <div className={styles['devtools-section']}>
                <div className={styles['devtools-section-head']}>
      <Star size={14} className={`${styles['devtools-section-icon']} ${styles['devtools-section-icon--fav']}`} />
                  <strong className={styles['devtools-section-title']}>{t('devtools.favorites')}</strong>
                </div>
                <div className={styles['devtools-grid']}>
                  {favoriteTools.map((tool) => (
                    <ToolCard
                      key={`fav-${tool.id}`}
                      tool={tool}
                      title={toolTexts[tool.id]?.title ?? tool.titleKey}
                      description={toolTexts[tool.id]?.desc ?? tool.descriptionKey}
                      selected={selectedToolId === tool.id}
                      favorited
                      onClick={() => handleSelectTool(tool.id)}
                      onToggleFavorite={(e) => { e.stopPropagation(); handleToggleFavorite(tool.id); }}
                    />
                  ))}
                </div>
              </div>
            )}
            {filteredTools.filter((tool) => !hiddenIds.has(tool.id)).map((tool) => (              <ToolCard
                key={tool.id}
                tool={tool}
                title={toolTexts[tool.id]?.title ?? tool.titleKey}
                description={toolTexts[tool.id]?.desc ?? tool.descriptionKey}
                selected={selectedToolId === tool.id}
                favorited={favorites.includes(tool.id)}
                onClick={() => handleSelectTool(tool.id)}
                onToggleFavorite={(e) => { e.stopPropagation(); handleToggleFavorite(tool.id); }}
              />
            ))}
            {filteredTools.length === 0 && (
              <Empty description={t('devtools.searchPlaceholder')} className={styles['devtools-empty-state']} />
            )}
          </div>

          <aside className={styles['devtools-panel-pane']}>
            <div className={styles['devtools-panel-card']}>
              <div className={styles['devtools-panel-head']}>
                <div className={styles['devtools-panel-title']}>
                  <span className={styles['devtools-panel-icon']}>{TOOL_ICONS[selectedTool.id] ?? <Wrench size={ICON_SIZE.LARGE} />}</span>
                  <Title level={5} className={styles['devtools-panel-heading']}>{toolTexts[selectedTool.id]?.title ?? selectedTool.titleKey}</Title>
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
                <div className={styles['devtools-panel-desc']}>{toolTexts[selectedTool.id]?.desc ?? selectedTool.descriptionKey}</div>
              </div>
              <div className={styles['devtools-panel-body']}>
                <ToolPanel tool={selectedTool} onUse={() => handleSelectTool(selectedTool.id)} />
              </div>
            </div>
          </aside>
        </div>
      </div>

      <div className={styles['devtools-privacy']}>
        <Shield size={12} />
        <span>{t('devtools.privacyNote')}</span>
      </div>
    </section>
  );
}
