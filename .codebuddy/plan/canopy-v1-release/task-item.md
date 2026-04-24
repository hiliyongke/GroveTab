# Canopy v1.0 封板 —— 实施计划

> 对应需求文档：[requirements.md](./requirements.md)（共 23 项需求，覆盖 PRD v1.0 F-01 ~ F-34）
> 执行原则：在现有代码基础上**扩展和完善**，保持已落地功能行为不变；严格按顺序推进，每个顶级任务交付后可独立验证。

---

- [ ] 1. **数据层与 Store 扩展**：为本次封板新增的所有字段与切片打好地基
  - 1.1 在 [settings-slice.ts](/Users/yorke/Desktop/tabs/src/store/settings-slice.ts) 新增 `dedupStrictness`、`idleThresholdMinutes`、`autoSnapshotFrequency`、`enableOgFetch`、`overrideNewTab`、`uiVisibility.activityStrip`、`lastActiveWorkspaceId`、`customKeybindings` 等字段，并提供默认值；在 [storage-repo.ts](/Users/yorke/Desktop/tabs/src/repositories/storage-repo.ts) 增加 `schemaVersion` 迁移兜底（缺失字段给默认值、不抛错）
  - 1.2 在 [metadata-slice.ts](/Users/yorke/Desktop/tabs/src/store/metadata-slice.ts) 新增 `recentActivity: ActivityRecord[]` ring buffer（20 条 / 72h 过期）、`searchHistory`（20 条 LRU）、`workspaces`（最多 3 个），并暴露 `pushActivity` / `pushSearch` / `upsertWorkspace` actions
  - 1.3 新增 `src/store/stats-slice.ts`（SW 激活计数 URL×day 聚合 30 天）、`src/store/kanban-slice.ts`（列与 URL 列表），以及 [shared/types.ts](/Users/yorke/Desktop/tabs/src/shared/types.ts) 的 `ActivityRecord / Workspace / KanbanColumn / SearchHistoryEntry / TagEntry` 类型定义
  - _需求：1.10、2.5、5.1、7.1、12.2、12.3、13.12、14.3、17.1、18.3、19.3、20.1、21.1、23.1_

- [ ] 2. **首页工作台三件套**：Dashboard Overview / Onboarding v2 / Activity Strip
  - 2.1 新增 `src/features/dashboard/DashboardOverview.tsx`：6 个统计卡片（标签页 / 域名 / 窗口 / 重复 / 闲置 / 最近归档）+ 3 个高频入口按钮（搜索 / 一键整理 / 归档当前窗口），点击分别触发滚动 / 视图切换 / 展开 TidySuggestionBar / 打开 ArchivePanel；空值走"中性灰态"禁用点击；使用 `React.memo + useMemo` 一次 render 完成首帧
  - 2.2 升级 [OnboardingCard.tsx](/Users/yorke/Desktop/tabs/src/features/sessions/OnboardingCard.tsx) 为 v2 双模式：欢迎屏（🌐 接管 / 🧩 仅工具栏）→ 3 步微引导（工作台总览 / 归档演示 / 快捷键帮助），支持 `→/←/Esc` 键盘导航；完成后写 `canopy_onboarded: true`
  - 2.3 新增 `src/features/dashboard/ActivityStrip.tsx`：读取 `metadata-slice.recentActivity`，仅在最近条目 ≤ 60min 时渲染胶囊条，每条含图标 + 摘要 + 1-2 个行动按钮（↩ 恢复 / 查看）；`uiVisibility.activityStrip=false` 时不渲染
  - 2.4 在 [App.tsx](/Users/yorke/Desktop/tabs/src/pages/newtab/App.tsx) 按 `HeroBar → ActivityStrip → DashboardOverview → TidySuggestionBar → 主视图` 顺序挂载
  - _需求：1.1–1.12、2.1–2.8、20.1–20.7_

- [ ] 3. **Popup 工具栏轻量版**（F-26）
  - 3.1 重写 [popup/App.tsx](/Users/yorke/Desktop/tabs/src/pages/popup/App.tsx) 为 360×520 四区：顶部全局搜索（动态 `import()` 加载核心搜索逻辑）、中部最近 10 个激活 Tab 列表（`chrome.tabs.query` 按 `lastAccessed` 倒序）、底部"归档当前窗口"大按钮（复用 `archiveCurrentWindowTabs()`）+ "打开工作台"按钮
  - 3.2 在 [sw/index.ts](/Users/yorke/Desktop/tabs/src/sw/index.ts) 处理 `chrome.action.onClicked` 与 `Alt+C` 快捷键，按 `settings.overrideNewTab` 决定是否打开工作台 URL；Popup 首屏 ≤ 200ms（延迟加载非关键模块）
  - 3.3 无 Tab 时置灰归档按钮并显示提示
  - _需求：2.6、3.1–3.7_

