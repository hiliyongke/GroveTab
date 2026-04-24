# Canopy Changelog

## [1.3.0] — 2026-04-25 · 打磨与加固 / Polish & Harden

> 本版本聚焦「能用 → 好用」：把半成品做完、把手写实现替换为成熟社区库、把交互流程统一。数据与权限 0 破坏，老用户 `canopy_*` 存储键 100% 兼容。

### 🔧 修复（Fix）

- **Pomodoro 番茄钟**：补全被漏掉的倒计时核心逻辑。基于 `Date.now()` 差值计算，切 Tab 失焦不再卡住；focus→short→focus→long 自动循环；完成时请求 `Notification.permission` 推送通知，拒绝则降级 `message.info`；新增 `pomodoro-engine.ts` 纯函数模块 + 16 个单测（[pomodoro-engine.test.ts](tests/unit/pomodoro-engine.test.ts)）。
- **SearchBox 交互**：方向键导航改为循环（末尾→0 / 0→末尾）；Input 增加 `autoComplete="off" spellCheck={false} aria-label`；Esc 两阶段（有 query 清空 / 空 query 关闭）显式单测覆盖。
- **Popup 工具栏**：最近 Tab 行支持 hover 显示 `X` 一键关闭（调用 `chrome.tabs.remove`）；回车搜索改为读 `searchDefaultEngine` 设置（不再写死 Google）。
- **错误边界**：`ErrorBoundary` 升级支持 `fallback` / `onReset`；Dashboard 每个 Widget 卡片独立包裹，单个 Widget 崩溃不连累整个工作台，附"加载失败 · 点击重试"占位。
- **加载态**：`Suspense` fallback 从 `Spin` 升级为 `SkeletonWidget` 骨架屏，尊重 `prefers-reduced-motion`。

### 🔁 替换（Replace）—— 重要架构变更

- **Dashboard 网格 → `react-grid-layout` 2.x**（[DashboardWidgets.tsx](src/features/dashboard-widgets/DashboardWidgets.tsx)）：删除 260+ 行手写指针事件 + 碰撞推挤算法。新增响应式断点（lg/md/sm → 12/8/1 列）、垂直紧凑、占位预览、触屏支持；附 `layout-migrator.ts` 迁移旧 `{x,y,w,h}` → RGL `Layout[]`（9 个单测）。
- **Kanban / SpeedDial / Todo / Sticky 拖拽 → `@dnd-kit`**：用 `DndContext + SortableContext` 统一替换原生 HTML5 drag API 与"← →"按钮排序。PointerSensor（distance:6）+ TouchSensor（delay:200）+ KeyboardSensor 标配，无障碍和触屏双提升。
- **农历 → `lunar-typescript`**（[lunar-cn.ts](src/features/hero-widgets/lunar-cn.ts)）：删除手写压缩表（仅支持 2024-2035 年），切换为官方 TS 库，覆盖 1900-2100、原生支持干支 / 节气 / 节日。通过动态 `import()` 仅在 CalendarWidget 挂载时加载（`vendor-lunar` chunk），首屏 0 影响。
- **全局快捷键 → `tinykeys`**（[use-keybinding.ts](src/shared/hooks/use-keybinding.ts)）：用 ~1 KB gz 的 tinykeys 替换手写 `parseKeybinding`，标准化修饰键语义；`Mod+K` 语法仍向后兼容，内部转义为 `$mod+KeyK`。

### ✨ 增强（Enhance）

- **StickyWidget 大改**：单条 → 最多 10 条；5 色可选（黄/粉/绿/蓝/紫）；行内 `TextArea` 自动扩展 + 失焦自动保存 + 空内容自动删除；Popconfirm 确认删除；`@dnd-kit/sortable` 纵向拖拽排序；旧数据自动迁移（`#hex` → 色代号）。
- **TodoWidget 完成率**：顶部显示"N/M 完成"胶囊；已完成项超 24h 自动折叠分组，可一键展开；hover 显示删除按钮；Esc 清空输入保留焦点；`@dnd-kit/sortable` 拖拽排序。
- **SpeedDialWidget**：去除"← →"按钮，改为 hover 显示拖拽句柄；点击与拖拽通过 `activationConstraint: { distance: 6 }` 区分；网格 `rectSortingStrategy`。
- **JSON Widget 语法高亮**：自写 ~100 行 tokenizer（key/string/number/boolean/null/punct 六类），CSS 类按主题染色；解析失败时从 `position N` 反推行列号，提示"第 X 行 第 Y 列"。
- **天气双源降级**：抽出 `weather-providers.ts`，实现 `fetchWttr` + `fetchOpenMeteo` + `fetchGeo` 链式降级；主源 5s 超时后自动切备；全部失败但有缓存 → 展示"离线"徽标；无缓存 → "点击重试"按钮清缓存。

