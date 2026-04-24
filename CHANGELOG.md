# Canopy Changelog

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
