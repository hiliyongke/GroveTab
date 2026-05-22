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
    /** 应用级 CSS 自定义属性 */
    '--app-background-overlay-bg'?: string;
    '--app-background-overlay-filter'?: string;
    '--app-content-max-width'?: string;
    '--app-domain-column-count'?: string;
    '--app-domain-column-width'?: string;
    '--app-tab-context-width'?: string;
    '--app-tab-context-z'?: string;
    '--app-tab-context-radius'?: string;
    '--app-tab-context-shadow'?: string;
    '--app-tab-context-tag-bg'?: string;
    '--app-batch-bar-z'?: string;
    '--app-batch-bar-danger-icon'?: string;
    '--app-batch-bar-discard-icon'?: string;
    '--app-row-hover-bg'?: string;
    '--app-tab-selected-bg'?: string;
    '--app-tab-text'?: string;
    '--app-tab-text-tertiary'?: string;
    '--app-tab-primary'?: string;
    '--app-tab-fallback-bg'?: string;
    '--app-tab-item-tag-bg'?: string;
    '--app-kanban-source-bg'?: string;
    '--app-kanban-surface-bg'?: string;
    '--app-kanban-border'?: string;
    '--app-kanban-column-bg'?: string;
    '--app-kanban-column-hover-bg'?: string;
    '--app-kanban-overlay-border'?: string;
    '--app-kanban-overlay-shadow'?: string;
    '--app-color'?: string;
    '--app-color-hover'?: string;
    '--app-hover-border'?: string;
    '--app-domain-card-radius'?: string;
    '--app-domain-card-bar'?: string;
    '--app-domain-card-badge-bg'?: string;
    '--app-domain-card-header-border'?: string;
    '--app-domain-card-chevron-color'?: string;
    '--app-domain-card-title-color'?: string;
    '--app-grid-card-accent'?: string;
    '--app-grid-popover-accent'?: string;

    /** 洞察面板 CSS 自定义属性 */
    '--insights-track-bg'?: string;
    '--insights-bar-fill'?: string;
    '--insights-bar-width'?: string;

    /** 常用站点 CSS 自定义属性 */
    '--speed-dial-group-accent'?: string;
    '--speed-dial-card-accent'?: string;
    '--speed-dial-card-opacity'?: string;
    /** 常用站点卡片最小宽度（用于尺寸档位与 auto 自适配） */
    '--speed-dial-card-min-width'?: string;

    /** 外观设置面板 CSS 自定义属性 */
    '--appearance-preview-bg'?: string;
    '--appearance-edit-icon'?: string;

    /** 关于面板 CSS 自定义属性 */
    '--about-feature-color'?: string;

    /** 开发者工具页面 CSS 自定义属性 */
    '--devtools-color-swatch-bg'?: string;
  }
}
