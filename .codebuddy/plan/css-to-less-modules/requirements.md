# 需求文档：项目样式体系从 CSS 迁移至 Less + CSS Modules

## 引言

本项目（GroveTab）当前使用纯 CSS 文件管理样式，共包含约 20 个 `.css` 文件，总计约 140KB 的样式代码。项目采用 antd v6 作为 UI 组件库，已通过 `cssVar: { key: 'app' }` 启用了 CSS 变量模式，并建立了 `--app-*` 业务语义变量体系和 `--ant-*` antd 主题变量桥接层。

本次重构的核心目标是将纯 CSS 迁移为 **Less + CSS Modules** 组合架构，以解决当前样式体系中存在的三大痛点：**代码重复率高**（毛玻璃效果、悬浮卡片等模式重复 10+ 处）、**嵌套层级可读性差**（`[data-skin]`/`[data-theme]` 深层选择器平铺）、**样式命名冲突风险**（全局 CSS 类名无隔离）。同时需确保与 antd v6 的 `cssVar` + `classNames` + Component Token 体系无缝对接。

## 需求

### 需求 1：样式文件迁移与模块化重组

**用户故事：** 作为一名前端开发者，我希望样式文件采用 `.module.less` 格式组织，以便获得自动类名隔离和模块化作用域，避免全局样式污染。

#### 验收标准

1. WHEN 项目构建完成 THEN 系统 SHALL 所有组件样式文件从 `.css` 重命名为 `.module.less`，文件路径保持一致
2. WHEN Vite 编译 `.module.less` 文件 THEN 系统 SHALL 自动生成唯一的局部类名（如 `.app-card-interactive_1a2b3c`），确保无全局命名冲突
3. IF 某样式需要全局可用（如 `index.css`、`prepaint.css`）THEN 系统 SHALL 保留为纯 `.css` 文件，不添加 `.module` 后缀
4. WHEN 组件文件中导入样式 THEN 系统 SHALL 使用 `import styles from './xxx.module.less'` 方式，可通过 `styles.xxx` 访问类名

### 需求 2：Less Mixin 抽离通用样式模式

**用户故事：** 作为一名前端开发者，我希望毛玻璃效果、悬浮卡片、行级 hover 等重复出现的样式模式被抽象为 Less Mixin，以便在多处复用，减少 30-40% 的代码量。

#### 验收标准

1. WHEN 毛玻璃效果模式（`backdrop-filter` + 半透明背景 + 边框 + 阴影）在多个容器中重复出现 THEN 系统 SHALL 将其抽离为 `.glass-effect(@blur)` Mixin，参数化 blur 值
2. WHEN 悬浮卡片 hover 效果（上浮 + 阴影提升 + 边框加深）在 6+ 处重复使用 THEN 系统 SHALL 将其抽离为 `.card-lift()` Mixin
3. WHEN 行级 hover 效果（背景色过渡）在多处重复 THEN 系统 SHALL 将其抽离为 `.row-hover(@bg-color)` Mixin，参数化背景色
4. WHEN 调用 Mixin THEN 系统 SHALL 通过 `.mixin-name()` 语法调用，代码量相比原纯 CSS 方案减少 30% 以上
5. IF Mixin 仅使用一次 THEN 系统 SHALL 不抽离为 Mixin，保持在组件样式内部

### 需求 3：Less 嵌套规则重构 `[data-skin]`/`[data-theme]` 选择器

**用户故事：** 作为一名前端开发者，我希望 `[data-skin='apple']` 和 `[data-theme='dark']` 等属性选择器使用 Less 嵌套规则组织，以便层级关系一目了然，修改某个皮肤时不会误伤其他皮肤。

#### 验收标准

1. WHEN `[data-skin='apple']` 下有多个选择器需要覆盖 THEN 系统 SHALL 使用 Less 嵌套将它们组织在同一个 `[data-skin='apple']` 块内
2. WHEN `[data-theme='dark'][data-skin='apple']` 双重条件覆盖存在 THEN 系统 SHALL 使用 Less 嵌套在 `[data-skin='apple']` 内部嵌套 `[data-theme='dark']` 块
3. WHEN 修改某个皮肤的样式 THEN 系统 SHALL 不会影响其他皮肤的样式定义（每个皮肤的覆盖相互独立）
4. WHEN 编译嵌套后的 Less THEN 系统 SHALL 生成与当前纯 CSS 相同的 CSS 选择器特异性（specificity）

### 需求 4：Less 变量体系建立与 CSS 变量的互补

**用户故事：** 作为一名前端开发者，我希望编译时常量（间距、字体大小、密度缩放系数等）使用 Less `@` 变量管理，而运行时动态值（颜色、主题切换、皮肤变量）继续使用 CSS `--` 变量，两者各司其职、互不冲突。

#### 验收标准

