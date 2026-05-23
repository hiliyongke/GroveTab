/**
 * 主题定制模块
 *
 * 将皮肤预设（skin-presets.ts）转换为 Ant Design 和消费层可用的样式 token：
 *   - buildAntdThemeConfig  →  Ant Design v6 ThemeConfig（seed + component token）
 *   - buildAppThemeVars     →  `--app-*` CSS 自定义属性（业务层消费）
 *
 * 设计原则：
 *   1. 所有视觉参数从 SkinPreset 派生，不在本文件硬编码色值
 *   2. 极客定制（skinCustom）仅在用户开启后覆盖单项，其余保留预设默认值
 *   3. 密度缩放（densityScale）统一由 scaleByDensity 处理，确保间距/字号/控件高度成比例
 *   4. 暗色模式切换由 isDark 参数驱动，本模块不读取媒体查询
 */

import type { ThemeConfig } from 'antd';
import { theme as antdTheme } from 'antd';
import type { UserSettings } from '@/shared/types';
import { getSkinPreset, type SkinPreset, type SkinPresetId } from './skin-presets';

/** 布局密度别名，剥离 undefined 使下游调用更安静 */
export type LayoutDensity = NonNullable<UserSettings['layoutDensity']>;
/** 极客定制覆盖项，剥离 undefined 使下游调用更安静 */
export type SkinCustomOverride = NonNullable<UserSettings['skinCustom']>;
/** 应用级 CSS 自定义属性映射，所有 `--app-*` 变量统一用此类型约束 */
export type AppThemeVars = Record<`--app-${string}`, string>;

const BASE_BODY_FONT_SIZE = 14;
const DENSITY_SCALE_MAP: Record<LayoutDensity, number> = {
  compact: 0.85,
  default: 1,
  comfortable: 1.15,
};

/**
 * 按布局密度缩放数值
 * @param value - 基准值（对应 default 密度下的 px 值）
 * @param density - 当前布局密度档位
 * @returns 缩放后的整数 px 值
 */
function scaleByDensity(value: number, density: LayoutDensity): number {
  return Math.round(value * DENSITY_SCALE_MAP[density]);
}

/**
 * 按基准字号比例缩放标题字号
 * @param baseSize - 标题基准字号（对应 bodyFontSize=14 时的 px 值）
 * @param bodyFontSize - 当前皮肤基准字号
 * @returns 缩放后的标题字号（取整）
 */
function scaleHeadingFont(baseSize: number, bodyFontSize: number): number {
  return Math.round((baseSize / BASE_BODY_FONT_SIZE) * bodyFontSize);
}

/**
 * 解析主色 hover 状态颜色
 *
 * 如果用户在极客模式中自定义了主色，
 * 则基于自定义颜色生成 hover 态（混合 78% 白色）。
 * 否则使用皮肤预设的 hover 颜色。
 *
 * @param base - 皮肤预设配置
 * @param customColor - 用户自定义的主色（可选）
 * @returns hover 状态的主色值
 */
function resolvePrimaryHoverColor(base: SkinPreset, customColor?: string): string {
  const primary = customColor ?? base.colorPrimary;
  // 如果皮肤自定义了 hover 颜色且未自定义主色，优先使用皮肤定义
  if (!customColor && base.colorPrimaryHover) return base.colorPrimaryHover;
  // 否则从主色派生 hover 颜色（混合 78% 白色）
  return `color-mix(in srgb, ${primary} 78%, white)`;
}

/**
 * 获取布局密度缩放系数
 *
 * 返回当前密度设置对应的缩放系数：
 *   - compact: 0.85（缩小 15%）
 *   - default: 1（原始尺寸）
 *   - comfortable: 1.15（放大 15%）
 *
 * @param density - 布局密度设置
 * @returns 密度缩放系数
 */
function getDensityScale(density: LayoutDensity): number {
  return DENSITY_SCALE_MAP[density];
}

/**
 * 获取极客定制的基线值
 *
 * 开启极客定制时，表单控件应回落到当前皮肤的基线值，而不是一组全局硬编码默认值。
 * 否则用户只要打开开关，就会瞬间把当前皮肤改造成另一套视觉体系。
 *
 * @param skinId - 皮肤 ID
 * @returns 包含 borderRadius、fontSize、controlHeight、borderWidth、colorPrimary 的基线值对象
 */
