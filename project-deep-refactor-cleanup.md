---
name: project-deep-refactor-cleanup
overview: 对当前 React 19 + TypeScript + Vite + Ant Design v6 Chrome 扩展进行分阶段深度重构规划，重点清理冗余/废弃/低效代码，抽取重复 UI 与公共业务逻辑，并保持功能行为不变。
todos:
  - id: baseline-audit
    content: 使用 [subagent:code-explorer] 完成基线审计并建立重构报告
    status: pending
  - id: safe-cleanup
    content: 使用 [skill:karpathy-guidelines] 修复诊断、弃用属性和明显类型问题
    status: pending
    dependencies:
      - baseline-audit
  - id: shared-extraction
    content: 抽取共享 Hook、URL 工具、空态图标和测试覆盖
    status: pending
    dependencies:
      - safe-cleanup
  - id: search-devtools-refactor
    content: 使用 [skill:modern-javascript-patterns] 拆分搜索框和开发工具栏
    status: pending
    dependencies:
      - shared-extraction
  - id: settings-bookmark-history-refactor
    content: 拆分外观设置、书签工具箱和历史面板组件
    status: pending
    dependencies:
      - search-devtools-refactor
  - id: store-sw-deduplicate
    content: 去重 Store 与 Service Worker 公共逻辑
    status: pending
    dependencies:
      - settings-bookmark-history-refactor
  - id: final-validation-report
    content: 使用 [skill:javascript-testing-patterns] 完成验证并输出前后对比报告
    status: pending
    dependencies:
      - store-sw-deduplicate
---

## User Requirements

对当前项目进行一次不改变原有功能的深度重构，重点清理冗余、废弃、低效和重复代码，提升整体代码结构、模块化程度、可维护性与可读性。

## Product Overview

本次工作不改变产品现有交互、页面视觉表现、功能入口和用户操作结果。重构后的项目应保持当前新标签页扩展、搜索、标签页管理、书签工具、历史记录、开发工具栏、设置面板等功能行为一致。

## Core Features

- 精准定位并清理未使用变量、死代码、重复逻辑、低效实现和过度嵌套结构。
- 将多文件重复出现的空态、图标、卡片、工具栏、列表、弹窗等界面模块抽取为可复用组件。
- 将重复业务逻辑抽取为共享工具函数或自定义 Hook。
- 拆分过大的页面和组件，降低单文件职责复杂度。
- 修复现有类型安全问题和明显的弃用用法。
- 输出详细重构记录，包含每个重构点、优化前后对比、影响范围和验证结果。
- 保证重构前后功能一致，并通过自动化检查与关键回归验证。

## Tech Stack Selection

- 复用当前项目技术栈：React 19、TypeScript、Vite、Ant Design v6、Zustand、Less CSS Modules、Vitest、ESLint、Knip、pnpm。
- 遵循现有项目规范：共享 UI 放入 `src/shared/ui/`，共享 Hook 放入 `src/shared/hooks/`，共享工具放入 `src/shared/utils/`，功能级组件放入对应 `src/features/*/components/`。
- 不引入新框架和重型依赖，避免扩大构建体积和 Chrome 扩展运行风险。

## Implementation Approach

采用“基线验证 → 低风险清理 → 公共抽取 → 大组件分层 → 状态与后台逻辑手术式去重 → 最终报告”的增量式重构策略。每一阶段只处理明确收益的代码坏味道，并在阶段后运行对应类型检查、单测、Lint、Knip 或构建命令，确保行为不变。

关键决策：

- 先处理现有诊断与低风险问题，再拆大组件，降低后续重构噪音。
- 对 `SearchBox.tsx`、`DeveloperToolsPage.tsx`、`AppearancePanel.tsx`、`BookmarkToolsModal.tsx`、`HistoryPanel.tsx` 等大文件按职责拆分，而不是整体重写。
- 抽取纯函数和 Hook 优先于抽 UI，便于单测保护和行为对齐。
- 对可见功能保持兼容，例如 `ua-parse` 注册但未实现的问题不直接删除，优先实现或记录为需确认项，避免静默改变功能入口。
- Service Worker 只做边界清晰的模块化拆分，必须继续通过 `scripts/build-sw.mjs` 验证 MV3 自包含构建。

## Implementation Notes

- 性能：搜索索引、热榜缓存、历史结果、书签健康扫描、标签页批量关闭等路径避免重复遍历和不必要重渲染；抽取 Hook 时保持 memo、callback 依赖正确。
- 可靠性：Chrome API 调用继续保留现有错误兜底、反馈提示和静默刷新机制；不把 Undo 或持久化失败变成阻塞操作。
- 日志：保留有价值的错误日志，清理或统一非必要 console；避免记录敏感 URL 之外的大 payload。
- 兼容性：Ant Design v6 弃用属性替换必须保持视觉和交互一致；CSS 继续使用 CSS Modules 和设计 Token。
- 变更控制：不做无关格式化，不大范围重排代码；每批重构后记录 before/after 和验证结果。

