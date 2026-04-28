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

/** 皮肤 ID 联合类型 */
export type SkinPresetId =
  | 'minimal'
  | 'glassmorphism'
  | 'skeuomorphism'
  | 'aurora'
  | 'elegant'
  | 'nord'
  | 'solarized';

/** 毛玻璃配置 */
export interface GlassConfig {
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
export interface ShadowConfig {
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
export interface TextureConfig {
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
export interface CardStyleConfig {
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
  /** i18n key，如 skin.minimal → t('skin.minimal') */
  labelKey: string;
  /** 皮肤描述 i18n key */
  descriptionKey: string;
  /** 色卡预览色值（设置面板用） */
  previewColors: string[];
  /** 推荐模式：'both' 双模皆宜 / 'light' 浅色优先 / 'dark' 深色优先 */
  compatibleMode: 'both' | 'light' | 'dark';

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
    id: 'minimal',
    labelKey: 'skin.minimal',
    descriptionKey: 'skin.minimalDesc',
    previewColors: ['#1677ff', '#f5f5f5', '#4096ff'],
    compatibleMode: 'both',

    colorPrimary: '#1677ff',
    colorPrimaryHover: '#4096ff',

    borderRadius: 10,
    borderRadiusLG: 12,
    borderRadiusSM: 8,
    borderRadiusXS: 6,

    controlHeight: 36,
    controlHeightLG: 44,
    controlHeightSM: 28,

    fontFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans SC", sans-serif',
    fontFamilyHeading:
      '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans SC", sans-serif',
    fontSize: 14,

    padding: 20,
    paddingLG: 24,
    paddingSM: 12,

    motionDurationSlow: '0.3s',
    motionDurationMid: '0.2s',
    motionDurationFast: '0.12s',
    motionEaseInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    motionEaseOut: 'cubic-bezier(0, 0, 0.2, 1)',

    colorBgLayoutLight: '#f5f5f5',
    colorBgContainerLight: '#ffffff',
    colorBgElevatedLight: '#ffffff',
    colorBorderSecondaryLight: '#f0f0f0',

    colorBgLayoutDark: '#141414',
    colorBgContainerDark: '#1f1f1f',
    colorBgElevatedDark: '#262626',
    colorBorderSecondaryDark: 'rgba(255,255,255,0.06)',

    glass: {
      blur: 20,
      saturate: 140,
      bgLight: 'rgba(255, 255, 255, 0.72)',
      bgDark: 'rgba(20, 20, 20, 0.78)',
    },

    shadow: {
      card: {
        light: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)',
        dark: '0 1px 2px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.2)',
      },
      cardHover: {
        light: '0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08)',
        dark: '0 2px 8px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.28)',
      },
      floating: {
        light: '0 2px 8px rgba(22,119,255,0.06), 0 8px 32px rgba(0,0,0,0.08)',
        dark: '0 2px 8px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.3)',
      },
      brandGlow: {
        light: '0 2px 12px rgba(22,119,255,0.04), 0 0 0 1px rgba(0,0,0,0.03)',
        dark: '0 2px 12px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04)',
      },
    },

    texture: {
      noise: false,
      noiseOpacity: 0,
      grid: false,
      gridColor: { light: 'rgba(0,0,0,0.03)', dark: 'rgba(255,255,255,0.03)' },
    },

    cardStyle: {
      borderWidth: 1,
      hoverBorderWidth: 1,
      hoverLift: true,
      liftDistance: 1,
    },

    searchBox: {
      height: 52,
      borderRadius: 16,
      fontSize: 15,
    },

    header: {
      height: 56,
    },

    logoGradient: 'linear-gradient(135deg, #1677ff, #4096ff)',
    logoGlowShadow: {
      light: '0 2px 8px rgba(22,119,255,0.15)',
      dark: '0 2px 8px rgba(22,119,255,0.12)',
    },

    floatingBar: {
      borderRadius: 16,
    },
  },

