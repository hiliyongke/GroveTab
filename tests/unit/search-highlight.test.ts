/**
 * search-highlight.ts 单元测试
 */

import { describe, it, expect } from "vitest";
import { tokenizeHighlight } from "@/shared/utils/search-highlight";

describe("tokenizeHighlight", () => {
  it("空搜索词应该返回原始文本", () => {
    const tokens = tokenizeHighlight("Hello World", "");
    expect(tokens).toEqual([{ text: "Hello World", match: false }]);
  });

  it("空文本应该返回空 token", () => {
    const tokens = tokenizeHighlight("", "query");
    expect(tokens).toEqual([{ text: "", match: false }]);
  });

  it("应该正确标记匹配片段", () => {
    const tokens = tokenizeHighlight("Hello World", "world");
    expect(tokens).toContainEqual({ text: "World", match: true });
  });

  it("应该忽略大小写", () => {
    const tokens = tokenizeHighlight("Hello World", "WORLD");
    expect(tokens).toContainEqual({ text: "World", match: true });
  });

  it("应该正确处理特殊正则字符", () => {
    const tokens = tokenizeHighlight("Hello (World)", "(world");
    // 不应该抛出错误
    expect(tokens.length).toBeGreaterThan(0);
  });

  it("无匹配时应该返回原始文本", () => {
    const tokens = tokenizeHighlight("Hello World", "xyz");
    expect(tokens).toEqual([{ text: "Hello World", match: false }]);
  });

  it("多个匹配片段应该正确拆分", () => {
    const tokens = tokenizeHighlight("test test test", "test");
    const matchedTokens = tokens.filter((t) => t.match);
    expect(matchedTokens.length).toBe(3);
  });
});
