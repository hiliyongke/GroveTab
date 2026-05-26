# Canopy 9 个产品模块市场调研总览

本目录基于当前项目的用户可感知一级功能，按 9 个模块输出独立报告：标签工作台、搜索与命令中心、会话归档、书签中心、历史记录、设置与个性化、热榜聚合、本地隐私洞察、开发工具栏。

方法说明：

- 项目现状以当前仓库实现为准，重点参考 `docs/PRD v1.0.md`、`src/pages/newtab/App.tsx`、`src/features/*`、`src/shared/config/views.ts`、`src/features/settings/settings-tabs.tsx`。
- 市场数据以 Chrome Web Store 公开页面为主，抓取时间为 2026-05-25；用户量、评分、评论数均使用商店公开展示口径。
- Chrome/Chromium 能力基线以截至 2026-05 已公开可用的 Chrome Extension API 与 Web API 为边界，重点关注性能、安全、离线、本地存储、权限治理、后台能力。

## 模块总表

| 模块           | 当前完善度 | 主要对标产品                                            | 结论                                             | 报告                                          |
| -------------- | ---------- | ------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------- |
| 标签工作台     | 78/100     | OneTab, Session Buddy, Workona, Toby                    | 核心管理能力成熟，但仍缺常驻工作区和内存压力治理 | [01](./01-tabs-workspace-report.md)           |
| 搜索与命令中心 | 71/100     | Workona, Quick Tabs, Session Buddy, Toby                | 入口强，但还不是“全域命令中心”                   | [02](./02-search-command-center-report.md)    |
| 会话归档       | 74/100     | OneTab, Session Buddy, Workona, Tabs Outliner           | 原子归档可靠，恢复保真和大体量数据治理仍弱       | [03](./03-session-archive-report.md)          |
| 书签中心       | 72/100     | Raindrop.io, Toby, Session Buddy                        | 工具化能力不错，但规则化治理与实时同步不足       | [04](./04-bookmarks-report.md)                |
| 历史记录       | 67/100     | Better History, History Trends Unlimited, Session Buddy | 已有闭环恢复，但浏览器历史分析深度不足           | [05](./05-history-report.md)                  |
| 设置与个性化   | 76/100     | Momentum, Tabliss, Workona                              | 配置覆盖广，但权限诊断和上下文自适应偏弱         | [06](./06-settings-personalization-report.md) |
| 热榜聚合       | 61/100     | daily.dev, 稀土掘金, Momentum                           | 可用但依赖单源，缺个性化与内容沉淀链路           | [07](./07-trending-report.md)                 |
| 本地隐私洞察   | 56/100     | History Trends Unlimited, Better History, Workona       | 有基础仪表盘，但缺深度指标和行动建议             | [08](./08-insights-report.md)                 |
| 开发工具栏     | 64/100     | JSON Formatter, Web Developer, ModHeader, Octotree      | 工具面广，缺页面上下文和 DevTools 级集成         | [09](./09-developer-tools-report.md)          |

## 竞品公开数据快照

| 产品                      | 用户量 | 评分 | 评论数 | 主要定位                        |
| ------------------------- | ------ | ---- | ------ | ------------------------------- |
| OneTab                    | 2M     | 4.45 | 14,527 | 会话收纳 / 省内存               |
| Session Buddy             | 1M     | 4.66 | 25,095 | 会话恢复 / 标签与书签管理       |
| Tab Manager by Workona    | 200K   | 4.64 | 3,795  | 工作区 / 搜索 / 协作式标签管理  |
| Toby: Tab Management Tool | 300K   | 4.21 | 3,279  | 集合式新标签页工作台            |
| Raindrop.io               | 400K   | 4.12 | 776    | 书签收藏 / 同步 / 规则化管理    |
| Better History            | 100K   | 4.70 | 1,428  | 浏览历史查询 / 导出 / 清理      |
| History Trends Unlimited  | 60K    | 4.52 | 470    | 历史统计 / 趋势图表             |
| Tabs Outliner             | 100K   | 4.44 | 3,324  | 树状会话组织                    |
| Tab Suspender by Workona  | 30K    | 4.04 | 330    | 自动挂起 / 内存治理             |
| Momentum                  | 2M     | 4.49 | 13,759 | 新标签页美化 / 小组件           |
| Tabliss                   | 100K   | 4.66 | 382    | 高自由度新标签页定制            |
| daily.dev                 | 400K   | 4.82 | 2,798  | 开发者内容流 / 新标签页信息分发 |
| 稀土掘金                  | 100K   | 3.47 | 352    | 开发者内容入口                  |
| JSON Formatter            | 2M     | 4.28 | 2,082  | JSON 可视化 / 格式化            |
| Web Developer             | 1M     | 4.46 | 2,831  | 页面调试 / 前端工具集           |
| ModHeader                 | 900K   | 2.99 | 1,178  | 请求头改写 / 网络调试           |
| Octotree                  | 200K   | 4.86 | 1,137  | GitHub 增强                     |
| Quick Tabs                | 30K    | 4.54 | 549    | MRU Tab Search / 快速切换       |

