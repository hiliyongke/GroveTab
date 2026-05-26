import type { ThemeConfig } from "antd";
import { theme as antdTheme } from "antd";
import type { UserSettings } from "@/shared/types";
import { getSkinPreset, type SkinPreset, type SkinPresetId } from "./skin-presets";

export type LayoutDensity = NonNullable<UserSettings["layoutDensity"]>;
export type SkinCustomOverride = NonNullable<UserSettings["skinCustom"]>;
export type AppThemeVars = Record<`--app-${string}`, string>;

const BASE_BODY_FONT_SIZE = 14;
const DENSITY_SCALE_MAP: Record<LayoutDensity, number> = {
  compact: 0.85,
  default: 1,
  comfortable: 1.15,
};

function scaleByDensity(value: number, density: LayoutDensity): number {
  return Math.round(value * DENSITY_SCALE_MAP[density]);
}

function scaleHeadingFont(baseSize: number, bodyFontSize: number): number {
  return Math.round((baseSize / BASE_BODY_FONT_SIZE) * bodyFontSize);
}

function resolvePrimaryHoverColor(base: SkinPreset, customColor?: string): string {
  if (!customColor) return base.colorPrimaryHover;
  return `color-mix(in srgb, ${customColor} 78%, white)`;
}

function getDensityScale(density: LayoutDensity): number {
  return DENSITY_SCALE_MAP[density];
}

interface ThemeMaterialTokens {
  pageGradient: string;
  micaBase: string;
  micaSurface: string;
  micaTint: string;
  acrylicSurface: string;
  acrylicTint: string;
  acrylicBorder: string;
  acrylicHighlight: string;
  overlayMaskBg: string;
  overlayBlur: string;
}

