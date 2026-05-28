# GroveTab 项目记忆

## 当前版本：1.3.0

## 产品定位

单机标签管理浏览器扩展，不考虑云同步/团队协作。

## 核心架构决策

- **视图合并**：domain/compact/grid → 统一 `tabs` 视图 + `tabsLayout`（masonry/compact/grid）
- **ViewDock**：6 个视图（tabs/timeline/tabgroup/window/frequency/kanban），archive 为隐藏视图
- **设置面板**：4 Tab（appearance/behavior/system/about），shortcuts 并入 behavior
- **Bookmark 目录**：`features/bookmarks/`（从 tabs/ 迁出）
- **LEGACY_VIEW_MAP**：旧设置自动迁移（domain→tabs+masonry 等）

## 关键功能实现

- **使用时长追踪**：SW FocusTimeTracker，按 URL×day 聚合，30天保留，useFocusTime hook
- **自动化规则引擎**：ScheduledCondition（定时清理）+ OnEventCondition（事件触发），kind 判别字段
- **工作区模板**：保存当前标签组为模板，一键恢复
- **悬停预览卡片**：TabPreviewCard（Popover），含 URL/时长/域名/操作
- **关闭退场动画**：is-closing class + CSS transition

## 近期动态（2026-05-28）

### UI 设计体系修复

1. **浮层覆盖提取（P0 ✅）**
   - 新建 `shared/styles/_floating-overrides.less`，newtab 和 popup 共享
   - 配置 Vite `css.preprocessorOptions.less.paths` 支持 `@import '@/...'`

2. **间距 token 补齐（P1 ✅）**
   - 修正编号：space-5 从 24px→20px（线性编号：5×4px=20px）
   - 新增 space-5(20px)/7(28px)/8(32px)/10(40px)/12(48px)/16(64px)
   - 迁移所有旧引用：space-5(24px旧)→space-6(24px新)，space-6(32px旧)→space-8(32px新)

3. **newtab/index.less 拆分（P0 ✅）**
   - 1422 行 → 20 行入口 + 6 个职责文件

4. **SiteIcon CSS Module 迁移（P1 ✅）**
   - 消除内联样式，CSS 变量 --site-icon-size 驱动尺寸

5. **硬编码间距/圆角 token 化（P1 ✅）**
6. **manifest.json minimum_chrome_version: "111"**（P2 ✅）
7. **app-shell.less 拆分（P0 ✅）**：1336 行 → 6 个职责文件
8. **TSX 内联样式清零（P1 ✅）**：34→23 处，剩余均为动态值
9. **!important 策略分析（P1 ✅）**：124 处中 90% 为 antd v6 必要覆盖

### 技术债务清理（2026-05-28）

- 删除 15 个 .DS_Store + 2 个空目录
- 删除未使用的 `use-settings-draft.ts`
- 迁移孤儿 `effects.module.less` 到 `_layout.less`（全局样式不应放在 CSS Module 中）
- 清理 console.log：迁移日志精简为 console.info（DEV only）
- inline style → CSS：3 个 Toolbar 搜索框 + TabGroupCard/DomainGroupCard flex + HistoryPanel 3 处 + PermissionDiagnostics 3 处 + MemoryGovernance 1 处
- 删除项目根 .pnpm-store（19MB）
- .gitignore 新增 .pnpm-store/、.workbuddy/、deliverables/

### 关键经验

- Less `@import '~@/...'` 不被 Vite 支持，需配置 paths 并用 `@import '@/...'`
- antd v6 Modal 不支持 padding token，!important 覆盖暂无法消除
- 间距 token 编号变更是破坏性操作，需全项目 grep 迁移
- 同一 TSX 文件 import 两个 CSS Module 时变量名不能重复，需用不同名
- antd 组件 style prop 是官方布局用法，与内联样式滥用不同，保留合理

## 产品规划（2026-05-29）

- 完成窗口模式模块产品能力与 UX 优化完整规划
- PRD + 路线图落盘：`deliverables/product-strategy/prd-window-mode-optimization-2026-05-29.md`
- 3 大目标：操作直达、信息保真、批量提效
- P0（5项）/P1（7项）/P2（5项），总工期 ~12 周
- 关键复用：selection-slice→P0-3、archive-operations→P0-4、useWindowActions→P0-1
- 待确认 7 个决策问题

## 踩坑经验

（以下由 AI 在实际调用中自动积累，请勿手动删除）

### 2026-05-29 产品审计修复

**P0-2 ArchiveView useReducer 重构**
- ArchiveView.tsx 有 15 个 useState，合并为一个 `useReducer(archiveReducer, INITIAL_STATE)`
- `pinyinMatchFn` 是异步加载的回调函数，也放入 reducer state，通过 `SET_PINYIN_MATCH_FN` action 更新
- ArchiveState 包含所有 15 个状态字段 + `pinyinMatchFn`
- ArchiveAction 用 discriminated union (type + payload) 模式，支持 19 种 action

**P1-6 SearchBox handleActivate 重构**
- 原 9 个分支各有重复的 try/catch/window.open 降级逻辑
- 提取 `openUrlSafely(url, active, options?)` 统一辅助函数，内部处理 `createTab → window.open` 降级
- 重构后 `handleActivate` 变为简洁的 switch-case 结构，代码行数 ~130→~50

**P1-7 Insights 内存估算权重模型**
- 基础：80 MB/标签，+ 视频/媒体(300MB)、+ 图片(150MB)、+ JS应用(200MB)
- 通过 URL 路径特征（/watch/, /image/, /doc/）分类估算

**P2-14 bookmark-tools 速率限制**
- 新增 `RateLimiter` 类，按域名隔离 token bucket，每秒 5 请求，并发 3
- `checkOne` 发请求前先 `await rateLimiter.acquire(domain)`

**P2-13 Insights 时间范围选择**
- 导出 `InsightsTimeRange` 类型 `7 | 14 | 30`
- 添加 `Segmented` UI 控件（7d/14d/30d）
- `dailyOpens` useMemo 依赖 `timeRange` 动态计算

**P2-10 getViewComponentMap 缓存**
- module-level `componentMapCache` 变量，只在 register/unregister 时重建
- `invalidateCache()` 在所有修改操作后调用

**P2-11 HistoryAnalysisView 提取**
- 从 HistoryPanel.tsx 提取 ~160 行到 `components/HistoryAnalysisView.tsx`
- 同步清理未使用 import（Select, Spin, Download from antd/lucide-react）
- 修复 `Typography.Empty` → `Empty`（antd v6 正确用法）

**P1-8 trending chrome API 封装**
- TrendingPage 直接调用 `chrome.bookmarks.create`/`chrome.tabs.create`
- 替换为 `createBookmark`/`createTab`（已有抽象层）
- 同时修复了 `.then()` 嵌套地狱，改为 async/await