- [ ] 4. **去重 / 闲置 / 多选体验升级**（需求 5、6、7、8）
  - 4.1 扩展 [shared/utils/dedupe.ts](/Users/yorke/Desktop/tabs/src/shared/utils/dedupe.ts) 支持 `strict | loose | off` 三档；扩展 [idle-detect.ts](/Users/yorke/Desktop/tabs/src/shared/utils/idle-detect.ts) 读取 `settings.idleThresholdMinutes`；在 [BehaviorPanel.tsx](/Users/yorke/Desktop/tabs/src/features/settings/panels/BehaviorPanel.tsx) 新增三档单选 + 示例描述、闲置阈值下拉
  - 4.2 新增 `src/features/tabs/DuplicatePreviewModal.tsx`：按分组展示所有重复、默认勾选最旧作为保留项、底部"将关闭 N / 保留 M"实时统计、"合并 / 忽略 / 全不勾选 / 全部最旧"四按钮；合并后推入单条 Undo + Toast
  - 4.3 在 [SelectionModeNotice.tsx](/Users/yorke/Desktop/tabs/src/features/tabs/SelectionModeNotice.tsx) 渲染"已选 N · M 域名 · K 窗口"摘要；主视图区绑定 `Cmd+A` / `Esc`；[BatchActionBar.tsx](/Users/yorke/Desktop/tabs/src/features/tabs/BatchActionBar.tsx) 5 个动作合并为单条 Undo
  - _需求：5.1–5.6、6.1–6.7、7.1–7.4、8.1–8.5_

- [ ] 5. **归档富 Toast + 会话管理扩展**（F-06 + F-14）
  - 5.1 升级 [UndoToast.tsx](/Users/yorke/Desktop/tabs/src/shared/ui/UndoToast.tsx) 支持富交互形态：文案 + 可选副行（关闭失败数）+ 2 个可选按钮（查看归档 / 撤销）；[archive-service.ts](/Users/yorke/Desktop/tabs/src/services/archive-service.ts) 触发时写入 `recentActivity` 与 `undo-slice`
  - 5.2 升级 [ArchivePanel.tsx](/Users/yorke/Desktop/tabs/src/features/sessions/ArchivePanel.tsx)：多选会话 → "合并"按钮打开合并 Modal（合计 / 去重后 / 命名输入）；单会话条目加"分享"按钮触发下载 `canopy-session-<id>.json`
  - 5.3 新增 `src/features/sessions/RestoreStrategyPopover.tsx`（三选一：新窗口 / 当前窗口 / 部分）与 `PartialRestoreModal.tsx`；在 [archive-service.ts](/Users/yorke/Desktop/tabs/src/services/archive-service.ts) 增加 `restoreSession(sessionId, strategy)`，> 30 Tab 分批恢复（10/批、100ms），带 Progress 与取消
  - _需求：4.1–4.6、15.1–15.8_

- [ ] 6. **CommandCenter + tag: 语法 + 自动快照 + StatsCollector**（需求 13、14、17、18）
  - 6.1 升级 [SearchBox.tsx](/Users/yorke/Desktop/tabs/src/features/search/SearchBox.tsx)：空输入渲染四区推荐（recentActivity / 推荐动作 / searchHistory / 热门关键词）；新增结果类型 `action / session / bookmark / tag`，混排展示；实现语法解析器 `parseQuery(input)` 支持 `site: / in:(archive|live|bookmark) / tag: / has:note / pinned:true`，多语法 AND 组合；每次搜索写入 searchHistory
  - 6.2 新增 `src/features/search/TagEditorPopover.tsx` + `src/features/settings/panels/TagsManagerPanel.tsx`（或内嵌到 Data 面板）：限制 ≤10 tag / ≤20 字符、hash 生成颜色、重命名 / 删除（二次确认）
  - 6.3 升级 [sw/index.ts](/Users/yorke/Desktop/tabs/src/sw/index.ts) 新增 `StatsCollector`：订阅 `onActivated` 累加、每 30s 或 `onSuspend` 写入 `canopy_stats`（URL×day，保留 30 天）；如授权 `history`，SW 启动时用 `getVisits` 校正 7 天计数；升级 [FrequencyView.tsx](/Users/yorke/Desktop/tabs/src/features/tabs/FrequencyView.tsx) 消费新数据、移除"约"字样、损坏时回退 lastAccessed
  - 6.4 在 [sw/index.ts](/Users/yorke/Desktop/tabs/src/sw/index.ts) + [archive-handler.ts](/Users/yorke/Desktop/tabs/src/sw/archive-handler.ts) 实现 `canopy-auto-snapshot` 闹钟：触发条件（Tab≥10 & >6h）、`hidden:true` 会话、FIFO 上限 20、频率下拉（off/6h/12h/24h）；ArchivePanel 顶部增"自动快照"折叠组 + "转为正式"
  - _需求：13.1–13.12、14.1–14.7、17.1–17.6、18.1–18.7_