function buildThemeMaterialTokens(
  skinId: SkinPresetId,
  isDark: boolean,
  skin: SkinPreset,
): ThemeMaterialTokens {
  const layout = isDark ? skin.colorBgLayoutDark : skin.colorBgLayoutLight;
  const container = isDark ? skin.colorBgContainerDark : skin.colorBgContainerLight;
  const elevated = isDark ? skin.colorBgElevatedDark : skin.colorBgElevatedLight;
  const border = isDark ? skin.colorBorderSecondaryDark : skin.colorBorderSecondaryLight;

  const base: ThemeMaterialTokens = {
    pageGradient: isDark
      ? `radial-gradient(circle at 16% -8%, color-mix(in srgb, ${skin.colorPrimary} 16%, transparent), transparent 34%), linear-gradient(180deg, ${layout} 0%, color-mix(in srgb, ${layout} 88%, #000 12%) 100%)`
      : `radial-gradient(circle at 18% -10%, color-mix(in srgb, ${skin.colorPrimary} 10%, transparent), transparent 34%), linear-gradient(180deg, ${layout} 0%, color-mix(in srgb, ${layout} 88%, #fff 12%) 100%)`,
    micaBase: layout,
    micaSurface: container,
    micaTint: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(255, 255, 255, 0.62)",
    acrylicSurface: elevated,
    acrylicTint: isDark ? "rgba(255, 255, 255, 0.055)" : "rgba(255, 255, 255, 0.70)",
    acrylicBorder: border,
    acrylicHighlight: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.86)",
    overlayMaskBg: isDark ? "rgba(5, 10, 20, 0.52)" : "rgba(15, 23, 42, 0.28)",
    overlayBlur: isDark ? "14px" : "12px",
  };

  switch (skinId) {
    case "minimal":
      return {
        ...base,
        pageGradient: isDark
          ? "radial-gradient(circle at 12% -10%, rgba(43, 107, 255, 0.18), transparent 34%), radial-gradient(circle at 88% 4%, rgba(126, 168, 255, 0.10), transparent 28%), linear-gradient(180deg, #0F1726 0%, #111B2D 54%, #0B1220 100%)"
          : "radial-gradient(circle at 12% -10%, rgba(43, 107, 255, 0.10), transparent 32%), radial-gradient(circle at 86% 2%, rgba(141, 178, 255, 0.12), transparent 30%), linear-gradient(180deg, #F7F9FE 0%, #F2F3F5 48%, #EEF2F8 100%)",
        acrylicBorder: isDark ? "rgba(173, 194, 227, 0.16)" : "rgba(43, 107, 255, 0.10)",
      };
    case "glassmorphism":
      return {
        ...base,
        pageGradient: isDark
          ? "radial-gradient(circle at 12% -8%, rgba(0, 120, 212, 0.16), transparent 34%), radial-gradient(circle at 88% 0%, rgba(96, 205, 255, 0.10), transparent 28%), linear-gradient(180deg, #202020 0%, #1B1B1B 52%, #171717 100%)"
          : "radial-gradient(circle at 10% -10%, rgba(0, 120, 212, 0.10), transparent 32%), radial-gradient(circle at 88% 2%, rgba(96, 205, 255, 0.12), transparent 28%), linear-gradient(180deg, #F7F7F7 0%, #F3F3F3 48%, #ECECEC 100%)",
        micaBase: isDark ? "#202020" : "#F3F3F3",
        micaSurface: isDark ? "#2B2B2B" : "#FDFDFD",
        acrylicSurface: isDark ? "#303030" : "#FFFFFF",
        acrylicBorder: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)",
        acrylicHighlight: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.92)",
      };
    case "skeuomorphism":
      return {
        ...base,
        pageGradient: isDark
          ? "radial-gradient(circle at 16% -10%, rgba(196, 163, 90, 0.14), transparent 34%), linear-gradient(180deg, #1A1610 0%, #211C15 54%, #15110C 100%)"
          : "radial-gradient(circle at 18% -10%, rgba(184, 149, 106, 0.18), transparent 34%), linear-gradient(180deg, #F4EBDD 0%, #E8E0D0 52%, #DED3BE 100%)",
        micaTint: isDark ? "rgba(196, 163, 90, 0.035)" : "rgba(255, 248, 232, 0.66)",
        acrylicTint: isDark ? "rgba(196, 163, 90, 0.055)" : "rgba(255, 248, 232, 0.76)",
        acrylicBorder: isDark ? "rgba(196, 163, 90, 0.18)" : "rgba(143, 110, 70, 0.18)",
        acrylicHighlight: isDark ? "rgba(255, 235, 196, 0.08)" : "rgba(255, 252, 242, 0.88)",
      };
    case "aurora":
      return {
        ...base,
        pageGradient: isDark
          ? "radial-gradient(circle at 16% -12%, rgba(155, 142, 196, 0.30), transparent 36%), radial-gradient(circle at 84% 4%, rgba(122, 191, 184, 0.20), transparent 30%), radial-gradient(circle at 48% 100%, rgba(168, 85, 247, 0.14), transparent 42%), linear-gradient(180deg, #0A0A14 0%, #10101D 52%, #07070F 100%)"
          : "radial-gradient(circle at 14% -10%, rgba(155, 142, 196, 0.18), transparent 34%), radial-gradient(circle at 88% 2%, rgba(122, 191, 184, 0.16), transparent 30%), linear-gradient(180deg, #FAF8FF 0%, #F3F0FF 48%, #ECE8FA 100%)",
        acrylicBorder: isDark ? "rgba(155, 142, 196, 0.22)" : "rgba(155, 142, 196, 0.18)",
        acrylicHighlight: isDark ? "rgba(205, 190, 255, 0.10)" : "rgba(255, 255, 255, 0.82)",
        overlayMaskBg: isDark ? "rgba(4, 4, 12, 0.66)" : "rgba(42, 30, 74, 0.30)",
      };
    case "elegant":
      return {
        ...base,
        pageGradient: isDark
          ? "radial-gradient(circle at 14% -10%, rgba(184, 168, 152, 0.10), transparent 34%), linear-gradient(180deg, #141412 0%, #1A1916 54%, #10100E 100%)"
          : "radial-gradient(circle at 16% -10%, rgba(139, 125, 107, 0.10), transparent 34%), linear-gradient(180deg, #FAF8F4 0%, #F0EBE3 52%, #E8E1D7 100%)",
        acrylicBorder: isDark ? "rgba(184, 168, 152, 0.14)" : "rgba(139, 125, 107, 0.16)",
        acrylicHighlight: isDark ? "rgba(255, 246, 226, 0.06)" : "rgba(255, 252, 246, 0.84)",
      };
    case "nord":
      return {
        ...base,
        pageGradient: isDark
          ? "radial-gradient(circle at 16% -10%, rgba(136, 192, 208, 0.16), transparent 34%), radial-gradient(circle at 88% 4%, rgba(94, 129, 172, 0.18), transparent 30%), linear-gradient(180deg, #2E3440 0%, #252B36 52%, #202630 100%)"
          : "radial-gradient(circle at 14% -10%, rgba(136, 192, 208, 0.18), transparent 34%), linear-gradient(180deg, #F4F7FB 0%, #ECEFF4 52%, #E3E8F1 100%)",
        acrylicBorder: isDark ? "rgba(136, 192, 208, 0.18)" : "rgba(94, 129, 172, 0.16)",
        acrylicHighlight: isDark ? "rgba(216, 222, 233, 0.08)" : "rgba(255, 255, 255, 0.78)",
      };
    case "solarized":
      return {
        ...base,
        pageGradient: isDark
          ? "radial-gradient(circle at 14% -10%, rgba(42, 161, 152, 0.16), transparent 34%), radial-gradient(circle at 88% 2%, rgba(181, 137, 0, 0.12), transparent 30%), linear-gradient(180deg, #002B36 0%, #073642 54%, #00212A 100%)"
          : "radial-gradient(circle at 12% -10%, rgba(61, 142, 185, 0.10), transparent 32%), radial-gradient(circle at 88% 2%, rgba(181, 137, 0, 0.12), transparent 30%), linear-gradient(180deg, #FFF9E8 0%, #FDF6E3 52%, #F4ECD5 100%)",
        acrylicBorder: isDark ? "rgba(131, 148, 150, 0.18)" : "rgba(147, 128, 74, 0.18)",
        acrylicHighlight: isDark ? "rgba(238, 232, 213, 0.07)" : "rgba(255, 252, 242, 0.82)",
      };
    case "pastel":
      return {
        ...base,
        pageGradient: isDark
          ? "radial-gradient(circle at 14% -12%, rgba(138, 148, 224, 0.34), transparent 36%), radial-gradient(circle at 86% 0%, rgba(240, 168, 192, 0.28), transparent 32%), radial-gradient(circle at 50% 104%, rgba(125, 211, 252, 0.12), transparent 44%), linear-gradient(180deg, #171019 0%, #21162A 52%, #130D17 100%)"
          : "radial-gradient(circle at 10% -10%, rgba(138, 148, 224, 0.24), transparent 34%), radial-gradient(circle at 88% 0%, rgba(240, 168, 192, 0.24), transparent 32%), radial-gradient(circle at 52% 102%, rgba(153, 246, 228, 0.18), transparent 42%), linear-gradient(180deg, #FFFDFC 0%, #FFF7F4 46%, #F7EEFF 100%)",
        micaBase: isDark ? "#171019" : "#FFF7F4",
        micaSurface: isDark ? "#241A28" : "#FFFDFB",
        micaTint: isDark ? "rgba(255, 220, 240, 0.045)" : "rgba(255, 255, 255, 0.76)",
        acrylicSurface: isDark ? "#302338" : "#FFFFFF",
        acrylicTint: isDark ? "rgba(255, 220, 240, 0.075)" : "rgba(255, 246, 252, 0.82)",
        acrylicBorder: isDark ? "rgba(255, 214, 235, 0.16)" : "rgba(138, 148, 224, 0.18)",
        acrylicHighlight: isDark ? "rgba(255, 220, 240, 0.12)" : "rgba(255, 255, 255, 0.94)",
        overlayMaskBg: isDark ? "rgba(18, 8, 22, 0.62)" : "rgba(97, 72, 118, 0.26)",
        overlayBlur: isDark ? "16px" : "14px",
      };
    case "apple":
      return {
        ...base,
        pageGradient: "none",
        micaTint: isDark ? "rgba(255, 255, 255, 0.035)" : "rgba(255, 255, 255, 0.74)",
        acrylicTint: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(255, 255, 255, 0.80)",
        acrylicBorder: isDark ? "rgba(255, 255, 255, 0.10)" : "rgba(0, 0, 0, 0.06)",
        acrylicHighlight: isDark ? "rgba(255, 255, 255, 0.07)" : "rgba(255, 255, 255, 0.94)",
        overlayMaskBg: isDark ? "rgba(0, 0, 0, 0.62)" : "rgba(0, 0, 0, 0.32)",
        overlayBlur: "16px",
      };
    default:
      return base;
  }
}

