/**
 * 统一主题 Token 映射
 *
 * 所有硬编码的布局值（间距、圆角、字号、色值）均通过 antd Token 获取，
 * 皮肤可通过 ConfigProvider 的 theme.token 覆盖实现全局统一。
 *
 * 使用方式：
 *   const { token } = theme.useToken();
 *   const layout = useLayoutToken(token);
 *   <div style={{ padding: layout.viewPadding }}>
 */

import { useMemo } from "react";

/** 视图级布局 Token */
export interface LayoutToken {
  /** 视图外层 padding（上下-左右）: "12px 16px 32px" */
  viewPadding: string;
  /** 卡片间距 */
  cardGap: number;
  /** 列表项间距 */
  itemGap: number;
  /** 操作按钮间距 */
  actionGap: number;
  /** 卡片头部高度 */
  headerHeight: number;
  /** Badge 大小 */
  badgeSize: number;
  /** 卡片圆角 */
  cardRadius: number;
  /** 列表项最小高度 */
  itemMinHeight: number;
  /** 标签栏宽度（折叠态） */
  tabCollapsedWidth: number;
  /** 标签栏展开最小宽 */
  tabExpandedMinWidth: number;
}

/**
 * 从 antd Token 推导出项目专属布局 Token
 */
export function useLayoutToken(token: { padding: number; borderRadiusLG: number; controlHeightSM: number }): LayoutToken {
  return useMemo<LayoutToken>(() => {
    const pad = token.padding;           // antd 默认 16
    const rad = token.borderRadiusLG;    // antd 默认 8
    return {
      viewPadding: `12px ${pad}px 32px`,
      cardGap: pad === 16 ? 12 : pad - 4,
      itemGap: 6,
      actionGap: 4,
      headerHeight: 48,
      badgeSize: 28,
      cardRadius: rad,
      itemMinHeight: 40,
      tabCollapsedWidth: 52,
      tabExpandedMinWidth: 120,
    };
  }, [token.padding, token.borderRadiusLG]);
}
