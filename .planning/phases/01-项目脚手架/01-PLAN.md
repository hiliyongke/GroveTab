# Phase 1 PLAN — 项目脚手架

**Created:** 2026-04-22

## 1. Phase 目标

- 搭建可运行的 Chrome MV3 扩展开发环境
- 使用 Vite 8 + 自定义 Chrome 扩展 Vite 插件 完成多入口构建
- 使用 React 19 + TypeScript 6 建立基础应用骨架
- 打通新标签页入口,`pnpm dev` 下可热更新
- 完成基础工程化(ESLint/Prettier/Vitest/_locales)

## 2. 非目标(Out of Scope)

- 不在本阶段实现完整视觉系统(渐变/动效/Design Token 放到 Phase 6)
- 不在本阶段实现复杂业务功能(搜索/去重/归档等放到后续 Phase)
- 不在本阶段引入 E2E 测试用例(仅搭建框架,具体用例放到 Phase 10)

## 3. Wave 划分

### Wave 1: 工程脚手架与多入口构建

**目标:** 让扩展在开发环境下可被 Chrome 加载,多入口(新标签页/Popup/SW)编译正常。

**Tasks:**
- Task 1: 初始化仓库
  - 使用 pnpm 初始化项目
  - 创建 `package.json` 并写入基础脚本(`dev`/`build`/`test` 等)
- Task 2: 配置 Vite 8
  - 新建 `vite.config.ts`
  - 引入并配置自定义 `chromeExtensionPlugin`,支持 newtab / popup / sw 多入口构建
  - 配置别名与基础输出结构
- Task 3: 创建基础目录结构
  - 建立 `src/pages`, `src/features`, `src/shared`, `src/store`, `src/services`, `src/repositories`, `src/chrome`, `src/sw`
  - 建立新标签页入口: `src/pages/newtab/main.tsx`, `App.tsx`, `index.html`

### Wave 2: UI 框架与样式基础

**目标:** 建立 React + Tailwind 4 运行环境,并提供一个最小的新标签页占位 UI。

**Tasks:**
- Task 4: React 19 + TypeScript 6
  - 配置 `tsconfig.json` 严格模式
  - 在 `main.tsx` 中挂载 React 根节点
  - 建立 `App.tsx` 作为占位页面(显示 "Canopy" 字样)
- Task 5: Tailwind CSS 4 集成
  - 安装 `tailwindcss` 4.x 及 `@tailwindcss/vite`
  - 在 `vite.config.ts` 中启用 `@tailwindcss/vite`
  - 新建样式入口(例如 `src/pages/newtab/index.css`)并引入基础 `@tailwind` 指令
  - (后续跟进) 预留 `tailwind.config`/`postcss.config` 扩展点

### Wave 3: 工程化工具与国际化基座

**目标:** 完成基础工程化与 i18n 架构,为后续业务迭代提供保障。

**Tasks:**
- Task 6: 代码规范与格式化
  - 配置 ESLint FlatConfig(`eslint.config.js`)
  - 配置 Prettier(`.prettierrc`)
  - 在 `package.json` 中添加 `lint`/`lint:fix` 脚本
- Task 7: 单元测试基座
  - 配置 `vitest.config.ts`
  - 在 `package.json` 中添加 `test` 脚本
  - 保证至少可以跑空测试套件
- Task 8: 国际化与 Chrome _locales
  - 在 `public/_locales/` 下创建 `zh_CN/messages.json` 与 `en/messages.json`
  - 在 `src/shared/i18n` 下实现 I18nProvider + `useT` Hook
  - 在 `App.tsx` 中接入 I18nProvider

## 4. 风险与假设

- 假设: 自定义 Chrome 扩展 Vite 插件 能稳定支持 MV3 多入口构建; 如后续事实证明维护成本过高,可在后续 Phase 迁移到 CRXJS/wxt.dev
- 风险: Tailwind 4 新配置模式与现有文档存在差异,可能导致样式编译问题,需要留出调整空间
- 风险: React 19 + TypeScript 6 相比 PRD 原计划的 18/5 版本更前沿,可能引入生态兼容性问题

## 5. Done 定义(Definition of Done)

- [ ] `pnpm dev` 能启动 Vite,Chrome 可以正常加载扩展
- [ ] 新标签页路径由 manifest 正确指向,页面中至少出现一个 "Canopy" 占位 UI
- [ ] 工程结构符合 `.planning/PROJECT.md` 与 `.planning/ROADMAP.md` 中定义的分层
- [ ] ESLint/Prettier/Vitest 配置齐全,对应脚本可执行(即使当前测试用例为空)
- [ ] `_locales` 与前端 i18n 架构搭好,后续 Phase 可以直接复用