### 兼容性

- 所有 `canopy_*` 存储键保持不变；老用户升级 v1.2 → v1.3 数据 0 破坏。
- StickyWidget 存量单条便签自动迁移到多条结构，颜色代号归一。
- 新增的重型依赖（`react-grid-layout` / `lunar-typescript` / `@dnd-kit` / `react-resizable`）全部通过独立 chunk + 动态 `import()` 按需加载，首屏 JS 预算（≤ 280KB raw / 90KB gz）不突破。
- 单测总数 102 → **141**（+39）：覆盖番茄钟引擎、layout 迁移、Kanban reducer、widgets helpers、lunar-typescript 薄封装、JSON tokenizer、天气 provider fallback、SearchBox 循环导航共 8 个新文件。

---

## [1.2.0] — 2026-04-25 · 林栖回响

> 围绕「让标签页更有温度」打造的一次增量升级。数据与权限 0 破坏，老用户直升即可。

### 每日金句

- **200+ 条中文金句内置**：名言警句、人民日报·夜读、古诗词、现代散文四档分类（[quotes-data.ts](src/features/quotes/quotes-data.ts)）。
- **DailyQuote Widget**：挂在 HeroWidgets 之下，按本地日期稳定选取今日金句（同一天同一设备不会跳字）；右上角三个按钮：♥ 收藏 / ⧉ 复制 / ↻ 换一句。
- **设置细化**：`BehaviorPanel` 新增每日金句区——显隐开关、分类多选、字号档位（S/M/L/XL）、作者/出处显隐、一键清空收藏。

### 点击动效

- 新增 `ClickEffectLayer`（全屏 Canvas + 粒子系统），5 套预设：
  - `off`（默认）/ `ripple` 涟漪 / `sparkle` 星光 / `confetti` 彩纸 / `petal` 樱花。
- 性能：rAF 驱动，空闲时自动停；粒子上限 150；尊重 `prefers-reduced-motion`。
- 按需加载：`feat-effects` chunk，默认关闭时不拉取 Canvas 代码。

### 视频背景

- 在原有 color / gradient / image 基础上新增 `video` 壁纸类型：
  - **URL 模式**：直接粘贴视频地址。
  - **本地文件模式**：`IndexedDB` 持久化，不上传任何数据。
- 全局 `<video autoplay loop muted playsinline>` 背景层，`visibilitychange` 自动 pause/resume 省电；`reducedMotion` 时停留在首帧。
- 播放速率可调（0.25× ~ 2×），默认 1×。

### 关于 GroveTab

- 新增 **About Tab**（设置面板第 5 个 Tab）：品牌 Hero、6 个核心能力卡片、使用小贴士、开源 / 反馈 / 更新日志三个外链。
- **Popup 底部**加"关于 GroveTab"链接，点击打开新 Tab 并自动跳到 About（URL hash `#about`）。

### 工程与体积

- manifest / package 版本 → `1.2.0`；所有新功能通过独立 chunk 按需加载，不影响首屏体积预算。
- 新增 [DailyQuote.tsx](src/features/quotes/DailyQuote.tsx)、[ClickEffectLayer.tsx](src/features/effects/ClickEffectLayer.tsx)、[VideoBackground.tsx](src/features/effects/VideoBackground.tsx)、[AboutPanel.tsx](src/features/settings/panels/AboutPanel.tsx)。

### 兼容性

- 存储键名保持 `canopy_*` 不变。新增：`canopy_quote_favs`（金句收藏，直接走 chrome.storage）和 IndexedDB `grovetab-video`（视频文件）。
- 老用户升级后数据 100% 可用；所有新特性默认值保守（点击动效 off、视频背景 none），不会打扰既有体验。

---

## [1.1.0] — 2026-04-25 · GroveTab 版本

> 本版本将产品从 Canopy 更名为 **GroveTab（林栖标签页）**，并在 v1.0 能力基础上做深度扩展。旧用户数据 100% 兼容（存储键名保持 `canopy_*`）。

### 品牌与身份

- **新品牌：GroveTab**。Slogan：「你的标签页，找到归属 · Where your tabs find their place.」
- 引入 **产品身份配置层** `src/shared/config/brand.ts`，将品牌名 / Slogan / Logo / 主色 / 日志前缀集中管理，后续可轻松衍生子品牌。
- HeroBar 下方展示 Slogan，i18n 文案、manifest、SW 日志前缀、Popup 全部走 BRAND 配置层。

### HeroWidgets 三件套

