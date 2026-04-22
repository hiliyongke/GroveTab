# Phase 1 EXECUTE — 项目脚手架

**Created:** 2026-04-22

> 本文记录实际执行顺序与相对 PLAN 的偏差,用于后续 Phase 回顾和经验复用。

## 1. 执行概览

- 实际落地时间: 2026-04-22
- 执行结果: 功能上 **已完成并超出原始 Phase 1 范围**
- 主要产出:
  - 完整的 MV3 扩展工程(多入口: newtab/popup/sw)
  - 完整的新标签页应用骨架,并已实现多种视图和业务功能
  - 基本工程化(ESLint/Prettier/Vitest/_locales/i18n 架构)

## 2. 实际执行步骤(按时间逻辑归纳)

1. 初始化工程与包管理
   - 使用 pnpm 初始化项目
   - 创建 `package.json`,配置 `dev`/`build`/`test` 等脚本
2. 配置 Vite 8 + 自定义扩展插件
   - 新建 `vite.config.ts`
   - 实现并接入 `chromeExtensionPlugin`,负责多入口与 manifest 相关路径处理
   - 配置 newtab/popup/sw 入口,保证构建输出结构符合扩展要求
3. 建立目录结构与新标签页入口
   - 建立 `src/pages`, `src/features`, `src/shared`, `src/store`, `src/services`, `src/repositories`, `src/chrome`, `src/sw` 等目录
   - 在 `src/pages/newtab/` 中创建 `main.tsx`、`App.tsx`、`index.html`、`index.css` 等文件
   - 新标签页入口直接实现了完整应用骨架(视图切换/搜索等),而非仅占位 UI
4. 集成 React 19 + TypeScript 6
   - 配置 `tsconfig.json` 为 strict 模式
   - 在 `main.tsx` 中挂载 React 根节点
   - 使用函数式组件与 hooks 编写应用
5. 集成 Tailwind CSS 4
   - 安装 `tailwindcss` 4.x 与 `@tailwindcss/vite`
   - 在 `vite.config.ts` 中启用 `@tailwindcss/vite`
   - 在 newtab 页面样式入口中引入基础 Tailwind 指令
   - 尚未单独创建 `tailwind.config`/`postcss.config`,依赖 Tailwind 4 默认行为
6. 配置工程化工具
   - 配置 ESLint FlatConfig(`eslint.config.js`)
   - 配置 Prettier(`.prettierrc`)
   - 配置 Vitest(`vitest.config.ts`)
   - 在 `package.json` 中添加 `lint`/`test` 等脚本
7. 国际化与 _locales
   - 在 `public/_locales/` 下创建 `zh_CN` 与 `en` 消息文件
   - 在 `src/shared/i18n` 下实现 I18nProvider + `useT` Hook
   - 在应用中集成 i18n,支持中英双语切换

## 3. 相对 PLAN 的偏差

> 以下偏差均是为适配实际实现所做的更新,需要在 CONTEXT/PROJECT 中同步记录,避免信息漂移。

1. 构建工具选择
   - PLAN: 使用 Vite 5 + @crxjs/vite-plugin v2
   - 实际: 使用 Vite 8 + 自定义 Chrome 扩展 Vite 插件(chromeExtensionPlugin),未引入 CRXJS
   - 状态: 已在 CONTEXT 中更新为当前决策; 如后续维护成本过高,可以考虑迁移至 CRXJS/wxt.dev
2. React/TypeScript 版本
   - PLAN: React 18 + TypeScript 5
   - 实际: React 19 + TypeScript 6
   - 状态: 已在 CONTEXT 中更新; 需关注生态兼容性
3. 动画库
   - PLAN: 使用 Framer Motion 11
   - 实际: 使用 Motion 12 库 作为动效实现
   - 状态: 已在 CONTEXT 中更新; Phase 6 中的视觉与动效设计需以 Motion 为基准
4. 新标签页功能范围
   - PLAN: 仅需占位 UI 验证接管
   - 实际: 直接实现了多视图/搜索等核心功能,超出 Phase 1 范围
   - 状态: 在后续 Phase(2~7) 的 EXECUTE/VERIFICATION 中,需要将这些实现映射回对应 Phase 以保证可追溯性

## 4. 遗留事项与后续建议

- Tailwind 配置:
  - 当前依赖 Tailwind 4 默认行为,缺少显式 `tailwind.config` 和 `postcss.config`
  - 建议在 Phase 6(视觉系统) 中补充并统一 Design Token 相关配置
- CRXJS 评估:
  - 当前自定义 `chromeExtensionPlugin` 工作正常
  - 建议在后续某一 Phase(例如 10-打磨与上架) 评估是否迁移到 CRXJS/wxt.dev 以降低长期维护成本
- 国际化策略:
  - 当前同时存在 Chrome `_locales` 与前端自实现 i18n
  - 建议在后续 Phase 中统一策略,减少双重维护
- 测试覆盖:
  - Vitest 已配置,但当前测试覆盖率尚未在此文档中记录
  - 建议在后续 Phase 或当前 Phase 的回溯中,补充测试范围与关键用例说明