## 共用 Chrome / Web API 基线

| API / 能力                                | 适用问题                                                | 适合落地的模块                     |
| ----------------------------------------- | ------------------------------------------------------- | ---------------------------------- |
| `chrome.sidePanel`                        | 让工作台 / 工具页从“新标签页入口”升级为常驻伴随式 UI    | 工作台、开发工具栏、热榜           |
| `chrome.storage.session`                  | 存放高频、临时、跨上下文状态，减轻 `storage.local` 压力 | 工作台、搜索、设置、历史           |
| `chrome.offscreen`                        | 在 MV3 后台做 DOM 解析、预处理和富索引构建              | 搜索、热榜、归档                   |
| `chrome.system.memory`                    | 基于真实内存压力做挂起与提示策略                        | 工作台、洞察                       |
| `scheduler.postTask()`                    | 把重计算降级为后台优先级，保障输入响应和滚动流畅        | 工作台、搜索、书签、历史           |
| `View Transitions API`                    | 平滑切换视图和主题，降低状态跳变感                      | 工作台、设置、热榜                 |
| `File System Access API`                  | 导入导出、备份、批量文件处理                            | 归档、设置、开发工具栏             |
| OPFS / `navigator.storage.getDirectory()` | 大体量离线索引、本地缓存、归档仓库                      | 搜索、归档、洞察、书签             |
| `CompressionStream`                       | 压缩备份、压缩索引、压缩缓存                            | 搜索、归档、热榜、洞察、开发工具栏 |
| `Web Locks API`                           | 避免并发归档、导入、批量删除导致的数据竞争              | 归档、书签、历史、洞察             |
| `PerformanceObserver`                     | 捕获 `paint`、`longtask`、`event` 等性能信号            | 工作台、搜索、洞察                 |
| `URLPattern`                              | 规则匹配、查询语法解析、站点级治理                      | 搜索、书签、历史、热榜             |
| `EyeDropper`                              | 颜色拾取与视觉配置增强                                  | 设置、开发工具栏                   |
| Async Clipboard API                       | 复制粘贴与工具链联动                                    | 搜索、开发工具栏                   |

## 建议阅读顺序

如果你要优先做“拉开产品差距”的事情，建议按下面顺序推进：

1. 先看 [标签工作台](./01-tabs-workspace-report.md)、[搜索与命令中心](./02-search-command-center-report.md)、[会话归档](./03-session-archive-report.md)。这三个模块共同决定 Canopy 是否真的能替代原生标签管理。
2. 再看 [设置与个性化](./06-settings-personalization-report.md)、[书签中心](./04-bookmarks-report.md)、[历史记录](./05-history-report.md)。这三个模块决定留存、信任感和本地化深度。
3. 最后看 [热榜聚合](./07-trending-report.md)、[本地隐私洞察](./08-insights-report.md)、[开发工具栏](./09-developer-tools-report.md)。这三个模块决定差异化和扩展增长面。

## 数据说明附录

### A. 数据来源与口径

- 项目功能现状：以仓库当前实现为唯一基线，重点参考 [docs/PRD v1.0.md](/Users/yorke/Desktop/tabs/docs/PRD%20v1.0.md)、[App.tsx](/Users/yorke/Desktop/tabs/src/pages/newtab/App.tsx)、[views.ts](/Users/yorke/Desktop/tabs/src/shared/config/views.ts)、[settings-tabs.tsx](/Users/yorke/Desktop/tabs/src/features/settings/settings-tabs.tsx) 以及各 `src/features/*` 模块实现。
- 竞品市场数据：以 Chrome Web Store 公开搜索结果和详情页为主，采集时间为 2026-05-25，字段口径为“用户量、评分、评论数、主页 URL、最近公开版本更新时间”。
- 竞品选择原则：优先选择与当前 9 个模块直接竞争或可替代的 Chrome 扩展，不混入 SaaS 网站或原生浏览器能力，避免横向口径失真。
- Chrome / Web API 建议：以 2026-05 可在 Chrome / Chromium 生态中公开使用、且能在 MV3 扩展里落地的能力为范围，不引入实验性到不可执行的建议。

### B. 竞品抓取方法

- 访问 Chrome Web Store 搜索页，定位竞品扩展公开条目。
- 提取条目中的 `title`、`rating`、`reviews`、`users`、`homepage`、`updatedAt` 等公开字段。
- 与产品定位进行人工归类，映射到 Canopy 的 9 个模块。
- 对于数据源波动较大的模块，优先采用“头部竞品 + 场景竞品”组合，而不是只看总用户量。

