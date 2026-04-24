/**
 * json-highlighter · v1.3
 *
 * 纯函数：JSON tokenizer + 错误位置反推
 *
 * 为什么独立成文件？
 *  - extra-widgets.tsx 里的组件需要 React / zustand / chrome API，
 *    放一起会让纯工具函数在单测里拖入整个浏览器环境。
 *  - 抽成独立模块后，tests/unit/json-tokenizer.test.ts 可以直接 import，
 *    不污染任何全局依赖。
 */

/** tokenizer 输出的 token 类型 */
export interface JsonToken {
  type: 'key' | 'string' | 'number' | 'boolean' | 'null' | 'punct' | 'ws';
  text: string;
}

/**
 * JSON tokenizer：
 *  - 识别 key/string/number/boolean/null/punct/ws 7 类 token
 *  - 不做 AST 合法性校验（交给 JSON.parse），仅为上色服务
 *  - 兜底行为：遇到无法识别的字符当 punct 吐出 1 字符，避免死循环
 */
export function tokenizeJson(input: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let i = 0;
  const n = input.length;

  while (i < n) {
    const ch = input[i];

    // 空白
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      let end = i + 1;
      while (end < n && /\s/.test(input[end] ?? '')) end++;
      tokens.push({ type: 'ws', text: input.slice(i, end) });
      i = end;
      continue;
    }

    // 字符串：若后接冒号则为 key
    if (ch === '"') {
      let end = i + 1;
      while (end < n) {
        const c = input[end];
        if (c === '\\') {
          end += 2;
          continue;
        }
        if (c === '"') {
          end++;
          break;
        }
        end++;
      }
      const text = input.slice(i, end);
      // 跳过尾部空白判断是否是 key
      let peek = end;
      while (peek < n && /\s/.test(input[peek] ?? '')) peek++;
      const isKey = input[peek] === ':';
      tokens.push({ type: isKey ? 'key' : 'string', text });
      i = end;
      continue;
    }

    // 标点
    if (ch === '{' || ch === '}' || ch === '[' || ch === ']' || ch === ',' || ch === ':') {
      tokens.push({ type: 'punct', text: ch as string });
      i++;
      continue;
    }

    // true / false / null
    if (input.startsWith('true', i)) {
      tokens.push({ type: 'boolean', text: 'true' });
      i += 4;
      continue;
    }
    if (input.startsWith('false', i)) {
      tokens.push({ type: 'boolean', text: 'false' });
      i += 5;
      continue;
    }
    if (input.startsWith('null', i)) {
      tokens.push({ type: 'null', text: 'null' });
      i += 4;
      continue;
    }

    // 数字：-? \d+ (\.\d+)? ([eE][+-]?\d+)?
    if (ch === '-' || (ch !== undefined && ch >= '0' && ch <= '9')) {
      const match = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(input.slice(i));
      if (match) {
        tokens.push({ type: 'number', text: match[0] });
        i += match[0].length;
        continue;
      }
    }

    // 兜底
    tokens.push({ type: 'punct', text: ch ?? '' });
    i++;
  }

  return tokens;
}

/**
 * 从 JSON.parse 抛出的错误消息反推行列号。
 * 若 msg 不含 `position <N>`（如 Safari 老版本），返回 null。
 */
export function parseJsonErrorPosition(input: string, errMsg: string): { line: number; col: number } | null {
  const m = /position\s+(\d+)/i.exec(errMsg);
  if (!m) return null;
  const pos = Number(m[1]);
  if (!Number.isFinite(pos) || pos < 0) return null;
  let line = 1;
  let col = 1;
  for (let i = 0; i < Math.min(pos, input.length); i++) {
    if (input[i] === '\n') {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, col };
}
