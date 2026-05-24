---
name: antd-style-cleanup
overview: 深度排查并修复项目样式问题：全局样式污染、硬编码颜色、内联样式、禁止CSS模式、Ant Design覆盖、!important滥用等6大类问题
todos:
  - id: stop-bleeding
    content: 将 app-shell.less 中 6 处无作用域 .ant-* 全局覆盖迁移到 ConfigProvider component token，删除死代码 bookmark-tree.less
    status: completed
  - id: global-to-modules
    content: 将 index.less/app-shell.less/popup/index.less 重命名为 .module.less，类名局部化，移除残留 .ant-* 覆盖
    status: completed
    dependencies:
      - stop-bleeding
  - id: token-replace
    content: 用 [subagent:code-explorer] 定位所有硬编码颜色，替换为 --ant-* / --app-* CSS 变量
    status: completed
    dependencies:
      - stop-bleeding
  - id: inline-style-fix
    content: 消除 17 处内联 style={{}}，替换为 CSS Modules 或 Ant Design 布局组件
    status: completed
    dependencies:
      - global-to-modules
  - id: native-html-fix
    content: 20 个文件中 37 处 native button 替换为 Ant Design Button
    status: completed
    dependencies:
      - global-to-modules
  - id: forbidden-css-fix
    content: 移除 !important，display:flex/gap 替换为 Flex/Space 组件或加注释说明
    status: completed
    dependencies:
      - global-to-modules
      - inline-style-fix
  - id: verify-build
    content: 用 [skill:前端开发] 审查修复结果，执行 type-check + build 验证
    status: completed
    dependencies:
      - token-replace
      - inline-style-fix
      - native-html-fix
      - forbidden-css-fix
---

## Product Overview

GroveTab 是一个 Chrome 新标签页扩展，当前存在大量样式与布局问题：未按 Ant Design v6 组件库最佳实践编写页面布局，大量自定义样式污染了组件库内置样式和动效，导致多处 UI 显示异常、UX 体验不一致、交互行为异常。需要进行系统性排查和修复。

## Core Features

- **全局样式污染治理**：将 4 个非 CSS Modules 全局 .less 文件转换为 .module.less，消除类名冲突和 Ant Design 样式覆盖
- **Ant Design 内部类覆盖清除**：移除 22 处对 `.ant-*` 内部类的直接覆盖，改用 ConfigProvider theme token 和 component token 正规途径
- **硬编码颜色替换为设计 Token**：60+ 处硬编码 hex/rgba 值替换为 `var(--ant-*)` / `var(--app-*)` CSS 变量
- **内联样式消除**：17 处 `style={{}}` 替换为 CSS Modules 或 Ant Design 布局组件
- **禁止 CSS 模式修正**：207+ 处 `display:flex`、50+ 处 `gap`、15+ 处 `!important` 替换为 Ant Design `<Flex>`/`<Space>` 组件和正确 token 定制
- **原生 HTML 元素替换**：20 个文件中约 37 处 `<button>` 替换为 Ant Design `<Button>`

## Tech Stack

- 框架：React 19 + TypeScript + Vite（保持现有）
- 组件库：Ant Design v6（ConfigProvider + theme token + component token）
- 样式方案：CSS Modules（.module.less）+ Ant Design 设计 Token（`--ant-*`）+ 业务变量（`--app-*`）
- 状态管理：Zustand（保持现有）
- 构建工具：Vite（保持现有）

## Implementation Approach

### 核心策略：分层治理，从根源到末端

项目已具备完善的主题基础设施（`AntdThemeProvider.tsx` + `theme-customization.ts` + `skin-presets.ts`），通过 ConfigProvider 注入 theme token 和 `--app-*` 业务变量。当前问题的根源是**绕过了这套正规体系**，直接用全局 CSS 覆盖 `.ant-*` 类名和硬编码值。

**方法**：

1. **先止血**：将全局 .less 文件转为 CSS Modules，阻止污染扩散
2. **拔病根**：将 Ant Design 类覆盖迁移到 ConfigProvider component token，这是最关键的一步——让主题系统而非 CSS 选择器来控制组件外观
3. **清余毒**：系统性替换硬编码值、内联样式、禁止模式

### 关键技术决策