/**
 * 开启极客定制时，表单控件应回落到当前皮肤的基线值，而不是一组全局硬编码默认值。
 * 否则用户只要打开开关，就会瞬间把当前皮肤改造成另一套视觉体系。
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
    borderRadiusSM:
      borderRadius !== undefined ? Math.max(2, borderRadius - 2) : base.borderRadiusSM,
    borderRadiusXS:
      borderRadius !== undefined ? Math.max(1, borderRadius - 4) : base.borderRadiusXS,
    fontSize: fontSize ?? base.fontSize,
    controlHeight: controlHeight ?? base.controlHeight,
    controlHeightLG: controlHeight !== undefined ? controlHeight + 8 : base.controlHeightLG,
    controlHeightSM:
      controlHeight !== undefined ? Math.max(20, controlHeight - 8) : base.controlHeightSM,
    cardStyle: {
      ...base.cardStyle,
      borderWidth: borderWidth ?? base.cardStyle.borderWidth,
      hoverBorderWidth: borderWidth ?? base.cardStyle.hoverBorderWidth,
    },
  };
}

/**
 * Ant Design v6 官方推荐把主题定制收敛到 ConfigProvider.theme，
 * 由 seed token + component token 统一生成运行时样式，而不是到处覆盖 `.ant-*` 选择器。
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
    cssVar: { key: "app" },
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
      lineType: "solid",

      ...(isDark
        ? {
            colorBgContainer: skin.colorBgContainerDark,
            colorBgElevated: skin.colorBgElevatedDark,
            colorBgLayout: skin.colorBgLayoutDark,
            colorBgSpotlight: skinId === "apple" ? "#2c2c2e" : "#262629",
            colorBorderSecondary: skin.colorBorderSecondaryDark,
            colorText: skinId === "apple" ? "#ffffff" : "rgba(244, 248, 255, 0.92)",
            colorTextSecondary:
              skinId === "apple" ? "rgba(255, 255, 255, 0.7)" : "rgba(212, 223, 242, 0.78)",
            colorTextTertiary:
              skinId === "apple" ? "rgba(255, 255, 255, 0.48)" : "rgba(173, 194, 227, 0.58)",
            colorFillQuaternary:
              skinId === "apple" ? "rgba(255, 255, 255, 0.06)" : "rgba(154, 183, 229, 0.1)",
            colorFillTertiary:
              skinId === "apple" ? "rgba(255, 255, 255, 0.1)" : "rgba(154, 183, 229, 0.14)",
          }
        : {
            colorBgLayout: skin.colorBgLayoutLight,
            colorBgContainer: skin.colorBgContainerLight,
            colorBgElevated: skin.colorBgElevatedLight,
            colorBorderSecondary: skin.colorBorderSecondaryLight,
            colorText: skinId === "apple" ? "#1d1d1f" : "#1F2329",
            colorTextSecondary: skinId === "apple" ? "rgba(0, 0, 0, 0.8)" : "#646A73",
            colorTextTertiary: skinId === "apple" ? "rgba(0, 0, 0, 0.48)" : "#8F959E",
            colorFillQuaternary:
              skinId === "apple" ? "rgba(0, 0, 0, 0.04)" : "rgba(31, 35, 41, 0.04)",
            colorFillTertiary:
              skinId === "apple" ? "rgba(0, 0, 0, 0.06)" : "rgba(31, 35, 41, 0.06)",
          }),
    },
    components: {
      Card: {
        borderRadiusLG: skin.borderRadiusLG,
        paddingLG: scaleByDensity(20, density),
        boxShadowTertiary: isDark ? skin.shadow.card.dark : skin.shadow.card.light,
        headerBg: "transparent",
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
          ? "0 6px 16px rgba(6, 12, 24, 0.22)"
          : "0 4px 12px rgba(43, 107, 255, 0.08)",
      },
      Input: {
        borderRadius: skin.borderRadius,
        activeBorderColor: skin.colorPrimary,
        hoverBorderColor: skin.colorPrimaryHover,
        activeShadow: `0 0 0 3px ${skin.colorPrimary}1F`,
      },
      Layout: {
        headerBg: "transparent",
        bodyBg: "transparent",
        siderBg: "transparent",
        triggerBg: "transparent",
      },
      Segmented: {
        borderRadius: skin.borderRadius,
        borderRadiusSM: skin.borderRadiusSM,
        itemActiveBg: isDark
          ? skinId === "apple"
            ? "rgba(255, 255, 255, 0.1)"
            : "rgba(98, 140, 255, 0.18)"
          : skinId === "apple"
            ? "rgba(0, 0, 0, 0.06)"
            : "rgba(43, 107, 255, 0.14)",
        itemSelectedBg: isDark
          ? skinId === "apple"
            ? "rgba(255, 255, 255, 0.16)"
            : "rgba(98, 140, 255, 0.22)"
          : skinId === "apple"
            ? "#ffffff"
            : "#ffffff",
      },
      Tabs: {
        itemColor: isDark ? "rgba(212, 223, 242, 0.72)" : "#60708A",
        itemHoverColor: skin.colorPrimaryHover,
        itemSelectedColor: skin.colorPrimary,
        inkBarColor: skin.colorPrimary,
      },
      Tag: {
        borderRadiusSM: skin.borderRadiusXS,
      },
      Select: {
        optionSelectedBg: isDark
          ? skinId === "apple"
            ? "rgba(255, 255, 255, 0.1)"
            : "rgba(98, 140, 255, 0.18)"
          : skinId === "apple"
            ? "rgba(0, 113, 227, 0.08)"
            : "rgba(43, 107, 255, 0.1)",
      },
      Dropdown: {
        controlItemBgHover: isDark
          ? skinId === "apple"
            ? "rgba(255, 255, 255, 0.08)"
            : "rgba(98, 140, 255, 0.16)"
          : skinId === "apple"
            ? "rgba(0, 0, 0, 0.04)"
            : "rgba(43, 107, 255, 0.08)",
      },
      Tooltip: {
        colorBgSpotlight: isDark ? "rgba(18, 28, 44, 0.94)" : "rgba(24, 37, 59, 0.9)",
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
 * 业务层不应该直接消费 antd 内部 DOM 结构，因此这里把业务视觉原语桥接成 `--app-*` 变量：
 * 卡片阴影、毛玻璃、业务 hover、纹理等都只读这一层。
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
  const searchRadius =
    custom?.borderRadius !== undefined ? skin.borderRadiusLG : skin.searchBox.borderRadius;
  const floatingRadius =
    custom?.borderRadius !== undefined ? skin.borderRadiusLG : skin.floatingBar.borderRadius;

  const material = buildThemeMaterialTokens(skinId, isDark, skin);

  return {
    "--app-glass-blur": `${skin.glass.blur}px`,
    "--app-glass-saturate": `${skin.glass.saturate}%`,
    "--app-glass-bg": isDark ? skin.glass.bgDark : skin.glass.bgLight,
    "--app-page-gradient": material.pageGradient,
    "--app-glass-filter": `blur(${skin.glass.blur}px) saturate(${skin.glass.saturate}%)`,
    "--app-mica-bg": material.micaBase,
    "--app-mica-surface": material.micaSurface,
    "--app-mica-tint": material.micaTint,
    "--app-acrylic-bg": material.acrylicSurface,
    "--app-acrylic-tint": material.acrylicTint,
    "--app-acrylic-border": material.acrylicBorder,
    "--app-acrylic-highlight": material.acrylicHighlight,

    "--app-shadow-card": isDark ? skin.shadow.card.dark : skin.shadow.card.light,
    "--app-shadow-card-hover": isDark ? skin.shadow.cardHover.dark : skin.shadow.cardHover.light,
    "--app-shadow-floating": isDark ? skin.shadow.floating.dark : skin.shadow.floating.light,
    "--app-shadow-brand-glow": isDark ? skin.shadow.brandGlow.dark : skin.shadow.brandGlow.light,

    "--app-logo-gradient": custom?.colorPrimary
      ? `linear-gradient(135deg, ${skin.colorPrimary}, ${skin.colorPrimaryHover})`
      : skin.logoGradient,
    "--app-logo-glow": isDark ? skin.logoGlowShadow.dark : skin.logoGlowShadow.light,

    "--app-search-height": `${scaleByDensity(skin.searchBox.height, density)}px`,
    "--app-search-radius": `${searchRadius}px`,
    "--app-search-font-size": `${Math.round(skin.searchBox.fontSize * densityScale)}px`,

    "--app-header-height": `${scaleByDensity(skin.header.height, density)}px`,

    "--app-floating-radius": `${floatingRadius}px`,

    /* ── 统一圆角规范（所有组件必须使用这些变量）── */
    "--app-radius-xs": `${skin.borderRadiusXS}px`,
    "--app-radius-sm": `${skin.borderRadiusSM}px`,
    "--app-radius-md": `${skin.borderRadius}px`,
    "--app-radius-lg": `${skin.borderRadiusLG}px`,
    "--app-radius-pill": "980px",
    "--app-radius-circle": "50%",

    /* ── 统一间距规范（4px 基础单位，支持密度缩放）── */
    "--app-space-1": `calc(4px * ${densityScale})`,
    "--app-space-2": `calc(8px * ${densityScale})`,
    "--app-space-3": `calc(12px * ${densityScale})`,
    "--app-space-4": `calc(16px * ${densityScale})`,
    "--app-space-5": `calc(24px * ${densityScale})`,
    "--app-space-6": `calc(32px * ${densityScale})`,

    "--app-card-radius": `${skin.borderRadiusLG}px`,
    "--app-card-lift":
      skin.cardStyle.hoverLift && !reducedMotion ? `${skin.cardStyle.liftDistance}px` : "0px",

    "--app-texture-noise": skin.texture.noise ? "1" : "0",
    "--app-texture-noise-opacity": `${skin.texture.noiseOpacity}`,
    "--app-texture-grid": skin.texture.grid ? "1" : "0",
    "--app-texture-grid-color": isDark ? skin.texture.gridColor.dark : skin.texture.gridColor.light,

    "--app-brand": skin.colorPrimary,
    "--app-color-primary": skin.colorPrimary,
    "--app-color-primary-hover": skin.colorPrimaryHover,
    "--app-color-success": "var(--ant-color-success)",
    "--app-color-warning": "var(--ant-color-warning)",
    "--app-color-error": "var(--ant-color-error)",
    "--app-color-info": "var(--ant-color-info)",

    "--app-text-primary": "var(--ant-color-text)",
    "--app-text-secondary": "var(--ant-color-text-secondary)",
    "--app-text-tertiary": "var(--ant-color-text-tertiary)",
    "--app-surface-bg": "var(--ant-color-bg-container)",
    "--app-page-bg": material.micaBase,
    "--app-surface-elevated-bg": material.acrylicSurface,
    "--app-hairline": "var(--ant-color-border-secondary)",
    "--app-overlay-mask-bg": material.overlayMaskBg,
    "--app-overlay-blur": material.overlayBlur,

    "--app-font-family-heading": skin.fontFamilyHeading,
    "--app-font-weight-body": `${custom?.fontWeightBody ?? 400}`,
    "--app-font-weight-heading": `${custom?.fontWeightHeading ?? 600}`,

    "--app-border-hover": "var(--ant-color-border)",

    "--app-density-scale": `${densityScale}`,
    "--app-spacing-unit": `${Math.round(4 * densityScale)}px`,
    "--app-card-gap": `${Math.round(16 * densityScale)}px`,
    "--app-card-padding": `${Math.round(16 * densityScale)}px`,
    "--app-section-gap": `${Math.round(24 * densityScale)}px`,

    "--app-motion-duration": reducedMotion ? "0s" : skin.motionDurationMid,
    "--app-motion-duration-slow": reducedMotion ? "0s" : skin.motionDurationSlow,
    "--app-motion-duration-fast": reducedMotion ? "0s" : skin.motionDurationFast,
  };
}