  // ═══════════════════════════════════════════════════
  // 2. Glassmorphism — 液态玻璃风（WWDC 2025 / visionOS 风格）
  // ═══════════════════════════════════════════════════
  {
    id: 'glassmorphism',
    labelKey: 'skin.glassmorphism',
    descriptionKey: 'skin.glassmorphismDesc',
    previewColors: ['#5BA4E6', 'rgba(255,255,255,0.4)', '#7BB8F0'],
    compatibleMode: 'both',

    colorPrimary: '#5BA4E6',
    colorPrimaryHover: '#7BB8F0',

    borderRadius: 16,
    borderRadiusLG: 20,
    borderRadiusSM: 12,
    borderRadiusXS: 8,

    controlHeight: 38,
    controlHeightLG: 46,
    controlHeightSM: 30,

    fontFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Rounded", "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans SC", sans-serif',
    fontFamilyHeading:
      '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Rounded", "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans SC", sans-serif',
    fontSize: 14,

    padding: 22,
    paddingLG: 28,
    paddingSM: 14,

    motionDurationSlow: '0.4s',
    motionDurationMid: '0.25s',
    motionDurationFast: '0.15s',
    motionEaseInOut: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    motionEaseOut: 'cubic-bezier(0.0, 0.0, 0.2, 1)',

    colorBgLayoutLight: '#f0f0f5',
    colorBgContainerLight: 'rgba(255, 255, 255, 0.55)',
    colorBgElevatedLight: 'rgba(255, 255, 255, 0.7)',
    colorBorderSecondaryLight: 'rgba(0, 0, 0, 0.08)',

    colorBgLayoutDark: '#0d0d12',
    colorBgContainerDark: 'rgba(40, 40, 50, 0.5)',
    colorBgElevatedDark: 'rgba(55, 55, 68, 0.6)',
    colorBorderSecondaryDark: 'rgba(255, 255, 255, 0.1)',

    glass: {
      blur: 40,
      saturate: 200,
      bgLight: 'rgba(255, 255, 255, 0.5)',
      bgDark: 'rgba(30, 30, 40, 0.5)',
    },

    shadow: {
      card: {
        light: '0 2px 8px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.5)',
        dark: '0 2px 8px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)',
      },
      cardHover: {
        light: '0 4px 16px rgba(0,0,0,0.06), 0 16px 48px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)',
        dark: '0 4px 16px rgba(0,0,0,0.4), 0 16px 48px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.12)',
      },
      floating: {
        light: '0 4px 16px rgba(91,164,230,0.08), 0 16px 48px rgba(0,0,0,0.08)',
        dark: '0 4px 16px rgba(91,164,230,0.1), 0 16px 48px rgba(0,0,0,0.4)',
      },
      brandGlow: {
        light: '0 4px 24px rgba(91,164,230,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
        dark: '0 4px 24px rgba(91,164,230,0.1), 0 0 0 1px rgba(255,255,255,0.06)',
      },
    },

    texture: {
      noise: true,
      noiseOpacity: 0.03,
      grid: false,
      gridColor: { light: 'rgba(0,0,0,0.02)', dark: 'rgba(255,255,255,0.02)' },
    },

    cardStyle: {
      borderWidth: 1,
      hoverBorderWidth: 1,
      hoverLift: true,
      liftDistance: 2,
    },

    searchBox: {
      height: 56,
      borderRadius: 20,
      fontSize: 16,
    },

    header: {
      height: 58,
    },

    logoGradient: 'linear-gradient(135deg, #5BA4E6, #7BB8F0)',
    logoGlowShadow: {
      light: '0 2px 12px rgba(91,164,230,0.2)',
      dark: '0 2px 12px rgba(91,164,230,0.18)',
    },

    floatingBar: {
      borderRadius: 20,
    },
  },