| 决策                          | 选择                                                                  | 理由                                                                                           |
| ----------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Ant Design 样式定制方式       | ConfigProvider component token                                        | v6 官方推荐，不依赖内部类名，升级安全                                                          |
| 毛玻璃/背景覆盖               | ConfigProvider `components` token + `classNames` + scoped CSS Modules | 已有 `classNames` 注入机制（如 `app-modal__container`），应在此基础上用 CSS Modules 限定作用域 |
| 品牌色/皮肤色                 | `--app-*` 变量 + skin-presets                                         | 已有完善的皮肤变量系统，只需把硬编码值替换为变量引用                                           |
| 布局方式                      | Ant Design `<Flex>` / `<Space>`                                       | CODEBUDDY.md 规范要求，与 Ant Design token 体系集成                                            |
| 残留文件 `bookmark-tree.less` | 删除                                                                  | 已有 `bookmark-tree.module.less` 替代，无任何引用                                              |

### 性能与可靠性

- 全局 .less → .module.less：消除类名冲突，每个组件样式独立哈希，零运行时开销
- 内联样式消除：减少每次渲染的对象创建，恢复 React.memo 优化效果
- component token 替代 `.ant-*` 覆盖：消除 CSS 特异性战争，避免 Ant Design 版本升级时样式断裂
- `!important` 消除：降低维护成本，避免特异性通胀

## Implementation Notes

1. **迁移 Ant Design 覆盖时的关键路径**：`app-shell.less` 中 6 处无父级作用域的 `.ant-xxx` 全局覆盖（行 757-780）是最严重的污染源，优先处理。这些毛玻璃效果应通过 ConfigProvider 的 Modal/Drawer/Popover/Tooltip component token 注入 `contentBg`，再配合已有的 `classNames`（如 `app-modal__container`）在 CSS Modules 中添加 `backdrop-filter`
2. **全局 .less 转模块化**：`index.less` 和 `app-shell.less` 被 `main.tsx` 全局引入，需要拆分——皮肤级样式保留为全局入口（因为需要作用于 Ant Design 生成的 DOM），但所有自定义类名必须加 `:local()` 或转为 .module.less；`popup/index.less` 同理
3. **`bookmark-tree.less`（26KB）是死代码**：无任何引用，已由 `bookmark-tree.module.less` 替代，直接删除
4. **display:flex 替换策略**：不能机械地全部替换——对于 Ant Design 组件内部的微调（如 `.ant-card-body` 内部布局），保留 flex 并添加注释；对于组件级别的布局，替换为 `<Flex>` 组件

## Architecture Design

### 当前问题架构

```
main.tsx
  ├── import './index.less'          ← 全局 25KB，含皮肤覆盖 + Ant 类覆盖
  ├── import './app-shell.less'      ← 全局 17KB，含 6 处无作用域 .ant-* 覆盖
  └── <AntdThemeProvider>            ← ConfigProvider + theme token（正规途径）
        └── <App>                    ← 但部分组件绕过 token 直接覆盖 .ant-* 类
```

### 目标架构

```
main.tsx
  ├── import './index.module.less'   ← 仅保留浏览器重置 + 滚动条 + CSS 变量消费
  ├── import './app-shell.module.less'← App Shell 布局，CSS Modules 限定作用域
  └── <AntdThemeProvider>            ← ConfigProvider theme token + component token
        │                               毛玻璃/背景色通过 component token 注入
        │                               classNames 注入业务语义类名
        └── <App>
              └── 各功能组件
                    ├── <Flex>/<Space> 布局（替代 display:flex/gap）
                    ├── <Button>（替代 <button>）
                    └── className={styles.xxx}（CSS Modules）
```

### 皮肤样式迁移策略

```
app-shell.less 中的 .ant-popover-inner { background: ... !important; backdrop-filter: ...; }
                        ↓ 迁移到
ConfigProvider.components.Popover = { colorBgElevated: 'color-mix(...)' }
      + .app-popover__container（已有 classNames）的 CSS Module 中写 backdrop-filter
```

## Directory Structure

