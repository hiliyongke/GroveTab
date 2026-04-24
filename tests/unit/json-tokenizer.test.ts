/**
 * JSON 高亮 tokenizer · v1.3 单测
 */

import { describe, it, expect } from 'vitest';
import { tokenizeJson, parseJsonErrorPosition } from '../../src/features/dashboard-widgets/json-highlighter';

describe('tokenizeJson · 基本分类', () => {
  it('对象 key 与 string value 区分', () => {
    const tokens = tokenizeJson('{"name":"Yorke"}');
    // 过滤掉空白，聚焦非 ws token
    const nonWs = tokens.filter((t) => t.type !== 'ws');
    expect(nonWs).toEqual([
      { type: 'punct', text: '{' },
      { type: 'key', text: '"name"' },
      { type: 'punct', text: ':' },
      { type: 'string', text: '"Yorke"' },
      { type: 'punct', text: '}' },
    ]);
  });

  it('number / boolean / null', () => {
    const tokens = tokenizeJson('[1, -2.5, true, false, null]');
    const types = tokens.filter((t) => t.type !== 'ws' && t.type !== 'punct').map((t) => t.type);
    expect(types).toEqual(['number', 'number', 'boolean', 'boolean', 'null']);
  });

  it('字符串中的转义引号不应意外闭合', () => {
    const tokens = tokenizeJson('{"q":"say \\"hi\\""}');
    const strings = tokens.filter((t) => t.type === 'string').map((t) => t.text);
    expect(strings).toEqual(['"say \\"hi\\""']);
  });
});

describe('parseJsonErrorPosition', () => {
  it('从 "at position N" 反推行列号', () => {
    const input = 'line1\nline2-bad\nline3';
    const pos = parseJsonErrorPosition(input, 'Unexpected token at position 11');
    expect(pos).toEqual({ line: 2, col: 6 });
  });

  it('不包含 position 的错误消息返回 null', () => {
    expect(parseJsonErrorPosition('abc', 'some error')).toBeNull();
  });
});