1. WHEN 间距值（如 4px 基数、密度缩放系数）在编译时即可确定 THEN 系统 SHALL 使用 Less `@` 变量定义（如 `@spacing-unit: 4px`、`@density-scale: 1`）
2. WHEN 运行时需要动态切换的值（如主题色、皮肤色）THEN 系统 SHALL 继续使用 CSS `--` 变量（如 `--app-color-primary`、`--app-page-bg`）
3. WHEN Less 变量和 CSS 变量在同一文件中共存 THEN 系统 SHALL 确保两者命名不冲突、职责清晰：`@` 用于编译时常量，`--` 用于运行时动态值
4. WHEN 通过 `buildAppThemeVars()` 注入 CSS 变量 THEN 系统 SHALL 保持现有注入逻辑不变，Less 变量不替代 CSS 变量的运行时角色

### 需求 5：全局共享模块文件创建

**用户故事：** 作为一名前端开发者，我希望有统一的全局 Less 变量文件和 Mixin 文件，以便各组件样式模块导入共享基础，避免在每个模块中重复定义。

#### 验收标准

1. WHEN 项目存在多个组件样式模块需要共享间距、圆角、阴影等基础变量 THEN 系统 SHALL 创建 `src/shared/styles/_variables.less` 文件，包含所有编译时常量
2. WHEN 项目存在多个可复用的 Mixin THEN 系统 SHALL 创建 `src/shared/styles/_mixins.less` 文件，包含所有通用 Mixin
3. WHEN 组件样式模块需要使用共享变量或 Mixin THEN 系统 SHALL 在文件开头通过 `@import (reference) '~@/shared/styles/_variables.less'` 等方式导入
4. IF 某个 Mixin 或变量仅限于特定组件使用 THEN 系统 SHALL 不放入全局文件，保留在组件样式文件内部

### 需求 6：antd v6 主题集成兼容性保障

**用户故事：** 作为一名前端开发者，我希望迁移到 Less + CSS Modules 后，antd v6 的 `cssVar` 模式、`classNames` 注入和 Component Token 体系继续正常工作，不出现样式覆盖失效或变量丢失的情况。

#### 验收标准

1. WHEN antd 的 `ConfigProvider` 通过 `classNames` 向组件注入自定义类名（如 `.app-modal__container`、`.app-drawer__section`）THEN 系统 SHALL 在对应的 `.module.less` 文件中定义这些类名的样式，且编译后的类名匹配 antd 注入的类名
2. WHEN antd 使用 `--ant-*` CSS 变量体系 THEN 系统 SHALL 在 Less 文件中通过 `var(--ant-xxx)` 引用这些变量，保持主题跟随能力
3. WHEN antd 组件的 Component Token（如 `Modal.borderRadiusLG`、`Card.paddingLG`）生效 THEN 系统 SHALL 不在 Less 中硬编码覆盖这些值，而是继续通过 antd 的主题配置体系传递
4. WHEN `AntdThemeProvider` 通过 `style.setProperty` 注入 `--app-*` 变量 THEN 系统 SHALL 这些变量在 Less 文件中通过 `var(--app-xxx)` 正常消费

### 需求 7：构建配置适配与 Less 编译链路搭建

**用户故事：** 作为一名前端开发者，我希望 Vite 构建配置正确支持 Less 文件编译，包括 CSS Modules、路径别名（`@/`）和共享文件引用，迁移后构建产物与当前一致。

#### 验收标准

1. WHEN Vite 遇到 `.module.less` 文件 THEN 系统 SHALL 自动启用 CSS Modules 编译，生成 `[name]_[local]_[hash:6]` 格式的局部类名
2. WHEN Less 文件中使用 `@import '~@/shared/styles/_variables.less'` THEN 系统 SHALL 正确解析 `@` 别名为 `src/` 目录
3. WHEN 项目执行 `pnpm build` THEN 系统 SHALL 构建成功，产物中包含编译后的 CSS 文件，且样式效果与迁移前完全一致
4. WHEN 项目执行 `pnpm dev` THEN 系统 SHALL 支持热更新（HMR），修改 `.module.less` 文件后浏览器自动刷新样式
5. IF 当前项目中尚未安装 Less 相关依赖 THEN 系统 SHALL 在 `package.json` 的 `devDependencies` 中添加 `less` 依赖

### 需求 8：样式变量和 Mixin 使用指南文档

**用户故事：** 作为一名前端开发者，我希望有一份直观的样式变量和 Mixin 使用指南，以便后续开发快速查阅可用的变量和 Mixin，减少重复造轮子。

#### 验收标准

1. WHEN 重构完成 THEN 系统 SHALL 产出一份 `STYLES_GUIDE.md` 文档，包含所有全局 Less 变量列表（名称、类型、默认值、用途说明）
2. WHEN 重构完成 THEN 系统 SHALL 在文档中包含所有全局 Mixin 列表（名称、参数、用法示例、适用场景）
3. WHEN 重构完成 THEN 系统 SHALL 在文档中明确标注哪些样式继续使用 CSS 变量（运行时动态），哪些使用 Less 变量（编译时常量）
4. WHEN 新开发者加入项目 THEN 系统 SHALL 通过阅读该文档即可了解如何正确使用样式体系