### C. 目录索引

- [总览 README](/Users/yorke/Desktop/tabs/docs/market-research/README.md)
- [01 标签工作台](/Users/yorke/Desktop/tabs/docs/market-research/01-tabs-workspace-report.md)
- [02 搜索与命令中心](/Users/yorke/Desktop/tabs/docs/market-research/02-search-command-center-report.md)
- [03 会话归档](/Users/yorke/Desktop/tabs/docs/market-research/03-session-archive-report.md)
- [04 书签中心](/Users/yorke/Desktop/tabs/docs/market-research/04-bookmarks-report.md)
- [05 历史记录](/Users/yorke/Desktop/tabs/docs/market-research/05-history-report.md)
- [06 设置与个性化](/Users/yorke/Desktop/tabs/docs/market-research/06-settings-personalization-report.md)
- [07 热榜聚合](/Users/yorke/Desktop/tabs/docs/market-research/07-trending-report.md)
- [08 本地隐私洞察](/Users/yorke/Desktop/tabs/docs/market-research/08-insights-report.md)
- [09 开发工具栏](/Users/yorke/Desktop/tabs/docs/market-research/09-developer-tools-report.md)
- [10 竞品数据与调研方法附录](/Users/yorke/Desktop/tabs/docs/market-research/10-market-data-methodology.md)
- [11 Chrome / Web API 落地路线图附录](/Users/yorke/Desktop/tabs/docs/market-research/11-chrome-api-integration-roadmap.md)

## Chrome / Web API 落地矩阵附录

| 能力                                      | 适用模块                           | 当前项目现状                        | 建议落地方向                                 |
| ----------------------------------------- | ---------------------------------- | ----------------------------------- | -------------------------------------------- |
| `chrome.sidePanel`                        | 工作台、热榜、开发工具栏           | 当前未作为主入口                    | 把高频管理入口从新标签页延伸为常驻伴随式空间 |
| `chrome.storage.session`                  | 工作台、搜索、设置、历史           | 目前主要使用 `storage.local`        | 承载高频临时状态，减少频繁落盘与跨上下文抖动 |
| `chrome.offscreen`                        | 搜索、归档、热榜                   | 当前未形成独立后台 DOM 处理层       | 用于索引构建、摘要提取、富文本解析           |
| `chrome.system.memory`                    | 工作台、洞察                       | 当前未接入真实内存压力              | 建立更可信的挂起策略和资源收益指标           |
| `chrome.sessions`                         | 工作台、归档、历史                 | 已用于局部恢复思路                  | 用于高保真最近关闭与会话恢复兜底             |
| `chrome.bookmarks` 事件流                 | 书签中心                           | 当前主要按需读取                    | 增量同步书签变更，降低全量扫描成本           |
| `chrome.history` 事件流                   | 历史、搜索、洞察                   | 当前以搜索与仓库存储为主            | 补齐浏览器级历史分析和趋势统计               |
| `scheduler.postTask()`                    | 工作台、搜索、书签、洞察           | 当前未系统化使用                    | 将重计算降级，提升输入与滚动流畅度           |
| `PerformanceObserver`                     | 工作台、洞察、搜索                 | 已有局部采样基础                    | 补齐长任务、输入延迟、首屏与帧率指标         |
| OPFS / `navigator.storage.getDirectory()` | 归档、搜索、洞察、书签、设置       | 当前仍以 `storage.local` / IDB 为主 | 承载大对象、索引与素材文件，降低配额压力     |
| `CompressionStream`                       | 归档、设置、热榜、洞察、开发工具栏 | 当前未形成统一压缩策略              | 做备份压缩、缓存压缩、离线快照压缩           |
| `Web Locks API`                           | 归档、历史、书签、洞察             | 当前未显式加锁                      | 解决导入、恢复、清理等并发数据竞争           |
| `URLPattern`                              | 搜索、书签、历史、热榜             | 当前规则逻辑分散                    | 统一查询语法、匹配规则和黑白名单逻辑         |
| `File System Access API`                  | 归档、设置、开发工具栏、书签       | 当前仅有基础导入导出链路            | 升级为本地文件级备份、修复与批处理           |
| `EyeDropper`                              | 设置、开发工具栏                   | 当前未接入                          | 做背景图取色、主题生成和颜色工具增强         |

## 优先级总建议

如果后续要把这些报告进一步转成 roadmap，建议先聚焦 3 组事情：

1. 平台级能力：`chrome.sidePanel`、`chrome.storage.session`、OPFS、`Web Locks API`。这些能力会同时改善多个模块。
2. 搜索与会话中台：统一索引、统一恢复、统一数据仓。它决定 Canopy 是否能从“页面集合”升级为“工作流系统”。
3. 数据可信度：真实内存、真实趋势、真实历史与真实权限状态。它决定洞察、治理和产品说服力是否站得住。
