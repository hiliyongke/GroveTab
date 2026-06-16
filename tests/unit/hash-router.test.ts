/**
 * hash-router 单元测试
 */

import { describe, it, expect } from "vitest";
import { parseHash, serializeRoute, type RouteDescriptor } from "@/shared/routing/hash-router";

// ── parseHash ─────────────────────────────────────────────────────────────────

describe("parseHash", () => {
  it("空 hash → 空路由（默认工作区）", () => {
    expect(parseHash("")).toEqual({});
  });

  it("非路由 hash → 空路由", () => {
    expect(parseHash("#foo")).toEqual({});
  });

  it("#/ → 空路由", () => {
    expect(parseHash("#/")).toEqual({});
  });

  it("#/view/timeline → timeline 视图", () => {
    expect(parseHash("#/view/timeline")).toEqual({ viewId: "timeline" });
  });

  it("#/panel/settings → settings 面板", () => {
    expect(parseHash("#/panel/settings")).toEqual({ panelId: "settings" });
  });

  it("#/view/tabs/panel/search → tabs + search", () => {
    expect(parseHash("#/view/tabs/panel/search")).toEqual({
      viewId: "tabs",
      panelId: "search",
    });
  });

  it("#/panel/settings/about → settings + about subId", () => {
    expect(parseHash("#/panel/settings/about")).toEqual({
      panelId: "settings",
      subId: "about",
    });
  });

  it("#/view/timeline/panel/settings/appearance → 全路径", () => {
    expect(parseHash("#/view/timeline/panel/settings/appearance")).toEqual({
      viewId: "timeline",
      panelId: "settings",
      subId: "appearance",
    });
  });

  // 旧版扁平 hash 兼容
  it("#settings → 旧版兼容 → settings 面板", () => {
    expect(parseHash("#settings")).toEqual({ panelId: "settings" });
  });

  it("#about → 旧版兼容 → settings + about subId", () => {
    expect(parseHash("#about")).toEqual({ panelId: "settings", subId: "about" });
  });

  it("#search → 旧版兼容 → search 面板", () => {
    expect(parseHash("#search")).toEqual({ panelId: "search" });
  });

  // 旧版 "#/space/{spaceId}/..." 协议向后兼容：丢弃 space 维度
  it("#/space/workspace → 兼容 → 空路由", () => {
    expect(parseHash("#/space/workspace")).toEqual({});
  });

  it("#/space/workspace/view/timeline → 兼容 → timeline 视图", () => {
    expect(parseHash("#/space/workspace/view/timeline")).toEqual({ viewId: "timeline" });
  });

  it("#/space/workspace/view/tabs/panel/search → 兼容 → tabs + search", () => {
    expect(parseHash("#/space/workspace/view/tabs/panel/search")).toEqual({
      viewId: "tabs",
      panelId: "search",
    });
  });

  it("#/space/workspace/panel/settings/about → 兼容 → settings + about", () => {
    expect(parseHash("#/space/workspace/panel/settings/about")).toEqual({
      panelId: "settings",
      subId: "about",
    });
  });

  it("#/space/trending → 兼容 → 空路由（旧空间值被丢弃）", () => {
    expect(parseHash("#/space/trending")).toEqual({});
  });

  // 边界：无效 viewId
  it("#/view/invalid → 空路由（无效 viewId 忽略）", () => {
    expect(parseHash("#/view/invalid")).toEqual({});
  });

  // 边界：无效 panelId
  it("#/panel/invalid → 空路由（无效 panelId 忽略）", () => {
    expect(parseHash("#/panel/invalid")).toEqual({});
  });

  // 边界：面板 + view 的反向顺序
  it("#/panel/search/view/tabs → 按关键字解析，顺序无关", () => {
    const result = parseHash("#/panel/search/view/tabs");
    expect(result.panelId).toBe("search");
    expect(result.viewId).toBe("tabs");
  });
});

// ── serializeRoute ─────────────────────────────────────────────────────────────

describe("serializeRoute", () => {
  it("空路由", () => {
    expect(serializeRoute({})).toBe("#/");
  });

  it("仅 viewId", () => {
    expect(serializeRoute({ viewId: "timeline" })).toBe("#/view/timeline");
  });

  it("仅 panelId", () => {
    expect(serializeRoute({ panelId: "settings" })).toBe("#/panel/settings");
  });

  it("viewId + panelId", () => {
    expect(serializeRoute({ viewId: "tabs", panelId: "search" })).toBe(
      "#/view/tabs/panel/search",
    );
  });

  it("panelId + subId", () => {
    expect(serializeRoute({ panelId: "settings", subId: "about" })).toBe(
      "#/panel/settings/about",
    );
  });

  it("完整路径", () => {
    expect(
      serializeRoute({
        viewId: "timeline",
        panelId: "settings",
        subId: "appearance",
      }),
    ).toBe("#/view/timeline/panel/settings/appearance");
  });
});

// ── 往返测试（parse → serialize → parse 一致性） ──────────────────────────────

describe("round-trip: parse → serialize → parse", () => {
  const cases: RouteDescriptor[] = [
    {},
    { viewId: "timeline" },
    { panelId: "settings" },
    { viewId: "tabs", panelId: "search" },
    { panelId: "settings", subId: "about" },
    { viewId: "kanban", panelId: "search" },
  ];

  cases.forEach((route) => {
    it(`${JSON.stringify(route)} → 序列化 → 解析 → 一致`, () => {
      const hash = serializeRoute(route);
      const parsed = parseHash(hash);
      expect(parsed).toEqual(route);
    });
  });
});