- **时钟**：大号数字时钟，12/24 制 + 秒针 + 周几/日期，`visibilitychange` 节能。
- **天气**：IP 自动 / 手动城市 / 关闭 三档；wttr.in 主源（CORS 友好，国内可达），30 分钟本地缓存，离线回退最后一次有效值并标识。
- **日历**：当日大号数字 + 月/周几 + **中国法定节假日** + 简易 **农历**（本地压缩表，2024-2035 覆盖），零网络请求。
- HeroWidgets 容器支持 `trio / clockWeather / clockOnly / hidden` 四种布局模式。

### 皮肤与极客定制

- 新增 **Nord**（北欧寒色）和 **Solarized**（太阳化）两套预设，共 7 套主流皮肤。
- **UI Token 极客定制**：在任一皮肤预设之上覆盖单项 token（圆角 / 基础字号 / 控件高度 / 边框粗细 / 品牌主色），所有设置可"一键恢复预设默认"。
- `AntdThemeProvider` 按 `skinCustom` 合成最终主题，不影响未启用用户。

### 搜索体验

- **默认搜索引擎改为 Bing**（国内可达，体验最接近 Google）。
- **热词来源三档**：`off / local（默认，基于本地搜索历史聚合）/ preset / trending（预留）`；BehaviorPanel 增加清空最近搜索按钮。
- SearchBox **快捷键完善**：Cmd/Ctrl + K 再次关闭、Cmd/Ctrl + 1..9 直接选择第 N 个引擎搜索、空输入时 Escape 关闭 Modal、Alt + Enter 后台打开。
- `useKeybinding('search')` 改为 toggle 行为。

### 抗抖动

- `html { scrollbar-gutter: stable }` 全局预留滚动条槽位，消除因滚动条出现/消失导致的页面横向抖动。
- **BookmarkView** 改造为**固定高度 flex 布局**：搜索栏固定、结果区独立滚动，Tree ↔ List 切换时外框尺寸恒定。

### 书签能力加强

- 新增 **BookmarkToolsModal**：
  - **去重**：复用 `normalizeUrl + dedupStrictness`，扫描重复书签并批量合并。
  - **失效检测**：`<all_urls>` 按需授权；并发 HEAD/GET 探测（5 并发、6s 超时），识别 dead / timeout 书签并批量清理。
  - **智能整理**：按域名聚类（≥ 3 个书签/域名），一键在"其他书签"下建新文件夹并批量归入。

### 一键重置三件套（危险区）

- **恢复默认配置**：重置所有设置为默认值，保留数据（归档 / 书签 / 历史）。
- **重播 Onboarding**：重置 `canopy_onboarding_done` 标志。
- **全量重置**：清除所有 `canopy_*` 键，Modal 二次确认（需手动输入 `RESET`）。

### 快捷键

- ShortcutsPanel 加入**冲突检测**：多动作共用同一组合键时高亮警告；与 Chrome 全局快捷键冲突时提示全局快捷键优先。

### 工程

- `package.json` / `manifest.json` 版本号 → `1.1.0`；Chrome command `open-canopy` → `open-grovetab`。
- 存储键名（`canopy_*`）向下兼容保持不变，老用户升级后数据完整可用。

---

## [1.0.0] — 2026-04-24 · 封板正式版

### 首页与工作流

- **DashboardOverview（F-34）**：HeroBar 下新增工作台概览卡片，一目了然当前 Tab/域名/窗口/重复/闲置/最近归档，点击每项直达对应视图；3 个高频操作按钮（搜索 / 一键整理 / 归档当前窗口）。
- **Onboarding v2（F-25 升级）**：欢迎屏双模式（接管新标签页 / 仅工具栏），选择后 3 步微引导（工作台总览 → 归档演示 → 快捷键帮助），支持 ←/→/Esc 键盘导航。
- **ActivityStrip（F-27）**：最近操作状态区（60 分钟窗口内显示），每条胶囊带图标 + 摘要 + 最多 2 个快捷动作（撤销 / 查看归档 / 查看导入结果）。
- **Popup 工具栏轻量版（F-26）**：360×520 四区（品牌 / 搜索 / 最近 10 个激活 Tab / 归档当前窗口 + 打开工作台），点击列表行直接聚焦目标 Tab。

### 整理、去重与闲置

- **去重严格度三档（F-13）**：`strict` / `loose`（默认，忽略 #hash + utm_* / fbclid / gclid）/ `off`；设置面板即时生效，Dashboard 徽标同步。
- **闲置阈值可配（F-13）**：360 / 720 / 1440 / 4320 / 10080 分钟；默认 24h；pinned 与 discarded tabs 不再被标记。
- **DuplicatePreviewModal（需求 6）**：合并前可按组查看、按单选保留项（默认最旧）、底部"将关闭 N / 保留 M"实时统计、"合并 / 忽略 / 全不勾选 / 全部最旧"四按钮；合并走单条 Undo。
- **SelectionMode 摘要强化**：已选 N · M 域名 · K 窗口；Cmd+A/Esc 键盘支持；BatchActionBar 一步批量操作后单条 Undo（富 Toast）。

