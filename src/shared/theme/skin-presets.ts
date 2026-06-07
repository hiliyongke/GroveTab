/**
 * 皮肤预设系统
 *
 * 每套皮肤是一个完整的设计 token 包，覆盖：
 *   - antd 全局 token（色彩、圆角、阴影、字体、动效等）
 *   - antd 组件级 token（Card / Button / Input / Modal 等）
 *   - 自定义 CSS 变量（毛玻璃参数、背景纹理、品牌渐变等）
 *
 * 设计原则：
 *   1. 每套皮肤必须同时适配 light / dark 两态
 *   2. 所有视觉参数从 token 派生，组件内禁止硬编码色值
 *   3. 皮肤之间可自由切换，无需刷新页面
 *   4. 皮肤 ID 与 UserSettings.skinPreset 联合类型一一对应
 */

import { translate } from '@/shared/i18n/core';

/** 皮肤 ID 联合类型 */
export type SkinPresetId = "minimal" | "glassmorphism" | "nord" | "apple";

/** 毛玻璃配置 */
interface GlassConfig {
  /** backdrop-filter blur 值（px） */
  blur: number;
  /** backdrop-filter saturate 值（%） */
  saturate: number;
  /** 浅色模式背景色（含透明度） */
  bgLight: string;
  /** 深色模式背景色（含透明度） */
  bgDark: string;
}

/** 阴影配置 */
interface ShadowConfig {
  /** 卡片默认阴影 */
  card: { light: string; dark: string };
  /** 卡片 hover 阴影 */
  cardHover: { light: string; dark: string };
  /** 浮动栏阴影 */
  floating: { light: string; dark: string };
  /** 品牌辉光阴影 */
  brandGlow: { light: string; dark: string };
}

/** 背景纹理配置 */
interface TextureConfig {
  /** 是否启用噪点纹理叠加 */
  noise: boolean;
  /** 噪点纹理透明度 */
  noiseOpacity: number;
  /** 是否启用网格线背景 */
  grid: boolean;
  /** 网格线颜色（浅色/深色） */
  gridColor: { light: string; dark: string };
}

/** 卡片风格配置 */
interface CardStyleConfig {
  /** 默认边框宽度 */
  borderWidth: number;
  /** hover 边框宽度 */
  hoverBorderWidth: number;
  /** 是否显示 hover 上浮效果 */
  hoverLift: boolean;
  /** 上浮距离（px） */
  liftDistance: number;
}

/** 单套皮肤完整配置 */
export interface SkinPreset {
  id: SkinPresetId;
  /** i18n key，如 skin.minimal → t('极简毛玻璃') */
  labelKey: string;
  /** 皮肤描述 i18n key */
  descriptionKey: string;
  /** 色卡预览色值（设置面板用） */
  previewColors: string[];
  /** 推荐模式：'both' 双模皆宜 / 'light' 浅色优先 / 'dark' 深色优先 */
  compatibleMode: "both" | "light" | "dark";

  /** ── 品牌色 ── */
  colorPrimary: string;
  /** 品牌色 hover 态 */
  colorPrimaryHover: string;

  /** ── 圆角体系 ── */
  borderRadius: number;
  borderRadiusLG: number;
  borderRadiusSM: number;
  borderRadiusXS: number;

  /** ── 控件高度 ── */
  controlHeight: number;
  controlHeightLG: number;
  controlHeightSM: number;

  /** ── 字体 ── */

  /**
   * 正文字体栈。
   *
   * 各皮肤的字体选择：
   *   - apple: "SF Pro Display" → macOS/iOS 原生；回落到 -apple-system → Segoe UI(Win) → Roboto(Android/Linux)
   *   - glassmorphism: "Segoe UI Variable" → Windows 11+；回落到 "Segoe UI"(Win10-) → 系统默认
   *   - nord: "Inter" → Web 字体渲染；回落到 -apple-system → system-ui
   *   - minimal: 通用系统字体栈，无平台依赖
   */
  fontFamily: string;
  /** 标题字体（拟物/典雅皮肤可切换衬线体） */
  fontFamilyHeading: string;
  fontSize: number;

  /** ── 间距 ── */
  padding: number;
  paddingLG: number;
  paddingSM: number;

  /** ── 动效 ── */
  motionDurationSlow: string;
  motionDurationMid: string;
  motionDurationFast: string;
  motionEaseInOut: string;
  motionEaseOut: string;