  // ═══════════════════════════════════════════════════
  // 3. Skeuomorphism — 拟物风（锤子 UI / iOS 6 风格）
  // ═══════════════════════════════════════════════════
  {
    id: 'skeuomorphism',
    labelKey: 'skin.skeuomorphism',
    descriptionKey: 'skin.skeuomorphismDesc',
    previewColors: ['#B8956A', '#f5f0e8', '#C9A87C'],
    compatibleMode: 'light',

    colorPrimary: '#B8956A',
    colorPrimaryHover: '#C9A87C',

    borderRadius: 8,
    borderRadiusLG: 10,
    borderRadiusSM: 6,
    borderRadiusXS: 4,

    controlHeight: 36,
    controlHeightLG: 44,
    controlHeightSM: 28,

    fontFamily:
      '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "WenQuanYi Micro Hei", "Noto Sans SC", sans-serif',
    fontFamilyHeading:
      '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "WenQuanYi Micro Hei", "Noto Sans SC", sans-serif',
    fontSize: 14,

    padding: 20,
    paddingLG: 24,
    paddingSM: 12,

    motionDurationSlow: '0.3s',
    motionDurationMid: '0.2s',
    motionDurationFast: '0.1s',
    motionEaseInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    motionEaseOut: 'cubic-bezier(0, 0, 0.2, 1)',

    colorBgLayoutLight: '#e8e0d0',
    colorBgContainerLight: '#f5f0e8',
    colorBgElevatedLight: '#faf6ef',
    colorBorderSecondaryLight: '#d4c9b4',

    colorBgLayoutDark: '#1a1610',
    colorBgContainerDark: '#2a241c',
    colorBgElevatedDark: '#352e24',
    colorBorderSecondaryDark: 'rgba(196,163,90,0.15)',

    glass: {
      blur: 0,
      saturate: 100,
      bgLight: '#f5f0e8',
      bgDark: '#2a241c',
    },

    shadow: {
      card: {
        light: '0 1px 3px rgba(184,149,106,0.08), 0 3px 10px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)',
        dark: '0 1px 3px rgba(0,0,0,0.5), 0 3px 10px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
      },
      cardHover: {
        light: '0 2px 6px rgba(184,149,106,0.1), 0 6px 20px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.7)',
        dark: '0 2px 6px rgba(0,0,0,0.6), 0 6px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
      },
      floating: {
        light: '0 3px 10px rgba(184,149,106,0.1), 0 10px 40px rgba(0,0,0,0.1)',
        dark: '0 3px 10px rgba(0,0,0,0.6), 0 10px 40px rgba(0,0,0,0.5)',
      },
      brandGlow: {
        light: '0 2px 12px rgba(184,149,106,0.06), 0 0 0 1px rgba(196,163,90,0.2)',
        dark: '0 2px 12px rgba(196,163,90,0.1), 0 0 0 1px rgba(196,163,90,0.15)',
      },
    },

    texture: {
      noise: true,
      noiseOpacity: 0.04,
      grid: false,
      gridColor: { light: 'rgba(184,149,106,0.03)', dark: 'rgba(196,163,90,0.03)' },
    },

    cardStyle: {
      borderWidth: 1,
      hoverBorderWidth: 1,
      hoverLift: true,
      liftDistance: 1,
    },

    searchBox: {
      height: 48,
      borderRadius: 8,
      fontSize: 14,
    },

    header: {
      height: 52,
    },

    logoGradient: 'linear-gradient(135deg, #B8956A, #C9A87C)',
    logoGlowShadow: {
      light: '0 2px 8px rgba(184,149,106,0.18)',
      dark: '0 2px 8px rgba(184,149,106,0.15)',
    },

    floatingBar: {
      borderRadius: 10,
    },
  },

