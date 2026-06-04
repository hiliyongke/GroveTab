import { useMemo, type CSSProperties } from "react";
import { cssVars } from "@/shared/utils/css-vars";

interface LayoutStyleOptions {
  contentMaxWidth: number;
}

interface LayoutStyleResult {
  /** Layout 根节点背景样式 */
  layoutStyle: CSSProperties;
  /** 内容区最大宽度 CSS 变量样式（未限制时为 undefined） */
  contentShellStyle: CSSProperties | undefined;
}

/**
 * useLayoutStyle —— 计算页面背景、内容区宽度等布局样式。
 *
 * 页面背景由当前皮肤的 --app-page-gradient CSS 变量控制，
 * 由 AntdThemeProvider 在切换皮肤时注入到 document.documentElement。
 */
export function useLayoutStyle({
  contentMaxWidth,
}: LayoutStyleOptions): LayoutStyleResult {
  const layoutStyle = useMemo<CSSProperties>(() => ({
    minHeight: "100vh",
    background: "var(--app-page-gradient, var(--ant-color-bg-layout))",
    position: "relative" as const,
  }), []);

  const contentShellStyle = useMemo<CSSProperties | undefined>(
    () =>
      contentMaxWidth > 0
        ? cssVars({ "--app-content-max-width": `${contentMaxWidth}px` })
        : undefined,
    [contentMaxWidth],
  );

  return {
    layoutStyle,
    contentShellStyle,
  };
}
