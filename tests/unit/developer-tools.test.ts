/**
 * 开发工具栏 —— 本地工具纯函数单元测试
 *
 * 覆盖 JSON、URL、Base64、时间戳、进制、随机生成、颜色解析、
 * 多算法哈希、正则测试、文本差异、HTML 实体编解码的正常和边界场景。
 */

import { describe, it, expect } from 'vitest';
import {
  jsonTransform,
  urlTransform,
  base64Transform,
  timestampTransform,
  radixTransform,
  randomGenerate,
  colorParse,
  hashDigest,
  regexTest,
  textDiff,
  htmlEntityTransform,
  jwtDecode,
  urlQueryTransform,
  caseConvert,
  jsonToTypeScript,
  httpStatusLookup,
  mimeLookup,
  cssUnitConvert,
  textStats,
  cronDescribe,
  urlParse,
  curlToFetch,
  jsonPathQuery,
  yamlToJson,
  jsonToYaml,
  csvToJson,
  jsonToCsv,
  httpHeaderParse,
  basicAuth,
  sqlFormat,
  stringEscape,
} from '@/features/developer-tools/local-tools';

// ── JSON 格式化 ──────────────────────────────────────

describe('jsonTransform', () => {
  it('格式化 JSON', () => {
    const result = jsonTransform('{"a":1}', 'format');
    expect(result.error).toBeUndefined();
    expect(result.output).toBe('{\n  "a": 1\n}');
  });

  it('压缩 JSON', () => {
    const result = jsonTransform('{\n  "a": 1\n}', 'minify');
    expect(result.error).toBeUndefined();
    expect(result.output).toBe('{"a":1}');
  });

  it('校验有效 JSON', () => {
    const result = jsonTransform('{"ok":true}', 'validate');
    expect(result.error).toBeUndefined();
    expect(result.meta).toContain('正确');
  });

  it('报告非法 JSON', () => {
    const result = jsonTransform('{invalid}', 'format');
    expect(result.error).toContain('解析失败');
  });

  it('空输入报错', () => {
    const result = jsonTransform('  ', 'format');
    expect(result.error).toContain('为空');
  });
});

// ── URL 编解码 ────────────────────────────────────────

describe('urlTransform', () => {
  it('编码 URL', () => {
    const result = urlTransform('hello world&foo=bar', 'encode');
    expect(result.output).toBe('hello%20world%26foo%3Dbar');
  });

  it('解码 URL', () => {
    const result = urlTransform('hello%20world', 'decode');
    expect(result.output).toBe('hello world');
  });

  it('解码非法序列报错', () => {
    const result = urlTransform('%E0%A4%A', 'decode');
    expect(result.error).toBeDefined();
  });

  it('空输入报错', () => {
    expect(urlTransform('', 'encode').error).toBeDefined();
  });
});

// ── Base64 编解码 ─────────────────────────────────────

describe('base64Transform', () => {
  it('编码 ASCII', () => {
    const result = base64Transform('Hello', 'encode');
    expect(result.output).toBe('SGVsbG8=');
  });

  it('解码 ASCII', () => {
    const result = base64Transform('SGVsbG8=', 'decode');
    expect(result.output).toBe('Hello');
  });

  it('编码 Unicode', () => {
    const result = base64Transform('你好', 'encode');
    expect(result.error).toBeUndefined();
    // 验证 round-trip
    const decoded = base64Transform(result.output, 'decode');
    expect(decoded.output).toBe('你好');
  });

  it('解码非法 Base64 报错', () => {
    const result = base64Transform('!!!not-base64!!!', 'decode');
    expect(result.error).toBeDefined();
  });

  it('空输入报错', () => {
    expect(base64Transform('', 'encode').error).toBeDefined();
  });
});

// ── 时间戳转换 ────────────────────────────────────────

describe('timestampTransform', () => {
  it('秒级时间戳转日期', () => {
    const result = timestampTransform('1700000000', 'toDatetime');
    expect(result.error).toBeUndefined();
    expect(result.output).toContain('2023');
  });

  it('毫秒级时间戳转日期', () => {
    const result = timestampTransform('1700000000000', 'toDatetime');
    expect(result.error).toBeUndefined();
    expect(result.output).toContain('2023');
  });

  it('日期转时间戳', () => {
    const result = timestampTransform('2024-01-01', 'toTimestamp');
    expect(result.error).toBeUndefined();
    expect(Number(result.output)).toBeGreaterThan(0);
  });

  it('无效时间戳报错', () => {
    const result = timestampTransform('abc', 'toDatetime');
    expect(result.error).toBeDefined();
  });

  it('无效日期报错', () => {
    const result = timestampTransform('not-a-date', 'toTimestamp');
    expect(result.error).toBeDefined();
  });
});

