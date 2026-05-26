# 11. Chrome / Web API 落地路线图附录

本文档把 9 个模块报告中分散的 Chrome / Web API 建议收敛成一份统一路线图，目标不是罗列 API 名称，而是明确：当前短板是什么、推荐接哪个能力、应改哪些仓库文件、优先级和收益分别是什么。

## 1. 总体原则

- 平台级能力优先于单点功能：优先建设可被多个模块复用的能力层，例如 Side Panel、OPFS、`storage.session`、统一索引和并发锁。
- 本地优先不等于能力保守：Canopy 已经是本地优先产品，因此更应该充分使用 Chromium 提供的本地底层能力，而不是停留在 `chrome.storage.local + 列表 UI`。
- 权限最小化与渐进授权必须保留：`history`、`bookmarks`、`<all_urls>`、`system.memory` 等仍应按场景申请，避免因为“想增强能力”而破坏产品的信任基线。

## 2. 模块级落地矩阵

| 模块           | 当前关键短板                             | 推荐 API / 能力                                                                                                                                                                | 建议改动入口                                                                                           | 优先级 | 预期收益                                                 |
| -------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------ | -------------------------------------------------------- |
| 标签工作台     | 入口仍偏新标签页，缺真实内存治理         | `chrome.sidePanel`, `chrome.system.memory`, `chrome.sessions`, `chrome.tabGroups`, `scheduler.postTask()`                                                                      | `src/pages/newtab/App.tsx`, `src/features/workspace/*`, `src/store/tabs-slice.ts`, `src/sw/index.ts`   | P0     | 把工作台升级为常驻伴随式管理层，提升性能与资源治理可信度 |
| 搜索与命令中心 | 只覆盖部分实体，索引与语法不完整         | `chrome.offscreen`, OPFS, `URLPattern`, `chrome.storage.session`, `AbortSignal.timeout()`                                                                                      | `src/features/search/*`, `src/shared/config/search-engines.ts`, `src/shared/utils/metadata-key.ts`     | P0     | 从标签搜索框升级为全域命令中心                           |
| 会话归档       | 恢复保真与大体量存储不足                 | OPFS, IndexedDB, `CompressionStream`, `Web Locks API`, `chrome.sessions`, `chrome.tabGroups`, `File System Access API`                                                         | `src/features/sessions/ArchiveView.tsx`, `src/services/archive/*`, `src/shared/utils/import-export.ts` | P0     | 强化长期归档仓库能力和结构化恢复能力                     |
| 书签中心       | 仍偏手动工具箱，缺实时同步与规则引擎     | `chrome.bookmarks.onCreated/onChanged/onRemoved`, `URLPattern`, Web Workers, OPFS, `Cache Storage`                                                                             | `src/chrome/bookmarks.ts`, `src/features/tabs/BookmarkView.tsx`, `src/features/bookmarks/*`            | P0     | 从“书签页”升级为持续治理中心                             |
| 历史记录       | 更像插件事件流，不是浏览器级历史层       | `chrome.history.onVisited`, `chrome.history.getVisits`, `chrome.sessions.getRecentlyClosed`, `File System Access API`, OPFS                                                    | `src/chrome/history.ts`, `src/repositories/history-repo.ts`, `src/features/history/HistoryPanel.tsx`   | P0     | 提升最近关闭可信度和趋势分析深度                         |
| 设置与个性化   | 选项多但预演、诊断和素材治理不足         | `chrome.storage.session`, `chrome.permissions.contains/request/remove`, OPFS, `navigator.storage.persist()`, `EyeDropper`, `View Transitions API`                              | `src/features/settings/*`, `src/store/settings-slice.ts`, `src/shared/theme/*`                         | P0     | 提升设置系统可理解性、预览能力和长期可靠性               |
| 热榜聚合       | 单源依赖重，离线与个性化能力弱           | `AbortSignal.timeout()`, `Cache Storage`, OPFS, `chrome.sidePanel`, `scheduler.postTask()`, `URLPattern`                                                                       | `src/features/trending/TrendingPage.tsx`, `src/services/trending-service.ts`, `src/sw/index.ts`        | P1     | 降低外部数据源风险，增强内容入口价值                     |
| 本地隐私洞察   | 指标深度不足，缺真实性能与资源信号       | `PerformanceObserver`, `performance.measureUserAgentSpecificMemory()`, `chrome.system.memory`, `navigator.storage.estimate()`, `Web Locks API`                                 | `src/features/insights/InsightsPanel.tsx`, `src/shared/utils/metrics.ts`, `src/sw/index.ts`            | P1     | 把轻量看板升级为可信的本地分析层                         |
| 开发工具栏     | 工具多但没有页面上下文和 DevTools 工作流 | `chrome.devtools.panels`, `chrome.devtools.inspectedWindow`, `chrome.devtools.network`, `chrome.scripting.executeScript`, `File System Access API`, Clipboard API, Web Workers | `src/features/developer-tools/*`, `src/features/developer-tools/local-tools.ts`                        | P1     | 从静态工具集合升级为开发工作台                           |

