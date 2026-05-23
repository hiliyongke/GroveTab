/**
 * 开发工具栏 —— 工具执行器
 *
 * 将工具 ID 分派到对应的 local-tools 转换函数。
 * 纯异步函数，无 React 依赖，便于测试和复用。
 */

import type {
  Base64Action,
  DevToolResult,
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

/** 工具执行参数 —— 对应 ToolPanel 中各工具的交互状态 */
export interface ToolExecutorParams {
  jsonAction?: JsonAction;
  rootName?: string;
  yamlAction?: 'yamlToJson' | 'jsonToYaml';
  csvAction?: 'csvToJson' | 'jsonToCsv';
  basicAuthAction?: 'encode' | 'decode';
  escapeMode?: 'js' | 'json' | 'regex' | 'shell';
  urlQueryAction?: UrlQueryAction;
  urlAction?: UrlAction;
  base64Action?: Base64Action;
  htmlEntityAction?: HtmlEntityAction;
  regexPattern?: string;
  regexFlags?: string;
  timestampAction?: TimestampAction;
  hashAlgo?: HashAlgorithm;
  fromRadix?: string;
  toRadix?: string;
  baseFontSize?: number;
  randomAction?: RandomAction;
  randomLen?: number;
}

/**
 * 执行开发工具转换
 *
 * @param toolId  - 工具 ID
 * @param input   - 主输入文本
 * @param input2  - 辅助输入文本（如 text-diff 的第二段）
 * @param params  - 工具交互参数（对应各工具的 UI 状态）
 * @returns 转换结果
 */
export async function executeTool(
  toolId: string,
  input: string,
  input2: string,
  params: ToolExecutorParams,
): Promise<DevToolResult> {
  switch (toolId) {
    case 'json-format':
      return jsonTransform(input, params.jsonAction ?? 'format');
    case 'json-to-ts':
      return jsonToTypeScript(input, params.rootName ?? 'Root');
    case 'json-path':
      return jsonPathQuery(input, params.regexPattern ?? '');
    case 'yaml-json':
      return params.yamlAction === 'jsonToYaml' ? jsonToYaml(input) : yamlToJson(input);
    case 'csv-json':
      return params.csvAction === 'jsonToCsv' ? jsonToCsv(input) : csvToJson(input);
    case 'jwt-decoder':
      return jwtDecode(input);
    case 'basic-auth':
      return basicAuth(input, params.basicAuthAction ?? 'encode');
    case 'sql-format':
      return sqlFormat(input);
    case 'url-parse':
      return urlParse(input);
    case 'url-query':
      return urlQueryTransform(input, params.urlQueryAction ?? 'parse');
    case 'url-codec':
      return urlTransform(input, params.urlAction ?? 'encode');
    case 'curl-fetch':
      return curlToFetch(input);
    case 'http-status':
      return httpStatusLookup(input);
    case 'http-header':
      return httpHeaderParse(input);
    case 'ua-parse':
      return { output: '', error: 'ua-parse not implemented' };
    case 'base64-codec':
      return base64Transform(input, params.base64Action ?? 'encode');
    case 'html-entity':
      return htmlEntityTransform(input, params.htmlEntityAction ?? 'encode');
    case 'string-escape':
      return stringEscape(input, params.escapeMode ?? 'js');
    case 'regex-test':
      return regexTest(input, params.regexPattern ?? '', params.regexFlags ?? '');
    case 'text-diff':
      return textDiff(input, input2);
    case 'case-convert':
      return caseConvert(input);
    case 'timestamp':
      return timestampTransform(input, params.timestampAction ?? 'toDatetime');
    case 'cron':
      return cronDescribe(input);
    case 'hash':
      return hashDigest(input, params.hashAlgo ?? 'sha256');
    case 'radix':
      return radixTransform(input, params.fromRadix ?? 'dec', params.toRadix ?? 'hex');
    case 'css-unit':
      return cssUnitConvert(input, params.baseFontSize ?? 16);
    case 'color-preview':
      return colorParse(input);
    case 'mime-type':
      return mimeLookup(input);
    case 'text-stats':
      return textStats(input);
    case 'random-gen':
      return randomGenerate(params.randomAction ?? 'uuid', params.randomLen);
    default:
      return { output: '', error: '未知工具' };
  }
}