- [ ] 7. **完整导入导出 + OG 抓取 + 隐私洞察 + Workspace + 看板**（P2 集中交付）
  - 7.1 扩展 [shared/utils/import-export.ts](/Users/yorke/Desktop/tabs/src/shared/utils/import-export.ts)：新增 MD / TXT / HTML 三种导出（HTML 走 Netscape 格式），以及 HTML / Chrome bookmarks / OneTab `|` 分隔导入解析；导入前 Modal 选择冲突策略 `skip | append | replace`（replace 需输入 `DELETE`），限制 5MB/20K 行/单会话 500KB；完成后写 recentActivity + 结果 Toast；升级 [DataPanel.tsx](/Users/yorke/Desktop/tabs/src/features/settings/panels/DataPanel.tsx) UI
  - 7.2 在 [sw/index.ts](/Users/yorke/Desktop/tabs/src/sw/index.ts) 新增 `OgFetcher`：`enableOgFetch` 开关 + `chrome.permissions.request('<all_urls>')`；`fetch HEAD + Range 0-51200 + 超时 3s + 并发≤5`；DOMParser 抽取 og/description → IndexedDB `canopy_og_index`（LRU 10000）；SearchBox 的 MiniSearch 索引合并 title(×3) + ogDesc(×1)；关闭开关时移除权限 + 清空索引按钮
  - 7.3 新增 `src/features/insights/InsightsPanel.tsx`（`React.lazy`）：4 卡片（7 天新标签页折线 / Top 10 域名柱状 / 累计归档 tab + 节省内存文案 / Top 5 操作），使用纯 SVG（≤15KB 原始）；"清除所有统计"二次确认清空 metrics/stats/og/activity；Header 新增"我的数据"入口
  - 7.4 新增 `src/features/workspace/WorkspaceSwitcher.tsx`（Header chip + 切换器）+ Data 面板"工作区"区块（增删改，最多 3，`FeatureGate` 占位）；激活时按 `tagIds` OR `domains` 过滤主视图；记忆 `lastActiveWorkspaceId`；空态友好提示
  - 7.5 安装 `@dnd-kit/core` + `@dnd-kit/sortable`；新增 `src/features/tabs/KanbanView.tsx`：默认 4 列，拖拽不关闭原 Tab、关闭后灰态卡片可重开、"另存为归档会话"、窗口 <720px 横向滚动、`prefers-reduced-motion` 禁动画；注册进 [view-registry.ts](/Users/yorke/Desktop/tabs/src/shared/config/view-registry.ts)
  - _需求：16.1–16.9、21.1–21.8、22.1–22.6、23.1–23.7、19.1–19.9_