## 3. 平台级能力建设顺序

### Phase 1：底层平台化

目标：先解决所有模块都会反复遇到的能力缺口。

- 引入 `chrome.storage.session` 作为短期状态层，承接搜索草稿、视图态、临时筛选和设置预演。
- 建立 OPFS / IndexedDB 大对象仓，统一承接归档正文、搜索索引、背景素材和统计快照。
- 引入 `Web Locks API` 保护归档、导入、恢复、清空和批量扫描等互斥任务。
- 在 SW 与前台之间建立更清晰的后台任务层，为搜索索引、热榜刷新和统计聚合预留后台计算入口。

### Phase 2：中台能力收敛

目标：把原来分散在模块里的逻辑抽成统一能力。

- 搜索中台：统一索引结构，合并 Tab / 归档 / 书签 / 历史 / 命令动作。
- 会话中台：统一恢复语义，处理窗口结构、分组结构、固定状态和自动快照。
- 规则中台：统一 `URLPattern` 语法，承接黑名单、搜索语法、书签整理规则和热榜源规则。
- 指标中台：统一 `MetricEvent`、`StatsData`、性能采样和资源估算口径。

### Phase 3：差异化强化

目标：在能力底座稳定后，把差异化做深。

- 工作台常驻化：`chrome.sidePanel` 版工作台、热榜和开发工具栏。
- 洞察可信化：真实内存、真实历史、真实性能，而不是估算值和列表拼接。
- 开发者增强：DevTools 面板、请求上下文、当前页面上下文和可保存模板。

## 4. 重点风险与控制建议

| 风险                       | 影响                               | 控制建议                                                                       |
| -------------------------- | ---------------------------------- | ------------------------------------------------------------------------------ |
| 权限过多导致信任下降       | 用户安装转化和留存下降             | 所有高敏权限按需申请，并在设置页提供权限健康面板                               |
| MV3 后台被挂起导致状态丢失 | 最近关闭、搜索索引、自动快照不稳定 | 热数据短存 `storage.session`，关键状态及时落持久层，必要时用 `sessions` 做兜底 |
| 大对象长期占满配额         | 归档、背景图、索引互相抢占空间     | 早迁 OPFS，并在设置 / 洞察中展示存储占用与清理建议                             |
| 多入口并发写导致数据竞争   | 导入、恢复、清理出现错乱           | 对关键路径统一加 `Web Locks API` 锁                                            |
| 重计算阻塞主线程           | 大量 Tab / 书签 / 长文本下体验变差 | 使用 Web Workers、`scheduler.postTask()`、分片计算与缓存                       |

## 5. 建议先改哪些文件

如果只做第一轮工程落地，建议优先从以下文件开始：

- 工作台入口：`src/pages/newtab/App.tsx`、`src/features/workspace/*`
- 搜索中台：`src/features/search/*`
- 归档中台：`src/services/archive/*`
- 书签增量层：`src/chrome/bookmarks.ts`
- 历史仓库：`src/repositories/history-repo.ts`
- 设置与权限诊断：`src/features/settings/*`
- 指标与性能：`src/shared/utils/metrics.ts`、`src/sw/index.ts`

## 6. 与 9 份模块报告的关系

- 如果要看“每个模块为什么要做这些”，回到对应的 `01` 到 `09` 报告。
- 如果要看“这些能力应该先做哪一批、改哪里”，优先看本文档。
- 如果要看“这些竞品数据是从哪来的”，看 `10-market-data-methodology.md`。
