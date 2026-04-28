/**
 * AntdThemeProvider —— antd v6 主题桥接 + 皮肤系统
 *
 * 职责：
 *   1. 通过 `useResolvedTheme` 订阅 settings.theme 与系统 `prefers-color-scheme`，
 *      在「跟随系统」模式下也能即时响应系统明暗切换
 *   2. 写 `<html data-theme="...">` 以兼容存量 CSS 变量引用
 *   3. 从皮肤预设（skinPreset）动态生成 antd theme config + CSS 变量
 *   4. 注入皮肤级 CSS 变量到 `:root`，供组件内通过 `var(--app-xxx)` 消费
 *   5. 挂载 antd 的 App 容器（提供 message/notification/modal 的静态调用上下文）
 */

import { useEffect, useMemo, useRef } from 'react';
import { ConfigProvider, theme as antdTheme, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { useSettingsStore } from '@/store';
import { useResolvedTheme } from '@/shared/hooks';
import { bindFeedback, unbindFeedback } from './feedback';
import { getSkinPreset, type SkinPresetId } from '@/shared/theme/skin-presets';
import { LOCAL_CACHE_KEYS } from '@/shared/config/storage-keys';

/** AntdApp 容器的稳定样式常量，避免每次渲染创建新对象 */
const ANT_APP_STYLE: React.CSSProperties = { minHeight: '100vh' };

/**
 * 将 antd App 的 message/notification/modal 实例注入到模块级 `feedback`
 *
 * 必须放在 `<AntdApp>` 的子节点里，`App.useApp()` 才能拿到有效实例；
 * 组件本身不渲染任何节点。
 */
function FeedbackBridge() {
  const { message, notification, modal } = AntdApp.useApp();
  /** 用 ref 持有最新的 antd API 引用，避免 useEffect 依赖不稳定导致反复触发 */
  const apiRef = useRef({ message, notification, modal });

  useEffect(() => {
    apiRef.current = { message, notification, modal };
  }, [message, notification, modal]);

  useEffect(() => {
    bindFeedback(apiRef);
    return () => unbindFeedback();
  }, []);
  return null;
}

/** UI Token 极客定制的覆盖配置——与 UserSettings.skinCustom 对齐 */
interface SkinCustomOverride {
  borderRadius?: number;
  fontSize?: number;
  controlHeight?: number;
  borderWidth?: number;
  fontWeightBody?: number;
  fontWeightHeading?: number;
  colorPrimary?: string;
}

/**
 * 将 skinCustom 覆盖应用到预设上，得到最终生效 token。
 *
 * 覆盖规则：
 *   - borderRadius：驱动五级圆角（base/LG/SM/XS）
 *   - fontSize：驱动基础字号，标题字号按比例更新
 *   - controlHeight：驱动三级控件高（SM/base/LG）
 *   - borderWidth：写到 token.lineWidth
 *   - colorPrimary：完全覆盖品牌主色
 */
function applySkinCustom(base: ReturnType<typeof getSkinPreset>, custom?: SkinCustomOverride): ReturnType<typeof getSkinPreset> {
  if (custom === undefined) return base;
  const br = custom.borderRadius;
  const fs = custom.fontSize;
  const ch = custom.controlHeight;
  return {
    ...base,
    colorPrimary: custom.colorPrimary ?? base.colorPrimary,
    colorPrimaryHover: custom.colorPrimary ?? base.colorPrimaryHover,
    borderRadius: br ?? base.borderRadius,
    borderRadiusLG: br !== undefined ? br + 4 : base.borderRadiusLG,
    borderRadiusSM: br !== undefined ? Math.max(2, br - 2) : base.borderRadiusSM,
    borderRadiusXS: br !== undefined ? Math.max(1, br - 4) : base.borderRadiusXS,
    fontSize: fs ?? base.fontSize,
    controlHeight: ch ?? base.controlHeight,
    controlHeightLG: ch !== undefined ? ch + 8 : base.controlHeightLG,
    controlHeightSM: ch !== undefined ? Math.max(20, ch - 8) : base.controlHeightSM,
  };
}

/**
 * 从皮肤预设 + 极客覆盖生成 antd ThemeConfig
 *
 * 皮肤预设定义了完整的视觉 token 包，此函数将其转换为 antd 可消费的
 * ConfigProvider theme 配置，并允许用户覆盖单项 token。
 */
function buildThemeConfig(
  skinId: SkinPresetId,
  isDark: boolean,
  density: 'compact' | 'default' | 'comfortable',
  custom?: SkinCustomOverride,
) {
  const skin = applySkinCustom(getSkinPreset(skinId), custom);

  /** 布局密度缩放因子 */
  const ds = density === 'compact' ? 0.85 : density === 'comfortable' ? 1.15 : 1;

  /** 用户自定义线条粗细，默认 1 */
  const lineWidth = custom?.borderWidth ?? 1;

  return {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    cssVar: { key: 'app' },
    hashed: false,
    token: {
      /** 品牌主色 */
      colorPrimary: skin.colorPrimary,
      /** 圆角体系 */
      borderRadius: skin.borderRadius,
      borderRadiusLG: skin.borderRadiusLG,
      borderRadiusSM: skin.borderRadiusSM,
      borderRadiusXS: skin.borderRadiusXS,
      /** 控件高度（随密度缩放） */
      controlHeight: Math.round(skin.controlHeight * ds),
      controlHeightLG: Math.round(skin.controlHeightLG * ds),
      controlHeightSM: Math.round(skin.controlHeightSM * ds),
      /** 字体 */
      fontFamily: skin.fontFamily,
      fontFamilyCode:
        '"SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", "Noto Sans Mono SC", ui-monospace, monospace',
      fontSize: skin.fontSize,
      fontSizeHeading1: 32,
      fontSizeHeading2: 24,
      fontSizeHeading3: 20,
      fontSizeHeading4: 16,
      /** 行高 */
      lineHeight: 1.6,
      /** 动效 */
      motionDurationSlow: skin.motionDurationSlow,
      motionDurationMid: skin.motionDurationMid,
      motionDurationFast: skin.motionDurationFast,
      motionEaseInOut: skin.motionEaseInOut,
      motionEaseOut: skin.motionEaseOut,
      motionEaseIn: 'cubic-bezier(0.4, 0, 1, 1)',
      /** 间距（随密度缩放） */
      padding: Math.round(skin.padding * ds),
      paddingLG: Math.round(skin.paddingLG * ds),
      paddingSM: Math.round(skin.paddingSM * ds),
      paddingXS: 8,
      margin: 12,
      marginLG: 16,
      marginSM: 8,
      marginXS: 4,
      /** 线条（可用户自定义粗细） */
      lineWidth,
      lineType: 'solid',
      /** 明暗模式背景色 */
      ...(isDark ? {
        colorBgContainer: skin.colorBgContainerDark,
        colorBgElevated: skin.colorBgElevatedDark,
        colorBgLayout: skin.colorBgLayoutDark,
        colorBgSpotlight: '#262629',
        colorBorderSecondary: skin.colorBorderSecondaryDark,
      } : {
        colorBgLayout: skin.colorBgLayoutLight,
        colorBgContainer: skin.colorBgContainerLight,
        colorBgElevated: skin.colorBgElevatedLight,
        colorBorderSecondary: skin.colorBorderSecondaryLight,
      }),
    },
    components: {
      Card: {
        borderRadiusLG: skin.borderRadiusLG,
        paddingLG: 20,
        boxShadowTertiary: isDark
          ? skin.shadow.card.dark
          : skin.shadow.card.light,
      },
      Button: {
        borderRadius: skin.borderRadius,
        contentFontSizeSM: 12,
        primaryShadow: isDark
          ? `0 2px 8px ${skin.colorPrimary}40`
          : `0 2px 8px ${skin.colorPrimary}33`,
      },
      Input: {
        borderRadius: skin.borderRadius,
        activeBorderColor: skin.colorPrimary,
        hoverBorderColor: skin.colorPrimaryHover,
        activeShadow: `0 0 0 3px ${skin.colorPrimary}1F`,
      },
      Modal: {
        borderRadiusLG: skin.borderRadiusLG + 4,
        contentBg: isDark ? skin.colorBgElevatedDark : skin.colorBgElevatedLight,
        headerBg: isDark ? skin.colorBgElevatedDark : skin.colorBgElevatedLight,
      },
      Tag: {
        borderRadiusSM: skin.borderRadiusXS,
      },
      Segmented: {
        borderRadius: skin.borderRadius,
        borderRadiusSM: skin.borderRadiusSM,
      },
      Tooltip: {},
    },
  };
}

/**
 * 从皮肤预设生成 CSS 变量，注入到 :root
 *
 * 这些变量供组件内通过 `var(--app-skin-xxx)` 消费，
 * 实现皮肤驱动的视觉一致性，消灭硬编码色值。
 */
function buildSkinCSSVars(
  skinId: SkinPresetId,
  isDark: boolean,
  density: 'compact' | 'default' | 'comfortable',
  reducedMotion: boolean,
  custom?: SkinCustomOverride,
): Record<string, string> {
  const skin = applySkinCustom(getSkinPreset(skinId), custom);

  /** 布局密度缩放因子 */
  const densityScale = density === 'compact' ? 0.8 : density === 'comfortable' ? 1.25 : 1;
  const searchRadius = custom?.borderRadius !== undefined ? skin.borderRadiusLG : skin.searchBox.borderRadius;
  const floatingRadius = custom?.borderRadius !== undefined ? skin.borderRadiusLG : skin.floatingBar.borderRadius;

  const vars: Record<string, string> = {
    // ── 毛玻璃 ──
    '--app-glass-blur': `${skin.glass.blur}px`,
    '--app-glass-saturate': `${skin.glass.saturate}%`,
    '--app-glass-bg': isDark ? skin.glass.bgDark : skin.glass.bgLight,
    '--app-glass-filter': `blur(${skin.glass.blur}px) saturate(${skin.glass.saturate}%)`,

    // ── 阴影 ──
    '--app-shadow-card': isDark ? skin.shadow.card.dark : skin.shadow.card.light,
    '--app-shadow-card-hover': isDark ? skin.shadow.cardHover.dark : skin.shadow.cardHover.light,
    '--app-shadow-floating': isDark ? skin.shadow.floating.dark : skin.shadow.floating.light,
    '--app-shadow-brand-glow': isDark ? skin.shadow.brandGlow.dark : skin.shadow.brandGlow.light,

    // ── Logo ──
    '--app-logo-gradient': custom?.colorPrimary
      ? `linear-gradient(135deg, ${skin.colorPrimary}, color-mix(in srgb, ${skin.colorPrimary} 70%, white))`
      : skin.logoGradient,
    '--app-logo-glow': isDark ? skin.logoGlowShadow.dark : skin.logoGlowShadow.light,

    // ── 搜索框 ──
    '--app-search-height': `${Math.round(skin.searchBox.height * densityScale)}px`,
    '--app-search-radius': `${searchRadius}px`,
    '--app-search-font-size': `${skin.searchBox.fontSize}px`,

    // ── Header ──
    '--app-header-height': `${Math.round(skin.header.height * densityScale)}px`,

    // ── 浮动栏 ──
    '--app-floating-radius': `${floatingRadius}px`,

    // ── 卡片风格 ──
    '--app-card-radius': `${skin.borderRadiusLG}px`,
    '--app-card-lift': skin.cardStyle.hoverLift && !reducedMotion ? `${skin.cardStyle.liftDistance}px` : '0px',

    // ── 纹理 ──
    '--app-texture-noise': skin.texture.noise ? '1' : '0',
    '--app-texture-noise-opacity': `${skin.texture.noiseOpacity}`,
    '--app-texture-grid': skin.texture.grid ? '1' : '0',
    '--app-texture-grid-color': isDark ? skin.texture.gridColor.dark : skin.texture.gridColor.light,

    // ── 语义色 ──
    '--app-brand': skin.colorPrimary,
    '--app-color-primary': skin.colorPrimary,
    '--app-color-primary-hover': skin.colorPrimaryHover,
    '--app-color-success': 'var(--ant-color-success)',
    '--app-color-warning': 'var(--ant-color-warning)',
    '--app-color-error': 'var(--ant-color-error)',
    '--app-color-info': 'var(--ant-color-info)',

    // ── 文本与面板 ──
    '--app-text-primary': 'var(--ant-color-text)',
    '--app-text-secondary': 'var(--ant-color-text-secondary)',
    '--app-text-tertiary': 'var(--ant-color-text-tertiary)',
    '--app-surface-bg': 'var(--ant-color-bg-container)',
    '--app-surface-elevated-bg': 'var(--ant-color-bg-elevated)',

    // ── 边框 ──
    '--app-border-hover': 'var(--ant-color-border)',

    // ── 布局密度缩放 ──
    '--app-density-scale': `${densityScale}`,
    '--app-spacing-unit': `${Math.round(4 * densityScale)}px`,
    '--app-card-gap': `${Math.round(16 * densityScale)}px`,
    '--app-card-padding': `${Math.round(16 * densityScale)}px`,
    '--app-section-gap': `${Math.round(24 * densityScale)}px`,

    // ── 动效 ──
    '--app-motion-duration': reducedMotion ? '0s' : '0.2s',
    '--app-motion-duration-slow': reducedMotion ? '0s' : '0.3s',
    '--app-motion-duration-fast': reducedMotion ? '0s' : '0.12s',
  };

  return vars;
}

/**
 * antd v6 主题提供者 + 多语言环境 + App 静态消息容器
 */
export function AntdThemeProvider({ children }: { children: React.ReactNode }) {
  const language = useSettingsStore((s) => s.settings.language);
  const loaded = useSettingsStore((s) => s.loaded);
  const mode = useResolvedTheme();
  const skinPreset = useSettingsStore((s) => s.settings.skinPreset ?? 'minimal');
  const layoutDensity = useSettingsStore((s) => s.settings.layoutDensity ?? 'default');
  const reducedMotionSetting = useSettingsStore((s) => s.settings.reducedMotion ?? 'auto');
  const skinCustom = useSettingsStore((s) => s.settings.skinCustom);

  /** 计算实际是否减弱动效 */
  const reducedMotion = reducedMotionSetting === 'on'
    || (reducedMotionSetting === 'auto' && typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // 同步 data-theme 到 <html>，供存量 CSS 变量消费
  useEffect(() => {
    if (!loaded) return;
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.style.backgroundColor = mode === 'dark' ? '#141414' : '';
    document.documentElement.style.colorScheme = mode;
    try {
      window.localStorage.setItem(LOCAL_CACHE_KEYS.prepaintTheme, mode);
    } catch {
      // localStorage 不可用时忽略；下一次仍可通过系统主题兜底。
    }
  }, [mode, loaded]);

  // 同步皮肤纹理属性到 <html>
  useEffect(() => {
    if (!loaded) return;
    const skin = getSkinPreset(skinPreset);
    if (skin.texture.noise) {
      document.documentElement.setAttribute('data-texture-noise', '');
    } else {
      document.documentElement.removeAttribute('data-texture-noise');
    }
  }, [skinPreset, loaded]);

  // 同步 dayjs locale
  useEffect(() => {
    dayjs.locale(language === 'zh-CN' ? 'zh-cn' : 'en');
  }, [language]);

  /**
   * 注入皮肤级 CSS 变量到 :root
   *
   * 使用 CSSStyleDeclaration 批量写入，比逐个 setProperty 高效，
   * 且避免闪烁（同步写入而非异步）。
   */
  const skinVars = useMemo(
    () => buildSkinCSSVars(skinPreset, mode === 'dark', layoutDensity, reducedMotion, skinCustom),
    [skinPreset, mode, layoutDensity, reducedMotion, skinCustom],
  );

  useEffect(() => {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(skinVars)) {
      root.style.setProperty(key, value);
    }
    return () => {
      for (const key of Object.keys(skinVars)) {
        root.style.removeProperty(key);
      }
    };
  }, [skinVars]);

  /**
   * 主题配置：从皮肤预设 + 极客覆盖动态生成
   */
  const themeConfig = useMemo(
    () => buildThemeConfig(skinPreset, mode === 'dark', layoutDensity, skinCustom),
    [skinPreset, mode, layoutDensity, skinCustom],
  );

  const locale = language === 'zh-CN' ? zhCN : enUS;

  return (
    <ConfigProvider theme={themeConfig} locale={locale}>
      <AntdApp style={ANT_APP_STYLE}>
        <FeedbackBridge />
        {children}
      </AntdApp>
    </ConfigProvider>
  );
}
