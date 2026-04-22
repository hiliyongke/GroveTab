# Phase 1: 项目脚手架 - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

搭建可运行的 Chrome MV3 扩展开发环境：Vite + CRXJS + React 18 + TypeScript + Tailwind CSS。确保 `pnpm dev` 能热更新加载扩展到 Chrome，新标签页显示占位页面。

</domain>

<decisions>
## Implementation Decisions

### 构建工具
- **D-01:** 使用 Vite 8 + 自定义 Chrome 扩展 Vite 插件 作为构建工具（MV3 多入口构建 + HMR 支持）；CRXJS / wxt.dev 作为备选方案
- **D-02:** 包管理器使用 pnpm

### 框架与语言
- **D-03:** React 19 + TypeScript 6（strict 模式）
- **D-04:** 状态管理使用 Zustand 4

### 样式
- **D-05:** Tailwind CSS 4 + CSS Variables（主题切换通过 CSS var）
- **D-06:** 动画使用 Motion 12 库(代替 Framer Motion)
- **D-07:** 图标使用 Lucide React

### 扩展配置
- **D-08:** Manifest V3，权限：tabs / storage / favicon / alarms / sessions / contextMenus
- **D-09:** optional_permissions: ["history"]（频率视图可选授权）
- **D-10:** host_permissions 默认为空（避免商店审核风险）
- **D-11:** optional_host_permissions: ["<all_urls>"]（P2 全文检索按需申请）
- **D-12:** incognito: "split"（无痕窗口独立实例）

### 文件结构
- **D-13:** 遵循 PRD §14.1 定义的文件结构（src/pages / src/features / src/shared / src/store / src/services / src/repositories / src/chrome / src/sw）

### 测试
- **D-14:** 单元测试 Vitest + React Testing Library
- **D-15:** E2E 用 Playwright（Phase 10 完善，Phase 1 只搭框架）

### 代码规范
- **D-16:** ESLint（airbnb-base + @typescript-eslint）+ Prettier
- **D-17:** Conventional Commits
- **D-18:** Git 分支：main（稳定）/ dev（开发）/ feat/* / fix/*

### 国际化
- **D-19:** 使用 _locales 体系，初始化 zh-CN + en 两个语言包

### Claude's Discretion
- 具体依赖版本号的选择
- CRXJS 配置细节
- Tailwind 配置细节（Design Token 在 Phase 6 完善，Phase 1 只搭基础）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 项目规范
- `docs/PRD.md` §5.2 (Manifest & 权限)、§8.1 (技术栈)、§14.1 (文件结构)、§14.2 (代码规范)、§14.3 (版本与发布)
- `.planning/PROJECT.md` — 项目核心约束与技术栈
- `.planning/REQUIREMENTS.md` — 需求可追溯性
- `.planning/ROADMAP.md` — Phase 1 详细描述

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `docs/PRD.md` — 包含完整的 manifest.json 模板和文件结构定义

### Established Patterns
- Greenfield 项目，无既有模式

### Integration Points
- manifest.json → Chrome 扩展入口
- src/sw/index.ts → Service Worker 入口
- src/pages/newtab/ → 新标签页入口

</code_context>

<specifics>
## Specific Ideas

- 新标签页占位页面只需显示 "Canopy" logo + 简单欢迎文案，验证接管成功即可
- SW 最小实现：监听 chrome.runtime.onInstalled，console.log 确认运行

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-项目脚手架*
*Context gathered: 2026-04-22*
