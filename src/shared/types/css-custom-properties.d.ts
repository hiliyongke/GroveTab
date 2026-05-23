/**
 * CSS 自定义属性类型扩展
 *
 * 扩展 React 的 CSSProperties 接口以支持
 * 以 `--app-` 和 `--insights-` 和 `--speed-dial-` 和 `--appearance-` 和 `--about-` 和 `--devtools-`
 * 为前缀的 CSS 自定义属性。
 *
 * 这消除了在代码中使用 `as string` 或 `as CSSProperties`
 * 非安全类型断言的需要。
 */

import 'react';

declare module 'react' {
  interface CSSProperties {
    // ── 应用级 CSS 自定义属性 ─────────────────────

    /** 背景遮罩层背景色 */
    '--app-background-overlay-bg'?: string;
    /** 背景遮罩层滤镜效果 */
    '--app-background-overlay-filter'?: string;
    /** 内容区最大宽度（px） */
    '--app-content-max-width'?: string;
    /** 域名视图列数 */
    '--app-domain-column-count'?: string;
    /** 域名视图列宽 */
    '--app-domain-column-width'?: string;
    /** 标签文本宽度 */
    '--app-tab-text-width'?: string;
    /** 标签文本 z-index */
    '--app-tab-text-z'?: string;
    /** 标签文本圆角 */
    '--app-tab-text-radius'?: string;
    /** 标签文本阴影 */
    '--app-tab-text-shadow'?: string;
    /** 标签文本标签背景 */
    '--app-tab-text-tag-bg'?: string;
    /** 批量操作栏 z-index */
    '--app-batch-bar-z'?: string;
    /** 批量操作栏危险图标颜色 */
    '--app-batch-bar-danger-icon'?: string;
    /** 批量操作栏丢弃图标颜色 */
    '--app-batch-bar-discard-icon'?: string;
    /** 行悬停背景色 */
    '--app-row-hover-bg'?: string;
    /** 选中标签背景色 */
    '--app-tab-selected-bg'?: string;
    /** 标签文本颜色 */
    '--app-tab-text'?: string;
    /** 标签辅助文本颜色 */
    '--app-tab-text-tertiary'?: string;
    /** 标签主色调 */
    '--app-tab-primary'?: string;
    /** 标签 fallback 背景色 */
    '--app-tab-fallback-bg'?: string;
    /** 标签项标签背景 */
    '--app-tab-item-tag-bg'?: string;

    // ── 看板相关 CSS 自定义属性 ─────────────────────

    /** 看板来源区域背景 */
    '--app-kanban-source-bg'?: string;
    /** 看板表面背景 */
    '--app-kanban-surface-bg'?: string;
    /** 看板边框颜色 */
    '--app-kanban-border'?: string;
    /** 看板列背景 */
    '--app-kanban-column-bg'?: string;
    /** 看板列悬停背景 */
    '--app-kanban-column-hover-bg'?: string;
    /** 看板浮层边框 */
    '--app-kanban-overlay-border'?: string;
    /** 看板浮层阴影 */
    '--app-kanban-overlay-shadow'?: string;

    // ── 通用主题色 ─────────────────────────────

    /** 主题色 */
    '--app-color'?: string;
    /** 主题悬停色 */
    '--app-color-hover'?: string;
    /** 悬停边框色 */
    '--app-hover-border'?: string;

    // ── 域名卡片相关 ────────────────────────────

    /** 域名卡片圆角 */
    '--app-domain-card-radius'?: string;
    /** 域名卡片色条 */
    '--app-domain-card-bar'?: string;
    /** 域名卡片徽章背景 */
    '--app-domain-card-badge-bg'?: string;
    /** 域名卡片头部边框 */
    '--app-domain-card-header-border'?: string;
    /** 域名卡片折叠箭头颜色 */
    '--app-domain-card-chevron-color'?: string;
    /** 域名卡片标题颜色 */
    '--app-domain-card-title-color'?: string;

    // ── 网格视图相关 ────────────────────────────

    /** 网格卡片强调色 */
    '--app-grid-card-accent'?: string;
    /** 网格浮层强调色 */
    '--app-grid-popover-accent'?: string;

    // ── 洞察面板 CSS 自定义属性 ────────────────────

    /** 洞察面板轨道背景 */
    '--insights-track-bg'?: string;
    /** 洞察面板进度条填充色 */
    '--insights-bar-fill'?: string;
    /** 洞察面板进度条宽度 */
    '--insights-bar-width'?: string;

    // ── 常用站点 CSS 自定义属性 ────────────────────

    /** 常用站点分组强调色 */
    '--speed-dial-group-accent'?: string;
    /** 常用站点卡片强调色 */
    '--speed-dial-card-accent'?: string;
    /** 常用站点卡片透明度 */
    '--speed-dial-card-opacity'?: string;
    /** 常用站点卡片最小宽度（用于尺寸档位与 auto 自适配） */
    '--speed-dial-card-min-width'?: string;

    // ── 外观设置面板 CSS 自定义属性 ─────────────────

    /** 外观设置面板预览背景 */
    '--appearance-preview-bg'?: string;
    /** 外观设置面板编辑图标颜色 */
    '--appearance-edit-icon'?: string;

    // ── 关于面板 CSS 自定义属性 ─────────────────────

    /** 关于面板功能高亮色 */
    '--about-feature-color'?: string;

    // ── 开发者工具页面 CSS 自定义属性 ───────────────

    /** 开发者工具页面颜色样本背景 */
    '--devtools-color-swatch-bg'?: string;
  }
}
