# GroveTab UI 规范与布局重构方案

## 1. 问题现象与根本原因分析

### 1.1 问题现象

- **JSX 结构充满 `div` 汤**：各个核心组件（如 `App.tsx`, `AppHeader.tsx`, `app-shell.less` 等）大量使用 `div + className` 配合自定义 CSS 布局，完全没有利用 Ant Design 的布局组件最佳实践。
- **内联样式（`style={{...}}`）泛滥**：许多组件通过 `style` 传入对象或动态修改 CSS 变量，导致 React 的 `memo` 缓存失效，影响性能。
- **全局样式与 CSS Modules 混用**：部分文件（如 `app-shell.less` 和 `index.less`）包含成百上千行的全局覆盖代码，充斥着针对主题/皮肤（如 `data-skin="apple"`）的生硬重写。
- **硬编码尺寸和颜色**：未完全遵循 Antd v6 的 Design Token，导致皮肤适配、圆角统一等非常困难，维护成本极高。

### 1.2 根本原因

1. **对 Antd v6 现代布局范式不够熟悉**：开发者习惯了传统的“写 HTML 结构 -> 挂 class -> 在 Less 里写 Flexbox”的切图流，忽略了 `<Flex>`, `<Space>`, `<Layout>`, `<Row>`, `<Col>` 等自带标准化 Token 的高级容器。
2. **缺乏工具层面的 Lint 强力约束**：虽然 `GEMINI.md` 定义了严谨的标准（如禁用原生 `<button>`, `<input>` 等，要求使用 CSS Modules），但 `package.json` 中的 `eslint` 并未配置对应的 `no-restricted-syntax` 或相关插件进行语法拦截。
3. **主题与皮肤逻辑未与 ConfigProvider 深度整合**：没有将皮肤特征（如 Apple 的卡片圆角、Fluent 的高光）转化为 Ant Design 的 Token 定制，而是试图用纯外挂 CSS 去强行 Override，导致“样式补丁”越糊越厚。

---

## 2. 修复与重构方案

### 2.1 整体修复策略

- **清理全局与自定义布局类**：用 Antd 官方提供的 `<Flex>`, `<Layout>`, `<Space>` 替换手写的 `div` 和 Less flex 布局。彻底抛弃 `app-shell.less` 等全局污染的样式文件。
- **严格落实 CSS Modules**：所有仍需要自定义的样式一律通过 `.module.less` 导入。禁止在 `.less` 文件中手写 `display: flex;`。
- **清理禁用原生标签与内联样式**：用 `<Typography.*>` 替换原生排版标签，用 `<Button>` 替换原生按钮；将所有的 `style={{...}}` 转化为 CSS Modules 中的类或提取为稳定的常量/Token。
- **主题逻辑重构**：将零散在 `index.less` 的 Apple、Fluent 皮肤样式，提炼转化为 Ant Design 的 `theme` 覆盖（利用 `ConfigProvider` 和 Design Token）。
- **收紧 ESLint 规则**：从工程化源头掐断烂代码产生。

### 2.2 替换映射表指南

| 原有写法 (反模式)                  | 重构后的标准写法                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| `<div className="flex-container">` | `<Flex align="center" gap={...}>`                                              |
| `<div style={{ margin: '16px' }}>` | 使用 CSS Modules `className={styles.container}` 或包裹 `<Space size="middle">` |
| `<button className="my-btn">`      | `<Button className={styles.myBtn}>`                                            |
| `<span className="title">`         | `<Typography.Text>` / `<Typography.Title>`                                     |
| `display: flex; gap: 8px;` (Less)  | 删除 Less 属性，使用 `<Flex gap={8}>`                                          |

---

## 3. 详细任务拆分 (按优先级执行)

### 阶段一：工程化基建与工具链拦截 (基石)

_目标：防止在重构期间产生新的不规范代码。_

- [ ] **Task 1.1**: 更新 `eslint.config.js`，增加 `no-restricted-syntax` 规则，全局拦截原生 `<button>`, `<h1>`~`<h6>`, `<p>`, `<input>` 等，拦截原生 `<div style={{...}}>` 内联样式。
- [ ] **Task 1.2**: 配置 Stylelint (如尚未配置)，禁用 Less 文件中的 `display: flex`, `display: grid`, 并且强制校验不可硬编码 `#` 十六进制颜色，要求只能使用 `var(--ant-*)` Token。

### 阶段二：核心骨架布局重构 (高优 P0)

_目标：解决外壳布局导致的滚动条、背景色和自适应问题。_

- [ ] **Task 2.1**: 重构 `src/pages/newtab/App.tsx` 和 `AppHeader.tsx`。
  - 删除 `<div className="app-main-body">` 等冗余外壳。
  - 引入并使用 Antd `<Layout>`, `<Layout.Header>`, `<Layout.Content>`, `<Flex>`。
  - 废弃 `app-shell.less`，将其特有样式按组件拆分到各自的 `*.module.less` 中。
- [ ] **Task 2.2**: 重构 `ViewDock`, `HeroBar`, `ViewSidebar`, `ViewBottomBar` 组件。
  - 移除通过内联 className 实现的外挂悬浮、定位和 flex 排版，改为语义化的 Antd 布局。
- [ ] **Task 2.3**: 清理 `src/pages/newtab/index.less`，把其中几百行的冗余 `data-skin="apple"` 补丁整理出来。

### 阶段三：卡片、面板与视图区组件重构 (功能层 P1)

_目标：统一各类标签、书签展现的视觉尺寸与交互反馈。_

- [ ] **Task 3.1**: Tab 视图簇（`GridView.tsx`, `DomainGroupCard.tsx`, `WindowCard.tsx` 等）。
  - 用 `<Card>`, `<List>` 和 `<Flex>` 代替内部 div。
  - 去掉动态拼装的内联 `style={{ "--app-bm-accent": ... }}`，改为在 `styles` 中声明并仅给外层注入所需变量，或是利用 `classNames` 透传。
- [ ] **Task 3.2**: 书签视图簇（`BookmarkTreeView.tsx`, `BookmarkView.tsx` 等）。
  - 清理内联样式，统一缩进及视觉层次；移除针对深色模式硬编码的判断，依赖 `var(--ant-color-bg-elevated)` 等机制。
- [ ] **Task 3.3**: 设置与偏好面板（`SettingsPanel.tsx`, `AppearancePanel.tsx` 等）。
  - 将传统的表单项改为标准的 Antd `<Form>` / `<Space>` 组合。

### 阶段四：主题与 Token 体系深度融合 (视觉 P2)

_目标：让主题切换完全走 Ant Design 架构，提高可维护性。_

- [ ] **Task 4.1**: 提取 Apple 和 Glassmorphism 皮肤的特定 Token (如圆角 `--app-radius-pill` -> `borderRadius: 999`)，将原本在 `index.less` 中的重度 override 写法，改为通过在 `AntdThemeProvider.tsx` 的 `theme.components` 中对 `Card`, `Button` 统一下发算法。
- [ ] **Task 4.2**: 删除项目中冗余遗留的 `background-colors.less`，将所需的预设背景统一为 TypeScript 中的 theme 变量数组供界面选取。
- [ ] **Task 4.3**: 联调和回归测试，确认全暗黑模式切换时文字与边界对比度符合 WCAG 标准，确保动画降级（prefers-reduced-motion）不被破坏。

---

> 请确认此方案，后续可以直接要求我“开始执行阶段一”或“重构 App.tsx 布局”。