## Architecture Design

当前结构保持不变，新增公共层和功能内子模块以降低耦合：

- `shared/ui`：跨功能复用的展示组件，如站点图标、空态增强、统计卡等。
- `shared/hooks`：跨功能复用 Hook，如防抖、相对时间等。
- `shared/utils`：纯工具函数，如 URL 归一化、localStorage 字符串数组读写、搜索高亮 token 化。
- `features/search`：搜索索引、搜索来源、键盘导航、搜索结果 UI 分层。
- `features/developer-tools`：工具注册、执行器、选项状态、输入输出面板分离。
- `features/settings`：外观设置按皮肤、渐变、背景媒体、遮罩、布局、可见性拆分。
- `features/bookmarks`：书签工具箱按 overview、dedupe、health、organize、empty folders 拆分 Hook 和 Panel。
- `features/history`：历史分组、筛选、快照对比、列表展示分离。
- `store` 与 `sw`：只抽取重复 helper，不改变 Store API 与广播协议。

## Directory Structure Summary

本次重构会以现有目录为基础新增少量组件、Hook、工具文件，并修改高复杂度文件。以下为计划内文件范围：

```
/Users/yorke/Desktop/tabs/
├── docs/
│   └── refactor-report.md
│       [NEW] 重构报告。记录所有重构点、前后对比、验证命令、剩余风险与延期项。
├── src/
│   ├── shared/
│   │   ├── hooks/
│   │   │   ├── use-debounce.ts
│   │   │   │   [NEW] 通用防抖 Hook。替代 DeveloperToolsPage 内部防抖，并供搜索模块复用。
│   │   │   └── use-relative-time.ts
│   │   │       [NEW] 通用相对时间 Hook。由 HistoryPanel 的本地实现抽取，保持文案翻译行为一致。
│   │   ├── ui/
│   │   │   ├── FeatureEmptyState.tsx
│   │   │   │   [MODIFY] 小幅增强 key 稳定性和类型定义，保持视觉不变。
│   │   │   ├── FeatureEmptyState.module.less
│   │   │   │   [AFFECTED] 配合空态复用时仅做必要样式补充。
│   │   │   ├── SiteIcon.tsx
│   │   │   │   [NEW] 统一 favicon 与首字母兜底展示，供书签、历史、搜索等复用。
│   │   │   └── StatCard.tsx
│   │   │       [NEW] 通用统计卡片组件，优先承接 BookmarkToolsModal 中的重复统计展示。
│   │   └── utils/
│   │       ├── metadata-key.ts
│   │       │   [NEW] URL metadata key 归一化工具，统一 metadata store 与搜索模块逻辑。
│   │       ├── storage-array.ts
│   │       │   [NEW] localStorage 字符串数组安全读写工具，替代功能内重复实现。
│   │       └── search-highlight.ts
│   │           [NEW] 搜索高亮纯逻辑，输出 token 后由 UI 渲染，便于单测。
│   ├── store/
│   │   ├── metadata-slice.ts
│   │   │   [MODIFY] 改用共享 URL 归一化工具，保持 tags、notes、pins key 兼容。
│   │   ├── tabs-slice.ts
│   │   │   [MODIFY] 抽取关闭标签、Undo 安全写入、批量目标计算等重复逻辑。
│   │   └── undo-slice.ts
│   │       [MODIFY] 抽取 TTL 过滤逻辑，减少 loadRecords 与 cleanExpired 重复。
│   ├── features/
│   │   ├── search/
│   │   │   ├── SearchBox.tsx
│   │   │   │   [MODIFY] 保留容器职责，移出索引、来源、键盘导航和结果渲染。
│   │   │   ├── SearchBox.module.less
│   │   │   │   [MODIFY] 按拆出的组件迁移类名，保持现有视觉。
│   │   │   ├── components/
│   │   │   │   ├── SearchEngineSwitcher.tsx
│   │   │   │   ├── SearchResultItem.tsx
│   │   │   │   ├── SearchResultList.tsx
│   │   │   │   ├── SearchShortcutHints.tsx
│   │   │   │   └── SearchEmptyState.tsx
│   │   │   │       [NEW] 搜索弹层 UI 子组件，拆分结果项、引擎切换、快捷提示和空态。
│   │   │   ├── hooks/
│   │   │   │   ├── use-search-index.ts
│   │   │   │   ├── use-search-sources.ts
│   │   │   │   ├── use-search-engines.ts
│   │   │   │   └── use-search-keyboard-navigation.ts
│   │   │   │       [NEW] 搜索索引、数据来源、引擎状态、键盘导航逻辑。
│   │   │   └── utils/
│   │   │       └── search-items.ts
│   │   │           [NEW] 搜索结果组装、排序、分组纯函数。
│   │   ├── developer-tools/
│   │   │   ├── DeveloperToolsPage.tsx
│   │   │   │   [MODIFY] 降为页面编排容器，移出工具运行、侧栏、面板和输出渲染。
│   │   │   ├── local-tools.ts
│   │   │   │   [MODIFY] 保持导出兼容，逐步拆分或转发到分类工具文件。
│   │   │   ├── tool-registry.ts
│   │   │   │   [MODIFY] 集中工具元数据与执行映射，减少新增工具多处修改。
│   │   │   ├── components/
│   │   │   │   ├── ToolSidebar.tsx
│   │   │   │   ├── ToolPanel.tsx
│   │   │   │   ├── ToolOptions.tsx
│   │   │   │   ├── ToolInputArea.tsx
│   │   │   │   └── ToolOutput.tsx
│   │   │   │       [NEW] 开发工具栏 UI 子组件。
│   │   │   └── hooks/
│   │   │       ├── use-tool-runner.ts
│   │   │       └── use-devtool-favorites.ts
│   │   │           [NEW] 工具执行与收藏状态管理。
│   │   ├── settings/
│   │   │   ├── panels/AppearancePanel.tsx
│   │   │   │   [MODIFY] 拆为外观设置编排组件，保留原功能入口。
│   │   │   ├── panels/styles/appearance.module.less
│   │   │   │   [MODIFY] 配合子组件迁移样式，避免全局类名扩散。
│   │   │   ├── components/Field.tsx
│   │   │   │   [AFFECTED] 如需承接更通用设置字段布局，只做兼容增强。
│   │   │   ├── panels/appearance/
│   │   │   │   ├── SkinPresetSelector.tsx
│   │   │   │   ├── GradientPresetSelector.tsx
│   │   │   │   ├── CustomGradientEditor.tsx
│   │   │   │   ├── BackgroundImageSettings.tsx
│   │   │   │   ├── BackgroundVideoSettings.tsx
│   │   │   │   ├── BackgroundOverlaySettings.tsx
│   │   │   │   ├── LayoutDensitySettings.tsx
│   │   │   │   └── UiVisibilitySettings.tsx
│   │   │   │       [NEW] 外观设置子模块。
│   │   │   └── utils/background-media.ts
│   │   │       [NEW] 背景图压缩、文件校验和媒体常量。
│   │   ├── bookmarks/
│   │   │   ├── BookmarkToolsModal.tsx
│   │   │   │   [MODIFY] 保留弹窗编排，拆出各工具 Hook 与 Panel，修复弃用属性。
│   │   │   ├── bookmark-tools.ts
│   │   │   │   [AFFECTED] 纯业务逻辑保持兼容，必要时补充导出供 Hook 使用。
│   │   │   ├── bookmark-tools.module.less
│   │   │   │   [MODIFY] 按子组件整理样式。
│   │   │   ├── hooks/
│   │   │   │   ├── use-bookmark-overview.ts
│   │   │   │   ├── use-bookmark-dedupe.ts
│   │   │   │   ├── use-bookmark-health.ts
│   │   │   │   ├── use-bookmark-organize.ts
│   │   │   │   └── use-empty-bookmark-folders.ts
│   │   │   │       [NEW] 书签工具箱各能力状态与操作。
│   │   │   └── components/
│   │   │       ├── BookmarkToolsSidebar.tsx
│   │   │       ├── BookmarkToolsOverview.tsx
│   │   │       ├── BookmarkDedupePanel.tsx
│   │   │       ├── BookmarkHealthPanel.tsx
│   │   │       ├── BookmarkOrganizePanel.tsx
│   │   │       └── BookmarkEmptyFoldersPanel.tsx
│   │   │           [NEW] 书签工具箱 UI 分区。
│   │   ├── history/
│   │   │   ├── HistoryPanel.tsx
│   │   │   │   [MODIFY] 拆分抽屉编排、关闭记录、窗口记录、事件时间线和快照对比。
│   │   │   ├── HistoryPanel.module.less
│   │   │   │   [MODIFY] 配合组件拆分整理样式。
│   │   │   ├── history-utils.ts
│   │   │   │   [NEW] 时间桶、事件类型分组、筛选等纯函数。
│   │   │   └── components/
│   │   │       ├── SnapshotDiffCard.tsx
│   │   │       ├── ClosedTabsList.tsx
│   │   │       ├── ClosedWindowsList.tsx
│   │   │       ├── HistoryEventTimeline.tsx
│   │   │       └── HistoryToolbar.tsx
│   │   │           [NEW] 历史面板子组件。
│   │   ├── tabs/
│   │   │   ├── DuplicatePreviewModal.tsx
│   │   │   │   [MODIFY] 修复当前 unsafe any 诊断。
│   │   │   ├── BookmarkTreeView.tsx
│   │   │   │   [MODIFY] 替换明确的弃用属性，避免行为变更。
│   │   │   └── widgets helpers source file
│   │   │       [NEW or MODIFY] 将测试中重复的 widget 纯逻辑抽到源代码后由测试直接覆盖。
│   │   ├── quick-start/SiteCard.tsx
│   │   │   [MODIFY] 收紧拖拽属性类型，移除不必要 any 和 eslint-disable。
│   │   ├── trending/TrendingPage.tsx
│   │   │   [MODIFY] 替换 `as any` 为准确类型。
│   │   └── sessions/OnboardingCard.tsx
│   │       [MODIFY] 替换 Ant Design 弃用属性，保持引导流程不变。
│   ├── sw/
│   │   ├── index.ts
│   │   │   [MODIFY] 仅在验证充分时拆分明显独立的快照、统计、菜单、告警逻辑。
│   │   ├── tab-snapshot-cache.ts
│   │   ├── daily-snapshot.ts
│   │   ├── stats-collector.ts
│   │   └── sw-events.ts
│   │       [NEW] Service Worker 内聚模块，必须通过独立 SW 构建验证。
│   └── shared/types/
│       [AFFECTED] 如抽取组件或 Hook 需要共享类型，仅补充必要类型定义。
├── tests/
│   └── unit/
│       ├── searchbox-nav.test.ts
│       │   [AFFECTED] 搜索键盘导航回归保护。
│       ├── developer-tools.test.ts
│       │   [AFFECTED] 开发工具纯函数回归保护。
│       ├── widgets-helpers.test.ts
│       │   [MODIFY] 改为测试源代码工具函数，删除测试内重复实现。
│       ├── metadata-key.test.ts
│       │   [NEW] URL metadata key 归一化兼容测试。
│       ├── search-highlight.test.ts
│       │   [NEW] 搜索高亮 token 化测试。
│       └── history-utils.test.ts
│           [NEW] 历史分组与筛选纯函数测试。
└── package.json / knip.json / vite.config.ts
    [AFFECTED] 原则上不修改；仅用于验证现有脚本和入口配置。
```

