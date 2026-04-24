> 版本：**v1.0（执行基线）** ｜ 更新日期：2026-04-24 ｜ 作者：Yorke + AI Pair

# Canopy — 全新标签页·标签管理 Chrome 扩展 · 产品需求文档 v1.0

## 目录

1. [产品概述](#1-产品概述)
2. [产品原则 &amp; 非目标](#2-产品原则--非目标)
3. [目标用户 &amp; 用户故事](#3-目标用户--用户故事)
4. [竞品分析](#4-竞品分析)
5. [功能矩阵（P0 / P1 / P2）](#5-功能矩阵)
6. [P0 功能详述（MVP 基线）](#6-p0-功能详述)
7. [P1 功能详述](#7-p1-功能详述)
8. [P2 功能详述](#8-p2-功能详述)
9. [三态设计（空 / 加载 / 错误）](#9-三态设计)
10. [信息架构 &amp; 视觉规范](#10-信息架构--视觉规范)
11. [技术方案](#11-技术方案)
12. [数据模型 &amp; 存储策略](#12-数据模型--存储策略)
13. [消息协议 &amp; 并发模型](#13-消息协议--并发模型)
14. [权限与隐私](#14-权限与隐私)
15. [可访问性 &amp; 国际化](#15-可访问性--国际化)
16. [测试策略](#16-测试策略)
17. [本地埋点 &amp; 度量口径](#17-本地埋点--度量口径)
18. [工程规范（文件结构 / 版本 / 发布流）](#18-工程规范)
19. [迭代里程碑](#19-迭代里程碑)
20. [成功指标](#20-成功指标)
21. [风险与未决问题](#21-风险与未决问题)
22. [术语表](#22-术语表)

---

## 1. 产品概述

### 1.1 一句话定位

**一款替换 Chrome 新标签页的标签管理器。** 每次新开 Tab，都进入一个美观、高效、可检索的"标签工作台"，统一管理当前所有已打开的 Tab、归档会话和书签。

### 1.2 解决什么问题

| 场景痛点                       | 现状                           | 本产品方案                                                  |
| ------------------------------ | ------------------------------ | ----------------------------------------------------------- |
| Tab 数量爆炸，找不到想要的页面 | Chrome 原生 Tab 条只剩 favicon | 新标签页 = 工作台，**8 种视图** + 全文搜索            |
| Tab 太多吃内存                 | OneTab 能收纳但 UI 朴素        | 一键归档 + 美观归档浏览器 +**单 Tab 休眠（Discard）** |
| 新标签页空白浪费               | 只有搜索 + 缩略图              | 承载"实时 Tab + 归档会话 + 书签 + 搜索"                     |
| 多窗口分散                     | 跨窗口 Tab 难以统一管理        | 聚合所有窗口的 Tab，支持窗口合并                            |
| 重复 / 闲置 Tab 污染           | 用户自己清理成本高             | **智能整理建议栏**：一键合并重复 + 批量休眠闲置       |

### 1.3 产品定位范围

- Chrome / Edge / 其他 Chromium 桌面浏览器（MV3）
- 本地优先：零账号、零外部上报
- 单人工具：不涉及团队协作与云同步（v1 内）

---

## 2. 产品原则 & 非目标

### 2.1 产品原则

1. **即开即用**：安装即生效，默认体验已经足够美观可用。
2. **性能优先**：500+ Tab 场景下仍保持 ≥ 55 fps 交互，首屏骨架 ≤ 150ms (P95)，有意义内容 ≤ 600ms (P95)。
3. **本地优先、隐私安全**：所有数据存在 `chrome.storage.local` / IndexedDB，零外部请求（除 favicon）。
4. **键盘党友好**：所有高频操作都有快捷键，可全键盘操作。
5. **可逆操作**：关闭 / 归档 / 删除 均可撤销（Undo Toast，默认 5 秒，3–10 可配）。
6. **渐进增强**：缺权限 / 缺 API 时优雅降级，不崩溃。
7. **认知收敛**：首页一屏内解决"有多少 Tab / 要不要整理 / 最近归档在哪 / 我接下来想干嘛"。

### 2.2 非目标（明确不做）

- ❌ 不做团队协作 / 多人共享 / 账号体系 / 云端同步
- ❌ 不做抓取网页正文做全文索引（仅 `title` + 按需 OG `description`）
- ❌ 不做跨浏览器数据互通（Chrome ↔ Firefox），除非用户手动导入导出
- ❌ 不做广告、站点打分、内容推荐
- ❌ 不做自动分类 AI / 机器学习
- ❌ 不做移动端 / Safari
- ❌ v1 不做付费版，但代码骨架预留 `FeatureGate` 以便未来扩展

---

## 3. 目标用户 & 用户故事

### 3.1 目标用户画像

| 画像                                                 | 占比预估 | 典型特征                                   |
| ---------------------------------------------------- | -------- | ------------------------------------------ |
| **重度网页工作者**（开发者 / 研究员 / 分析师） | 50%      | 50–300 Tab 并发，跨多窗口，常用搜索和归档 |
| **内容创作者 / 学生**（写作 / 学习）           | 30%      | 开很多 Tab 做参考，需要按项目分组、加备注  |
| **美学追求者 / 生产力玩家**                    | 20%      | 关心视觉风格，喜欢尝试新工具               |

### 3.2 核心用户故事

| ID    | 用户故事                                                                                                          | 对应功能           |
| ----- | ----------------------------------------------------------------------------------------------------------------- | ------------------ |
| US-01 | 作为开发者，我一天要开 80 个 Tab，希望每次新开 Tab 时看到所有 Tab 按域名分组，**所以**能在 3 秒内找到那个。 | F-01 / F-02 / F-03 |
| US-02 | 作为研究员，我想在新标签页直接键入关键词过滤 Tab，**所以**不必打开历史记录。                                | F-05               |
| US-03 | 作为重度用户，Tab 太多拖慢浏览器，希望一键收起所有 Tab 稍后恢复，**所以**能保留思路但释放内存。             | F-06               |
| US-04 | 作为误操作常犯者，不小心关闭一整组 Tab，我希望 5 秒内撤销，**所以**不用翻历史一个个恢复。                   | F-04               |
| US-05 | 作为切换电脑的用户，希望把归档会话导出成文件，**所以**能在另一台电脑导入恢复。                              | F-15               |
| US-06 | 作为知识管理者，希望给某个 Tab 或会话加标签和备注，**所以**后续能按主题检索。                               | F-12               |
| US-07 | 作为多项目并行者，希望用拖拽把 Tab 归入"工作/学习/娱乐"列，**所以**工作台就是 Kanban。                      | F-20               |
| US-08 | 作为美学用户，希望新标签页像 Arc 一样漂亮，**所以**每天愿意打开十几次。                                     | 视觉规范           |
| US-09 | 作为多窗口用户，希望能一键合并多窗口的 Tab，**所以**整理时不用逐窗口来回切。                                | F-02b              |
| US-10 | 作为有重复 Tab 洁癖者，希望系统自动提示重复与闲置 Tab，**所以**能一键整理掉。                               | F-13               |
| US-11 | 作为多角色切换者（工作 / 私人），希望保存多套外观 + 行为配置并一键切换，**所以**场景切换不用反复调设置。    | F-30（配置预设）   |

### 3.3 反用户故事

- ❌ 不希望新标签页每次都闪烁、加载 1 秒以上才出内容。
- ❌ 不希望发现扩展向任何外部服务器发请求。
- ❌ 不希望关键操作需要二次确认打断心流（除不可逆操作外）。

---

## 4. 竞品分析

| 产品                           | 核心形态             | 优势                 | 劣势                             | 我们的差异点                 |
| ------------------------------ | -------------------- | -------------------- | -------------------------------- | ---------------------------- |
| **OneTab**               | 工具栏按钮 → 列表页 | 轻量、省内存、用户多 | UI 过时、无视图切换、搜索体验差  | 新标签页接管 + 多视图 + 美学 |
| **Toby**                 | 新标签页工作台       | 看板分组、云同步     | 需注册登录、隐私隐忧、免费版有限 | 本地优先、零账号             |
| **Workona**              | 新标签页工作空间     | 强大 workspace       | 复杂、学习曲线高、付费           | 聚焦标签管理、上手即用       |
| **Tab Manager Plus**     | 弹窗                 | 强大搜索             | UI 工具感强                      | 沉浸式工作台                 |
| **Momentum / Tabby Cat** | 新标签页美化         | 视觉出色             | 无 Tab 管理能力                  | 视觉 + 生产力双强            |
| **Arc Max**              | 浏览器本身           | 整体体验最佳         | 要换浏览器                       | Chrome 内原生体验            |

**差异化总结**：本产品 = **OneTab 的收纳能力** + **Toby 的视图丰富度** + **Momentum 的视觉美感** + **Arc 的整理智能** − **所有云端 / 登录复杂度**。

---

## 5. 功能矩阵

### 5.1 功能总览

| ID    | 模块                                 | 优先级  | 状态（仓库）                           |
| ----- | ------------------------------------ | ------- | -------------------------------------- |
| F-01  | 新标签页接管                         | P0      | ✅                                     |
| F-02  | 跨窗口实时 Tab 聚合                  | P0      | ✅                                     |
| F-02b | 多窗口视图 + 窗口合并                | P1      | ✅                                     |
| F-03  | 域名分组视图（默认）                 | P0      | ✅                                     |
| F-04  | Tab 基础操作（跳转/关闭/批量）+ Undo | P0      | ✅                                     |
| F-05  | 全局搜索（→ 命令中心）              | P0 / P1 | ✅ P0 部分                             |
| F-06  | 一键归档                             | P0      | ✅                                     |
| F-07  | 本地持久化 + IDB 降级                | P0      | ✅                                     |
| F-08  | 多选模式 + 批量操作                  | P0      | ✅                                     |
| F-09  | 智能整理建议栏（重复 + 闲置）        | P0      | ✅                                     |
| F-10  | 多视图切换（8 种）                   | P1      | ✅                                     |
| F-11  | 使用频率视图                         | P1      | ⚠️ 基础版，数据近似                  |
| F-12  | 标签 + 备注                          | P1      | ⚠️ 元数据已有，`tag:` 搜索语法待补 |
| F-13  | 去重严格度可配                       | P1      | ⚠️ 检测已有，严格度 UI 待加          |
| F-14  | 归档会话管理（合并/分享/三策略恢复） | P1      | ⚠️ 基础                              |
| F-15  | 导入导出（JSON/MD/TXT/HTML）         | P1      | ⚠️ 仅 JSON                           |
| F-16  | 设置面板（5 个 Tab）                 | P1      | ✅                                     |
| F-17  | 标签休眠（Discard）                  | P1      | ✅                                     |
| F-18  | 分屏显示                             | P1      | ✅                                     |
| F-19  | 原生 TabGroup 视图                   | P1      | ✅                                     |
| F-20  | 看板视图（dnd-kit）                  | P2      | ❌                                     |
| F-21  | 书签整合视图                         | P1      | ✅                                     |
| F-22  | 固定 / 置顶                          | P1      | ✅                                     |
| F-23  | 会话自动快照                         | P2      | ❌                                     |
| F-24  | 全文检索增强（OG description）       | P2      | ❌                                     |
| F-25  | 双模式引导（新标签页 / 工具栏）      | P1      | ⚠️ 基础                              |
| F-26  | 工具栏 Popup 轻量版                  | P1      | ⚠️ 占位                              |
| F-27  | 最近操作状态区 / Activity Strip      | P2      | ❌                                     |
| F-28  | 本地隐私洞察仪表盘                   | P2      | ❌                                     |
| F-29  | 工作区（Workspace）雏形              | P2      | ❌                                     |
| F-30  | 配置预设（SettingsProfile）          | P1      | ✅                                     |
| F-31  | 自定义快捷键                         | P1      | ✅                                     |
| F-32  | UI 区域可见性（uiVisibility）        | P1      | ✅                                     |
| F-33  | 皮肤 / 渐变 / 背景图 / 遮罩          | P1      | ✅                                     |
| F-34  | 首页工作区概览（Dashboard Overview） | P1      | ⚠️ 数据入参就绪，UI 需升级           |

> 图例：✅ 已落地 ｜ ⚠️ 部分落地 ｜ ❌ 未落地

---

## 6. P0 功能详述

### F-01 新标签页接管

- **实现**：`manifest.json.chrome_url_overrides.newtab` → `src/pages/newtab/index.html`
- **降级路径**：若与其他扩展冲突 → 启动时检测并给出引导卡片
- **可关闭**：设置 → 行为 → `overrideNewTab` 开关关闭；关闭后扩展仍可用，通过工具栏按钮 / 快捷键 `Alt+C` 打开
- **验收**：首屏骨架 ≤ 150ms，首次有意义内容 ≤ 600ms

### F-02 跨窗口实时 Tab 聚合

- **初始化**：SW 启动时 `chrome.tabs.query({})`
- **增量事件**：SW 监听 `onCreated / onUpdated / onRemoved / onActivated / onMoved / onAttached / onDetached / onReplaced`，通过 `BroadcastChannel('canopy-tabs')` 广播增量
- **UI 订阅**：`useSWBroadcast` Hook 接收广播 → 更新 `tabs-slice`
- **特殊 URL 处理**：
  | URL 类型                                 | 展示               | 可归档 | 可跳转 | favicon            |
  | ---------------------------------------- | ------------------ | ------ | ------ | ------------------ |
  | `https?://`                            | ✅                 | ✅     | ✅     | chrome://favicon2/ |
  | `chrome://` / `edge://` / `about:` | ✅                 | ❌     | ✅     | 占位图             |
  | `chrome-extension://`                  | ✅（显示扩展名）   | ❌     | ✅     | 占位图             |
  | `file://`                              | ✅（标"本地文件"） | ✅     | ✅     | 文档图标           |
  | 扩展自身新标签页                         | ❌                 | ❌     | —     | —                 |
  | `about:blank`                          | ❌                 | ❌     | —     | —                 |
- **无痕窗口**：`incognito: "split"` 模式下无痕实例与普通实例独立；无痕 Tab **永不**入归档 / 频率统计 / 去重

### F-03 按域名分组视图（默认视图）

- **聚合规则**：使用 PSL 把 `m.example.com` 与 `www.example.com` 合并到 `example.com`；由 `shared/utils/domain.ts` 实现
- **分组卡片**：站点 favicon / 域名 / 数量徽标 / 身份色条（左 / 顶 / 无）/ 圆角档位
- **排序策略**：`byCount`（默认）/ `byAlpha` / `byRecent`
- **列数**：`auto` / 1–6，可在设置 → 外观中调整
- **折叠持久化**：按 hostname 持久化折叠状态到 storage

### F-04 基础 Tab 操作 + Undo

- **跳转语义**：
  - 同窗口 → `chrome.tabs.update(id, {active:true})`
  - 跨窗口 → 上 + `chrome.windows.update(winId, {focused:true})`
  - 失败 → 静默 `queryAllTabs` 重新刷新 + `feedback.error`
- **关闭**：单个 / 多个 / 域名组 / 所有非固定；> 20 二次确认（阈值可配）
- **Undo**：
  - 持久化队列（`undo-slice` + storage），避免 SW 休眠丢失
  - 跨页广播（`BroadcastChannel`）
  - 5s 窗口（3–10s 可配）
  - `UndoToast` 集中显示最近一条，支持"撤销"与"忽略"
  - 恢复策略：优先 `chrome.sessions.restore`；兜底 `chrome.tabs.create({url, windowId})`

### F-05 全局搜索（P0 基线）

- **入口**：快捷键 `/` / `Cmd+K` / `Ctrl+K` / `Alt+K`；顶部搜索框点击
- **范围**：本地 Tab（title + url）
- **交互**：防抖 150ms；`<mark>` 高亮命中；`Esc` 清空失焦
- **空结果文案**："未找到匹配的 Tab，试试更短的关键词？"

> P1 增量见 §7 F-05b CommandCenter

### F-06 一键归档

- **入口**：Hero 大按钮 "Save All Tabs" / 右键菜单 / 工具栏 / 快捷键 `Alt+Shift+S`
- **原子事务**（`services/archive-service.ts`）：
  1. 序列化为 `ArchivedSession` 写入 storage
  2. 快照成功后再 `chrome.tabs.remove(ids)`
  3. 关闭失败不阻塞归档，错误数在 Toast 里显示
- **归档范围选项**：当前窗口 / 全部窗口 / 选中 Tab；默认排除 `pinned` Tab（可配）
- **落地页**：归档后在当前窗口开一个 Canopy 新标签页，高亮本次会话
- **冲突**：同名会话自动加时间戳后缀

### F-07 本地持久化 + IDB 降级

- **主存储**：`chrome.storage.local`，上限 10 MiB
- **容量监控**：`shared/utils/quota.ts` 每次写入前估算，≥ 8 MiB 告警
- **自动降级**：`shared/utils/idb-fallback.ts` 的 `shouldFallbackToIDB(bytes)` → 归档服务自动切 IndexedDB
- **索引不迁移**：元数据仍在 storage.local，便于快速列出
- **迁移策略**：所有实体携带 `schemaVersion`；`MigrationRunner` 按版本链式升级，前 3 次升级备份到 `migration_backup_<ts>`

### F-08 多选模式 + 批量操作

- **进入态**：Cmd / Ctrl + 点击 tab 进入 + 该 tab 选中；或长按；或显式按钮
- **选择扩展**：Shift + 点击做范围选，Cmd+A 全选当前视图，Esc 退出
- **视觉**：`SelectionModeNotice` 顶部浮条，展示"已选 N 个 · 来自 M 个域名 · 跨 K 个窗口"
- **批量动作**（`BatchActionBar`）：跳转 / 关闭 / 归档 / 休眠 / 加标签 / 加备注
- **单次事务**：多个 Tab 的关闭 / 归档合并为一条 Undo 记录

### F-09 智能整理建议栏（TidySuggestionBar）

- **位置**：Hero 下方，有建议时才显示
- **内容**：
  - 重复 Tab：按 url 宽松比对（忽略 `#hash` 与 `utm_*` 等跟踪参数）
  - 闲置 Tab：`shared/utils/idle-detect.ts`，按阈值（默认 24h）
- **动作**：
  - "一键合并重复" → 批量关闭仅保留最旧一条
  - "休眠全部闲置" → 批量 `chrome.tabs.discard`
  - 单条预览并逐条忽略 / 执行
- **可关**：设置 → `uiVisibility.tidySuggestion`

---

## 7. P1 功能详述

### F-02b 多窗口视图 + 窗口合并（✅ 已落地）

- `WindowView`：按窗口分栏展示；顶部显示窗口索引、Tab 数
- **合并窗口**：选中多个窗口 → 点击"合并到主窗口"，调用 `chrome.tabs.move`
- **关闭整窗口**：直接关闭窗口内所有 tab（走归档原子事务）

### F-05b SearchBox → CommandCenter（v0.5 升级目标）

#### 7.5.1 结果类型（扩展已有四类 `tab/history/recent/engine`）

```ts
type UniversalSearchItem =
  | { type: 'tab';       tab: LiveTab }
  | { type: 'history';   item: chrome.history.HistoryItem }
  | { type: 'recent';    query: string }
  | { type: 'engine';    engineId: string; query: string }
  | { type: 'action';    id: string; title: string; hotkey?: string; run(): void } // 新
  | { type: 'session';   sessionId: string; name: string }                          // 新
  | { type: 'bookmark';  bookmarkId: string; title: string; url: string }           // 新
  | { type: 'tag';       tag: string }                                              // 新
```

#### 7.5.2 空输入推荐（四区）

1. **最近操作**（来自 `recentActivity` ring buffer）
2. **推荐动作**：归档当前窗口 / 整理重复 / 打开归档 / 切换主题 / 打开设置
3. **最近搜索**（最多 5 条）
4. **热门关键词**

#### 7.5.3 搜索语法

```
tag:<name>        # 只命中打过此 tag 的 tab / 会话
site:<domain>    # 限制 hostname
in:archive       # 限搜归档
in:live          # 限搜实时 tab
in:bookmark      # 限搜书签
has:note         # 带备注的 tab
pinned:true      # 固定 tab
```

多语法可用空格组合。

### F-10 多视图切换器（✅ 8 种视图已落地）

| 视图             | 模块                | 说明                                        |
| ---------------- | ------------------- | ------------------------------------------- |
| 域名分组（默认） | `DomainGroupView` | 见 F-03                                     |
| 时间轴           | `TimelineView`    | `day` / `hour` 两档；可选"显示精确时间" |
| 紧凑列表         | `CompactView`     | `@tanstack/react-virtual` 虚拟滚动        |
| 网格             | `GridView`        | 单 tab 直跳；多 tab 走 Modal                |
| 使用频率         | `FrequencyView`   | 用 `lastAccessed` 近似                    |
| 原生 TabGroup    | `TabGroupView`    | 读取 `chrome.tabGroups` 原生色与标题      |
| 多窗口           | `WindowView`      | 见 F-02b                                    |
| 书签             | `BookmarkView`    | 按需申请 `bookmarks` 权限                 |

### F-11 使用频率视图（⚠️ 升级目标）

- **当前**：仅基于 `chrome.tabs.lastAccessed`，UI 标注"约"
- **目标**：SW `StatsCollector`（已有占位）累加 `onActivated`；每 30s 或 SW 挂起前写 storage；启动时与 `history.getVisits` 校正（需 `history` 权限）
- **展示**：按"最近 7 天激活次数"降序，默认 Top 30

### F-12 标签 + 备注

- **数据**：`metadata-slice.ts` 已支持 `pin / tag / note`，按 URL 索引
- **Tag 规则**：字符串数组；≤ 10 个；每个 ≤ 20 字符；色由 hash 稳定生成
- **Note 规则**：Markdown 纯文本 ≤ 500 字符
- **索引键**：URL（不含 hash，是否含 query 可配）
- **入口**：右键菜单「加标签」/「写备注」
- **搜索语法**：`tag:<name>` / `has:note`（见 §7.5.3）

### F-13 去重严格度可配

- **检测**：`shared/utils/dedupe.ts::findDuplicates`
- **严格度**：
  - `strict`：URL 完全相同
  - `loose`（默认）：忽略 `#hash` + `utm_*` / `fbclid` / `gclid`
  - `off`：禁用
- **UI**：
  - `TidySuggestionBar` 展示重复分组
  - 点击"预览"弹 Modal 逐条勾选保留项
  - 操作"一键合并"或"忽略本次"

### F-14 归档会话管理

#### 操作

- 重命名 / 删除（Undo）
- **合并**：选中多个会话 → 合并为一个（保留去重）
- **分享**：导出单个会话为 `canopy-session-<id>.json`
- **恢复策略**（三选一）：
  1. 新窗口（默认）
  2. 当前窗口末尾
  3. 部分恢复（Modal 勾选）
- **大批量保护**：> 30 个 tab 分批恢复（10 个 / 批，间隔 100ms）

### F-15 导入 / 导出

#### 导出格式

| 格式         | 用途                              |
| ------------ | --------------------------------- |
| JSON（默认） | 完整数据（含标签、备注、会话）    |
| Markdown     | 会话标题 + tab 列表，便于分享     |
| 纯文本       | 一行一 URL，便于二次加工          |
| HTML         | Chrome 书签格式，可导入其他浏览器 |

#### 导入源

- 本地文件（所有格式）
- Chrome 书签（`chrome.bookmarks.getTree`）
- OneTab 旧数据（兼容其特定 `|` 分隔格式）

#### 冲突策略

| 策略             | 行为                              |
| ---------------- | --------------------------------- |
| `skip`（默认） | URL 已存在则跳过                  |
| `append`       | 全部追加到新会话                  |
| `replace`      | 二次确认 + 输入 `DELETE` 才执行 |

**限制**：5 MB / 20K 行 / 单会话 ≤ 500 KB

### F-16 设置面板（5 个 Tab）

| Tab    | 模块                | 关键项                                                                                                               |
| ------ | ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 外观   | `AppearancePanel` | 主题、皮肤预设（5）、渐变预设（8+ 自定义）、背景图、遮罩、布局密度、最大宽度、减弱动效、区域显隐                     |
| 行为   | `BehaviorPanel`   | `overrideNewTab`、默认视图、默认搜索引擎、关闭阈值、Undo 窗口、闲置阈值、去重严格度                                |
| 数据   | `DataPanel`       | 容量条 / 导入 / 导出 / 清空归档 /**配置预设**（保存 / 应用 / 重命名 / 删除）                                   |
| 快捷键 | `ShortcutsPanel`  | 三条全局快捷键（链接到 chrome://extensions/shortcuts）+ 自定义页面内快捷键（`search / exitSelection / selectAll`） |
| 关于   | SettingsPanel 主体  | 版本、开源地址、隐私政策链接、许可证                                                                                 |

### F-17 标签休眠（Discard）

- **API**：`chrome.tabs.discard(id)`
- **入口**：右键菜单 / 批量操作 / TidySuggestionBar（闲置批量休眠）
- **SW 同步**：监听 `discarded` 状态变化并广播（避免 UI 与实际状态漂移）
- **限制**：不能 discard active Tab；UI 灰置对应选项

### F-18 分屏显示

- **入口**：右键菜单"分屏显示"
- **实现**：创建新窗口 + `chrome.windows.update({state:'normal', width, left})`；主窗口同步调整
- **兜底**：失败时 `feedback.error` 提示"分屏不可用（系统限制）"

### F-19 原生 TabGroup 视图

- **读取**：`chrome.tabGroups.query` 得到 `groupId / title / color / collapsed`
- **展示**：按组分栏，使用原生颜色；未分组 tab 放"未分组"区
- **交互**：支持拖拽 tab 跨组（MV3 `chrome.tabs.group`）

### F-21 书签整合

- **权限**：`bookmarks` 在 `optional_permissions`，首次点击 BookmarkView 时请求
- **视图**：树形 + 搜索
- **操作**：跳转 / 打开到新窗口 / 删除书签 / 从归档里"加入书签"

### F-22 固定 / 置顶

- 元数据层面的"置顶"（由 `metadata-slice.pin` 维护），不同于 Chrome 原生 `pinned`
- UI 层置顶的 tab 在域名分组卡内排到最前

### F-25 双模式引导（Onboarding v2）

- **首装**：新标签页展示欢迎卡片，两个大按钮：
  - 🌐 **接管新标签页（推荐）**
  - 🧩 **仅工具栏按钮**
- **随时切换**：设置 → 行为 → `overrideNewTab`
- **关闭接管后**：工具栏按钮仍可通过 `chrome.runtime.getURL('src/pages/newtab/index.html')` 打开工作台

### F-26 工具栏 Popup 轻量版

- **位置**：`src/pages/popup/App.tsx`
- **内容**：
  - 全局搜索（与主工作台共用逻辑）
  - 最近 10 个激活 Tab（一键跳转）
  - "归档当前窗口"大按钮（复用 `archiveCurrentWindowTabs`）
  - "打开工作台"按钮（新开 Canopy 新标签页）

### F-30 配置预设（SettingsProfile）

- **存储**：`shared/utils/profiles.ts`
- **操作**：保存当前配置 / 应用预设 / 重命名 / 删除
- **覆盖范围**：Settings 全量（外观 + 行为 + 快捷键）
- **典型用例**：工作模式（简洁、无背景图、`compact` 视图） vs 私人模式（彩色、大卡片）

### F-31 自定义快捷键

- **范围**：仅页面内快捷键（`search / exitSelection / selectAll`），不能改全局快捷键（受 Chrome 限制，需用户到 chrome://extensions/shortcuts 手改）
- **存储**：`settings.customKeybindings`
- **冲突检测**：同一按键绑定多个动作时只生效第一个 + 给红字提示

### F-32 UI 区域可见性

- 键值：`uiVisibility.{header, heroSearch, viewSwitcher, workspaceOverview, tidySuggestion}`
- 便于用户定制"极简模式"

### F-33 皮肤 / 渐变 / 背景图

- **皮肤预设**：5 套（`shared/theme/skin-presets.ts`），覆盖主色、圆角、卡片透明度、模糊强度
- **渐变预设**：8 套 + 自定义渐变编辑器（两色）
- **背景图**：支持本地上传，`backgroundFit` (`cover / contain / repeat`) + `backgroundOverlay` (颜色 + 模糊度)
- **无 FOUC**：`theme-init.js` 在 React 前同步读取 storage 应用 CSS 变量

### F-34 首页工作区概览（Dashboard Overview）

#### 位置（从上到下）

```
[Header — 薄]
[HeroBar — 品牌 + 大搜索 + 视图切换]
[Dashboard Overview ← 本节]
[TidySuggestionBar（有建议时）]
[SelectionModeNotice（多选时）]
[主视图区]
```

#### 展示内容

| 卡片                    | 数据来源                             | 点击行为                        |
| ----------------------- | ------------------------------------ | ------------------------------- |
| 标签页 N                | `tabs.length`                      | 滚动到主视图                    |
| 域名 N                  | `new Set(tabs.map(hostname)).size` | 切换到域名分组视图              |
| 窗口 N                  | `windows.size`                     | 切换到多窗口视图                |
| 重复 N（红/黄色）       | `findDuplicates(tabs)`             | 展开 TidySuggestionBar 重复分区 |
| 闲置 N（灰色）          | `detectIdleTabs(tabs)`             | 展开 TidySuggestionBar 闲置分区 |
| 最近归档（时间 + 名称） | `getArchivedSessions[0]`           | 打开 ArchivePanel 并高亮        |

#### 三个高频入口（显式按钮）

- 🔎 **搜索标签**（= `Cmd+K`）
- 🧹 **一键整理**（= 展开 TidySuggestionBar）
- 💾 **归档当前窗口**（= `Alt+Shift+S`）

#### 可关闭

`uiVisibility.workspaceOverview`，默认开启。

---

## 8. P2 功能详述

### F-20 看板视图（Kanban）

- **技术**：引入 `dnd-kit`（当前未装）
- **数据**：`KanbanLayout`，按列存 tab URL 列表
- **交互**：
  - 默认列「工作 / 学习 / 娱乐 / 待看」
  - 列可增删改
  - 拖拽 tab 入列**不关闭 tab**（纯视图聚合）
  - "把列另存为归档会话"

### F-23 会话自动快照

- **触发**：`chrome.alarms.create('canopy-auto-snapshot', { periodInMinutes: 60 })`
- **条件**：当前窗口 tab ≥ 10 且距上次快照 > 6h
- **行为**：静默创建 `hidden: true` 的 `ArchivedSession`
- **设置**：频率可调（6h / 12h / 24h / off）
- **展示**：ArchivePanel 的"自动快照"折叠区

### F-24 全文检索增强（OG description）

- **前置**：用户显式在设置里勾选"允许抓取网页预览描述" → 请求 `<all_urls>` 动态授权
- **抓取**：SW `fetch HEAD + 少量 GET`，超时 3s / 限 50KB / 并发 ≤ 5
- **抽取**：`<meta property="og:description">` + `<meta name="description">`
- **存储**：`canopy_og_index`（IDB）
- **索引**：合并 `title` 建 MiniSearch 倒排索引

### F-27 最近操作状态区（Activity Strip）

- **位置**：Hero 下方、Dashboard Overview 上方
- **条件**：最近 60 分钟有操作才显示
- **示例**：
  - `📦 已归档 32 个标签到「4月24日 15:02」` + 「↩ 恢复」 + 「查看」
  - `🔁 已恢复 5 个标签` + 「再次归档」
  - `⬇ 已导入 12 个会话` + 「查看」
  - `🔐 已授予 bookmarks 权限` + 「了解」
- **数据**：`metadata-slice.recentActivity: ActivityRecord[]` ring buffer（最多 20 条、72h 过期）

### F-28 本地隐私洞察仪表盘

- **入口**：Header → "我的数据"
- **内容**（全部本地计算）：
  - 近 7 天每日新标签页打开次数（折线图）
  - Top 10 访问域名（柱状图）
  - 累计归档 tab 数 + 估算节省内存（`tabCount × 80MB` 粗略）
  - 使用频率前 5 的操作
- 「清除所有统计」按钮

### F-29 工作区（Workspace）雏形

- **数据**：`Workspace { id; name; filter: { tagIds, domains } }`
- **使用**：最多 3 个（免费期），点击即把主视图过滤为该组合
- 为将来「多工作区」会员版做抽象

---

## 9. 三态设计

### 9.1 空状态

| 场景                 | 展示                                                                        |
| -------------------- | --------------------------------------------------------------------------- |
| 首次安装，没有归档   | `OnboardingCard` 4 步引导（打开网页 → 看工作台 → 试归档 → 快捷键帮助） |
| 没有任何 Tab（防御） | 插画 + "打开你的第一个标签吧" + 常用入口按钮                                |
| 搜索无结果           | "没有找到匹配的 Tab" + 清空搜索按钮                                         |
| 归档视图无会话       | "还没有归档会话。点击 Save All Tabs 开始"                                   |

### 9.2 加载状态

- 首次进入：骨架屏（Skeleton），**最多 200ms**；超时才出 spinner
- 切换视图：淡入淡出 150ms（`prefers-reduced-motion` 时禁用）
- 归档 / 批量操作：内联 Progress + 可取消（大批量时）

### 9.3 错误状态

| 错误                       | 用户感知                                         | 开发者                     |
| -------------------------- | ------------------------------------------------ | -------------------------- |
| Storage 写入失败（配额满） | Alert："本地存储已满，建议清理归档" + 跳转清理页 | 控制台 error               |
| Tab 操作权限被拒           | Toast："无法操作此 Tab（系统受限页面）"          | `feedback.error`         |
| Chrome API 抛错            | 降级只读模式，保留已加载内容                     | 本地 `error_ring_buffer` |
| SW 无响应                  | UI 自行 fallback 到直接 `chrome.tabs.query`    | ping 超时日志              |

---

## 10. 信息架构 & 视觉规范

### 10.1 页面布局

```
┌────────────────────────────────────────────────┐
│  Header（薄）：logo · 视图切换器 · 设置入口      │
├────────────────────────────────────────────────┤
│  HeroBar：品牌区 · 大搜索                       │
├────────────────────────────────────────────────┤
│  Dashboard Overview：统计 + 3 个高频入口         │
├────────────────────────────────────────────────┤
│  TidySuggestionBar（条件显示）                   │
│  SelectionModeNotice（条件显示）                 │
├────────────────────────────────────────────────┤
│  主视图区（8 种视图之一）                         │
├────────────────────────────────────────────────┤
│  ArchivePanel（右侧抽屉）                        │
│  SettingsPanel（右侧抽屉）                       │
│  UndoToast（右下浮层）                           │
└────────────────────────────────────────────────┘
```

### 10.2 视觉 Token

| Token            | 值                                                       |
| ---------------- | -------------------------------------------------------- |
| `--radius-sm`  | 8px                                                      |
| `--radius-md`  | 12px                                                     |
| `--radius-lg`  | 20px                                                     |
| `--blur-card`  | `blur(24px) saturate(180%)`                            |
| `--elev-1`     | `0 1px 2px rgba(0,0,0,.04), 0 2px 8px rgba(0,0,0,.04)` |
| `--elev-2`     | `0 4px 16px rgba(0,0,0,.08)`                           |
| `--font`       | `-apple-system, SF Pro Text, Inter, PingFang SC, ...`  |
| `--space-unit` | 4px（间距取 4 的倍数）                                   |

### 10.3 渐变预设（默认）

- **Aurora**（亮）：`linear-gradient(135deg, #F5F7FA 0%, #E0C3FC 50%, #8EC5FC 100%)`
- **Sunrise**：`linear-gradient(135deg, #FEE140 0%, #FA709A 100%)`
- **Deep Space**（暗）：`linear-gradient(135deg, #0F2027 0%, #203A43 50%, #2C5364 100%)`
- + 5 套额外预设 + 自定义

### 10.4 设计 DoD（Definition of Done）

- [ ] 主页面满足 WCAG AA（正文 ≥ 4.5:1）
- [ ] 任意渐变背景上卡片可读
- [ ] 深色模式下所有图标、阴影、边框自洽
- [ ] 500 Tab 下渲染 ≥ 55 fps
- [ ] 所有可点击元素 ≥ 32×32 px（桌面扩展）
- [ ] 所有动效 150–250ms，缓动 `cubic-bezier(.22,.61,.36,1)`
- [ ] `prefers-reduced-motion` 时禁用非必要动画
- [ ] 中英文混排标点统一

### 10.5 交互细节

- **焦点态**：键盘聚焦元素必须 2px 高对比外描边
- **拖拽态**：元素跟随指针 + 目标 drop zone 高亮虚线；取消时回弹
- **长按态**：长按 Tab 卡 → 弹出右键菜单（标签 / 备注 / 固定 / 休眠 / 分屏 / 跨窗口移动）

---

## 11. 技术方案

### 11.1 技术栈

| 层       | 选型                                           | 说明                             |
| -------- | ---------------------------------------------- | -------------------------------- |
| 扩展规范 | **Manifest V3**                          | —                               |
| 前端框架 | **React 18 + TypeScript 5**              | —                               |
| 构建     | **Vite 5 + `@crxjs/vite-plugin` v2**   | HMR；备选 wxt.dev                |
| 样式     | **Tailwind CSS 3 + CSS Variables**       | 主题切换通过 CSS var             |
| 动画     | **Framer Motion 11**                     | —                               |
| 状态     | **Zustand 4**                            | slice 化                         |
| 存储     | `chrome.storage.local` 封装 + IndexedDB 降级 | `shared/utils/idb-fallback.ts` |
| UI 基础  | **antd v6**（按需）                      | 部分组件 lazy                    |
| 图标     | **lucide-react**（按名导入）             | 须 tree-shake 良好               |
| 虚拟列表 | **@tanstack/react-virtual**              | 已用于 `CompactView`           |
| 搜索     | **MiniSearch**                           | 取代 Fuse.js                     |
| 拖拽     | **dnd-kit**（v0.6+ 引入）                | 看板用                           |
| 日期     | **date-fns**                             | —                               |
| 拼音     | **pinyin-pro**                           | 搜索中英文匹配                   |
| 测试     | Vitest + RTL + Playwright                      | §16                             |

### 11.2 Manifest 关键字段

```jsonc
{
  "manifest_version": 3,
  "name": "Canopy",
  "version": "1.0.0",
  "default_locale": "zh_CN",
  "permissions": [
    "tabs",
    "storage",
    "favicon",
    "alarms",
    "sessions",
    "contextMenus",
    "tabGroups",
    "activeTab"
  ],
  "optional_permissions": ["history", "bookmarks"],
  "host_permissions": [],
  "optional_host_permissions": ["<all_urls>"],
  "chrome_url_overrides": { "newtab": "src/pages/newtab/index.html" },
  "action": { "default_popup": "src/pages/popup/index.html" },
  "background": { "service_worker": "src/sw/index.ts", "type": "module" },
  "icons": { "16": "...", "48": "...", "128": "..." },
  "commands": {
    "_execute_action": { "suggested_key": { "default": "Alt+C" } },
    "archive-window":  { "suggested_key": { "default": "Alt+Shift+S" } },
    "focus-search":    { "suggested_key": { "default": "Alt+K" } }
  },
  "incognito": "split"
}
```

### 11.3 架构分层

```
┌────────────────────────────────────────────────┐
│  Pages:  newtab/  popup/                       │
├────────────────────────────────────────────────┤
│  Features (feature-sliced):                    │
│    tabs/  sessions/  search/  bookmarks/  settings/ │
├────────────────────────────────────────────────┤
│  Shared:  ui/  hooks/  theme/  i18n/  utils/  config/ │
├────────────────────────────────────────────────┤
│  Store (Zustand slices):                       │
│    tabs-slice  selection-slice  settings-slice │
│    metadata-slice  undo-slice                  │
├────────────────────────────────────────────────┤
│  Services (ArchiveService / SearchService / ...)│
├────────────────────────────────────────────────┤
│  Repositories (StorageRepo / IndexedDbRepo)    │
├────────────────────────────────────────────────┤
│  Chrome API Wrappers (promisified, mockable)   │
└────────────────────────────────────────────────┘

Service Worker (src/sw)
  ├── EventBus: tabs/windows/tabGroups events → BroadcastChannel
  ├── StatsCollector: onActivated → 防抖 30s 写 storage
  ├── AlarmHeartbeat: 60s 心跳 + 标签休眠轮询
  ├── ArchiveHandler: 原子事务
  └── MessageRouter: chrome.runtime.onMessage
```

### 11.4 MV3 SW 生命周期应对

- SW 30s 空闲挂起；重启后事件监听自动恢复
- **关键事件立即落盘**：频率计数器、Undo 队列、设置预设
- **心跳兜底**：`chrome.alarms.create('heartbeat', { periodInMinutes: 1 })`（alarms 最小 1min，1min 内丢事件可接受）
- **启动校正**：新标签页首次渲染时 `chrome.tabs.query({})` 一次全量；与 storage 中的 lastAccessed 做 diff 补偿
- **丢事件降级**：UI 侧若广播静默 > 10s 主动走全量查询

### 11.5 性能硬指标

| 指标               | v1.0 目标            | 度量         |
| ------------------ | -------------------- | ------------ |
| 首屏骨架可见 P95   | ≤ 150ms             | `perf_fcp` |
| 首屏有意义内容 P95 | ≤ 600ms             | `perf_fmp` |
| 主 chunk 大小      | ≤ 280 KB / 90 KB gz | 构建产物     |
| 500 Tab 下 FPS P95 | ≥ 55                | `perf_fps` |
| SW 冷启 → 首广播  | ≤ 300ms             | 本地采样     |

#### 关键拆包动作

1. `SearchBox` 独立 chunk（含 `minisearch` + `pinyin-pro`）
2. `SettingsPanel` 独立 chunk（含所有 `panels/*` + 皮肤 / 渐变预设）
3. `ArchivePanel` 独立 chunk（含 `import-export`）
4. antd 保留核心 10 个组件，其余 lazy：`Modal / Popover / Select / Drawer / DatePicker / Upload`
5. `lucide-react` 按路径导入 `lucide-react/dist/esm/icons/x.js`
6. `tldts / pinyin-pro / minisearch` 动态 `import()` 按需加载

---

## 12. 数据模型 & 存储策略

### 12.1 核心类型

```ts
// ========== Runtime（非持久化）==========
interface LiveTab {
  id: number;
  windowId: number;
  url: string;
  title: string;
  favIconUrl?: string;
  active: boolean;
  pinned: boolean;
  incognito: boolean;
  audible?: boolean;
  discarded?: boolean;
  lastAccessed?: number;
  status?: 'loading' | 'complete' | 'unloaded';
  groupId?: number;
  groupTitle?: string;
  groupColor?: chrome.tabGroups.ColorEnum;
}

// ========== 归档 ==========
interface ArchivedSession {
  id: string;                // nanoid
  name: string;
  createdAt: number;
  updatedAt: number;
  tabs: ArchivedTab[];
  tags?: string[];
  note?: string;
  hidden?: boolean;          // 自动快照走 hidden
  schemaVersion: number;
}

interface ArchivedTab {
  url: string;
  title: string;
  favIconUrl?: string;
  archivedAt: number;
  note?: string;
  tags?: string[];
}

// ========== 使用统计 ==========
interface UrlStat {
  url: string;
  activations: number;
  lastActivatedAt: number;
  sessionBucket: string;     // 'day-20260424'（用于 7 日滚动）
}

// ========== 看板（v0.6） ==========
interface KanbanLayout {
  columns: Array<{ id: string; name: string; color?: string; urls: string[] }>;
  updatedAt: number;
}

// ========== 工作区（v0.6） ==========
interface Workspace {
  id: string;
  name: string;
  filter: { tags?: string[]; domains?: string[] };
  createdAt: number;
}

// ========== 设置 ==========
interface Settings {
  schemaVersion: number;
  theme: 'light' | 'dark' | 'system';
  defaultView: ViewMode;
  overrideNewTab: boolean;
  showThumbnails: boolean;

  dedupStrictness: 'strict' | 'loose' | 'off';
  idleThresholdMinutes: 360 | 720 | 1440 | 4320 | 10080;

  skinPreset: string;
  gradientPreset: string;
  customGradient?: [string, string];
  backgroundImage?: string;  // base64 or URL
  backgroundFit?: 'cover' | 'contain' | 'repeat';
  backgroundOverlay?: { color: string; blur: number };

  layoutDensity: 'compact' | 'comfortable' | 'spacious';
  contentMaxWidth: number;
  reducedMotion: boolean;

  uiVisibility: {
    header: boolean;
    heroSearch: boolean;
    viewSwitcher: boolean;
    workspaceOverview: boolean;
    tidySuggestion: boolean;
  };

  customKeybindings: {
    search: string;
    exitSelection: string;
    selectAll: string;
  };

  closeConfirmThreshold: number;   // 默认 20
  undoWindowSeconds: number;       // 默认 5
  locale: 'zh-CN' | 'en-US' | 'auto';

  autoSnapshot?: { enabled: boolean; hours: 6 | 12 | 24 };
}

interface SettingsProfile {
  id: string;
  name: string;
  snapshot: Settings;
  createdAt: number;
  updatedAt: number;
}

// ========== 元数据 ==========
interface UrlMetadata {
  pin?: boolean;
  tags?: string[];
  note?: string;
}

// ========== Undo ==========
interface UndoItem {
  id: string;
  kind: 'close' | 'archive' | 'delete-session';
  createdAt: number;
  expiresAt: number;
  payload: unknown;
}

// ========== Activity（v0.5） ==========
interface ActivityRecord {
  id: string;
  type: 'archive' | 'restore' | 'import' | 'permission' | 'tidy';
  createdAt: number;
  payload: Record<string, unknown>;
  undoable?: boolean;
  expiresAt: number;    // now + 72h
}

type ViewMode =
  | 'domain' | 'timeline' | 'grid' | 'compact'
  | 'frequency' | 'tabgroup' | 'window' | 'bookmark';
```

### 12.2 Storage Schema 分区

| Key                          | 版本 | 内容                       | 预估容量  |
| ---------------------------- | ---- | -------------------------- | --------- |
| `canopy_settings`          | v0.1 | Settings                   | < 5 KB    |
| `canopy_settings_profiles` | v0.3 | SettingsProfile[]          | < 50 KB   |
| `canopy_sessions_index`    | v0.1 | 会话索引                   | < 200 KB  |
| `canopy_sessions:<id>`     | v0.1 | 单会话                     | ≤ 500 KB |
| `canopy_stats`             | v0.2 | UrlStat[]                  | ≤ 500 KB |
| `canopy_metadata`          | v0.3 | UrlMetadata Map            | ≤ 500 KB |
| `canopy_kanban`            | v0.6 | KanbanLayout               | < 100 KB  |
| `canopy_workspaces`        | v0.6 | Workspace[]                | < 10 KB   |
| `canopy_foldstate`         | v0.1 | 折叠状态                   | < 20 KB   |
| `canopy_undo`              | v0.2 | Undo 队列（最近 50 条）    | < 50 KB   |
| `canopy_metrics`           | v0.2 | 本地埋点计数               | < 50 KB   |
| `canopy_activity`          | v0.5 | ActivityRecord ring buffer | ≤ 20 KB  |
| `canopy_auto_snapshots`    | v0.5 | 自动快照索引               | 动态，IDB |
| `canopy_og_index`          | v0.6 | OG description 索引        | IDB 专用  |

### 12.3 容量监控与降级

- `chrome.storage.local` 上限 **10 MiB**
- 每次写入前 `getBytesInUse()` + 预计增量 > 8 MiB → Alert
- 自动降级：`shouldFallbackToIDB(bytes)` → 归档服务透明写 IDB（索引仍在 local）
- 设置 → 数据页面展示"存储容量"条 + 一键清理"超过 N 天的归档"

### 12.4 数据迁移

- 所有实体携带 `schemaVersion`
- 启动时 `MigrationRunner` 按版本链式升级
- 前 3 次升级备份到 `migration_backup_<ts>`
- 迁移失败自动回滚 + Alert

---

## 13. 消息协议 & 并发模型

### 13.1 消息协议

- UI ↔ UI：**BroadcastChannel**（`'canopy-tabs'` / `'canopy-undo'` / `'canopy-settings'`）
- UI → SW：`chrome.runtime.sendMessage`
- SW → UI：SW 通过 BroadcastChannel 直接广播

```ts
type Message =
  | { type: 'TABS_CHANGED';   payload: { changedIds: number[]; reason: string } }
  | { type: 'WINDOWS_CHANGED'; payload: { changedIds: number[] } }
  | { type: 'TABGROUPS_CHANGED'; payload: { changedIds: number[] } }
  | { type: 'SESSION_SAVED';  payload: { sessionId: string } }
  | { type: 'STATS_UPDATED' }
  | { type: 'UNDO_PUSH';      payload: UndoItem }
  | { type: 'UNDO_CONSUME';   payload: { id: string } }
  | { type: 'QUOTA_WARNING';  payload: { usedBytes: number } }
  | { type: 'SETTINGS_CHANGED'; payload: Partial<Settings> };
```

- **协议版本**：`protocolVersion: 1`，不兼容时丢弃旧消息
- **幂等性**：所有消息必须幂等处理

### 13.2 并发与竞态

| 场景                      | 方案                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| 用户同时打开 3 个新标签页 | 每页独立订阅广播，各自刷新                                                                 |
| 3 页同时写 storage        | **所有写操作经 SW 串行化**（UI 通过 `sendMessage` 发送意图，SW 单线程队列处理）    |
| 归档流程中用户关新标签页  | 归档**原子事务**：先写 storage，成功后再 `tabs.remove`；中途失败则回滚（不关 tab） |
| Undo 跨页面               | Undo 持久化 + BroadcastChannel 广播                                                        |
| SW 重启期间的事件         | 重启后 `queryAllTabs` 做全量校正                                                         |
| 浏览器关闭瞬间写入        | SW `beforeunload` 不可靠，改为每次变更立即落盘                                           |

---

## 14. 权限与隐私

### 14.1 权限清单（校准版）

```jsonc
{
  "permissions": [
    "tabs", "storage", "favicon", "alarms",
    "sessions", "contextMenus", "tabGroups", "activeTab"
  ],
  "optional_permissions": ["history", "bookmarks"],
  "host_permissions": [],
  "optional_host_permissions": ["<all_urls>"],
  "incognito": "split"
}
```

### 14.2 权限使用说明

| 权限             | 用途                        | 何时申请                          |
| ---------------- | --------------------------- | --------------------------------- |
| `tabs`         | 读写 Tab                    | 必选                              |
| `storage`      | 本地持久化                  | 必选                              |
| `favicon`      | chrome://favicon2/          | 必选                              |
| `alarms`       | SW 心跳                     | 必选                              |
| `sessions`     | Undo 恢复                   | 必选                              |
| `contextMenus` | 右键菜单                    | 必选                              |
| `tabGroups`    | 原生 TabGroup 视图          | 必选                              |
| `activeTab`    | 当前 Tab 临时读写           | 必选                              |
| `history`      | 使用频率视图校正 + 搜索建议 | **首次用时申请**            |
| `bookmarks`    | 书签视图                    | **首次打开视图时申请**      |
| `<all_urls>`   | OG 抓取（F-24）             | **v0.6 用户显式开启才申请** |

### 14.3 隐私声明

- 零外部上报（包括崩溃日志）
- 所有统计仅 `chrome.storage.local` / IDB，可随时清空
- 无痕窗口：
  - 默认不展示（`settings.showIncognito` 关）
  - `incognito: "split"` 下无痕有独立实例，天然隔离
  - 无痕 Tab 永不入归档、去重、频率统计

### 14.4 商店上架 Checklist

- [ ] 隐私政策页（GitHub Pages）
- [ ] 商店素材：128/48/16 图标 / 3–5 张 1280×800 截图 / 30s GIF
- [ ] 描述文案：一句话定位 + 四大场景 + 键盘 / 隐私亮点
- [ ] 开发者账号（$5 年费）
- [ ] 评审期预留：2 周

---

## 15. 可访问性 & 国际化

### 15.1 A11y（WCAG 2.1 AA）

- 完整键盘操作：`Tab`/`Shift+Tab` 遍历，`Enter` 激活，`Delete` 关闭 Tab，`↑/↓` 列表移动
- 所有图标按钮必须 `aria-label`
- 焦点态清晰可见（§10.5）
- 对比度 4.5:1（正文）/ 3:1（大字）
- `prefers-reduced-motion` 时禁用所有非必要动画
- 颜色不作为唯一信息载体（去重提示用色 + 图标 + 文字）

### 15.2 i18n

- **MVP 开始用 `_locales` 与 `t()` 函数**，不硬编码中文
- 已支持：`zh-CN`、`en`（`shared/i18n/*.ts`）
- 切换优先级：设置 → `chrome.i18n.getUILanguage()` → `en` 兜底
- 日期 / 数字用 `Intl.DateTimeFormat` / `Intl.NumberFormat`
- 长文本用 ICU MessageFormat 处理复数

---

## 16. 测试策略

### 16.1 测试金字塔

| 层   | 工具                                  | 覆盖目标                              |
| ---- | ------------------------------------- | ------------------------------------- |
| 单元 | Vitest                                | 纯函数、Services、Repositories ≥ 80% |
| 组件 | React Testing Library                 | 核心组件交互                          |
| 集成 | Vitest +`@webextension-mock`        | SW 行为、storage 流程                 |
| E2E  | Playwright + Chrome extension loading | 关键路径 10 个场景                    |

### 16.2 关键 E2E 场景

1. 安装扩展 → 新开 Tab → 看到工作台
2. 打开 5 个域名的 10 个 Tab → 按域名分组正确
3. 关闭一个 Tab → Undo 恢复
4. Save All Tabs → 所有 Tab 关闭 + 归档可见 → Restore All 到新窗口
5. 搜索关键词 → 高亮匹配
6. 导出 JSON → 清空 → 导入 → 数据一致
7. 500 Tab 下切换视图帧率 ≥ 55
8. 存储 8 MiB 时 QuotaWarning 正确显示
9. 快捷键 `Cmd+K` 聚焦搜索
10. 深色模式切换无 FOUC
11. **（新）** 多选 20 个 Tab → 批量归档 → Toast 显示成功 + 关闭失败数
12. **（新）** 打开 3 个相同 URL → TidySuggestionBar 显示去重 → 一键合并
13. **（新）** 2 个窗口 → 合并窗口 → 主窗口包含所有 Tab
14. **（新）** 保存配置预设 → 改设置 → 应用预设 → 设置恢复
15. **（新）** 开启无痕窗口 Tab → 默认不展示；归档不含无痕 Tab

### 16.3 手动回归 Checklist

发布前跑 `docs/QA_CHECKLIST.md`（首版 v1.0 发布前新增）。

---

## 17. 本地埋点 & 度量口径

> 原则：**不上传**。仅用户自己查看（设置 → "关于 / 数据洞察"）。

### 17.1 埋点事件

| 事件                | 字段                               | 用途         |
| ------------------- | ---------------------------------- | ------------ |
| `newtab_open`     | `ts`                             | 日均打开次数 |
| `view_switch`     | `from`, `to`                   | 视图偏好     |
| `session_save`    | `tabCount`                       | 归档规模     |
| `session_restore` | `tabCount`                       | 恢复规模     |
| `tab_close`       | `count`, `source`              | Undo 触发率  |
| `search_query`    | `len`（不存内容）, `hasPrefix` | 搜索活跃度   |
| `tidy_merge`      | `count`                          | 整理使用率   |
| `tidy_discard`    | `count`                          | 休眠使用率   |
| `profile_apply`   | `profileId`                      | 预设使用率   |
| `perf_fcp`        | `ms`                             | 首屏性能     |
| `perf_fps_sample` | `p50`, `p95`                   | 帧率         |

### 17.2 度量口径

- **首屏骨架 FCP**：`document.visibilityState === 'visible'` → 第一次非骨架内容 paint
- **帧率**：`requestAnimationFrame` 采样 5s，算 P50/P95
- **达标阈值**：见 §20

---

## 18. 工程规范

### 18.1 文件结构（对齐当前仓库）

```
tabs/
├── manifest.json
├── src/
│   ├── pages/
│   │   ├── newtab/      # 新标签页入口
│   │   └── popup/       # 工具栏弹窗
│   ├── features/
│   │   ├── tabs/        # 实时 Tab 聚合 + 8 种视图 + 多选 + 整理
│   │   ├── sessions/    # 归档会话 + Onboarding
│   │   ├── search/      # SearchBox / CommandCenter
│   │   ├── bookmarks/   # 书签视图
│   │   └── settings/    # 设置 5 Tab + Profile
│   ├── shared/
│   │   ├── ui/          # UndoToast / ErrorBoundary / feedback / AntdThemeProvider
│   │   ├── hooks/       # use-keybinding / use-sw-broadcast / use-resolved-theme ...
│   │   ├── theme/       # gradient-presets / skin-presets
│   │   ├── i18n/        # zh-CN / en
│   │   ├── utils/       # domain / dedupe / idle-detect / idb-fallback / import-export ...
│   │   └── config/      # keybindings / search-engines / views / view-registry
│   ├── store/           # tabs / selection / settings / metadata / undo  Zustand slices
│   ├── services/        # archive-service
│   ├── repositories/    # storage-repo
│   ├── chrome/          # tabs / bookmarks / history promisified
│   └── sw/              # index / archive-handler
├── public/
│   ├── icons/
│   └── _locales/        # zh_CN / en messages.json
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
│   ├── PRD v0.1.md              # 首版（保留）
│   ├── PRD.md                   # v0.2（保留）
│   ├── PRD v0.4.md              # v0.4（保留）
│   ├── PRD v1.0.md              # ← 本文（执行基线）
│   ├── CHANGELOG.md
│   ├── QA_CHECKLIST.md
│   └── ARCHITECTURE.md
├── scripts/
│   ├── release.mjs              # 打包 + 版本号
│   └── check-quota.mjs
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### 18.2 代码规范

- ESLint（airbnb-base + @typescript-eslint）+ Prettier
- Commit：Conventional Commits（`feat:` / `fix:` / `perf:` / `chore:` / `docs:`）
- PR：必须过 CI（type-check + unit + lint）
- Git 分支：`main` / `dev` / `feat/*` / `fix/*`
- 通用原则：
  - 新增 `chrome` API 调用必须走 `src/chrome/*` 封装并 try/catch
  - 新增 store action 必须失败静默刷新 + `feedback.error`
  - 新增数据表必须有 `schemaVersion` + 迁移脚本（至少空迁移）
  - 新 UI 字符串走 `t()`，双语覆盖
  - 关键路径至少 1 条 Vitest + 1 条 Playwright E2E

### 18.3 版本与发布

- SemVer：`MAJOR.MINOR.PATCH`
- `CHANGELOG.md` 每次发布追加
- 发布：`pnpm release` → 自动 bump 版本 → 生成 `.zip` → 上传 Chrome 商店（半自动）

---

## 19. 迭代里程碑

### 19.1 当前状态快照（commit 98c6613）

- P0 全部 ✅
- P1 约 75% ✅（见 §5.1 矩阵）
- P2 全部 ❌

### 19.2 v1.0（2 周）— 工作台收敛 + 包体治理

**主题**：首页工作台 + 高频操作可见化 + 性能达标

| 任务                                  | 说明                                       |
| ------------------------------------- | ------------------------------------------ |
| F-34 Dashboard Overview 独立组件      | 6 项统计 + 3 个高频入口 + 最近归档直达     |
| F-25 Onboarding v2                    | 双模式选择 + 3 步微引导                    |
| F-26 Popup 升级                       | 搜索 + 最近 10 Tab + 归档按钮 + 打开工作台 |
| F-06 归档富交互 Toast                 | 「查看归档」按钮 + 关闭失败数              |
| F-13 去重严格度 UI                    | 三档切换                                   |
| F-13 重复合并预览 Modal               | 逐条勾选保留项                             |
| 闲置阈值可配                          | 设置 → 行为                               |
| 多选范围反馈 + 选中摘要               | CompactView / DomainGroupView              |
| **主 chunk ≤ 280 KB gz 90 KB** | 拆包 + 按需导入                            |
| **首屏骨架 ≤ 150ms P95**       |                                            |
| 10 条关键 E2E 重跑通过                |                                            |
| 商店上架素材                          | §14.4                                     |

### 19.3 v1.1（2–3 周）— 搜索命令中心 + 上下文管理

| 任务                              | 说明                                  |
| --------------------------------- | ------------------------------------- |
| F-05b CommandCenter               | 四区推荐 + 6 种搜索语法               |
| F-27 Activity Strip               | ring buffer，最近操作展示             |
| F-15 完整导入导出                 | JSON / MD / TXT / HTML + 3 种冲突策略 |
| F-14 会话合并 / 分享 / 三策略恢复 | 分批恢复 10/100ms                     |
| F-23 自动快照                     | 频率可调 + 可关                       |
| F-11 频率视图 SW StatsCollector   | 精确计数                              |
| 首屏有意义内容 P95 ≤ 500ms       |                                       |

### 19.4 v1.2（3 周）— 组织能力 + 会员版铺垫

| 任务                         | 说明                                  |
| ---------------------------- | ------------------------------------- |
| F-20 看板视图                | dnd-kit 引入                          |
| F-24 OG description 受控抓取 | 用户显式勾选 +`<all_urls>` 动态授权 |
| F-28 本地隐私洞察仪表盘      | 折线 + 柱状图 + 清除统计              |
| F-29 Workspace 雏形          | 最多 3 个                             |
| `FeatureGate` 抽象         | 默认全 off                            |

---

## 20. 成功指标

| 指标                                | 目标                 | 度量                       |
| ----------------------------------- | -------------------- | -------------------------- |
| Chrome 商店安装量（v1.0 上架 3 月） | 1 万+                | 商店后台                   |
| 7 日留存                            | ≥ 40%               | 本地 `newtab_open` 分布  |
| 日均打开新标签次数                  | ≥ 10 / 用户         | 同上                       |
| 平均评分                            | ≥ 4.5 ★            | 商店                       |
| 首屏骨架 FCP P95                    | ≤ 150ms             | `perf_fcp`               |
| 首屏有意义内容 P95                  | ≤ 600ms             | `perf_fmp`               |
| 主 chunk 大小                       | ≤ 280 KB / 90 KB gz | CI 出包                    |
| 500 Tab 下 FPS P95                  | ≥ 55                | `perf_fps`               |
| 归档快照成功率                      | 100%                 | 操作计数                   |
| 归档关闭成功率                      | ≥ 95%               | 操作计数                   |
| Undo 恢复成功率                     | ≥ 90%               | 操作计数                   |
| Crash Rate                          | < 0.1%               | 本地 `error_ring_buffer` |

---

## 21. 风险与未决问题

### 21.1 风险登记

| 风险                                         | 等级 | 影响         | 缓解                                                                |
| -------------------------------------------- | ---- | ------------ | ------------------------------------------------------------------- |
| Chrome 商店对 `tabs` / `<all_urls>` 敏感 | 高   | 上架被拒     | v1.0 不申请 `<all_urls>`；隐私政策清晰                            |
| `antd v6` 拆包受限                         | 中   | 首屏慢       | 核心 10 组件保留 + 其余 lazy；必要时切 `@ant-design/pro-*` 子模块 |
| IDB 与 storage.local 状态同步                | 中   | 数据不一致   | 归档服务单一入口路由，不双写                                        |
| MV3 SW 30s 休眠丢事件                        | 中   | 频率不准     | 立即落盘 + alarms 心跳 + 启动校正                                   |
| Storage 10MiB 上限                           | 中   | 重度用户受限 | 容量监控 + IDB 降级                                                 |
| 用户开启 OG 索引后遇慢站                     | 中   | UI 卡顿      | 并发 5 + 超时 3s + 限 50KB + 可中止                                 |
| 多新标签页并发竞态                           | 低   | 数据不一致   | SW 串行化写入                                                       |
| Chrome 136+`lastAccessed` 行为变化         | 低   | 频率偏差     | `lastAccessed + SW 计数` 双轨，UI 标"约"                          |
| Firefox MV3 差异                             | 低   | 兼容成本     | v1.2 后评估，非阻塞                                                 |

### 21.2 待用户确认

- **品牌名**：✅ 已定 **Canopy**
- **上架时机**：v1.0 末尾
- **Firefox / Edge**：v1 仅 Chromium
- **v1 遥测**：保持"全本地"
- **付费模式**：v1 免费；v2 评估会员版（年付 + 终身双轨）

---

## 22. 术语表

| 术语              | 含义                                             |
| ----------------- | ------------------------------------------------ |
| MV3               | Manifest V3，Chrome 扩展新规范                   |
| SW                | Service Worker，MV3 的后台脚本形态               |
| PSL               | Public Suffix List，公共后缀列表（识别注册域名） |
| OG                | Open Graph，网页元数据协议                       |
| FCP               | First Contentful Paint，首次内容绘制             |
| FMP               | First Meaningful Paint，首次有意义内容绘制       |
| WCAG              | Web Content Accessibility Guidelines             |
| Undo Toast        | 操作后右下角的可撤销提示条                       |
| LiveTab           | 运行时的真实 Tab（来自 `chrome.tabs`）         |
| ArchivedSession   | 持久化的归档会话（多个 Tab 的集合）              |
| TidySuggestionBar | 智能整理建议栏（重复 + 闲置）                    |
| SettingsProfile   | 配置预设（保存一整套外观 + 行为）                |
| FeatureGate       | 功能 gating 抽象（为未来会员版铺垫）             |

---

## 附：P0 / P1 实现状态对照表

| 功能 ID     | 功能               | v1.0 前状态               | v1.0 需完成                                    |
| ----------- | ------------------ | ------------------------- | ---------------------------------------------- |
| F-01 ~ F-09 | P0 全量            | ✅ 全部已落地             | 保持不退化                                     |
| F-10        | 8 种视图           | ✅                        | —                                             |
| F-11        | 频率视图           | ⚠️`lastAccessed` 近似 | v1.1 接 SW StatsCollector                      |
| F-12        | 标签 + 备注        | ⚠️ 仅元数据             | v1.1 加 `tag:` 搜索语法                      |
| F-13        | 去重严格度         | ⚠️ 仅检测               | **v1.0 加 UI 三档切换** + 合并预览 Modal |
| F-14        | 会话管理           | ⚠️ 基础                 | v1.1 合并/分享/三策略恢复                      |
| F-15        | 导入导出           | ⚠️ 仅 JSON              | v1.1 加 MD / TXT / HTML + 冲突策略             |
| F-16        | 设置面板           | ✅                        | —                                             |
| F-17        | 标签休眠           | ✅                        | —                                             |
| F-18        | 分屏显示           | ✅                        | —                                             |
| F-19        | TabGroup 视图      | ✅                        | —                                             |
| F-20        | 看板视图           | ❌                        | v1.2                                           |
| F-21        | 书签整合           | ✅                        | —                                             |
| F-22        | 固定 / 置顶        | ✅                        | —                                             |
| F-23        | 自动快照           | ❌                        | v1.1                                           |
| F-24        | OG 检索            | ❌                        | v1.2                                           |
| F-25        | 双模式引导         | ⚠️ 基础                 | **v1.0 升级**                            |
| F-26        | Popup 轻量版       | ⚠️ 占位                 | **v1.0 升级**                            |
| F-27        | Activity Strip     | ❌                        | v1.1                                           |
| F-28        | 隐私洞察           | ❌                        | v1.2                                           |
| F-29        | Workspace 雏形     | ❌                        | v1.2                                           |
| F-30        | 配置预设           | ✅                        | —                                             |
| F-31        | 自定义快捷键       | ✅                        | —                                             |
| F-32        | UI 区域显隐        | ✅                        | —                                             |
| F-33        | 皮肤/渐变/背景     | ✅                        | —                                             |
| F-34        | Dashboard Overview | ⚠️ 数据入参就绪         | **v1.0 UI 升级**                         |

---

_文档版本：**v1.0（执行基线）** · 本文为后续开发唯一参照；v0.1 / v0.2 / v0.4 作为历史档案保留。_
