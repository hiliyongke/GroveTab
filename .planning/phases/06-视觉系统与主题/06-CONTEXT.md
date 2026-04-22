# Phase 6: 视觉系统 + 主题 - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

毛玻璃+渐变视觉完整落地，亮暗切换，A11y + i18n 基线。涵盖 VISUAL-01~06、A11Y-01~03、I18N-01~02。

</domain>

<decisions>
## Implementation Decisions

### 渐变背景方案
- **D-01:** 三套预设渐变由 Claude 定（确保风格差异明显且与毛玻璃搭配好看）
  - Aurora: 当前风格扩展，冷调极光感
  - Sunrise: 暖调日出感
  - Deep Space: 深色调宇宙感
- **D-02:** 自定义渐变交互由 Claude 定（保持操作简单）
- **D-03:** 渐变背景加缓慢流动动画（30-60s cycle），让背景有生命力

### 主题切换机制
- **D-04:** 主题切换架构由 Claude 定（必须无 FOUC）
- **D-05:** 亮色主题毛玻璃卡片风格由 Claude 定（确保亮暗下都美观可读）
- **D-06:** Header 加主题切换图标按钮（日/月/自动循环）+ 设置面板都做入口

### 动效体系
- **D-07:** Tab 进出场动画级别由 Claude 定（兼顾美观和性能）
- **D-08:** 视图切换过渡由 Claude 定（确保自然不突兀，为 Phase 7 多视图做准备）
- **D-09:** prefers-reduced-motion 处理由 Claude 定（确保 a11y 合规）

### A11y + i18n
- **D-10:** 焦点态样式由 Claude 定（确保视觉清晰，需满足 A11Y-02 的 2px 高对比外描边）
- **D-11:** i18n 实现方式由 Claude 定（Chrome 扩展场景够用就行）
- **D-12:** i18n 范围由 Claude 定（确保基座稳固，现有文案翻译可渐进补全）

### Claude's Discretion
- 三套预设渐变的具体色值和角度
- 自定义渐变选择器交互细节
- 主题 CSS 变量体系设计（亮/暗色 token 映射）
- 亮色主题毛玻璃卡片透明度、边框、阴影参数
- Tab 动画 spring 参数、stagger 延迟
- 视图切换 AnimatePresence 配置
- reduced-motion 的具体阈值和规则
- 焦点态 outline 样式细节
- i18n hook API 设计和字典结构
- 具体哪些现有文案需要在 Phase 6 翻译

### Folded Todos
(No todos folded into this phase)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 项目规范
- `docs/PRD.md` §7 (视觉系统)、§9 (可访问性)、§10 (国际化)、§14.1 (文件结构)
- `.planning/PROJECT.md` — 项目核心约束与技术栈
- `.planning/REQUIREMENTS.md` — VISUAL-01~06, A11Y-01~03, I18N-01~02
- `.planning/ROADMAP.md` — Phase 6 详细描述
- `.planning/phases/01-项目脚手架/01-CONTEXT.md` — Phase 1 决策（CSS Variables 策略、Design Token 在 Phase 6 完善）

### 代码参考
- `src/pages/newtab/index.css` — 当前 CSS 变量定义和渐变背景
- `src/shared/types.ts` — UserSettings 类型定义（theme / gradientPreset / language 字段）
- `src/store/settings-slice.ts` — 设置状态管理
- `src/shared/ui/Header.tsx` — 现有 Header 组件（需加主题切换按钮）
- `src/shared/ui/UndoToast.tsx` — 现有 Toast 组件（需适配主题）
- `src/features/tabs/TabItem.tsx` — 现有 Tab 卡片（硬编码白色/透明样式需改为 CSS 变量）
- `src/features/tabs/DomainGroupCard.tsx` — 现有分组卡片（同上）
- `public/_locales/zh_CN/messages.json` — 现有中文 locale
- `public/_locales/en/messages.json` — 现有英文 locale

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/pages/newtab/index.css` @theme 块: 已有 `--color-primary`, `--color-secondary`, `--radius-sm/md/lg`, `--font-family-sans`, `--blur-card` 基础 tokens，Phase 6 需大幅扩展
- `src/shared/types.ts` UserSettings: `theme`, `gradientPreset`, `language` 字段已定义，无需修改类型
- `src/store/settings-slice.ts`: 已有 `updateSettings` action，可直接调用切换主题/渐变/语言
- `public/_locales/`: _locales 目录结构已建立，仅 5 条 manifest 用文案

### Established Patterns
- Tailwind CSS v4 CSS-first config: `@import 'tailwindcss'` + `@theme` 块定义 tokens，无 tailwind.config.ts
- 毛玻璃样式统一模式: `bg-white/15 hover:bg-white/25 backdrop-blur-xl border border-white/20`（硬编码，需改为 CSS 变量）
- 组件用 Lucide React 图标，Zustand 管理状态
- `motion` 库已安装但未使用（原 Framer Motion，v12.38）

### Integration Points
- `src/pages/newtab/App.tsx` — 主入口，需注入主题初始化逻辑（防 FOUC）
- `src/pages/newtab/index.css` — Design Token 扩展点
- `src/shared/ui/Header.tsx` — 主题切换按钮挂载点
- `src/store/settings-slice.ts` — 主题/渐变/语言设置持久化
- `public/_locales/` — Chrome i18n 消息文件
- `src/shared/i18n/` — 空目录，i18n 运行时模块挂载点

</code_context>

<specifics>
## Specific Ideas

- 渐变流动动画用 CSS `@keyframes` + `background-size: 200%` + `background-position` 动画实现（纯 CSS 方案，不依赖 JS）
- 无 FOUC 方案：在 `index.html` 的 `<head>` 中注入内联脚本，在 React 渲染前读取 storage 并设置 `data-theme` 属性
- 亮色主题毛玻璃卡片参考 macOS 浅色毛玻璃效果（白底 + 微阴影 + 半透明）
- i18n 采用自建轻量方案（useT hook + 字典对象），避免引入重依赖
- A11y 焦点态使用 `outline` 而非 `border`（避免影响布局），2px solid 配合 `outline-offset`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-视觉系统与主题*
*Context gathered: 2026-04-22*