  // ═══════════════════════════════════════════════════
  // 4. Aurora — 极光流彩（暗色系霓虹风格）
  // ═══════════════════════════════════════════════════
  {
    id: 'aurora',
    labelKey: 'skin.aurora',
    descriptionKey: 'skin.auroraDesc',
    previewColors: ['#9B8EC4', '#0f0f1a', '#7ABFB8'],
    compatibleMode: 'dark',

    colorPrimary: '#9B8EC4',
    colorPrimaryHover: '#B3A8D4',

    borderRadius: 14,
    borderRadiusLG: 18,
    borderRadiusSM: 10,
    borderRadiusXS: 6,

    controlHeight: 38,
    controlHeightLG: 46,
    controlHeightSM: 30,

    fontFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans SC", sans-serif',
    fontFamilyHeading:
      '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans SC", sans-serif',
    fontSize: 14,

    padding: 22,
    paddingLG: 26,
    paddingSM: 14,

    motionDurationSlow: '0.4s',
    motionDurationMid: '0.25s',
    motionDurationFast: '0.15s',
    motionEaseInOut: 'cubic-bezier(0.22, 1, 0.36, 1)',
    motionEaseOut: 'cubic-bezier(0, 0, 0.2, 1)',

    colorBgLayoutLight: '#f3f0ff',
    colorBgContainerLight: '#ffffff',
    colorBgElevatedLight: '#ffffff',
    colorBorderSecondaryLight: '#e5e0f0',

    colorBgLayoutDark: '#0a0a14',
    colorBgContainerDark: '#12121e',
    colorBgElevatedDark: '#1a1a2e',
    colorBorderSecondaryDark: 'rgba(155, 142, 196, 0.1)',

    glass: {
      blur: 24,
      saturate: 200,
      bgLight: 'rgba(255, 255, 255, 0.75)',
      bgDark: 'rgba(18, 18, 28, 0.7)',
    },

    shadow: {
      card: {
        light: '0 1px 3px rgba(155,142,196,0.05), 0 4px 16px rgba(0,0,0,0.05)',
        dark: '0 0 1px rgba(155,142,196,0.12), 0 2px 8px rgba(0,0,0,0.4), 0 4px 20px rgba(155,142,196,0.05)',
      },
      cardHover: {
        light: '0 2px 8px rgba(155,142,196,0.07), 0 8px 28px rgba(0,0,0,0.08)',
        dark: '0 0 1px rgba(155,142,196,0.16), 0 4px 16px rgba(0,0,0,0.5), 0 8px 32px rgba(155,142,196,0.1)',
      },
      floating: {
        light: '0 4px 16px rgba(155,142,196,0.08), 0 8px 32px rgba(0,0,0,0.06)',
        dark: '0 0 1px rgba(168,85,247,0.4), 0 4px 20px rgba(0,0,0,0.5), 0 12px 40px rgba(155,142,196,0.08)',
      },
      brandGlow: {
        light: '0 4px 20px rgba(155,142,196,0.08), 0 0 0 1px rgba(155,142,196,0.05)',
        dark: '0 0 20px rgba(155,142,196,0.12), 0 0 40px rgba(122,191,184,0.06)',
      },
    },

    texture: {
      noise: false,
      noiseOpacity: 0,
      grid: false,
      gridColor: { light: 'rgba(155,142,196,0.02)', dark: 'rgba(155,142,196,0.02)' },
    },

    cardStyle: {
      borderWidth: 1,
      hoverBorderWidth: 1,
      hoverLift: true,
      liftDistance: 2,
    },

    searchBox: {
      height: 54,
      borderRadius: 18,
      fontSize: 15,
    },

    header: {
      height: 56,
    },

    logoGradient: 'linear-gradient(135deg, #9B8EC4, #7ABFB8)',
    logoGlowShadow: {
      light: '0 2px 12px rgba(155,142,196,0.18)',
      dark: '0 2px 16px rgba(155,142,196,0.15), 0 0 30px rgba(122,191,184,0.08)',
    },

    floatingBar: {
      borderRadius: 18,
    },
  },

  // ═══════════════════════════════════════════════════
  // 5. Elegant — 典雅新古典（衬线标题 + 金色描边 + 纸张质感）
  // ═══════════════════════════════════════════════════
  {
    id: 'elegant',
    labelKey: 'skin.elegant',
    descriptionKey: 'skin.elegantDesc',
    previewColors: ['#8B7D6B', '#faf8f4', '#B8A898'],
    compatibleMode: 'both',

    colorPrimary: '#8B7D6B',
    colorPrimaryHover: '#A09080',

    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,
    borderRadiusXS: 2,

    controlHeight: 36,
    controlHeightLG: 42,
    controlHeightSM: 28,

    fontFamily:
      '"Georgia", "Noto Serif SC", "Source Han Serif SC", "STSong", "SimSun", serif',
    fontFamilyHeading:
      '"Georgia", "Noto Serif SC", "Source Han Serif SC", "STSong", "SimSun", serif',
    fontSize: 14,

    padding: 24,
    paddingLG: 28,
    paddingSM: 16,

    motionDurationSlow: '0.35s',
    motionDurationMid: '0.22s',
    motionDurationFast: '0.12s',
    motionEaseInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    motionEaseOut: 'cubic-bezier(0, 0, 0.2, 1)',

    colorBgLayoutLight: '#f0ebe3',
    colorBgContainerLight: '#faf8f4',
    colorBgElevatedLight: '#ffffff',
    colorBorderSecondaryLight: '#d4cfc6',

    colorBgLayoutDark: '#141412',
    colorBgContainerDark: '#1c1b18',
    colorBgElevatedDark: '#242320',
    colorBorderSecondaryDark: 'rgba(139,125,107,0.08)',

    glass: {
      blur: 12,
      saturate: 120,
      bgLight: 'rgba(250, 248, 244, 0.9)',
      bgDark: 'rgba(22, 22, 42, 0.85)',
    },

    shadow: {
      card: {
        light: '0 1px 2px rgba(139,125,107,0.04), 0 4px 12px rgba(139,125,107,0.03)',
        dark: '0 1px 2px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.25)',
      },
      cardHover: {
        light: '0 2px 6px rgba(139,125,107,0.06), 0 8px 24px rgba(139,125,107,0.05)',
        dark: '0 2px 6px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.35)',
      },
      floating: {
        light: '0 2px 8px rgba(139,125,107,0.06), 0 8px 32px rgba(139,125,107,0.05)',
        dark: '0 2px 8px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.4)',
      },
      brandGlow: {
        light: '0 2px 12px rgba(139,125,107,0.05), 0 0 0 1px rgba(139,125,107,0.1)',
        dark: '0 2px 12px rgba(139,125,107,0.06), 0 0 0 1px rgba(139,125,107,0.08)',
      },
    },

    texture: {
      noise: true,
      noiseOpacity: 0.025,
      grid: false,
      gridColor: { light: 'rgba(139,125,107,0.02)', dark: 'rgba(139,125,107,0.02)' },
    },

    cardStyle: {
      borderWidth: 1,
      hoverBorderWidth: 1,
      hoverLift: false,
      liftDistance: 0,
    },

    searchBox: {
      height: 48,
      borderRadius: 6,
      fontSize: 14,
    },

    header: {
      height: 54,
    },

    logoGradient: 'linear-gradient(135deg, #8B7D6B, #B8A898)',
    logoGlowShadow: {
      light: '0 2px 8px rgba(139,125,107,0.15)',
      dark: '0 2px 8px rgba(139,125,107,0.12)',
    },

    floatingBar: {
      borderRadius: 8,
    },
  },