  /** ── 浅色模式背景色 ── */
  colorBgLayoutLight: string;
  colorBgContainerLight: string;
  colorBgElevatedLight: string;
  colorBorderSecondaryLight: string;

  /** ── 深色模式背景色 ── */
  colorBgLayoutDark: string;
  colorBgContainerDark: string;
  colorBgElevatedDark: string;
  colorBorderSecondaryDark: string;

  /** ── 毛玻璃 ── */
  glass: GlassConfig;

  /** ── 阴影 ── */
  shadow: ShadowConfig;

  /** ── 纹理 ── */
  texture: TextureConfig;

  /** ── 卡片风格 ── */
  cardStyle: CardStyleConfig;

  /** ── 搜索框配置 ── */
  searchBox: {
    height: number;
    borderRadius: number;
    fontSize: number;
  };

  /** ── Header 配置 ── */
  header: {
    height: number;
  };

  /** ── 品牌 Logo 渐变 ── */
  logoGradient: string;
  logoGlowShadow: { light: string; dark: string };

  /** ── 浮动操作栏配置 ── */
  floatingBar: {
    borderRadius: number;
  };
}

/**
 * 全部皮肤预设
 */
export const SKIN_PRESETS: SkinPreset[] = [
  // ═══════════════════════════════════════════════════
  // 1. Minimal — 极简毛玻璃
  // ═══════════════════════════════════════════════════
  {
    id: "minimal",
    labelKey: translate("极简"),
    descriptionKey: translate("极简干净的设计，最大化空间利用"),
    previewColors: ["#2B6BFF", "#EAF1FF", "#8DB2FF"],
    compatibleMode: "both",

    colorPrimary: "#2B6BFF",
    colorPrimaryHover: "#5A8CFF",

    borderRadius: 12,
    borderRadiusLG: 16,
    borderRadiusSM: 9,
    borderRadiusXS: 7,

    controlHeight: 38,
    controlHeightLG: 46,
    controlHeightSM: 30,

    fontFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans SC", sans-serif',
    fontFamilyHeading:
      '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans SC", sans-serif',
    fontSize: 14,

    padding: 22,
    paddingLG: 28,
    paddingSM: 14,

    motionDurationSlow: "0.32s",
    motionDurationMid: "0.22s",
    motionDurationFast: "0.14s",
    motionEaseInOut: "cubic-bezier(0.4, 0, 0.2, 1)",
    motionEaseOut: "cubic-bezier(0, 0, 0.2, 1)",

    colorBgLayoutLight: "#F2F3F5",
    colorBgContainerLight: "#FAFAFB",
    colorBgElevatedLight: "#FFFFFF",
    colorBorderSecondaryLight: "#E5E6EB",

    colorBgLayoutDark: "#0F1726",
    colorBgContainerDark: "#162033",
    colorBgElevatedDark: "#1B2840",
    colorBorderSecondaryDark: "rgba(173, 194, 227, 0.14)",

    glass: {
      blur: 28,
      saturate: 140,
      bgLight: "rgba(250, 250, 251, 0.88)",
      bgDark: "rgba(13, 22, 36, 0.86)",
    },

    shadow: {
      card: {
        light: "0 1px 2px rgba(19, 37, 63, 0.05), 0 10px 28px rgba(29, 64, 128, 0.08)",
        dark: "0 8px 24px rgba(5, 10, 20, 0.36), 0 1px 2px rgba(5, 10, 20, 0.34)",
      },
      cardHover: {
        light: "0 10px 26px rgba(43, 107, 255, 0.12), 0 12px 32px rgba(21, 44, 87, 0.08)",
        dark: "0 12px 30px rgba(4, 10, 24, 0.44), 0 0 0 1px rgba(113, 157, 255, 0.08)",
      },
      floating: {
        light: "0 12px 32px rgba(43, 107, 255, 0.12), 0 2px 10px rgba(23, 44, 88, 0.08)",
        dark: "0 14px 34px rgba(3, 9, 20, 0.46), 0 2px 8px rgba(3, 9, 20, 0.34)",
      },
      brandGlow: {
        light: "0 8px 22px rgba(43, 107, 255, 0.18), 0 0 0 1px rgba(43, 107, 255, 0.08)",
        dark: "0 10px 24px rgba(16, 46, 104, 0.24), 0 0 0 1px rgba(122, 165, 255, 0.1)",
      },
    },

    texture: {
      noise: false,
      noiseOpacity: 0,
      grid: false,
      gridColor: { light: "rgba(0,0,0,0.03)", dark: "rgba(255,255,255,0.03)" },
    },

    cardStyle: {
      borderWidth: 1,
      hoverBorderWidth: 1,
      hoverLift: true,
      liftDistance: 2,
    },

    searchBox: {
      height: 54,
      borderRadius: 20,
      fontSize: 15,
    },

    header: {
      height: 58,
    },

    logoGradient: "linear-gradient(135deg, #2B6BFF, #7EA8FF)",
    logoGlowShadow: {
      light: "0 8px 18px rgba(43,107,255,0.22)",
      dark: "0 8px 18px rgba(43,107,255,0.18)",
    },

    floatingBar: {
      borderRadius: 20,
    },
  },

  // ═══════════════════════════════════════════════════
  // 2. Glassmorphism — 微软 Fluent Acrylic（液态玻璃）
  //
  // 设计参考：
  //   Microsoft Fluent Design System —— Acrylic Material
  //   核心特征：
  //     · 多层半透明叠加（底色 tint → 模糊层 → 噪点层 → 辉光层）
  //     · 高模糊度（40-60px）+ 高饱和度（180-200%）让底层色彩"溢出"
  //     · 显性噪点纹理（0.04-0.06，Fluent Acrylic 的标志）
  //     · 柔和的 inset 顶部高光线（模拟光线折射）
  //     · 微软 Fluent Blue (#0078D4) 品牌色
  //   暗色模式参考 Mica Alt（更深、更沉浸的半透明）
  // ═══════════════════════════════════════════════════
  {
    id: "glassmorphism",
    labelKey: translate("毛玻璃"),
    descriptionKey: translate("半透明毛玻璃效果，现代质感"),
    previewColors: ["#0078D4", "rgba(255,255,255,0.45)", "#2B88D8"],
    compatibleMode: "both",

    colorPrimary: "#0078D4",
    colorPrimaryHover: "#2B88D8",

    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 6,
    borderRadiusXS: 4,

    controlHeight: 36,
    controlHeightLG: 44,
    controlHeightSM: 28,

    fontFamily:
      '"Segoe UI Variable", "Segoe UI", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Roboto, Arial, "Noto Sans SC", "Microsoft YaHei", sans-serif',
    fontFamilyHeading:
      '"Segoe UI Variable Display", "Segoe UI", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Roboto, Arial, "Noto Sans SC", "Microsoft YaHei", sans-serif',
    fontSize: 14,

    padding: 20,
    paddingLG: 24,
    paddingSM: 12,

    motionDurationSlow: "0.367s",
    motionDurationMid: "0.25s",
    motionDurationFast: "0.15s",
    motionEaseInOut: "cubic-bezier(0.16, 1, 0.3, 1)",
    motionEaseOut: "cubic-bezier(0.0, 0.0, 0.2, 1)",

    colorBgLayoutLight: "#F3F3F3",
    colorBgContainerLight: "#FDFDFD",
    colorBgElevatedLight: "#FFFFFF",
    colorBorderSecondaryLight: "rgba(0, 0, 0, 0.08)",

    colorBgLayoutDark: "#202020",
    colorBgContainerDark: "#2B2B2B",
    colorBgElevatedDark: "#303030",
    colorBorderSecondaryDark: "rgba(255, 255, 255, 0.10)",

    glass: {
      blur: 32,
      saturate: 180,
      bgLight: "rgba(253, 253, 253, 0.86)",
      bgDark: "rgba(43, 43, 43, 0.88)",
    },

    shadow: {
      card: {
        light:
          "0 1px 2px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.045), inset 0 1px 0 rgba(255,255,255,0.76)",
        dark: "0 1px 2px rgba(0,0,0,0.42), 0 8px 28px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.07)",
      },
      cardHover: {
        light:
          "0 2px 4px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.86)",
        dark: "0 2px 4px rgba(0,0,0,0.48), 0 12px 36px rgba(0,0,0,0.36), inset 0 1px 0 rgba(255,255,255,0.09)",
      },
      floating: {
        light:
          "0 8px 20px rgba(0,0,0,0.08), 0 24px 64px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.72)",
        dark: "0 8px 24px rgba(0,0,0,0.48), 0 28px 72px rgba(0,0,0,0.44), inset 0 1px 0 rgba(255,255,255,0.08)",
      },
      brandGlow: {
        light: "0 0 0 1px rgba(0,120,212,0.16), 0 8px 24px rgba(0,120,212,0.14)",
        dark: "0 0 0 1px rgba(96,205,255,0.18), 0 8px 28px rgba(96,205,255,0.12)",
      },
    },

    texture: {
      noise: true,
      noiseOpacity: 0.045,
      grid: false,
      gridColor: { light: "rgba(0,0,0,0.018)", dark: "rgba(255,255,255,0.018)" },
    },

    cardStyle: {
      borderWidth: 1,
      hoverBorderWidth: 1,
      hoverLift: true,
      liftDistance: 2,
    },

    searchBox: {
      height: 44,
      borderRadius: 8,
      fontSize: 15,
    },

    header: {
      height: 48,
    },

    logoGradient: "linear-gradient(135deg, #0078D4, #2B88D8)",
    logoGlowShadow: {
      light: "0 2px 10px rgba(0,120,212,0.18)",
      dark: "0 2px 10px rgba(0,120,212,0.14)",
    },

    floatingBar: {
      borderRadius: 8,
    },
  },

  // ═══════════════════════════════════════════════════
  // 3. Nord — 北欧寒色调（冷静蓝青，兼顾深浅）
  // ═══════════════════════════════════════════════════
  {
    id: "nord",
    labelKey: "Nord",
    descriptionKey: translate("Nord 暗色主题，护眼柔和的极地配色"),
    previewColors: ["#5E81AC", "#ECEFF4", "#88C0D0"],
    compatibleMode: "both",

    colorPrimary: "#5E81AC",
    colorPrimaryHover: "#81A1C1",

    borderRadius: 6,
    borderRadiusLG: 10,
    borderRadiusSM: 4,
    borderRadiusXS: 2,

    controlHeight: 32,
    controlHeightLG: 40,
    controlHeightSM: 24,

    fontFamily:
      '-apple-system, "Inter", "SF Pro Text", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
    fontFamilyHeading: "inherit",
    fontSize: 14,
    padding: 16,
    paddingLG: 20,
    paddingSM: 12,

    motionDurationSlow: "0.3s",
    motionDurationMid: "0.18s",
    motionDurationFast: "0.1s",
    motionEaseInOut: "cubic-bezier(0.4, 0, 0.2, 1)",
    motionEaseOut: "cubic-bezier(0, 0, 0.2, 1)",

    colorBgLayoutLight: "#ECEFF4",
    colorBgContainerLight: "#E5E9F0",
    colorBgElevatedLight: "#FFFFFF",
    colorBorderSecondaryLight: "#D8DEE9",

    colorBgLayoutDark: "#2E3440",
    colorBgContainerDark: "#3B4252",
    colorBgElevatedDark: "#434C5E",
    colorBorderSecondaryDark: "rgba(136,192,208,0.12)",

    glass: {
      blur: 16,
      saturate: 140,
      bgLight: "rgba(236,239,244,0.9)",
      bgDark: "rgba(46,52,64,0.88)",
    },

    shadow: {
      card: {
        light: "0 1px 2px rgba(46,52,64,0.04), 0 4px 12px rgba(46,52,64,0.04)",
        dark: "0 1px 2px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.2)",
      },
      cardHover: {
        light: "0 2px 6px rgba(94,129,172,0.08), 0 8px 24px rgba(46,52,64,0.06)",
        dark: "0 2px 6px rgba(0,0,0,0.35), 0 8px 24px rgba(94,129,172,0.12)",
      },
      floating: {
        light: "0 2px 8px rgba(94,129,172,0.1), 0 8px 32px rgba(46,52,64,0.06)",
        dark: "0 2px 8px rgba(0,0,0,0.4), 0 8px 32px rgba(94,129,172,0.1)",
      },
      brandGlow: {
        light: "0 2px 12px rgba(94,129,172,0.1), 0 0 0 1px rgba(94,129,172,0.1)",
        dark: "0 2px 12px rgba(136,192,208,0.12), 0 0 0 1px rgba(136,192,208,0.08)",
      },
    },

    texture: {
      noise: false,
      noiseOpacity: 0,
      grid: false,
      gridColor: { light: "rgba(94,129,172,0.03)", dark: "rgba(136,192,208,0.03)" },
    },
    cardStyle: { borderWidth: 1, hoverBorderWidth: 1, hoverLift: true, liftDistance: 1 },
    searchBox: { height: 46, borderRadius: 8, fontSize: 14 },
    header: { height: 52 },

    logoGradient: "linear-gradient(135deg, #5E81AC, #88C0D0)",
    logoGlowShadow: {
      light: "0 2px 8px rgba(94,129,172,0.22)",
      dark: "0 2px 8px rgba(136,192,208,0.26)",
    },

    floatingBar: { borderRadius: 10 },
  },

  // ═══════════════════════════════════════════════════
  // 4. Apple — Apple 官网设计语言（SF Pro、双色节奏、Apple Blue 强调）
  // ═══════════════════════════════════════════════════
  {
    id: "apple",
    labelKey: "Apple",
    descriptionKey: translate("Apple 风格浅色主题，优雅简洁"),
    previewColors: ["#0071e3", "#f5f5f7", "#1d1d1f"],
    compatibleMode: "both",

    colorPrimary: "#0071e3",
    colorPrimaryHover: "#2997ff",

    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 5,
    borderRadiusXS: 4,

    controlHeight: 36,
    controlHeightLG: 44,
    controlHeightSM: 28,

    fontFamily:
      '"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Segoe UI", Roboto, Arial, "Noto Sans SC", "PingFang SC", sans-serif',
    fontFamilyHeading:
      '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Segoe UI", Roboto, Arial, "Noto Sans SC", "PingFang SC", sans-serif',
    fontSize: 14,

    padding: 20,
    paddingLG: 24,
    paddingSM: 12,

    motionDurationSlow: "0.35s",
    motionDurationMid: "0.22s",
    motionDurationFast: "0.12s",
    motionEaseInOut: "cubic-bezier(0.25, 0.1, 0.25, 1)",
    motionEaseOut: "cubic-bezier(0, 0, 0.2, 1)",

    colorBgLayoutLight: "#f5f5f7",
    colorBgContainerLight: "#ffffff",
    colorBgElevatedLight: "#fafafc",
    colorBorderSecondaryLight: "rgba(0, 0, 0, 0.04)",

    colorBgLayoutDark: "#000000",
    colorBgContainerDark: "#1c1c1e",
    colorBgElevatedDark: "#2c2c2e",
    colorBorderSecondaryDark: "rgba(255, 255, 255, 0.08)",

    glass: {
      blur: 20,
      saturate: 180,
      bgLight: "rgba(251, 251, 253, 0.82)",
      bgDark: "rgba(0, 0, 0, 0.8)",
    },

    shadow: {
      card: {
        light: "rgba(0, 0, 0, 0.22) 3px 5px 30px 0px",
        dark: "rgba(0, 0, 0, 0.44) 3px 5px 30px 0px",
      },
      cardHover: {
        light: "rgba(0, 0, 0, 0.22) 5px 8px 36px 0px",
        dark: "rgba(0, 0, 0, 0.52) 5px 8px 36px 0px",
      },
      floating: {
        light: "rgba(0, 0, 0, 0.22) 3px 5px 30px 0px",
        dark: "rgba(0, 0, 0, 0.44) 3px 5px 30px 0px",
      },
      brandGlow: {
        light: "0 0 0 2px #0071e3",
        dark: "0 0 0 2px #0071e3",
      },
    },

    texture: {
      noise: false,
      noiseOpacity: 0,
      grid: false,
      gridColor: { light: "rgba(0,0,0,0.02)", dark: "rgba(255,255,255,0.02)" },
    },

    cardStyle: {
      borderWidth: 0,
      hoverBorderWidth: 0,
      hoverLift: false,
      liftDistance: 0,
    },

    searchBox: {
      height: 44,
      borderRadius: 11,
      fontSize: 15,
    },

    header: {
      height: 48,
    },

    logoGradient: "linear-gradient(135deg, #0071e3, #2997ff)",
    logoGlowShadow: {
      light: "0 0 0 2px #0071e3",
      dark: "0 0 0 2px #0071e3",
    },

    floatingBar: {
      borderRadius: 11,
    },
  },
];

/** 默认皮肤 ID，与 storage-repo / settings-slice 中的默认值保持同步 */
export const DEFAULT_SKIN_PRESET_ID = "glassmorphism" as const satisfies SkinPresetId;

/**
 * 根据 ID 查找皮肤预设
 */
export function getSkinPreset(id: SkinPresetId): SkinPreset {
  const preset = SKIN_PRESETS.find((p) => p.id === id);
  if (!preset) return SKIN_PRESETS.find((p) => p.id === DEFAULT_SKIN_PRESET_ID) ?? SKIN_PRESETS[0]!;
  return preset;
}
