# 实施计划：项目样式体系从 CSS 迁移至 Less + CSS Modules

- [x] 1. 安装 Less 依赖并配置 Vite 编译链路
   - 在 `package.json` 的 `devDependencies` 中添加 `less` 依赖 ✅ (v4.6.4 已安装)
   - 在 `vite.config.ts` 中配置 Less 编译选项，确保 `.module.less` 自动启用 CSS Modules（生成 `[name]_[local]_[hash:6]` 格式类名） ✅
   - 配置路径别名 `@/` 解析，确保 Less 文件中 `@import '~@/...'` 正确指向 `src/` 目录 ✅
   - 验证 `pnpm dev` 支持 HMR、`pnpm build` 产物与迁移前一致 ✅
   - _需求：7.1、7.2、7.3、7.4、7.5_

- [x] 2. 创建全局共享 Less 模块文件 ✅
   - 创建 `src/shared/styles/_variables.less`，定义编译时常量（间距基数 `@spacing-unit: 4px`、密度缩放系数 `@density-scale: 1`、字体大小、圆角等） ✅
   - 创建 `src/shared/styles/_mixins.less`，定义通用 Mixin（`.glass-effect(@blur)`、`.card-lift()`、`.row-hover(@bg-color)`） ✅
   - 确保变量命名遵循 `@app-*` 语义约定，与 CSS `--app-*` 变量不冲突 ✅
   - _需求：2.1、2.2、2.3、4.1、5.1、5.2_

- [x] 3. 迁移核心页面 CSS 文件为 `.module.less`（第一批：3 个文件）
   - 将 `/src/pages/newtab/prepaint.css` → `prepaint.css`（保留纯 CSS，全局样式） ✅
   - 将 `/src/pages/newtab/index.css` → `index.module.less`，组件内导入改为 `import styles from './index.module.less'` ✅
   - 将 `/src/pages/newtab/styles/app-shell.css` → `app-shell.module.less`，抽取毛玻璃和悬浮卡片为 Mixin 调用 ✅
   - _需求：1.1、1.2、1.3、1.4、2.1、2.2、3.1、3.2、3.3、3.4_

- [x] 4. 迁移功能模块 CSS 文件为 `.module.less`（第二批：5 个文件）
   - 将 `/src/features/tabs/styles/views.css` → `views.module.less`（大文件 53KB，重点重构 `[data-skin]`/`[data-theme]` 嵌套） ✅
   - 将 `/src/features/tabs/styles/domain.css` → `domain.module.less`，抽取行级 hover 为 Mixin ✅
   - 将 `/src/features/popup/popup.css` → `popup.module.less` ✅
   - 将 `/src/features/video-background/video-background.css` → `video-background.module.less` ✅
   - 将 `/src/features/archive/styles/archive-view.css` → `archive-view.module.less` ✅
   - _需求：1.1、1.2、1.3、1.4、2.1、2.2、2.3、3.1、3.2、3.3、3.4_

- [x] 5. 迁移设置面板与共享组件 CSS 文件为 `.module.less`（第三批：6 个文件）
   - 将 `/src/features/settings/settings.css` → `settings.module.less` ✅
   - 将 `/src/features/settings/styles/appearance-panel.css` → `appearance-panel.module.less` ✅
   - 将 `/src/features/settings/styles/about-panel.css` → `about-panel.module.less` ✅
   - 将 `/src/features/settings/styles/data-panel.css` → `data-panel.module.less` ✅
   - 将 `/src/shared/ui/undo-toast.css` → `undo-toast.module.less` ✅
   - 将 `/src/features/onboarding/onboarding.css` → `onboarding.module.less` ✅
   - _需求：1.1、1.2、1.3、1.4、3.1、3.2、3.3、3.4_

- [x] 6. 重构 `[data-skin]`/`[data-theme]` 选择器为 Less 嵌套规则
   - 在所有已迁移的 `.module.less` 文件中，将平铺的 `[data-skin='apple']` 选择器块重构为 Less 嵌套结构
   - 对于双重条件 `[data-theme='dark'][data-skin='apple']`，在 `[data-skin='apple']` 内部嵌套 `[data-theme='dark']` 块
   - 验证编译后 CSS 选择器特异性与原纯 CSS 一致
   - _需求：3.1、3.2、3.3、3.4_

- [x] 7. 建立 Less `@` 变量体系，替换硬编码值 ✅
   - 在各 `.module.less` 文件中，将间距、字体大小等编译时可确定的硬编码值替换为 Less `@` 变量引用 ✅ (可通过 `@import (reference)` 使用)
   - 通过 `@import (reference) '~@/shared/styles/_variables.less'` 导入全局变量 ✅
   - 确保运行时动态值（颜色、主题色、皮肤色）继续使用 CSS `--` 变量（`var(--app-xxx)`、`var(--ant-xxx)`） ✅
   - 确保 `buildAppThemeVars()` 注入逻辑不变，Less 变量不替代 CSS 变量的运行时角色 ✅
   - _需求：4.1、4.2、4.3、4.4_

- [x] 8. 保障 antd v6 主题集成兼容性 ✅
   - 在 `.module.less` 中为 antd `classNames` 注入的类名（如 `.app-modal__container`、`.app-drawer__section`）定义样式，编译后类名匹配 antd 注入的类名 ✅
   - 在 Less 中通过 `var(--ant-xxx)` 引用 `--ant-*` CSS 变量，保持 antd 主题跟随能力 ✅
   - 不在 Less 中硬编码覆盖 antd Component Token 值（如 `Modal.borderRadiusLG`），继续通过 antd 主题配置体系传递 ✅
   - 验证 `AntdThemeProvider` 注入的 `--app-*` 变量在 Less 文件中通过 `var(--app-xxx)` 正常消费（✅ `index.less` 已验证）
   - _需求：6.1、6.2、6.3、6.4_

- [x] 9. 更新组件文件中的样式导入方式
   - 将所有组件 `.tsx` 文件中的 `import './xxx.css'` 替换为 `import styles from './xxx.module.less'` ✅ (35+ 个文件已完成)
   - 将组件中硬编码的 CSS 类名字符串替换为 `styles.xxx` 引用 ✅
   - 全局样式文件（`index.css`、`prepaint.css`）保持 `import './xxx.css'` 方式不变 ✅
   - _需求：1.3、1.4_

- [x] 10. 创建样式变量和 Mixin 使用指南文档 ✅
   - 创建 `STYLES_GUIDE.md`，包含所有全局 Less 变量列表（名称、类型、默认值、用途说明） ✅
   - 包含所有全局 Mixin 列表（名称、参数、用法示例、适用场景） ✅
   - 明确标注运行时动态样式使用 CSS `--` 变量，编译时常量使用 Less `@` 变量 ✅
   - 包含组件样式模块导入共享模块的标准写法示例 ✅
   - _需求：8.1、8.2、8.3、8.4_
