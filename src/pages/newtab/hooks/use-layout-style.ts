import { useState, useMemo, type CSSProperties } from "react";
import { resolveGradient } from "@/shared/theme/gradient-presets";
import { cssVars } from "@/shared/utils/css-vars";
import { useResolvedTheme } from "@/shared/hooks";
import type { UserSettings } from "@/shared/types/settings";

interface LayoutStyleOptions {
  gradientPreset: UserSettings["gradientPreset"];
  customGradient: UserSettings["customGradient"];
  backgroundImage: UserSettings["backgroundImage"];
  backgroundOverlay: UserSettings["backgroundOverlay"];
  contentMaxWidth: number;
}

interface LayoutStyleResult {
  /** Layout 根节点背景样式 */
  layoutStyle: CSSProperties;
  /** 背景遮罩层 CSS 变量样式（overlay 未启用时为 undefined） */
  overlayStyle: CSSProperties | undefined;
  /** 内容区最大宽度 CSS 变量样式（未限制时为 undefined） */
  contentShellStyle: CSSProperties | undefined;
  /** 滚动进度 0~1，供调用方绑定到 onScroll */
  scrollProgress: number;
  /** 更新滚动进度的回调 */
  setScrollProgress: (progress: number) => void;
}

/**
 * useLayoutStyle —— 计算页面背景、遮罩、内容区宽度等布局样式。
 *
 * 将所有 useMemo 缓存的样式对象集中管理，避免 AppContent 中散落多处。
 */
export function useLayoutStyle({
  gradientPreset,
  customGradient,
  backgroundImage,
  backgroundOverlay,
  contentMaxWidth,
}: LayoutStyleOptions): LayoutStyleResult {
  const resolvedDark = useResolvedTheme() === "dark";
  const [scrollProgress, setScrollProgress] = useState(0);

  const layoutBackground = resolveGradient(gradientPreset, resolvedDark, customGradient);

  const layoutStyle = useMemo<CSSProperties>(() => {
    const style: CSSProperties = {
      minHeight: "100vh",
      background: layoutBackground,
      position: "relative",
    };

    if (backgroundImage?.url) {
      const isEmbeddedImage =
        backgroundImage.url.startsWith("data:") || backgroundImage.url.startsWith("blob:");
      style.backgroundImage = `url("${backgroundImage.url}")`;
      style.backgroundSize = backgroundImage.fit === "repeat" ? "auto" : backgroundImage.fit;
      style.backgroundRepeat = backgroundImage.fit === "repeat" ? "repeat" : "no-repeat";
      style.backgroundPosition = backgroundImage.position ?? "center";
      style.backgroundAttachment = isEmbeddedImage ? "scroll" : "fixed";
      style.backgroundColor = layoutBackground;
    }

    return style;
  }, [layoutBackground, backgroundImage]);

  const overlayBlur = Math.min(Math.max(backgroundOverlay?.blur ?? 0, 0), 12);
  const overlayStyle = useMemo<CSSProperties | undefined>(() => {
    if (!backgroundOverlay?.enabled) return undefined;

    const dynamicBlur = overlayBlur + scrollProgress * 8;
    const dynamicOpacity = Math.min(0.8, scrollProgress * 0.4);

    return cssVars({
      "--app-background-overlay-bg": resolvedDark
        ? backgroundOverlay.colorDark
        : backgroundOverlay.color,
      "--app-background-overlay-filter": dynamicBlur > 0 ? `blur(${dynamicBlur}px)` : "none",
      "--app-background-overlay-opacity": `${dynamicOpacity}`,
    });
  }, [backgroundOverlay, resolvedDark, overlayBlur, scrollProgress]);

  const contentShellStyle = useMemo<CSSProperties | undefined>(
    () =>
      contentMaxWidth > 0
        ? cssVars({ "--app-content-max-width": `${contentMaxWidth}px` })
        : undefined,
    [contentMaxWidth],
  );

  return {
    layoutStyle,
    overlayStyle,
    contentShellStyle,
    scrollProgress,
    setScrollProgress,
  };
}