  // ═══════════════════════════════════════════════════
  // 6. Nord — 北欧寒色调（冷静蓝青，兼顾深浅）
  // ═══════════════════════════════════════════════════
  {
    id: 'nord',
    labelKey: 'skin.nord',
    descriptionKey: 'skin.nordDesc',
    previewColors: ['#5E81AC', '#ECEFF4', '#88C0D0'],
    compatibleMode: 'both',

    colorPrimary: '#5E81AC',
    colorPrimaryHover: '#81A1C1',

    borderRadius: 6,
    borderRadiusLG: 10,
    borderRadiusSM: 4,
    borderRadiusXS: 2,

    controlHeight: 32,
    controlHeightLG: 40,
    controlHeightSM: 24,

    fontFamily:
      '-apple-system, "Inter", "SF Pro Text", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
    fontFamilyHeading: 'inherit',
    fontSize: 14,
    padding: 16, paddingLG: 20, paddingSM: 12,

    motionDurationSlow: '0.3s', motionDurationMid: '0.18s', motionDurationFast: '0.1s',
    motionEaseInOut: 'cubic-bezier(0.4, 0, 0.2, 1)', motionEaseOut: 'cubic-bezier(0, 0, 0.2, 1)',

    colorBgLayoutLight: '#ECEFF4',
    colorBgContainerLight: '#E5E9F0',
    colorBgElevatedLight: '#FFFFFF',
    colorBorderSecondaryLight: '#D8DEE9',

    colorBgLayoutDark: '#2E3440',
    colorBgContainerDark: '#3B4252',
    colorBgElevatedDark: '#434C5E',
    colorBorderSecondaryDark: 'rgba(136,192,208,0.12)',

    glass: { blur: 8, saturate: 110, bgLight: 'rgba(236,239,244,0.9)', bgDark: 'rgba(46,52,64,0.88)' },

    shadow: {
      card: {
        light: '0 1px 2px rgba(46,52,64,0.04), 0 4px 12px rgba(46,52,64,0.04)',
        dark: '0 1px 2px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.2)',
      },
      cardHover: {
        light: '0 2px 6px rgba(94,129,172,0.08), 0 8px 24px rgba(46,52,64,0.06)',
        dark: '0 2px 6px rgba(0,0,0,0.35), 0 8px 24px rgba(94,129,172,0.12)',
      },
      floating: {
        light: '0 2px 8px rgba(94,129,172,0.1), 0 8px 32px rgba(46,52,64,0.06)',
        dark: '0 2px 8px rgba(0,0,0,0.4), 0 8px 32px rgba(94,129,172,0.1)',
      },
      brandGlow: {
        light: '0 2px 12px rgba(94,129,172,0.1), 0 0 0 1px rgba(94,129,172,0.1)',
        dark: '0 2px 12px rgba(136,192,208,0.12), 0 0 0 1px rgba(136,192,208,0.08)',
      },
    },

    texture: {
      noise: false, noiseOpacity: 0,
      grid: false, gridColor: { light: 'rgba(94,129,172,0.03)', dark: 'rgba(136,192,208,0.03)' },
    },
    cardStyle: { borderWidth: 1, hoverBorderWidth: 1, hoverLift: true, liftDistance: 1 },
    searchBox: { height: 46, borderRadius: 8, fontSize: 14 },
    header: { height: 52 },

    logoGradient: 'linear-gradient(135deg, #5E81AC, #88C0D0)',
    logoGlowShadow: {
      light: '0 2px 8px rgba(94,129,172,0.22)',
      dark: '0 2px 8px rgba(136,192,208,0.26)',
    },

    floatingBar: { borderRadius: 10 },
  },