export function getSkinCustomBaseValues(skinId: SkinPresetId) {
  const skin = getSkinPreset(skinId);
  return {
    borderRadius: skin.borderRadius,
    fontSize: skin.fontSize,
    controlHeight: skin.controlHeight,
    borderWidth: skin.cardStyle.borderWidth,
    colorPrimary: skin.colorPrimary,
  };
}

/**
 * 应用极客定制覆盖
 *
 * 将用户自定义的覆盖项应用到基础皮肤配置上。
 * 对于未自定义的字段，保留基础皮肤的默认值。
 *
 * @param base - 基础皮肤配置
 * @param custom - 用户自定义的覆盖项（可选）
 * @returns 应用覆盖后的新皮肤配置
 */
function applySkinCustom(base: SkinPreset, custom?: SkinCustomOverride): SkinPreset {
  if (!custom) return base;

  const borderRadius = custom.borderRadius;
  const fontSize = custom.fontSize;
  const controlHeight = custom.controlHeight;
  const borderWidth = custom.borderWidth;
  const colorPrimary = custom.colorPrimary ?? base.colorPrimary;

  return {
    ...base,
    colorPrimary,
    colorPrimaryHover: resolvePrimaryHoverColor(base, custom.colorPrimary),
    borderRadius: borderRadius ?? base.borderRadius,
    borderRadiusLG: borderRadius !== undefined ? borderRadius + 4 : base.borderRadiusLG,
    borderRadiusSM: borderRadius !== undefined ? Math.max(2, borderRadius - 2) : base.borderRadiusSM,
    borderRadiusXS: borderRadius !== undefined ? Math.max(1, borderRadius - 4) : base.borderRadiusXS,
    fontSize: fontSize ?? base.fontSize,
    controlHeight: controlHeight ?? base.controlHeight,
    controlHeightLG: controlHeight !== undefined ? controlHeight + 8 : base.controlHeightLG,
    controlHeightSM: controlHeight !== undefined ? Math.max(20, controlHeight - 8) : base.controlHeightSM,
    cardStyle: {
      ...base.cardStyle,
      borderWidth: borderWidth ?? base.cardStyle.borderWidth,
      hoverBorderWidth: borderWidth ?? base.cardStyle.hoverBorderWidth,
    },
  };
}

/**
 * 构建 Ant Design 主题配置对象
 *
 * Ant Design v6 官方推荐把主题定制收敛到 ConfigProvider.theme，
 * 由 seed token + component token 统一生成运行时样式，而不是到处覆盖 `.ant-*` 选择器。
 *
 * @param skinId - 皮肤预设 ID
 * @param isDark - 是否为暗色模式
 * @param density - 布局密度档位
 * @param custom - 极客定制覆盖项（可选）
 * @returns 完整的 Ant Design ThemeConfig 对象
 */