```
src/
├── pages/newtab/
│   ├── main.tsx                              # [MODIFY] 更新 import 路径
│   ├── index.less                            # [MODIFY→RENAME] → index.module.less，移除 Ant 类覆盖，保留浏览器重置
│   └── styles/
│       └── app-shell.less                    # [MODIFY→RENAME] → app-shell.module.less，移除 6 处无作用域 .ant-* 覆盖，类名局部化
├── pages/popup/
│   ├── main.tsx                              # [MODIFY] 更新 import 路径
│   ├── App.tsx                               # [MODIFY] <button> → <Button>
│   └── styles/
│       └── index.less                        # [MODIFY→RENAME] → index.module.less，移除 Ant 类覆盖
├── features/tabs/styles/
│   ├── bookmark-tree.less                    # [DELETE] 死代码，已被 bookmark-tree.module.less 替代
│   ├── bookmark-tree.module.less             # [MODIFY] display:flex → 保留（组件内部布局，加注释）
│   ├── views.module.less                     # [MODIFY] 移除 .ant-card-body/.ant-input-affix-wrapper 覆盖，硬编码色→token
│   └── items.module.less                     # [MODIFY] 硬编码色→token
├── features/search/
│   ├── SearchBox.tsx                         # [MODIFY] style={{}}→CSS 变量绑定保留，其余→className
│   └── SearchBox.module.less                 # [MODIFY] 移除 .ant-modal-content/.ant-popover-inner 覆盖
├── features/bookmarks/
│   ├── bookmark-tools.module.less            # [MODIFY] 硬编码色→token，display:flex→注释说明
│   └── components/
│       └── BookmarkToolsOverview.tsx         # [MODIFY] style={{marginTop:16}}→Space/Flex gap
├── features/history/
│   └── HistoryPanel.module.less              # [MODIFY] 硬编码语义色→--ant-color-success/error，.ant-tabs 覆盖→token
├── features/quick-start/
│   └── QuickStartLayer.module.less           # [MODIFY] 移除 !important .ant-card-body 覆盖，改用 Card classNames
├── features/settings/
│   ├── settings.module.less                  # [MODIFY] .ant-switch 覆盖→token，硬编码色→token
│   └── panels/
│       ├── PrivacyPanel.tsx                  # [MODIFY] style={{}}→className
│       ├── AppearancePanel.tsx               # [MODIFY] style={{}}→className，<button>→<Button>
│       ├── DataPanel.tsx                     # [MODIFY] <button>→<Button>
│       ├── SearchSettings.tsx                # [MODIFY] <button>→<Button>
│       └── styles/
│           ├── appearance.module.less        # [MODIFY] 硬编码色→token
│           └── about.module.less             # [MODIFY] 硬编码色→token（如有）
├── features/developer-tools/
│   ├── DeveloperToolsPage.module.less        # [MODIFY] display:flex→注释说明或 Flex 组件
│   └── components/ToolPanel.tsx              # [MODIFY] <button>→<Button>
├── features/trending/TrendingPage.tsx        # [MODIFY] <button>→<Button>
├──/features/sessions/
│   ├── components/BatchOperationsMenu.tsx    # [MODIFY] <button>→<Button>
│   ├── components/EnhancedRenameDialog.tsx   # [MODIFY] <button>→<Button>
│   ├── components/EnhancedRestoreDialog.tsx  # [MODIFY] <button>→<Button>
│   └── styles/archive.module.less            # [MODIFY] 硬编码色→token（如有）
├── features/insights/InsightsPanel.tsx       # [MODIFY] <button>→<Button>
├── features/tabs/
│   ├── TabContextMenu.tsx                    # [MODIFY] <button>→<Button>
│   ├── KanbanView.tsx                        # [MODIFY] <button>→<Button>
│   ├── DuplicatePreviewModal.tsx             # [MODIFY] <button>→<Button>
│   ├── TidySuggestionBar.tsx                # [MODIFY] <button>→<Button>
│   ├── SelectionModeNotice.tsx              # [MODIFY] <button>→<Button>
│   ├── BookmarkTreeView.tsx                  # [MODIFY] style={{}}合理性保留/替换
│   ├── GridView.tsx                          # [MODIFY] style={{}}→CSS Module
│   └── BookmarkView.tsx                      # [MODIFY] style={{}}合理性保留
├── features/workspace/
│   ├── AppHeader.tsx                         # [MODIFY] <button>→<Button>
│   └── AppWorkspace.tsx                      # [MODIFY] <button>→<Button>
├── shared/ui/
│   ├── SiteIcon.tsx                          # [MODIFY] style={{}}→CSS Module（动态尺寸用 CSS 变量）
│   ├── AntdThemeProvider.tsx                 # [MODIFY] 增加毛玻璃相关 component token 配置
│   └── status-surfaces.module.less           # [MODIFY] z-index:1100→CSS 变量
├── shared/theme/
│   └── theme-customization.ts                # [MODIFY] 增加毛玻璃背景色 component token（Modal/Drawer/Popover/Dropdown/Tooltip）
└── shared/styles/
    ├── _variables.less                       # [KEEP] 纯变量，无污染
    └── _mixins.less                          # [KEEP] 纯 mixin，无污染
```

## Agent Extensions

### SubAgent

- **code-explorer**
- Purpose: 在每个任务执行阶段，深入搜索和验证受影响的代码文件和依赖关系
- Expected outcome: 确保修改不遗漏任何引用点，避免因样式迁移引入新的显示问题

### Skill

- **前端开发**
- Purpose: 在重构 Ant Design 组件布局时参考最佳实践，确保 Flex/Space 替换方案合理
- Expected outcome: 产出符合 Ant Design v6 最佳实践的组件布局代码