  // ═══════════════════════════════════════════════════
  // 7. Solarized — 太阳化（暖米 + 青黄对比，护眼长时间使用友好）
  // ═══════════════════════════════════════════════════
  {
    id: 'solarized',
    labelKey: 'skin.solarized',
    descriptionKey: 'skin.solarizedDesc',
    previewColors: ['#3D8EB9', '#FDF6E3', '#B58900'],
    compatibleMode: 'both',

    colorPrimary: '#3D8EB9',
    colorPrimaryHover: '#4FA3C4',

    borderRadius: 4, borderRadiusLG: 8, borderRadiusSM: 3, borderRadiusXS: 2,
    controlHeight: 32, controlHeightLG: 40, controlHeightSM: 24,

    fontFamily:
      '"Source Sans 3", -apple-system, "Inter", "PingFang SC", "Microsoft YaHei", sans-serif',
    fontFamilyHeading: 'inherit',
    fontSize: 14,
    padding: 16, paddingLG: 20, paddingSM: 12,

    motionDurationSlow: '0.3s', motionDurationMid: '0.18s', motionDurationFast: '0.1s',
    motionEaseInOut: 'cubic-bezier(0.4, 0, 0.2, 1)', motionEaseOut: 'cubic-bezier(0, 0, 0.2, 1)',

    colorBgLayoutLight: '#FDF6E3',
    colorBgContainerLight: '#EEE8D5',
    colorBgElevatedLight: '#FFFCF2',
    colorBorderSecondaryLight: '#DDD6C1',

    colorBgLayoutDark: '#002B36',
    colorBgContainerDark: '#073642',
    colorBgElevatedDark: '#0F4150',
    colorBorderSecondaryDark: 'rgba(131,148,150,0.14)',

    glass: { blur: 6, saturate: 110, bgLight: 'rgba(253,246,227,0.9)', bgDark: 'rgba(0,43,54,0.9)' },

    shadow: {
      card: {
        light: '0 1px 2px rgba(88,110,117,0.06), 0 4px 10px rgba(88,110,117,0.05)',
        dark: '0 1px 2px rgba(0,0,0,0.35), 0 4px 10px rgba(0,0,0,0.22)',
      },
      cardHover: {
        light: '0 2px 6px rgba(181,137,0,0.08), 0 8px 24px rgba(88,110,117,0.06)',
        dark: '0 2px 6px rgba(0,0,0,0.4), 0 8px 24px rgba(181,137,0,0.12)',
      },
      floating: {
        light: '0 2px 8px rgba(181,137,0,0.1), 0 8px 32px rgba(88,110,117,0.06)',
        dark: '0 2px 8px rgba(0,0,0,0.45), 0 8px 32px rgba(181,137,0,0.1)',
      },
      brandGlow: {
        light: '0 2px 12px rgba(61,142,185,0.08), 0 0 0 1px rgba(61,142,185,0.06)',
        dark: '0 2px 12px rgba(42,161,152,0.14), 0 0 0 1px rgba(42,161,152,0.1)',
      },
    },

    texture: {
      noise: true, noiseOpacity: 0.02,
      grid: false, gridColor: { light: 'rgba(181,137,0,0.03)', dark: 'rgba(42,161,152,0.03)' },
    },
    cardStyle: { borderWidth: 1, hoverBorderWidth: 1, hoverLift: false, liftDistance: 0 },
    searchBox: { height: 46, borderRadius: 4, fontSize: 14 },
    header: { height: 52 },

    logoGradient: 'linear-gradient(135deg, #3D8EB9, #B58900)',
    logoGlowShadow: {
      light: '0 2px 8px rgba(61,142,185,0.16)',
      dark: '0 2px 8px rgba(42,161,152,0.15)',
    },

    floatingBar: { borderRadius: 6 },
  },
];

/**
 * 根据 ID 查找皮肤预设
 */
export function getSkinPreset(id: SkinPresetId): SkinPreset {
  const preset = SKIN_PRESETS.find((p) => p.id === id);
  if (!preset) return SKIN_PRESETS[0]; // 默认回退到 minimal
  return preset;
}