export function buildAntdThemeConfig(
  skinId: SkinPresetId,
  isDark: boolean,
  density: LayoutDensity,
  custom?: SkinCustomOverride,
): ThemeConfig {
  const skin = applySkinCustom(getSkinPreset(skinId), custom);
  const lineWidth = custom?.borderWidth ?? skin.cardStyle.borderWidth;

  return {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    cssVar: { key: 'app' },
    hashed: false,
    token: {
      colorPrimary: skin.colorPrimary,

      borderRadius: skin.borderRadius,
      borderRadiusLG: skin.borderRadiusLG,
      borderRadiusSM: skin.borderRadiusSM,
      borderRadiusXS: skin.borderRadiusXS,

      controlHeight: scaleByDensity(skin.controlHeight, density),
      controlHeightLG: scaleByDensity(skin.controlHeightLG, density),
      controlHeightSM: scaleByDensity(skin.controlHeightSM, density),

      fontFamily: skin.fontFamily,
      fontFamilyCode:
        '"SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", "Noto Sans Mono SC", ui-monospace, monospace',
      fontSize: skin.fontSize,
      fontSizeHeading1: scaleHeadingFont(32, skin.fontSize),
      fontSizeHeading2: scaleHeadingFont(24, skin.fontSize),
      fontSizeHeading3: scaleHeadingFont(20, skin.fontSize),
      fontSizeHeading4: scaleHeadingFont(16, skin.fontSize),
      fontSizeHeading5: scaleHeadingFont(14, skin.fontSize),
      fontWeightStrong: custom?.fontWeightHeading ?? 600,

      lineHeight: 1.6,

      motionDurationSlow: skin.motionDurationSlow,
      motionDurationMid: skin.motionDurationMid,
      motionDurationFast: skin.motionDurationFast,
      motionEaseInOut: skin.motionEaseInOut,
      motionEaseOut: skin.motionEaseOut,
      padding: scaleByDensity(skin.padding, density),
      paddingLG: scaleByDensity(skin.paddingLG, density),
      paddingSM: scaleByDensity(skin.paddingSM, density),
      paddingXS: scaleByDensity(8, density),
      margin: scaleByDensity(12, density),
      marginLG: scaleByDensity(16, density),
      marginSM: scaleByDensity(8, density),
      marginXS: scaleByDensity(4, density),

      lineWidth,
      lineType: 'solid',

      ...(isDark
        ? {
            colorBgContainer: skin.colorBgContainerDark,
            colorBgElevated: skin.colorBgElevatedDark,
            colorBgLayout: skin.colorBgLayoutDark,
            colorBgSpotlight: skinId === 'apple' ? '#2c2c2e' : '#262629',
            colorBorderSecondary: skin.colorBorderSecondaryDark,
            colorText: skinId === 'apple' ? '#ffffff' : 'rgba(244, 248, 255, 0.92)',
            colorTextSecondary: skinId === 'apple' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(212, 223, 242, 0.78)',
            colorTextTertiary: skinId === 'apple' ? 'rgba(255, 255, 255, 0.48)' : 'rgba(173, 194, 227, 0.58)',
            colorFillQuaternary: skinId === 'apple' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(154, 183, 229, 0.1)',
            colorFillTertiary: skinId === 'apple' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(154, 183, 229, 0.14)',
          }
        : {
            colorBgLayout: skin.colorBgLayoutLight,
            colorBgContainer: skin.colorBgContainerLight,
            colorBgElevated: skin.colorBgElevatedLight,
            colorBorderSecondary: skin.colorBorderSecondaryLight,
            colorText: skinId === 'apple' ? '#1d1d1f' : '#1F2329',
            colorTextSecondary: skinId === 'apple' ? 'rgba(0, 0, 0, 0.8)' : '#646A73',
            colorTextTertiary: skinId === 'apple' ? 'rgba(0, 0, 0, 0.48)' : '#8F959E',
            colorFillQuaternary: skinId === 'apple' ? 'rgba(0, 0, 0, 0.04)' : 'rgba(31, 35, 41, 0.04)',
            colorFillTertiary: skinId === 'apple' ? 'rgba(0, 0, 0, 0.06)' : 'rgba(31, 35, 41, 0.06)',
          }),
    },
    components: {
      Card: {
        borderRadiusLG: skin.borderRadiusLG,
        paddingLG: scaleByDensity(20, density),
        boxShadowTertiary: isDark ? skin.shadow.card.dark : skin.shadow.card.light,
        headerBg: 'transparent',
      },
      Button: {
        borderRadius: skin.borderRadius,
        contentFontSizeSM: Math.max(12, scaleHeadingFont(12, skin.fontSize)),
        contentFontSize: Math.max(13, skin.fontSize),
        controlHeight: scaleByDensity(skin.controlHeight, density),
        primaryShadow: isDark
          ? `0 8px 18px ${skin.colorPrimary}45`
          : `0 8px 18px ${skin.colorPrimary}30`,
        defaultShadow: isDark
          ? '0 6px 16px rgba(6, 12, 24, 0.22)'
          : '0 4px 12px rgba(43, 107, 255, 0.08)',
      },
      Input: {
        borderRadius: skin.borderRadius,
        activeBorderColor: skin.colorPrimary,
        hoverBorderColor: skin.colorPrimaryHover,
        activeShadow: `0 0 0 3px ${skin.colorPrimary}1F`,
      },
      Layout: {
        headerBg: 'transparent',
        bodyBg: 'transparent',
        siderBg: 'transparent',
        triggerBg: 'transparent',
      },
      Segmented: {
        borderRadius: skin.borderRadius,
        borderRadiusSM: skin.borderRadiusSM,
        itemActiveBg: isDark
          ? (skinId === 'apple' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(98, 140, 255, 0.18)')
          : (skinId === 'apple' ? 'rgba(0, 0, 0, 0.06)' : 'rgba(43, 107, 255, 0.14)'),
        itemSelectedBg: isDark
          ? (skinId === 'apple' ? 'rgba(255, 255, 255, 0.16)' : 'rgba(98, 140, 255, 0.22)')
          : (skinId === 'apple' ? '#ffffff' : '#ffffff'),
      },
      Tabs: {
        itemColor: isDark ? 'rgba(212, 223, 242, 0.72)' : '#60708A',
        itemHoverColor: skin.colorPrimaryHover,
        itemSelectedColor: skin.colorPrimary,
        inkBarColor: skin.colorPrimary,
      },
      Tag: {
        borderRadiusSM: skin.borderRadiusXS,
      },
      Select: {
        optionSelectedBg: isDark
          ? (skinId === 'apple' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(98, 140, 255, 0.18)')
          : (skinId === 'apple' ? 'rgba(0, 113, 227, 0.08)' : 'rgba(43, 107, 255, 0.1)'),
      },
      Dropdown: {
        controlItemBgHover: isDark
          ? (skinId === 'apple' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(98, 140, 255, 0.16)')
          : (skinId === 'apple' ? 'rgba(0, 0, 0, 0.04)' : 'rgba(43, 107, 255, 0.08)'),
      },
      Tooltip: {
        colorBgSpotlight: isDark ? 'rgba(18, 28, 44, 0.94)' : 'rgba(24, 37, 59, 0.9)',
      },
      Modal: {
        borderRadiusLG: skin.borderRadiusLG + 4,
        contentBg: isDark ? skin.colorBgElevatedDark : skin.colorBgElevatedLight,
        headerBg: isDark ? skin.colorBgElevatedDark : skin.colorBgElevatedLight,
        footerBg: isDark ? skin.colorBgElevatedDark : skin.colorBgElevatedLight,
      },

    },
  };
}

/**
 * 构建应用级 CSS 自定义属性
 *
 * 业务层不应该直接消费 antd 内部 DOM 结构，因此这里把业务视觉原语桥接成 `--app-*` 变量：
 * 卡片阴影、毛玻璃、业务 hover、纹理等都只读这一层。
 *
 * @param skinId - 皮肤预设 ID
 * @param isDark - 是否为暗色模式
 * @param density - 布局密度档位
 * @param reducedMotion - 是否减弱动效（尊重用户偏好或系统设置）
 * @param custom - 极客定制覆盖项（可选）
 * @returns 包含全部 `--app-*` CSS 变量的对象
 */
export function buildAppThemeVars(
  skinId: SkinPresetId,
  isDark: boolean,
  density: LayoutDensity,
  reducedMotion: boolean,
  custom?: SkinCustomOverride,
): AppThemeVars {
  const skin = applySkinCustom(getSkinPreset(skinId), custom);
  const densityScale = getDensityScale(density);
  const searchRadius = custom?.borderRadius !== undefined ? skin.borderRadiusLG : skin.searchBox.borderRadius;
  const floatingRadius = custom?.borderRadius !== undefined ? skin.borderRadiusLG : skin.floatingBar.borderRadius;

  return {
    '--app-glass-blur': `${skin.glass.blur}px`,
    '--app-glass-saturate': `${skin.glass.saturate}%`,
    '--app-glass-bg': isDark ? skin.glass.bgDark : skin.glass.bgLight,
    '--app-page-gradient': isDark
      ? skinId === 'apple'
        ? 'none'
        : 'radial-gradient(circle at top, rgba(78, 119, 214, 0.12), transparent 42%), linear-gradient(180deg, #0F1726 0%, #10192A 54%, #0C1422 100%)'
      : skinId === 'apple'
        ? 'none'
        : 'radial-gradient(circle at top, rgba(120, 130, 160, 0.08), transparent 38%), linear-gradient(180deg, #F5F5F7 0%, #F0F0F3 52%, #E9E9ED 100%)',
    '--app-glass-filter': `blur(${skin.glass.blur}px) saturate(${skin.glass.saturate}%)`,

    '--app-shadow-card': isDark ? skin.shadow.card.dark : skin.shadow.card.light,
    '--app-shadow-card-hover': isDark ? skin.shadow.cardHover.dark : skin.shadow.cardHover.light,
    '--app-shadow-floating': isDark ? skin.shadow.floating.dark : skin.shadow.floating.light,
    '--app-shadow-brand-glow': isDark ? skin.shadow.brandGlow.dark : skin.shadow.brandGlow.light,

    // logo 渐变统一从主色和 hover 色派生；皮肤可通过 logoGradient 字段自定义
    '--app-logo-gradient': skin.logoGradient ?? `linear-gradient(135deg, ${skin.colorPrimary}, ${skin.colorPrimaryHover})`,
    '--app-logo-glow': isDark ? skin.logoGlowShadow.dark : skin.logoGlowShadow.light,

    '--app-search-height': `${scaleByDensity(skin.searchBox.height, density)}px`,
    '--app-search-radius': `${searchRadius}px`,
    '--app-search-font-size': `${Math.round(skin.searchBox.fontSize * densityScale)}px`,

    '--app-header-height': `${scaleByDensity(skin.header.height, density)}px`,

    '--app-floating-radius': `${floatingRadius}px`,

    /* ── 统一圆角规范（所有组件必须使用这些变量）── */
    '--app-radius-xs': `${skin.borderRadiusXS}px`,
    '--app-radius-sm': `${skin.borderRadiusSM}px`,
    '--app-radius-md': `${skin.borderRadius}px`,
    '--app-radius-lg': `${skin.borderRadiusLG}px`,
    '--app-radius-pill': '980px',
    '--app-radius-circle': '50%',

    /* ── 统一间距规范（4px 基础单位，支持密度缩放）── */
    '--app-space-1': `calc(4px * ${densityScale})`,
    '--app-space-2': `calc(8px * ${densityScale})`,
    '--app-space-3': `calc(12px * ${densityScale})`,
    '--app-space-4': `calc(16px * ${densityScale})`,
    '--app-space-5': `calc(24px * ${densityScale})`,
    '--app-space-6': `calc(32px * ${densityScale})`,

    '--app-card-radius': `${skin.borderRadiusLG}px`,
    '--app-card-lift': skin.cardStyle.hoverLift && !reducedMotion ? `${skin.cardStyle.liftDistance}px` : '0px',

    '--app-texture-noise': skin.texture.noise ? '1' : '0',
    '--app-texture-noise-opacity': `${skin.texture.noiseOpacity}`,
    '--app-texture-grid': skin.texture.grid ? '1' : '0',
    '--app-texture-grid-color': isDark ? skin.texture.gridColor.dark : skin.texture.gridColor.light,

    '--app-brand': skin.colorPrimary,
    '--app-color-primary': skin.colorPrimary,
    '--app-color-primary-hover': skin.colorPrimaryHover ?? resolvePrimaryHoverColor(skin, undefined),
    '--app-color-success': 'var(--ant-color-success)',
    '--app-color-warning': 'var(--ant-color-warning)',
    '--app-color-error': 'var(--ant-color-error)',
    '--app-color-info': 'var(--ant-color-info)',

    '--app-text-primary': 'var(--ant-color-text)',
    '--app-text-secondary': 'var(--ant-color-text-secondary)',
    '--app-text-tertiary': 'var(--ant-color-text-tertiary)',
    '--app-surface-bg': 'var(--ant-color-bg-container)',
    '--app-page-bg': 'var(--ant-color-bg-layout)',
    '--app-surface-elevated-bg': 'var(--ant-color-bg-elevated)',
    '--app-hairline': 'var(--ant-color-border-secondary)',
    '--app-overlay-mask-bg': isDark ? 'rgba(5, 10, 20, 0.48)' : 'rgba(15, 23, 42, 0.24)',
    '--app-overlay-blur': isDark ? '14px' : '12px',

    '--app-font-family-heading': skin.fontFamilyHeading,
    '--app-font-weight-body': `${custom?.fontWeightBody ?? 400}`,
    '--app-font-weight-heading': `${custom?.fontWeightHeading ?? 600}`,

    '--app-border-hover': 'var(--ant-color-border)',

    '--app-density-scale': `${densityScale}`,
    '--app-spacing-unit': `${Math.round(4 * densityScale)}px`,
    '--app-card-gap': `${Math.round(16 * densityScale)}px`,
    '--app-card-padding': `${Math.round(16 * densityScale)}px`,
    '--app-section-gap': `${Math.round(24 * densityScale)}px`,

    '--app-motion-duration': reducedMotion ? '0s' : skin.motionDurationMid,
    '--app-motion-duration-slow': reducedMotion ? '0s' : skin.motionDurationSlow,
    '--app-motion-duration-fast': reducedMotion ? '0s' : skin.motionDurationFast,
  };
}
