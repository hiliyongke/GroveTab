# Phase 04 · antd v6 全量重构

## 背景

当前技术栈：React 19 + Vite 8 + Tailwind 4 + 自研 `shared/ui/primitives/*`（基于 Radix）。
组件存在**裸 div + className 拼装**的历史债，且用户对 Tailwind+shadcn 风格不满意。

**决策**（用户拍板 2026-04-22）：

- 风格：现代轻盈 · 卡片化（Arc/Notion 风）
- UI 库：**Ant Design v6.3.3+**（正式版，主打 React 19）
- 主题：antd 默认蓝 `#1677ff`，明暗双套
- **Tailwind 完全移除**，纯 antd + css-in-js

## 迁移范围（量化）

- 31 个 tsx 文件含 className
- 18 个 shared/ui 组件
- 13 个 features 组件
- 1 个 `index.css` 设计系统（~300 行）
- 需要移除的依赖：`tailwindcss`、`@tailwindcss/vite`、`class-variance-authority`、`tailwind-merge`、`clsx`（保留 `clsx` 可选）
- 需要移除的依赖：`@radix-ui/react-dialog`、`@radix-ui/react-tooltip`、`@radix-ui/react-slot`
- 新增依赖：`antd`、`@ant-design/icons`、`@ant-design/cssinjs`（antd 自带）

## 不变更的范围

- 业务逻辑层（store / repositories / services / sw / chrome）
- i18n 体系
- `motion`、`lucide-react`（与 @ant-design/icons 共存，逐步替换）
- 快捷键、搜索算法、去重算法等核心能力

## 产物

视觉稿：`/docs/ui-mock/newtab.html` · `/docs/ui-mock/tokens.md`
