---
name: GroveTab UI/UX 深度优化计划
overview: 全面审查并修复 GroveTab 项目中的排版错位、间距不均、视觉缺陷、响应式布局及交互反馈问题，提升整体 UI 一致性与美观度。
todos:
  - id: fix-core-layout
    content: 重构 DomainGroupCard 头部为 flex 布局并修复 TabItem 行间距与选中态
    status: completed
  - id: unify-visual-system
    content: 统一卡片阴影圆角体系并优化 GridView/QuickStart 响应式布局
    status: completed
    dependencies:
      - fix-core-layout
  - id: enhance-responsive
    content: 增强全局响应式断点并修复顶栏与内容区适配
    status: completed
  - id: polish-interactions
    content: 完善全局交互状态并修复搜索框与设置面板样式细节
    status: completed
    dependencies:
      - fix-core-layout
      - enhance-responsive
---

## Product Overview

GroveTab is a Chrome new tab page extension with multiple tab management views (domain grouping, grid, compact list, timeline, kanban, bookmarks, etc.). The user requests a comprehensive UI audit and deep optimization to fix typography issues, visual defects, responsive layout problems, and incomplete interaction states.

## Core Features

- Fix layout misalignment, uneven spacing, and abnormal alignment across all views
- Repair visual defects of UI components and unify colors, fonts, and icon styles
- Optimize responsive layout for various screen sizes
- Enhance visual feedback for interaction states (hover, focus, active)
- Ensure overall UI consistency and eliminate unexpected visual behavior

## Tech Stack

- Frontend: React 19 + TypeScript + Vite
- UI Framework: Ant Design v6
- State Management: Zustand
- Styling: CSS Modules (.module.less) + CSS Variables
- Icons: Lucide React

## Implementation Approach

The optimization follows a systematic approach: first fix critical layout issues (overlapping buttons, uneven masonry gaps), then unify the visual design system (shadows, radii, spacing rhythm), then enhance responsiveness with additional breakpoints, and finally polish interaction states. All changes respect the existing architecture and design token system.

### Key Technical Decisions

1. **Flexbox over absolute positioning**: Replace absolute-positioned action buttons in DomainGroupCard header with a flex-based layout to prevent overlap with long domain titles
2. **CSS variable consistency**: Audit all `--app-color-primary` usages to ensure fallback to `--ant-color-primary` where missing; unify card shadow/radius tokens
3. **Progressive enhancement for responsive**: Add 1024px and 1440px breakpoints alongside the existing 768px breakpoint for finer control
4. **State completeness**: Add `:active` and `:focus-visible` states to all interactive primitives (cards, rows, sidebar items, buttons) following the existing `.app-row-hover` and `.app-card-interactive` patterns

### Architecture Design

The changes are localized to stylesheet and minor JSX adjustments across three layers:

- **Shell layer** (`app-shell.module.less`, `index.module.less`): Global layout, responsive breakpoints, interaction primitives
- **Feature layer** (`items.module.less`, `views.module.less`, `tidy-suggestion.module.less`, `QuickStartLayer.module.less`): View-specific layouts and component styling
- **Component layer** (`DomainGroupCard.tsx`, `SearchBox.module.less`, `settings.module.less`): Individual component layout fixes

### Directory Structure

```
src/
├── features/
│   ├── tabs/
│   │   ├── DomainGroupCard.tsx          # [MODIFY] Refactor header to flex layout
│   │   └── styles/
│   │       ├── items.module.less        # [MODIFY] Fix header padding, tab gaps, selected state
│   │       ├── views.module.less        # [MODIFY] Unify card shadows, GridView responsive
│   │       └── tidy-suggestion.module.less # [MODIFY] Enhance interaction states
│   ├── quick-start/
│   │   └── QuickStartLayer.module.less  # [MODIFY] Unify card tokens, spacing rhythm
│   ├── search/
│   │   └── SearchBox.module.less        # [MODIFY] Responsive width, item hover states
│   └── settings/
│       └── settings.module.less         # [MODIFY] Field alignment, interaction states
└── pages/newtab/
    ├── index.module.less                # [MODIFY] Add active states, fix focus-visible
    └── styles/
        └── app-shell.module.less        # [MODIFY] Add breakpoints, fix header/content responsive
```

### Implementation Notes

- **Performance**: All style changes are CSS-only (no new JS dependencies). Avoid layout thrashing by not changing `width/height` on hover — continue using `transform` and `box-shadow`.
- **Backward compatibility**: All CSS variable changes include fallbacks. Skin-specific overrides (Apple, glassmorphism) are preserved.
- **Blast radius control**: The DomainGroupCard header refactor is the only JSX change; all other modifications are style-only to minimize regression risk.
- **Testing verification**: After each batch, verify at 375px, 768px, 1024px, and 1440px viewports.

## Agent Extensions

### Skill

- **ui-ux-pro-max**
- Purpose: Provide design system guidance for spacing rhythm, responsive breakpoints, and interaction state patterns to ensure professional UI quality
- Expected outcome: Design recommendations for consistent 8px grid spacing, optimal breakpoint values, and hover/focus/active state specifications

### SubAgent

- **code-explorer**
- Purpose: Locate all CSS class usages across the project to ensure style changes do not miss dependent components
- Expected outcome: Complete reference map of which components use `.app-card-interactive`, `.app-row-hover`, and other shared primitives
