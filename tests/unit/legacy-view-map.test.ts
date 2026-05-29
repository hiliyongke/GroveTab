/**
 * LEGACY_VIEW_MAP 迁移测试
 */

import { describe, it, expect } from "vitest";
import { LEGACY_VIEW_MAP, VALID_VIEWS } from "@/shared/config/views";

describe("LEGACY_VIEW_MAP", () => {
  it("domain → tabs + masonry", () => {
    expect(LEGACY_VIEW_MAP["domain"]).toEqual({ view: "tabs", layout: "masonry" });
  });

  it("compact → tabs + compact", () => {
    expect(LEGACY_VIEW_MAP["compact"]).toEqual({ view: "tabs", layout: "compact" });
  });

  it("grid → tabs + grid", () => {
    expect(LEGACY_VIEW_MAP["grid"]).toEqual({ view: "tabs", layout: "grid" });
  });

  it("所有映射目标 viewId 都在 VALID_VIEWS 中", () => {
    Object.values(LEGACY_VIEW_MAP).forEach(({ view }) => {
      expect(VALID_VIEWS).toContain(view);
    });
  });

  it("所有映射目标 layout 都是合法值", () => {
    const validLayouts = ["masonry", "compact", "grid"];
    Object.values(LEGACY_VIEW_MAP).forEach(({ layout }) => {
      expect(validLayouts).toContain(layout);
    });
  });

  it("当前合法 viewMode 不在 LEGACY_VIEW_MAP 中（非遗留）", () => {
    VALID_VIEWS.forEach((view) => {
      expect(LEGACY_VIEW_MAP[view]).toBeUndefined();
    });
  });
});
