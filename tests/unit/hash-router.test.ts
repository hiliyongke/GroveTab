/**
 * hash-router 单元测试
 */

import { describe, it, expect } from "vitest";
import { parseHash, serializeRoute, type RouteDescriptor } from "@/shared/routing/hash-router";

// ── parseHash ─────────────────────────────────────────────────────────────────

describe("parseHash", () => {
  it("空 hash → 默认 workspace", () => {
    expect(parseHash("")).toEqual({ spaceId: "workspace" });
  });

  it("非路由 hash → 默认 workspace", () => {
    expect(parseHash("#foo")).toEqual({ spaceId: "workspace" });
  });

  it("#/space/workspace → workspace", () => {
    expect(parseHash("#/space/workspace")).toEqual({ spaceId: "workspace" });
  });

  it("#/space/trending → trending", () => {
    expect(parseHash("#/space/trending")).toEqual({ spaceId: "trending" });
  });

  it("#/space/devtools → devtools", () => {
    expect(parseHash("#/space/devtools")).toEqual({ spaceId: "devtools" });
  });

  it("#/space/workspace/view/timeline → workspace + timeline", () => {
    expect(parseHash("#/space/workspace/view/timeline")).toEqual({
      spaceId: "workspace",
      viewId: "timeline",
    });
  });

  it("#/space/workspace/panel/settings → workspace + settings 面板", () => {
    expect(parseHash("#/space/workspace/panel/settings")).toEqual({
      spaceId: "workspace",
      panelId: "settings",
    });
  });

  it("#/space/workspace/view/tabs/panel/search → workspace + tabs + search", () => {
    expect(parseHash("#/space/workspace/view/tabs/panel/search")).toEqual({
      spaceId: "workspace",
      viewId: "tabs",
      panelId: "search",
    });
  });

  it("#/space/workspace/panel/settings/about → workspace + settings + about subId", () => {
    expect(parseHash("#/space/workspace/panel/settings/about")).toEqual({
      spaceId: "workspace",
      panelId: "settings",
      subId: "about",
    });
  });

  it("#/space/workspace/view/timeline/panel/settings/appearance → 全路径", () => {
    expect(parseHash("#/space/workspace/view/timeline/panel/settings/appearance")).toEqual({
      spaceId: "workspace",
      viewId: "timeline",
      panelId: "settings",
      subId: "appearance",
    });
  });

  // 旧版 hash 兼容
  it("#settings → 旧版兼容 → workspace + settings 面板", () => {
    expect(parseHash("#settings")).toEqual({
      spaceId: "workspace",
      panelId: "settings",
    });
  });

  it("#about → 旧版兼容 → workspace + settings + about subId", () => {
    expect(parseHash("#about")).toEqual({
      spaceId: "workspace",
      panelId: "settings",
      subId: "about",
    });
  });

  it("#search → 旧版兼容 → workspace + search 面板", () => {
    expect(parseHash("#search")).toEqual({
      spaceId: "workspace",
      panelId: "search",
    });
  });

  // 边界：无效 viewId
  it("#/space/workspace/view/invalid → workspace（无效 viewId 忽略）", () => {
    expect(parseHash("#/space/workspace/view/invalid")).toEqual({
      spaceId: "workspace",
    });
  });

  // 边界：无效 panelId
  it("#/space/workspace/panel/invalid → workspace（无效 panelId 忽略）", () => {
    expect(parseHash("#/space/workspace/panel/invalid")).toEqual({
      spaceId: "workspace",
    });
  });

  // 边界：仅 #/space/ → workspace
  it("#/space/ → workspace", () => {
    expect(parseHash("#/space/")).toEqual({ spaceId: "workspace" });
  });

  // 边界：面板 + view 的反向顺序
  it("#/space/workspace/panel/search/view/tabs → 按关键字解析，顺序无关", () => {
    const result = parseHash("#/space/workspace/panel/search/view/tabs");
    expect(result.spaceId).toBe("workspace");
    // 面板在前，view 在后——解析器按顺序消费
    expect(result.panelId).toBe("search");
    expect(result.viewId).toBe("tabs");
  });
});

// ── serializeRoute ─────────────────────────────────────────────────────────────

describe("serializeRoute", () => {
  it("仅 spaceId", () => {
    expect(serializeRoute({ spaceId: "workspace" })).toBe("#/space/workspace");
  });

  it("spaceId + viewId", () => {
    expect(serializeRoute({ spaceId: "workspace", viewId: "timeline" })).toBe(
      "#/space/workspace/view/timeline",
    );
  });

  it("spaceId + panelId", () => {
    expect(serializeRoute({ spaceId: "workspace", panelId: "settings" })).toBe(
      "#/space/workspace/panel/settings",
    );
  });

  it("spaceId + viewId + panelId", () => {
    expect(
      serializeRoute({ spaceId: "workspace", viewId: "tabs", panelId: "search" }),
    ).toBe("#/space/workspace/view/tabs/panel/search");
  });

  it("spaceId + panelId + subId", () => {
    expect(
      serializeRoute({ spaceId: "workspace", panelId: "settings", subId: "about" }),
    ).toBe("#/space/workspace/panel/settings/about");
  });

  it("完整路径", () => {
    expect(
      serializeRoute({
        spaceId: "workspace",
        viewId: "timeline",
        panelId: "settings",
        subId: "appearance",
      }),
    ).toBe("#/space/workspace/view/timeline/panel/settings/appearance");
  });

  it("trending 空间", () => {
    expect(serializeRoute({ spaceId: "trending" })).toBe("#/space/trending");
  });
});

// ── 往返测试（parse → serialize → parse 一致性） ──────────────────────────────

describe("round-trip: parse → serialize → parse", () => {
  const cases: RouteDescriptor[] = [
    { spaceId: "workspace" },
    { spaceId: "workspace", viewId: "timeline" },
    { spaceId: "workspace", panelId: "settings" },
    { spaceId: "workspace", viewId: "tabs", panelId: "search" },
    { spaceId: "workspace", panelId: "settings", subId: "about" },
    { spaceId: "trending" },
    { spaceId: "devtools" },
    {
      spaceId: "workspace",
      viewId: "kanban",
      panelId: "search",
    },
  ];

  cases.forEach((route) => {
    it(`${JSON.stringify(route)} → 序列化 → 解析 → 一致`, () => {
      const hash = serializeRoute(route);
      const parsed = parseHash(hash);
      expect(parsed).toEqual(route);
    });
  });
});
