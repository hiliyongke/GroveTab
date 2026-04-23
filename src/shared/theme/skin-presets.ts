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
  | 'elegant';

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
    previewColors: ['#4F46E5', '#f8f8fa', '#818CF8'],
    compatibleMode: 'both',

    colorPrimary: '#4F46E5',
    colorPrimaryHover: '#6366F1',

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

    colorBgLayoutLight: '#f8f8fa',
    colorBgContainerLight: '#ffffff',
    colorBgElevatedLight: '#ffffff',
    colorBorderSecondaryLight: '#e8e8ec',

    colorBgLayoutDark: '#0a0a0b',
    colorBgContainerDark: '#141416',
    colorBgElevatedDark: '#1c1c1f',
    colorBorderSecondaryDark: 'rgba(255,255,255,0.06)',

    glass: {
      blur: 20,
      saturate: 180,
      bgLight: 'rgba(255, 255, 255, 0.72)',
      bgDark: 'rgba(20, 20, 22, 0.72)',
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
        light: '0 2px 8px rgba(79,70,229,0.08), 0 8px 32px rgba(0,0,0,0.08)',
        dark: '0 2px 8px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.3)',
      },
      brandGlow: {
        light: '0 2px 12px rgba(79,70,229,0.06), 0 0 0 1px rgba(0,0,0,0.03)',
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

    logoGradient: 'linear-gradient(135deg, #4F46E5, #818CF8)',
    logoGlowShadow: {
      light: '0 2px 8px rgba(79,70,229,0.3)',
      dark: '0 2px 8px rgba(79,70,229,0.4)',
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
    previewColors: ['#007AFF', 'rgba(255,255,255,0.4)', '#5AC8FA'],
    compatibleMode: 'both',

    colorPrimary: '#007AFF',
    colorPrimaryHover: '#0A84FF',

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
        light: '0 4px 16px rgba(0,122,255,0.1), 0 16px 48px rgba(0,0,0,0.08)',
        dark: '0 4px 16px rgba(0,122,255,0.15), 0 16px 48px rgba(0,0,0,0.4)',
      },
      brandGlow: {
        light: '0 4px 24px rgba(0,122,255,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
        dark: '0 4px 24px rgba(10,132,255,0.15), 0 0 0 1px rgba(255,255,255,0.06)',
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

    logoGradient: 'linear-gradient(135deg, #007AFF, #5AC8FA)',
    logoGlowShadow: {
      light: '0 2px 12px rgba(0,122,255,0.3)',
      dark: '0 2px 12px rgba(10,132,255,0.4)',
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
    previewColors: ['#8B6914', '#f5f0e8', '#C4A35A'],
    compatibleMode: 'light',

    colorPrimary: '#8B6914',
    colorPrimaryHover: '#A07B1A',

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
        light: '0 1px 3px rgba(139,105,20,0.1), 0 3px 10px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)',
        dark: '0 1px 3px rgba(0,0,0,0.5), 0 3px 10px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
      },
      cardHover: {
        light: '0 2px 6px rgba(139,105,20,0.15), 0 6px 20px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.7)',
        dark: '0 2px 6px rgba(0,0,0,0.6), 0 6px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
      },
      floating: {
        light: '0 3px 10px rgba(139,105,20,0.15), 0 10px 40px rgba(0,0,0,0.1)',
        dark: '0 3px 10px rgba(0,0,0,0.6), 0 10px 40px rgba(0,0,0,0.5)',
      },
      brandGlow: {
        light: '0 2px 12px rgba(139,105,20,0.08), 0 0 0 1px rgba(196,163,90,0.2)',
        dark: '0 2px 12px rgba(196,163,90,0.1), 0 0 0 1px rgba(196,163,90,0.15)',
      },
    },

    texture: {
      noise: true,
      noiseOpacity: 0.04,
      grid: false,
      gridColor: { light: 'rgba(139,105,20,0.04)', dark: 'rgba(196,163,90,0.03)' },
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

    logoGradient: 'linear-gradient(135deg, #8B6914, #C4A35A)',
    logoGlowShadow: {
      light: '0 2px 8px rgba(139,105,20,0.25)',
      dark: '0 2px 8px rgba(196,163,90,0.3)',
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
    previewColors: ['#A855F7', '#0f0f1a', '#06B6D4'],
    compatibleMode: 'dark',

    colorPrimary: '#A855F7',
    colorPrimaryHover: '#C084FC',

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
    colorBorderSecondaryDark: 'rgba(168, 85, 247, 0.12)',

    glass: {
      blur: 24,
      saturate: 200,
      bgLight: 'rgba(255, 255, 255, 0.75)',
      bgDark: 'rgba(18, 18, 30, 0.7)',
    },

    shadow: {
      card: {
        light: '0 1px 3px rgba(168,85,247,0.06), 0 4px 16px rgba(0,0,0,0.05)',
        dark: '0 0 1px rgba(168,85,247,0.3), 0 2px 8px rgba(0,0,0,0.4), 0 4px 20px rgba(168,85,247,0.08)',
      },
      cardHover: {
        light: '0 2px 8px rgba(168,85,247,0.1), 0 8px 28px rgba(0,0,0,0.08)',
        dark: '0 0 1px rgba(168,85,247,0.5), 0 4px 16px rgba(0,0,0,0.5), 0 8px 32px rgba(168,85,247,0.15)',
      },
      floating: {
        light: '0 4px 16px rgba(168,85,247,0.12), 0 8px 32px rgba(0,0,0,0.06)',
        dark: '0 0 1px rgba(168,85,247,0.4), 0 4px 20px rgba(0,0,0,0.5), 0 12px 40px rgba(168,85,247,0.12)',
      },
      brandGlow: {
        light: '0 4px 20px rgba(168,85,247,0.12), 0 0 0 1px rgba(168,85,247,0.08)',
        dark: '0 0 20px rgba(168,85,247,0.2), 0 0 40px rgba(6,182,212,0.08)',
      },
    },

    texture: {
      noise: false,
      noiseOpacity: 0,
      grid: false,
      gridColor: { light: 'rgba(168,85,247,0.03)', dark: 'rgba(168,85,247,0.03)' },
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

    logoGradient: 'linear-gradient(135deg, #A855F7, #06B6D4)',
    logoGlowShadow: {
      light: '0 2px 12px rgba(168,85,247,0.3)',
      dark: '0 2px 16px rgba(168,85,247,0.4), 0 0 30px rgba(6,182,212,0.15)',
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
    previewColors: ['#1a1a2e', '#faf8f4', '#B8860B'],
    compatibleMode: 'both',

    colorPrimary: '#1a1a2e',
    colorPrimaryHover: '#2d2d4e',

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

    colorBgLayoutDark: '#0e0e18',
    colorBgContainerDark: '#16162a',
    colorBgElevatedDark: '#1e1e38',
    colorBorderSecondaryDark: 'rgba(184,134,11,0.12)',

    glass: {
      blur: 12,
      saturate: 120,
      bgLight: 'rgba(250, 248, 244, 0.9)',
      bgDark: 'rgba(22, 22, 42, 0.85)',
    },

    shadow: {
      card: {
        light: '0 1px 2px rgba(26,26,46,0.05), 0 4px 12px rgba(26,26,46,0.04)',
        dark: '0 1px 2px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.25)',
      },
      cardHover: {
        light: '0 2px 6px rgba(26,26,46,0.08), 0 8px 24px rgba(26,26,46,0.06)',
        dark: '0 2px 6px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.35)',
      },
      floating: {
        light: '0 2px 8px rgba(26,26,46,0.08), 0 8px 32px rgba(26,26,46,0.06)',
        dark: '0 2px 8px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.4)',
      },
      brandGlow: {
        light: '0 2px 12px rgba(184,134,11,0.06), 0 0 0 1px rgba(184,134,11,0.15)',
        dark: '0 2px 12px rgba(184,134,11,0.08), 0 0 0 1px rgba(184,134,11,0.12)',
      },
    },

    texture: {
      noise: true,
      noiseOpacity: 0.025,
      grid: false,
      gridColor: { light: 'rgba(26,26,46,0.03)', dark: 'rgba(184,134,11,0.03)' },
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

    logoGradient: 'linear-gradient(135deg, #1a1a2e, #B8860B)',
    logoGlowShadow: {
      light: '0 2px 8px rgba(184,134,11,0.2)',
      dark: '0 2px 8px rgba(184,134,11,0.3)',
    },

    floatingBar: {
      borderRadius: 8,
    },
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
