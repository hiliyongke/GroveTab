import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Button, Input, Segmented, Tag, Tooltip, Typography } from "antd";
import { ArrowRightLeft, Braces, Check, Copy, Regex, Terminal, Trash2 } from "lucide-react";
import type { DevToolDefinition } from "../tool-registry";
import { useT } from "@/shared/i18n";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { cssVars } from "@/shared/utils/css-vars";
import type {
  Base64Action,
  HashAlgorithm,
  HtmlEntityAction,
  JsonAction,
  RandomAction,
  TimestampAction,
  UrlAction,
  UrlQueryAction,
} from "../local-tools";
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
  uaParse,
  urlParse,
  urlQueryTransform,
  urlTransform,
  yamlToJson,
} from "../local-tools";
import { BRAND } from "@/shared/config/brand";
import styles from "../DevToolsView.module.less";

// TOOL_EXAMPLES 移入组件用 useMemo + t() 动态生成，避免模块级 translate() 时机问题
function buildToolExamples(): Record<string, { input?: string; input2?: string; pattern?: string; flags?: string }> {
  return {
    "json-format": {
      input: JSON.stringify({
        name: BRAND.name,
        version: "1.3",
        features: ["tabs", "widgets", "devtools"],
      }),
    },
    "json-to-ts": {
      input: JSON.stringify({
        id: 1,
        name: BRAND.name,
        active: true,
        profile: { role: "admin", tags: ["dev", "ops"] },
      }),
    },
    "json-path": {
      input: '{"user":{"name":"Tom","age":30,"address":{"city":"Beijing"}}}',
      pattern: "$.user.address.city",
    },
    "yaml-json": { input: `name: ${BRAND.name}\nversion: "1.3"\nfeatures:\n  - tabs\n  - widgets` },
    "csv-json": { input: "name,age,city\nTom,30,Beijing\nJerry,25,Shanghai" },
    "jwt-decoder": {
      input:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
    },
    "basic-auth": { input: "admin:secret123" },
    "sql-format": {
      input: "select id,name from users where active=1 order by created_at desc limit 10",
    },
    "url-parse": { input: `${BRAND.productUrl}?tab=readme#overview` },
    "url-query": { input: "https://example.com/search?q=devtools&lang=zh&page=1" },
    "url-codec": { input: "https://example.com/search?q=test&page=1" },
    "curl-fetch": {
      input:
        'curl -X POST https://api.example.com/users -H "Content-Type: application/json" -d \'{"name":"Tom"}\'',
    },
    "http-status": { input: "404" },
    "http-header": {
      input: "Content-Type: application/json\nAuthorization: Bearer token123\nX-Request-ID: abc-123",
    },
    "ua-parse": {
      input:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    "base64-codec": { input: "Hello World" },
    "html-entity": { input: '<div class="container">Tom & Jerry</div>' },
    "string-escape": { input: 'Hello "World"\nNew line\tTab' },
    "regex-test": { input: "hello world hello", pattern: "hello", flags: "g" },
    "text-diff": { input: "line1\nline2\nline3", input2: "line1\nline2 modified\nline4" },
    "case-convert": { input: "user profile card" },
    "text-stats": { input: "Hello world!\nThis is a test." },
    timestamp: { input: "1700000000" },
    cron: { input: "*/5 * * * *" },
    hash: { input: `${BRAND.name} DevTools` },
    radix: { input: "255" },
    "css-unit": { input: "16px" },
    "color-preview": { input: "#1677FF" },
    "mime-type": { input: "json" },
  };
}

const { Text } = Typography;

/** 支持自动实时执行的工具 */
const AUTO_EXECUTE_TOOL_IDS = new Set([
  "json-format",
  "json-to-ts",
  "json-path",
  "yaml-json",
  "csv-json",
  "jwt-decoder",
  "basic-auth",
  "sql-format",
  "url-parse",
  "url-query",
  "url-codec",
  "curl-fetch",
  "http-status",
  "http-header",
  "ua-parse",
  "base64-codec",
  "html-entity",
  "string-escape",
  "regex-test",
  "text-diff",
  "case-convert",
  "text-stats",
  "timestamp",
  "cron",
  "hash",
  "radix",
  "css-unit",
  "color-preview",
  "mime-type",
]);

interface ToolPanelProps {
  tool: DevToolDefinition;
  onUse: () => void;
}

export function ToolPanel({ tool, onUse }: ToolPanelProps) {
  const { t } = useT();
  /** 当前工具 id，用于检测工具切换 */
  const toolIdRef = useRef(tool.id);
  const [input, setInput] = useState("");
  const [input2, setInput2] = useState("");
  const [output, setOutput] = useState("");
  const [meta, setMeta] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [colorValue, setColorValue] = useState<string | undefined>();

  /** 工具切换时重置所有内部状态，替代 key={selectedTool.id} 的重挂载行为 */
  const [jsonAction, setJsonAction] = useState<JsonAction>("format");
  const [urlAction, setUrlAction] = useState<UrlAction>("encode");
  const [base64Action, setBase64Action] = useState<Base64Action>("encode");
  const [urlQueryAction, setUrlQueryAction] = useState<UrlQueryAction>("parse");
  const [htmlEntityAction, setHtmlEntityAction] = useState<HtmlEntityAction>("encode");
  const [timestampAction, setTimestampAction] = useState<TimestampAction>("toDatetime");
  const [fromRadix, setFromRadix] = useState("dec");
  const [toRadix, setToRadix] = useState("hex");
  const [hashAlgo, setHashAlgo] = useState<HashAlgorithm>("sha256");
  const [regexPattern, setRegexPattern] = useState("");
  const [regexFlags, setRegexFlags] = useState("g");
  const [randomAction, setRandomAction] = useState<RandomAction>("uuid");
  const [randomLen, setRandomLen] = useState(32);
  const [rootName, setRootName] = useState("Root");
  const [baseFontSize, setBaseFontSize] = useState(16);
  const [yamlAction, setYamlAction] = useState<"yamlToJson" | "jsonToYaml">("yamlToJson");
  const [csvAction, setCsvAction] = useState<"csvToJson" | "jsonToCsv">("csvToJson");
  const [basicAuthAction, setBasicAuthAction] = useState<"encode" | "decode">("encode");
  const [escapeMode, setEscapeMode] = useState<"js" | "json" | "regex" | "shell">("js");
  const [computing, setComputing] = useState(false);

  useEffect(() => {
    if (toolIdRef.current !== tool.id) {
      toolIdRef.current = tool.id;
      setInput("");
      setInput2("");
      setOutput("");
      setMeta("");
      setError("");
      setColorValue(undefined);
      setJsonAction("format");
      setUrlAction("encode");
      setBase64Action("encode");
      setUrlQueryAction("parse");
      setHtmlEntityAction("encode");
      setTimestampAction("toDatetime");
      setFromRadix("dec");
      setToRadix("hex");
      setHashAlgo("sha256");
      setRegexPattern("");
      setRegexFlags("g");
      setRandomAction("uuid");
      setRandomLen(32);
      setRootName("Root");
      setBaseFontSize(16);
      setYamlAction("yamlToJson");
      setCsvAction("csvToJson");
      setBasicAuthAction("encode");
      setEscapeMode("js");
    }
  }, [tool.id]);

  const debouncedInput = useDebounce(input, 260);
  const debouncedInput2 = useDebounce(input2, 260);
  const debouncedPattern = useDebounce(regexPattern, 260);

  const isDualInput = tool.id === "text-diff";
  const isAutoExecute = AUTO_EXECUTE_TOOL_IDS.has(tool.id);
  const isBidirectional = [
    "url-codec",
    "base64-codec",
    "timestamp",
    "radix",
    "html-entity",
    "url-query",
  ].includes(tool.id);
  const isMonospace = [
    "json-format",
    "json-to-ts",
    "json-path",
    "jwt-decoder",
    "regex-test",
    "text-diff",
    "hash",
    "radix",
    "url-query",
    "case-convert",
    "text-stats",
    "yaml-json",
    "csv-json",
    "http-header",
    "ua-parse",
    "sql-format",
    "string-escape",
    "curl-fetch",
  ].includes(tool.id);
  const colorSwatchStyle: React.CSSProperties = useMemo(
    () => cssVars({ "--devtools-color-swatch-bg": colorValue ?? "transparent" }),
    [colorValue],
  );

  const runTool = useCallback(
    async (primary: string, secondary: string) => {
      switch (tool.id) {
        case "json-format":
          return jsonTransform(primary, jsonAction);
        case "json-to-ts":
          return jsonToTypeScript(primary, rootName || "Root");
        case "json-path":
          return jsonPathQuery(primary, regexPattern);
        case "yaml-json":
          return yamlAction === "yamlToJson" ? yamlToJson(primary) : jsonToYaml(primary);
        case "csv-json":
          return csvAction === "csvToJson" ? csvToJson(primary) : jsonToCsv(primary);
        case "jwt-decoder":
          return jwtDecode(primary);
        case "basic-auth":
          return basicAuth(primary, basicAuthAction);
        case "sql-format":
          return sqlFormat(primary);
        case "url-parse":
          return urlParse(primary);
        case "url-query":
          return urlQueryTransform(primary, urlQueryAction);
        case "url-codec":
          return urlTransform(primary, urlAction);
        case "curl-fetch":
          return curlToFetch(primary);
        case "http-status":
          return httpStatusLookup(primary);
        case "http-header":
          return httpHeaderParse(primary);
        case "ua-parse":
          return uaParse(primary);
        case "base64-codec":
          return base64Transform(primary, base64Action);
        case "html-entity":
          return htmlEntityTransform(primary, htmlEntityAction);
        case "string-escape":
          return stringEscape(primary, escapeMode);
        case "regex-test":
          return regexTest(primary, regexPattern, regexFlags);
        case "text-diff":
          return textDiff(primary, secondary);
        case "case-convert":
          return caseConvert(primary);
        case "timestamp":
          return timestampTransform(primary, timestampAction);
        case "cron":
          return cronDescribe(primary);
        case "hash":
          return hashDigest(primary, hashAlgo);
        case "radix":
          return radixTransform(primary, fromRadix, toRadix);
        case "css-unit":
          return cssUnitConvert(primary, baseFontSize);
        case "color-preview":
          return colorParse(primary);
        case "mime-type":
          return mimeLookup(primary);
        case "text-stats":
          return textStats(primary);
        case "random-gen":
          return randomGenerate(randomAction, randomLen);
        default:
          return { output: "", error: t("未知工具") };
      }
    },
    [
      tool.id,
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
      t,
    ],
  );

  const applyResult = useCallback((result: Awaited<ReturnType<typeof runTool>>) => {
    setOutput(result.output);
    setMeta(result.meta ?? "");
    setError(result.error ?? "");
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
    if (tool.id === "regex-test" && !debouncedPattern.trim()) {
      applyResult({ output: "", meta: "", error: "", colorValue: undefined });
      return;
    }
    if (tool.id !== "text-stats" && !debouncedInput.trim() && !isDualInput) {
      applyResult({ output: "", meta: "", error: "", colorValue: undefined });
      return;
    }
    if (isDualInput && !debouncedInput && !debouncedInput2) {
      applyResult({ output: "", meta: "", error: "", colorValue: undefined });
      return;
    }
    let cancelled = false;
    void (async () => {
      const result = await runTool(debouncedInput, debouncedInput2);
      if (!cancelled) applyResult(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    applyResult,
    debouncedInput,
    debouncedInput2,
    debouncedPattern,
    isAutoExecute,
    isDualInput,
    runTool,
    tool.id,
  ]);

  const handleCopy = useCallback(async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setError(t('复制失败'));
    }
  }, [output, t]);

  const handleClear = useCallback(() => {
    setInput("");
    setInput2("");
    setOutput("");
    setMeta("");
    setError("");
    setColorValue(undefined);
  }, []);

  const handleSwap = useCallback(() => {
    setInput(output);
    setOutput("");
    setMeta("");
    setError("");
    setColorValue(undefined);
    if (tool.id === "url-codec")
      setUrlAction((value) => (value === "encode" ? "decode" : "encode"));
    if (tool.id === "base64-codec")
      setBase64Action((value) => (value === "encode" ? "decode" : "encode"));
    if (tool.id === "html-entity")
      setHtmlEntityAction((value) => (value === "encode" ? "decode" : "encode"));
    if (tool.id === "url-query")
      setUrlQueryAction((value) => (value === "parse" ? "build" : "parse"));
    if (tool.id === "timestamp")
      setTimestampAction((value) => (value === "toDatetime" ? "toTimestamp" : "toDatetime"));
    if (tool.id === "radix") {
      const tmp = fromRadix;
      setFromRadix(toRadix);
      setToRadix(tmp);
    }
  }, [fromRadix, output, toRadix, tool.id]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void handleExecute();
      }
    },
    [handleExecute],
  );

  const toolExamples = useMemo(() => buildToolExamples(), []);

  const handleFillExample = useCallback(() => {
    const example = toolExamples[tool.id];
    if (!example) return;
    if (example.input !== undefined) setInput(example.input);
    if (example.input2 !== undefined) setInput2(example.input2);
    if (example.pattern !== undefined) setRegexPattern(example.pattern);
    if (example.flags !== undefined) setRegexFlags(example.flags);
    onUse();
  }, [tool.id, onUse]);

  const renderDiffOutput = useCallback(
    (value: string) =>
      value.split("\n").map((line, index) => {
        const stateClass = line.startsWith("+ ")
          ? " is-add"
          : line.startsWith("- ")
            ? " is-remove"
            : "";
        return (
          <div key={`${index}-${line}`} className={`devtools-diff-line${stateClass}`}>
            {line}
          </div>
        );
      }),
    [],
  );

  const placeholder = useMemo(() => {
    switch (tool.id) {
      case "json-format":
      case "json-to-ts":
        return JSON.stringify({ id: 1, name: BRAND.name });
      case "json-path":
        return '{"user":{"name":"Tom"}}';
      case "yaml-json":
        return yamlAction === "yamlToJson"
          ? `name: ${BRAND.name}\nversion: "1.3"`
          : JSON.stringify({ name: BRAND.name });
      case "csv-json":
        return csvAction === "csvToJson" ? "name,age\nTom,30" : '[{"name":"Tom","age":30}]';
      case "jwt-decoder":
        return "eyJhbGciOi...";
      case "basic-auth":
        return basicAuthAction === "encode" ? "admin:secret123" : "Basic YWRtaW46c2VjcmV0MTIz";
      case "sql-format":
        return "select id,name from users where active=1";
      case "url-parse":
        return `${BRAND.productUrl}?tab=readme#overview`;
      case "url-query":
        return urlQueryAction === "parse"
          ? 'https://example.com?a=1&b=2'
          : '{"a":1,"b":"hello"}';
      case "url-codec":
        return "https://example.com/search?q=test";
      case "curl-fetch":
        return 'curl -X POST https://api.example.com/users -H "Content-Type: application/json" -d \'{"name":"Tom"}\'';
      case "http-status":
        return "404";
      case "http-header":
        return "Content-Type: application/json\nAuthorization: Bearer token123";
      case "ua-parse":
        return "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36...";
      case "base64-codec":
        return "Input text or Base64 string";
      case "html-entity":
        return '<div class="hello">Tom & Jerry</div>';
      case "string-escape":
        return 'Hello "World"\nNew line\tTab';
      case "regex-test":
        return "Text to test against regex pattern";
      case "case-convert":
        return "user profile card";
      case "timestamp":
        return "1700000000 or 2024-01-01";
      case "cron":
        return "*/5 * * * *";
      case "hash":
        return "Text to hash";
      case "radix":
        return "255";
      case "css-unit":
        return "16px or 1rem";
      case "color-preview":
        return "#1677FF or rgb(22, 119, 255)";
      case "mime-type":
        return "json or application/json";
      default:
        return "";
    }
  }, [tool.id, urlQueryAction, yamlAction, csvAction, basicAuthAction]);

  return (
    <div className={styles["devtools-form"]} onKeyDown={handleKeyDown}>
      <div className={styles["devtools-options"]}>
        {tool.id === "json-format" && (
          <Segmented
            value={jsonAction}
            onChange={(value) => setJsonAction(value as JsonAction)}
            options={[
              { value: "format", label: t("格式化") },
              { value: "minify", label: t("压缩") },
              { value: "validate", label: t("校验") },
            ]}
          />
        )}
        {tool.id === "json-to-ts" && (
          <Input
            value={rootName}
            onChange={(event) => setRootName(event.target.value)}
            placeholder="Root"
            className={styles["devtools-field-size--root"]}
          />
        )}
        {tool.id === "yaml-json" && (
          <Segmented
            value={yamlAction}
            onChange={(value) => setYamlAction(value as "yamlToJson" | "jsonToYaml")}
            options={[
              { value: "yamlToJson", label: t("YAML → JSON") },
              { value: "jsonToYaml", label: t("JSON → YAML") },
            ]}
          />
        )}
        {tool.id === "csv-json" && (
          <Segmented
            value={csvAction}
            onChange={(value) => setCsvAction(value as "csvToJson" | "jsonToCsv")}
            options={[
              { value: "csvToJson", label: t("CSV → JSON") },
              { value: "jsonToCsv", label: t("JSON → CSV") },
            ]}
          />
        )}
        {tool.id === "url-query" && (
          <Segmented
            value={urlQueryAction}
            onChange={(value) => setUrlQueryAction(value as UrlQueryAction)}
            options={[
              { value: "parse", label: "Parse" },
              { value: "build", label: "Build" },
            ]}
          />
        )}
        {tool.id === "url-codec" && (
          <Segmented
            value={urlAction}
            onChange={(value) => setUrlAction(value as UrlAction)}
            options={[
              { value: "encode", label: "Encode" },
              { value: "decode", label: "Decode" },
            ]}
          />
        )}
        {tool.id === "base64-codec" && (
          <Segmented
            value={base64Action}
            onChange={(value) => setBase64Action(value as Base64Action)}
            options={[
              { value: "encode", label: "Encode" },
              { value: "decode", label: "Decode" },
            ]}
          />
        )}
        {tool.id === "html-entity" && (
          <Segmented
            value={htmlEntityAction}
            onChange={(value) => setHtmlEntityAction(value as HtmlEntityAction)}
            options={[
              { value: "encode", label: "Encode" },
              { value: "decode", label: "Decode" },
            ]}
          />
        )}
        {tool.id === "string-escape" && (
          <Segmented
            value={escapeMode}
            onChange={(value) => setEscapeMode(value as "js" | "json" | "regex" | "shell")}
            options={[
              { value: "js", label: "JS" },
              { value: "json", label: "JSON" },
              { value: "regex", label: "Regex" },
              { value: "shell", label: "Shell" },
            ]}
          />
        )}
        {tool.id === "timestamp" && (
          <Segmented
            value={timestampAction}
            onChange={(value) => setTimestampAction(value as TimestampAction)}
            options={[
              { value: "toDatetime", label: t("→ 日期") },
              { value: "toTimestamp", label: t("→ 时间戳") },
            ]}
          />
        )}
        {tool.id === "hash" && (
          <Segmented
            value={hashAlgo}
            onChange={(value) => setHashAlgo(value as HashAlgorithm)}
            options={[
              { value: "sha1", label: "SHA-1" },
              { value: "sha256", label: "SHA-256" },
              { value: "sha512", label: "SHA-512" },
            ]}
          />
        )}
        {tool.id === "radix" && (
          <>
            <Segmented
              value={fromRadix}
              onChange={setFromRadix}
              options={[
                { value: "bin", label: "2" },
                { value: "oct", label: "8" },
                { value: "dec", label: "10" },
                { value: "hex", label: "16" },
              ]}
            />
            <ArrowRightLeft size={14} className={styles["devtools-option-arrow"]} />
            <Segmented
              value={toRadix}
              onChange={setToRadix}
              options={[
                { value: "bin", label: "2" },
                { value: "oct", label: "8" },
                { value: "dec", label: "10" },
                { value: "hex", label: "16" },
              ]}
            />
          </>
        )}
        {tool.id === "css-unit" && (
          <Input
            type="number"
            value={baseFontSize}
            onChange={(event) => setBaseFontSize(Number(event.target.value) || 16)}
            prefix="Base"
            suffix="px"
            className={styles["devtools-field-size--base"]}
          />
        )}
        {tool.id === "random-gen" && (
          <Segmented
            value={randomAction}
            onChange={(value) => setRandomAction(value as RandomAction)}
            options={[
              { value: "uuid", label: "UUID" },
              { value: "randomInt", label: t("随机整数") },
              { value: "randomHex", label: t("随机 HEX") },
            ]}
          />
        )}
        {tool.id === "random-gen" && randomAction !== "uuid" && (
          <Input
            type="number"
            value={randomLen}
            onChange={(event) => setRandomLen(Number(event.target.value) || 1)}
            min={1}
            max={128}
            prefix="Len"
            className={styles["devtools-field-size--random"]}
          />
        )}
        {tool.id === "basic-auth" && (
          <Segmented
            value={basicAuthAction}
            onChange={(value) => setBasicAuthAction(value as "encode" | "decode")}
            options={[
              { value: "encode", label: "Encode" },
              { value: "decode", label: "Decode" },
            ]}
          />
        )}
      </div>

      {tool.id === "regex-test" && (
        <div className={styles["devtools-two-col"]}>
          <Input
            prefix={<Regex size={14} />}
            placeholder={t('正则')}
            value={regexPattern}
            onChange={(event) => setRegexPattern(event.target.value)}
          />
          <Input
            placeholder={t('标志')}
            value={regexFlags}
            onChange={(event) => setRegexFlags(event.target.value.replace(/[^gimsuy]/g, ""))}
            maxLength={7}
          />
        </div>
      )}
      {tool.id === "json-path" && (
        <div className={styles["devtools-two-col"]}>
          <Input
            prefix={<Braces size={14} />}
            placeholder="JSON Path, e.g. $.user.name"
            value={regexPattern}
            onChange={(event) => setRegexPattern(event.target.value)}
          />
        </div>
      )}

      {isDualInput ? (
        <div className={styles["devtools-two-col"]}>
          <div className={styles["devtools-field"]}>
            <span className={styles["devtools-field-label"]}>{t('左侧文本')}</span>
            <Input.TextArea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              rows={7}
              placeholder="Left text"
            />
          </div>
          <div className={styles["devtools-field"]}>
            <span className={styles["devtools-field-label"]}>{t('右侧文本')}</span>
            <Input.TextArea
              value={input2}
              onChange={(event) => setInput2(event.target.value)}
              rows={7}
              placeholder="Right text"
            />
          </div>
        </div>
      ) : (
        tool.id !== "random-gen" && (
          <div className={styles["devtools-field"]}>
            <span className={styles["devtools-field-label"]}>{t('输入')}</span>
            <Input.TextArea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              rows={6}
              placeholder={placeholder}
              className={isMonospace ? "devtools-input-mono" : undefined}
            />
          </div>
        )
      )}

      <div className={styles["devtools-actions"]}>
        {!isAutoExecute && (
          <Button
            type="primary"
            onClick={() => {
              void handleExecute();
            }}
            loading={computing}
          >
            {t('执行')}
          </Button>
        )}
        {isAutoExecute && (
          <Tag
            color="blue"
            className={`${styles["devtools-tag"]} ${styles["devtools-tag--realtime"]}`}
          >
            {t('实时')}
          </Tag>
        )}
        {isBidirectional && (
          <Button onClick={handleSwap} icon={<ArrowRightLeft size={14} />}>
            {t('交换')}
          </Button>
        )}
        <Button onClick={handleClear} icon={<Trash2 size={14} />}>
          {t('清空')}
        </Button>
        {toolExamples[tool.id] && (
          <Button onClick={handleFillExample} icon={<Terminal size={14} />}>
            {t('示例')}
          </Button>
        )}
        {tool.id === "random-gen" && (
          <Button
            type="primary"
            onClick={() => {
              void handleExecute();
            }}
            loading={computing}
          >
            {t('生成')}
          </Button>
        )}
      </div>

      {tool.id === "color-preview" && colorValue && (
        <div className={styles["devtools-color-preview"]}>
          <div className={styles["devtools-color-swatch"]} style={colorSwatchStyle} />
          <Text code>{colorValue}</Text>
        </div>
      )}

      {output && (
        <div className={styles["devtools-output"]}>
          <div className={styles["devtools-output-head"]}>
            <Text type="secondary" className={styles["devtools-output-label"]}>
              {t('输出')}
            </Text>
            <Tooltip title={copied ? t('已复制') : t('复制')}>
              <Button
                type="text"
                onClick={() => void handleCopy()}
                icon={copied ? <Check size={14} /> : <Copy size={14} />}
              />
            </Tooltip>
          </div>
          <div className={styles["devtools-output-body"]}>
            {tool.id === "text-diff" ? (
              renderDiffOutput(output)
            ) : (
              <pre className={styles["devtools-pre"]}>{output}</pre>
            )}
          </div>
          {meta && (
            <div className={styles["devtools-output-meta"]}>
              <Text type="secondary" className={styles["devtools-output-meta-text"]}>
                {meta}
              </Text>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className={styles["devtools-error"]}>
          <Text type="danger" className={styles["devtools-error-text"]}>
            {error}
          </Text>
        </div>
      )}
    </div>
  );
}