// ── 进制转换 ──────────────────────────────────────────

describe('radixTransform', () => {
  it('十进制转十六进制', () => {
    const result = radixTransform('255', 'dec', 'hex');
    expect(result.output).toBe('FF');
  });

  it('十六进制转十进制', () => {
    const result = radixTransform('FF', 'hex', 'dec');
    expect(result.output).toBe('255');
  });

  it('十进制转二进制', () => {
    const result = radixTransform('10', 'dec', 'bin');
    expect(result.output).toBe('1010');
  });

  it('非法输入报错', () => {
    const result = radixTransform('xyz', 'dec', 'hex');
    expect(result.error).toBeDefined();
  });

  it('空输入报错', () => {
    expect(radixTransform('', 'dec', 'hex').error).toBeDefined();
  });
});

// ── 随机数 / UUID ─────────────────────────────────────

describe('randomGenerate', () => {
  it('生成 UUID v4', () => {
    const result = randomGenerate('uuid');
    expect(result.error).toBeUndefined();
    expect(result.output).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('生成随机整数', () => {
    const result = randomGenerate('randomInt', 6);
    expect(result.error).toBeUndefined();
    expect(Number(result.output)).toBeGreaterThanOrEqual(100000);
    expect(Number(result.output)).toBeLessThanOrEqual(999999);
  });

  it('生成随机 HEX', () => {
    const result = randomGenerate('randomHex', 16);
    expect(result.error).toBeUndefined();
    expect(result.output).toMatch(/^[0-9a-f]{16}$/);
  });

  it('两次生成的 UUID 不同', () => {
    const a = randomGenerate('uuid');
    const b = randomGenerate('uuid');
    expect(a.output).not.toBe(b.output);
  });
});

// ── 颜色值预览 ────────────────────────────────────────

describe('colorParse', () => {
  it('解析 3 位 HEX', () => {
    const result = colorParse('#fff');
    expect(result.error).toBeUndefined();
    expect(result.output).toBe('#FFFFFF');
    expect(result.colorValue).toBeDefined();
  });

  it('解析 6 位 HEX', () => {
    const result = colorParse('#1677FF');
    expect(result.error).toBeUndefined();
    expect(result.output).toBe('#1677FF');
  });

  it('解析 rgb()', () => {
    const result = colorParse('rgb(22, 119, 255)');
    expect(result.error).toBeUndefined();
    expect(result.output).toContain('rgb');
    expect(result.colorValue).toBeDefined();
  });

  it('解析 hsl()', () => {
    const result = colorParse('hsl(210, 100%, 50%)');
    expect(result.error).toBeUndefined();
    expect(result.output).toContain('hsl');
  });

  it('无效颜色格式报错', () => {
    const result = colorParse('not-a-color');
    expect(result.error).toBeDefined();
  });

  it('HEX 长度无效报错', () => {
    const result = colorParse('#12');
    expect(result.error).toBeDefined();
  });

  it('RGB 值超范围报错', () => {
    const result = colorParse('rgb(300, 0, 0)');
    expect(result.error).toBeDefined();
  });

  it('空输入报错', () => {
    expect(colorParse('').error).toBeDefined();
  });
});

// ── 多算法哈希 ──────────────────────────────────────

describe('hashDigest', () => {
  it('SHA-256 计算哈希', async () => {
    const result = await hashDigest('hello', 'sha256');
    expect(result.error).toBeUndefined();
    expect(result.output).toHaveLength(64);
    expect(result.meta).toContain('SHA-256');
  });

  it('SHA-1 计算哈希', async () => {
    const result = await hashDigest('hello', 'sha1');
    expect(result.error).toBeUndefined();
    expect(result.output).toHaveLength(40);
    expect(result.meta).toContain('SHA-1');
  });

  it('SHA-512 计算哈希', async () => {
    const result = await hashDigest('hello', 'sha512');
    expect(result.error).toBeUndefined();
    expect(result.output).toHaveLength(128);
    expect(result.meta).toContain('SHA-512');
  });

  it('空输入报错', async () => {
    const result = await hashDigest('', 'sha256');
    expect(result.error).toBeDefined();
  });
});

// ── 正则测试 ──────────────────────────────────────────

describe('regexTest', () => {
  it('全局匹配', () => {
    const result = regexTest('hello world hello', 'hello', 'g');
    expect(result.error).toBeUndefined();
    expect(result.output).toContain('hello');
    expect(result.meta).toContain('2');
  });

  it('捕获组匹配', () => {
    const result = regexTest('2024-01-01', '(\\d{4})-(\\d{2})-(\\d{2})', '');
    expect(result.error).toBeUndefined();
    expect(result.output).toContain('2024');
  });

  it('无匹配时返回提示', () => {
    const result = regexTest('hello', 'xyz', 'g');
    expect(result.output).toContain('无匹配');
  });

  it('非法正则报错', () => {
    const result = regexTest('test', '[invalid', '');
    expect(result.error).toContain('语法错误');
  });

  it('空正则报错', () => {
    const result = regexTest('test', '  ', 'g');
    expect(result.error).toBeDefined();
  });
});

// ── 文本差异对比 ──────────────────────────────────────

describe('textDiff', () => {
  it('相同文本', () => {
    const result = textDiff('hello\nworld', 'hello\nworld');
    expect(result.meta).toContain('相同');
  });

  it('有增删行', () => {
    const result = textDiff('a\nb\nc', 'a\nd\nc');
    expect(result.output).toContain('+ d');
    expect(result.output).toContain('- b');
    expect(result.meta).toContain('+1');
    expect(result.meta).toContain('-1');
  });

  it('空文本对比', () => {
    const result = textDiff('', 'hello');
    expect(result.output).toContain('+ hello');
  });

  it('全删', () => {
    const result = textDiff('hello', '');
    expect(result.output).toContain('- hello');
  });
});

// ── HTML 实体编解码 ───────────────────────────────────

describe('htmlEntityTransform', () => {
  it('编码 HTML 特殊字符', () => {
    const result = htmlEntityTransform('<div class="test">&</div>', 'encode');
    expect(result.error).toBeUndefined();
    expect(result.output).toContain('&lt;');
    expect(result.output).toContain('&amp;');
    expect(result.output).toContain('&quot;');
  });

  it('解码 HTML 实体', () => {
    const result = htmlEntityTransform('&lt;div&gt;hello&amp;world&lt;/div&gt;', 'decode');
    expect(result.error).toBeUndefined();
    expect(result.output).toContain('<div>');
    expect(result.output).toContain('&');
  });

  it('编码单引号', () => {
    const result = htmlEntityTransform("it's", 'encode');
    expect(result.output).toContain('&#39;');
  });

  it('空输入报错', () => {
    expect(htmlEntityTransform('', 'encode').error).toBeDefined();
  });
});

// ── 新增 10 个高频工具 ───────────────────────────────

describe('urlParse', () => {
  it('拆解 URL', () => {
    const result = urlParse('https://github.com/canopy/tabs?tab=readme#overview');
    expect(result.error).toBeUndefined();
    expect(result.output).toContain('github.com');
    expect(result.output).toContain('protocol');
  });
});

describe('curlToFetch', () => {
  it('转换 curl 为 fetch', () => {
    const result = curlToFetch('curl -X POST https://api.example.com/users -H "Content-Type: application/json" -d \'{"name":"Tom"}\'');
    expect(result.error).toBeUndefined();
    expect(result.output).toContain('fetch');
  });
});

describe('jsonPathQuery', () => {
  it('查询 JSON Path', () => {
    const result = jsonPathQuery('{"user":{"name":"Tom"}}', '$.user.name');
    expect(result.output).toContain('Tom');
  });
});

describe('yamlToJson', () => {
  it('YAML 转 JSON', () => {
    const result = yamlToJson('name: Canopy\nversion: "1.3"');
    expect(result.output).toContain('Canopy');
  });
});

describe('jsonToYaml', () => {
  it('JSON 转 YAML', () => {
    const result = jsonToYaml('{"name":"Canopy"}');
    expect(result.output).toContain('name:');
  });
});

describe('csvToJson', () => {
  it('CSV 转 JSON', () => {
    const result = csvToJson('name,age\nTom,30');
    expect(result.output).toContain('Tom');
  });
});

describe('jsonToCsv', () => {
  it('JSON 转 CSV', () => {
    const result = jsonToCsv('[{"name":"Tom","age":30}]');
    expect(result.output).toContain('name,age');
  });
});

describe('httpHeaderParse', () => {
  it('解析 HTTP Header', () => {
    const result = httpHeaderParse('Content-Type: application/json\nAuthorization: Bearer token123');
    expect(result.output).toContain('Content-Type');
  });
});

describe('basicAuth', () => {
  it('编码 Basic Auth', () => {
    const result = basicAuth('admin:secret123', 'encode');
    expect(result.output).toContain('Basic');
  });

  it('解码 Basic Auth', () => {
    const result = basicAuth('Basic YWRtaW46c2VjcmV0MTIz', 'decode');
    expect(result.output).toBe('admin:secret123');
  });
});

describe('sqlFormat', () => {
  it('格式化 SQL', () => {
    const result = sqlFormat('select id,name from users where active=1');
    expect(result.output).toContain('SELECT');
  });
});

describe('stringEscape', () => {
  it('JS 转义', () => {
    const result = stringEscape('Hello "World"', 'js');
    expect(result.output).toContain('\\"');
  });

  it('Regex 转义', () => {
    const result = stringEscape('a.b*c', 'regex');
    expect(result.output).toContain('\\.');
  });
});

// ── 前后端增强工具 ───────────────────────────────────

describe('jwtDecode', () => {
  it('解码 JWT header 和 payload', () => {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const payload = btoa(JSON.stringify({ sub: 'u1', exp: 4102444800 })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const result = jwtDecode(`${header}.${payload}.signature`);
    expect(result.error).toBeUndefined();
    expect(result.output).toContain('payload');
    expect(result.meta).toContain('过期时间');
  });

  it('非法 JWT 报错', () => {
    expect(jwtDecode('abc').error).toBeDefined();
  });
});

describe('urlQueryTransform', () => {
  it('解析 URL Query 为 JSON', () => {
    const result = urlQueryTransform('https://example.com?a=1&b=hello', 'parse');
    expect(result.output).toContain('"a"');
    expect(result.output).toContain('hello');
  });

  it('由 JSON 构建 Query', () => {
    const result = urlQueryTransform('{"a":1,"b":"hello"}', 'build');
    expect(result.output).toContain('a=1');
    expect(result.output).toContain('b=hello');
  });
});

describe('caseConvert', () => {
  it('生成多种命名风格', () => {
    const result = caseConvert('user profile card');
    expect(result.output).toContain('camelCase');
    expect(result.output).toContain('userProfileCard');
    expect(result.output).toContain('user_profile_card');
  });
});

describe('jsonToTypeScript', () => {
  it('JSON 生成 interface', () => {
    const result = jsonToTypeScript('{"id":1,"name":"Canopy","profile":{"active":true}}', 'User');
    expect(result.error).toBeUndefined();
    expect(result.output).toContain('export interface User');
    expect(result.output).toContain('id: number');
  });

  it('非法 JSON 报错', () => {
    expect(jsonToTypeScript('{bad}', 'Root').error).toBeDefined();
  });
});

describe('httpStatusLookup', () => {
  it('查询 HTTP 状态码', () => {
    const result = httpStatusLookup('404');
    expect(result.output).toBe('404 Not Found');
    expect(result.meta).toContain('客户端');
  });
});

describe('mimeLookup', () => {
  it('扩展名查询 MIME', () => {
    expect(mimeLookup('json').output).toBe('application/json');
  });

  it('MIME 查询扩展名', () => {
    expect(mimeLookup('image/png').output).toContain('.png');
  });
});

describe('cssUnitConvert', () => {
  it('px 转 rem/em', () => {
    const result = cssUnitConvert('16px', 16);
    expect(result.output).toContain('1rem');
  });

  it('rem 转 px', () => {
    const result = cssUnitConvert('1.5rem', 16);
    expect(result.output).toContain('24px');
  });
});

describe('textStats', () => {
  it('统计文本', () => {
    const result = textStats('hello world\n你好');
    expect(result.output).toContain('chars');
    expect(result.output).toContain('bytes');
  });
});

describe('cronDescribe', () => {
  it('解释 Cron 表达式', () => {
    const result = cronDescribe('*/5 * * * *');
    expect(result.output).toContain('每 5 分钟');
  });

  it('非法 Cron 报错', () => {
    expect(cronDescribe('* * *').error).toBeDefined();
  });
});
