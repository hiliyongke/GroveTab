/**
 * metadata-key.ts 单元测试
 */

import { describe, it, expect } from "vitest";
import { normalizeMetadataKey } from "@/shared/utils/metadata-key";

describe("normalizeMetadataKey", () => {
  it("应该移除 hash", () => {
    expect(normalizeMetadataKey("https://example.com/path?a=1#section")).toBe(
      "https://example.com/path?a=1",
    );
  });

  it("应该移除尾部斜杠", () => {
    expect(normalizeMetadataKey("https://example.com/path/")).toBe("https://example.com/path");
  });

  it("应该同时移除 hash 和尾部斜杠", () => {
    expect(normalizeMetadataKey("https://example.com/path/#sec")).toBe("https://example.com/path");
  });

  it("无效 URL 应该原样返回", () => {
    expect(normalizeMetadataKey("not-a-url")).toBe("not-a-url");
  });

  it("无 hash 和尾部斜杠的 URL 应该保持不变", () => {
    expect(normalizeMetadataKey("https://example.com/path")).toBe("https://example.com/path");
  });
});