## Key Code Structures

本计划默认优先用文字和现有类型约束实现。必要的新结构仅限以下接口级约定：

- 共享 Hook：`useDebounce` 接收任意值和延迟毫秒数，返回防抖后的同类型值。
- URL 工具：提供与现有 metadata key 兼容的归一化函数，供 store 与 search 共用。
- 搜索高亮：纯函数返回文本 token 列表，React 组件只负责渲染，避免 UI 和匹配逻辑耦合。

## Validation Plan

阶段性验证：

- 基线与低风险清理：`pnpm run type-check`、`pnpm run lint`、`pnpm run knip`
- 搜索重构：`pnpm run test -- tests/unit/searchbox-nav.test.ts`、`pnpm run type-check`
- 开发工具重构：`pnpm run test -- tests/unit/developer-tools.test.ts`、`pnpm run type-check`
- Store 与 SW：`pnpm run test`、`node scripts/build-sw.mjs`、`pnpm run check-quota`
- 最终闸口：`pnpm run build:strict`、`pnpm run check-quota`

## Agent Extensions

### Skill

- **karpathy-guidelines**
- Purpose: 控制重构范围，避免过度设计和无关改动。
- Expected outcome: 每个变更都能追溯到用户重构目标，并保持行为不变。

- **modern-javascript-patterns**
- Purpose: 指导 TypeScript、Hook、纯函数抽取和现代前端模块化重构。
- Expected outcome: 形成更清晰、低耦合、可测试的模块结构。

- **javascript-testing-patterns**
- Purpose: 为抽取的工具函数、Hook 和关键行为补充 Vitest 回归测试。
- Expected outcome: 关键逻辑在重构后有自动化测试保护。

- **writing-plans**
- Purpose: 将深度重构拆成可执行、可验证的阶段计划。
- Expected outcome: 每阶段具备明确文件范围、验证命令和交付记录。

### SubAgent

- **code-explorer**
- Purpose: 在执行前和关键阶段继续做只读跨文件审计，定位重复逻辑、死代码和风险依赖。
- Expected outcome: 减少遗漏，确保清理与抽取基于真实调用关系。