### 归档、会话与 Undo

- **UndoToast 富交互（F-06 封板）**：归档场景展示"已归档 N 个标签到「{会话名}」"+ 查看归档按钮；关闭失败场景副行展示提示；5s 内可撤销。
- **会话合并**：ArchivePanel 多选模式，把多个会话合并为一个、按 URL 去重。
- **会话分享**：单会话一键导出 JSON（含 schema version）。
- **三种恢复策略（F-14）**：新窗口 / 当前窗口 / 部分恢复；超过 30 Tab 自动分批（10 / 批，100ms 间隔），支持进度与取消。
- **自动快照（F-23）**：SW 按频率闹钟（off / 6h / 12h / 24h）静默快照当前窗口 ≥10 个 Tab 的隐藏会话；最多保留 20 个自动快照。

### 搜索与统计

- **搜索语法（F-05b）**：解析 `site:` / `in:(archive|live|bookmark)` / `tag:` / `has:note` / `pinned:true` 多条件 AND 组合，剩余部分作为自由关键词。
- **SW StatsCollector（F-11 升级）**：onActivated 事件聚合 URL × day 的激活次数，30s flush + onSuspend 强刷；保留最近 30 天；FrequencyView 优先消费该数据，缺失时回退 lastAccessed 并标"数据重建中"。
- **InsightsPanel（F-28）**：本地隐私洞察 4 卡片（近 7 天每日打开次数折线、Top 10 访问域名柱状、累计归档估算内存、Top 5 高频动作）；一键清除所有本地统计。

### 导入导出与数据

- **多格式导出（F-15）**：JSON / Markdown / TXT / Netscape HTML（可被 Chrome / Edge / Firefox 导入）。
- **多格式导入（F-15）**：JSON / HTML / OneTab；`parseImportAuto` 自动识别；体量上限 5 MB / 20K 行 / 单会话 500 KB。
- **三种冲突策略**：`skip`（按 URL 去重，默认）/ `append`（全部追加为新会话）/ `replace`（清空后全量替换）。
- **OG description 抓取（F-24，可选）**：`enableOgFetch=true` 且授权 `<all_urls>` 时 SW 按页面加载完成触发；5 并发 / 3s 超时 / 50KB 截断；LRU 10000 条索引。

### Workspace 与看板

- **WorkspaceSwitcher（F-29）**：Header 上显示当前工作区 chip；Dropdown 切换；最多 3 个（免费版）。
- **KanbanView（F-20）**：默认 4 列（工作 / 学习 / 娱乐 / 待看），左侧 Tab 源栏 + HTML5 DnD；拖拽不关闭原 Tab；列内卡片离线灰态，点击重开或跳转；支持"另存为归档会话"。

### 性能、治理与埋点

- **首屏主入口 ≤ 280 KB / 90 KB gz**：实测 **67.80 KB / 20.39 KB gz**。
- **manualChunks 策略**：vendor-react/react-dom/antd/search/motion/icons/zustand 独立；feat-{settings,sessions,search,insights,workspace,kanban} 按需加载。
- **性能采样**：FCP（PerformanceObserver）+ 10s FPS p50/p95；样本事件写入 `canopy_metrics`。
- **事件型埋点**：`track(event, payload)` 覆盖 view_switch / archive / restore / dedup_merge / snapshot 等；最多 2000 条，永不上传。
- **check-quota.mjs**：对 `dist/` 产物按 newtab-raw/gz / sw / css / chunk 做硬阈值校验，CI 可直接调用。

### 存储与迁移

- **Schema v2**：新增 `canopy_settings` 多字段、`canopy_activity` / `canopy_workspaces` / `canopy_kanban` / `canopy_og_index` / `canopy_auto_snapshot_meta` / `canopy_metric_counters` 存储键。
- **MigrationRunner**：v1 → v2 物化默认值、不破坏用户已有设置；无回退风险。

### 测试

- **单测 79 用例全绿**（基线 43 → +84%）：新增 parse-query / import-export / idle-detect / dedupe-strictness 用例。

### 其他

- i18n 字典扩展 zh-CN / en：新增 onboarding v2 / activity / dashboard / dedup preview / archive merge+share / workspace / kanban / insights 共 70+ 条。
- manifest：`__MSG_appName__` / `__MSG_appDescription__` 本地化标签；版本标至 1.0.0。

— 以上变更在"不改动现有工作内容"约束下完成；所有既有 API、视图、快捷键向下兼容。
