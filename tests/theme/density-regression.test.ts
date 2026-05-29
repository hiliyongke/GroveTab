import { describe, it, expect } from "vitest";
import { buildAntdThemeConfig, buildAppThemeVars } from "@/shared/theme/theme-customization";

type LayoutDensity = "compact" | "default" | "comfortable";

const DENSITY_SCALE_MAP: Record<LayoutDensity, number> = {
  compact: 0.85,
  default: 1,
  comfortable: 1.15,
};

function getDensityScale(density: LayoutDensity): number {
  return DENSITY_SCALE_MAP[density];
}

function scaleByDensity(value: number, density: LayoutDensity): number {
  return Math.round(value * DENSITY_SCALE_MAP[density]);
}

/** 从 '14px' 中提取数值 */
function extractPxValue(cssValue: string): number {
  const match = cssValue.match(/(\d+(?:\.\d+)?)px/);
  return match ? parseFloat(match[1]) : 0;
}

describe("密度回归测试 (9皮肤 × 3密度)", () => {
  const skins = [
    "minimal",
    "glassmorphism",
    "skeuomorphism",
    "aurora",
    "elegant",
    "nord",
    "solarized",
    "pastel",
    "apple",
  ] as const;

  const densities: LayoutDensity[] = ["compact", "default", "comfortable"];

  it.each(skins.flatMap((skin) => densities.map((density) => ({ skin, density }))))(
    "$skin + $density: antd token 生成无异常",
    ({ skin, density }) => {
      expect(() => {
        buildAntdThemeConfig(skin as any, false, density);
        buildAntdThemeConfig(skin as any, true, density);
      }).not.toThrow();
    },
  );

  it.each(skins.flatMap((skin) => densities.map((density) => ({ skin, density }))))(
    "$skin + $density: app vars 生成无异常",
    ({ skin, density }) => {
      expect(() => {
        buildAppThemeVars(skin as any, false, density, false);
        buildAppThemeVars(skin as any, true, density, false);
        buildAppThemeVars(skin as any, false, density, true);
        buildAppThemeVars(skin as any, true, density, true);
      }).not.toThrow();
    },
  );

  it("密度缩放比例正确", () => {
    expect(getDensityScale("compact")).toBe(0.85);
    expect(getDensityScale("default")).toBe(1);
    expect(getDensityScale("comfortable")).toBe(1.15);
  });

  it("scaleByDensity 计算正确", () => {
    expect(scaleByDensity(100, "compact")).toBe(85);
    expect(scaleByDensity(100, "default")).toBe(100);
    expect(scaleByDensity(100, "comfortable")).toBe(115);
  });

  it("compact 密度下 card-padding 小于 default", () => {
    const compactVars = buildAppThemeVars("minimal", false, "compact", false);
    const defaultVars = buildAppThemeVars("minimal", false, "default", false);

    expect(extractPxValue(compactVars["--app-card-padding"])).toBeLessThan(
      extractPxValue(defaultVars["--app-card-padding"]),
    );
  });

  it("comfortable 密度下 card-padding 大于 default", () => {
    const comfortableVars = buildAppThemeVars("minimal", false, "comfortable", false);
    const defaultVars = buildAppThemeVars("minimal", false, "default", false);

    expect(extractPxValue(comfortableVars["--app-card-padding"])).toBeGreaterThan(
      extractPxValue(defaultVars["--app-card-padding"]),
    );
  });

  it("space-4 token 使用 calc 实现运行时缩放", () => {
    const vars = buildAppThemeVars("minimal", false, "compact", false);
    // --app-space-4 应该是 calc(16px * 0.85)
    expect(vars["--app-space-4"]).toMatch(/calc\(.*\)/);
  });

  it("所有皮肤在暗色模式下 primary 颜色有值", () => {
    for (const skin of skins) {
      const theme = buildAntdThemeConfig(skin as any, true, "default");
      expect(theme.token?.colorPrimary).toBeTruthy();
    }
  });

  it("所有皮肤在亮色模式下 primary 颜色有值", () => {
    for (const skin of skins) {
      const theme = buildAntdThemeConfig(skin as any, false, "default");
      expect(theme.token?.colorPrimary).toBeTruthy();
    }
  });
});