- [ ] 8. **本地埋点 + 性能治理 + 包体拆分**
  - 8.1 扩展 [shared/utils/metrics.ts](/Users/yorke/Desktop/tabs/src/shared/utils/metrics.ts)：实现 `track(event, payload)` 写入 `canopy_metrics`（本地、不上传）；在新标签页打开、视图切换、归档 / 恢复 / 搜索 / 整理 / 休眠 / 应用配置预设处调用；FCP 使用 `PerformanceObserver('paint')` 采样 → `perf_fcp`；FPS 使用 `requestAnimationFrame` 窗口采样 → `perf_fps_sample`；设置→关于新增"清除所有统计"按钮
  - 8.2 调整 [vite.config.ts](/Users/yorke/Desktop/tabs/vite.config.ts) `manualChunks`：把 `SearchBox`（+minisearch/pinyin-pro）、`SettingsPanel`（+panels/* + skin-presets + gradient-presets）、`ArchivePanel`（+import-export）、`KanbanView`（+@dnd-kit）、`InsightsPanel` 拆为独立 chunk；改所有 `lucide-react` 引用为按路径 `lucide-react/dist/esm/icons/x.js`；`tldts / pinyin-pro / minisearch` 改 `await import()` 按需；antd 仅静态引入 ≤10 个组件，Modal/Popover/Select/Drawer/DatePicker/Upload 走 lazy
  - 8.3 新增 [scripts/check-quota.mjs](/Users/yorke/Desktop/tabs/scripts/check-quota.mjs) 在 `pnpm build` 后输出各 chunk 大小 + gzip 大小，主 chunk 超阈值（>280KB 或 gz >90KB）时非 0 退出；集成到 `package.json` 的 `build` 脚本
  - _需求：9.1–9.9、10.1–10.4、10.7_

- [ ] 9. **测试覆盖 + 迁移与无回退校验**
  - 9.1 在 [tests/unit/](/Users/yorke/Desktop/tabs/tests/unit/) 补齐 `shared/utils/*`（dedupe / idle-detect / domain / import-export / metrics）、`services/archive-service`、`repositories/storage-repo` 的单测至 ≥80% 行覆盖；新增 `search/parseQuery` 语法解析测试、`stats-slice` 聚合测试、`kanban-slice` 持久化测试
  - 9.2 在 [tests/e2e/](/Users/yorke/Desktop/tabs/tests/e2e/) 新增 / 补齐 15 条关键场景（PRD §16.2）：安装→工作台、分组正确、Undo 恢复、Save All Tabs、搜索高亮、导入导出、500 Tab 帧率、Quota 告警、`Cmd+K` 聚焦、深色切换无 FOUC、批量归档 Toast、重复合并、合并窗口、配置预设、无痕隔离；确保 `pnpm test:e2e` 全绿
  - 9.3 在 [storage-repo.ts](/Users/yorke/Desktop/tabs/src/repositories/storage-repo.ts) 新增 `MigrationRunner`：为所有新字段提供空迁移或默认值注入；对 P0/P1 已有功能（F-01~F-04、F-07~F-10、F-16~F-19、F-21、F-22、F-30~F-33）做 Smoke E2E，确保行为不退化；验证深色模式 / `prefers-reduced-motion` / 高对比度下本次所有新组件满足 WCAG AA
  - _需求：10.5、10.6、12.1–12.4_

- [ ] 10. **发布物与上架就绪**
  - 10.1 生成 [docs/CHANGELOG.md](/Users/yorke/Desktop/tabs/docs/CHANGELOG.md)（v1.0 完整条目）、[docs/QA_CHECKLIST.md](/Users/yorke/Desktop/tabs/docs/QA_CHECKLIST.md)（手动回归清单）、[docs/PRIVACY.md](/Users/yorke/Desktop/tabs/docs/PRIVACY.md)（零外部请求 / 零账号 / 零上报 / 本地存储 / 可清空）、[docs/ARCHITECTURE.md](/Users/yorke/Desktop/tabs/docs/ARCHITECTURE.md)（mermaid 架构图）；重写 [README.md](/Users/yorke/Desktop/tabs/README.md)（截图 + 安装 + 许可证 + 开源地址）
  - 10.2 校准 [manifest.json](/Users/yorke/Desktop/tabs/manifest.json) 对齐 PRD §11.2：`permissions` / `optional_permissions` / `optional_host_permissions` / `host_permissions: []` / `incognito: "split"` / 三条 `commands`；补齐 [public/_locales/zh_CN/messages.json](/Users/yorke/Desktop/tabs/public/_locales/zh_CN/messages.json) + `en/messages.json` 的 `name / description / action_title`
  - 10.3 新增 `docs/store-assets/`：128/48/16 三尺寸图标、3-5 张 1280×800 截图占位、`GIF_SCRIPT.md` 录制指南；新增 [scripts/release.mjs](/Users/yorke/Desktop/tabs/scripts/release.mjs)：自动 bump 版本（`package.json` + `manifest.json`）、执行 `pnpm build`、打 `canopy-v1.0.0.zip`、追加 CHANGELOG 条目
  - _需求：11.1–11.7_
