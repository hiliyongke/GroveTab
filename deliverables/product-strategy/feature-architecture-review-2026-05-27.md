# GroveTab 功能架构审视报告

**日期**：2026-05-27
**类型**：产品架构分析
**参与成员**：方向明（主理人）

---

## 📌 TL;DR（执行摘要）

- **核心问题**：功能膨胀严重，10 种视图模式 + 3 种页面模式 + 6 个设置 Tab，用户认知负担高
- **最大冗余**：视图模式过度设计（10 种），其中 4 种使用率低；DeveloperToolsPage 作为一级页面模式过于侵入
- **最大分类问题**：BookmarkTreeView/BookmarkView 放在 `features/tabs/` 下，与标签管理混淆；设置面板中 Behavior 已内聚 5 个子面板但一级 Tab 仍显单薄
- **整合机会**：视图模式可合并为 5 种核心 + 2 种高级；设置面板可从 6 个合并为 4 个；热榜/开发工具/快速启动需重新定位
- **下一步**：按「核心-高级-实验性」三层重构功能架构，降低认知负担

---

## 🎯 核心结论卡片

| 项目 | 内容 |
|------|------|
| 推荐方案 | 功能架构三层化：核心层（5 视图）+ 高级层（4 视图）+ 实验性（2 页面模式） |
| 优先级 | P0（架构债务，影响长期可维护性） |
| 预期影响 | 降低新用户门槛 30%+，减少维护成本，明确功能边界 |
| 资源需求 | 中（主要是代码移动和 UI 调整，无新功能开发） |
| 风险等级 | 中（视图模式合并可能影响老用户习惯） |

---

## 1. 功能架构全景图

### 1.1 当前功能矩阵

```
GroveTab
├── Page Mode（页面模式）3 种
│   ├── workspace（工作区）── 核心
│   ├── trending（热榜）── 独立页面
│   └── devtools（开发工具）── 独立页面
│
├── View Mode（视图模式）10 种 ── 全部在 workspace 内
│   ├── domain（域名分组）
│   ├── compact（紧凑列表）
│   ├── timeline（时间轴）
│   ├── tabgroup（标签组）
│   ├── window（窗口分组）
│   ├── kanban（看板）
│   ├── bookmarks（书签）── ❌ 放在 tabs/ 目录下
│   ├── frequency（频率）
│   ├── grid（网格）
│   └── archive（归档）── ❌ 放在 tabs/ 目录下，但属于 sessions
│
├── Panel（面板）6 个
│   ├── SearchBox（搜索）
│   ├── SettingsPanel（设置）── 6 个 Tab
│   ├── InsightsPanel（洞察）
│   ├── HistoryPanel（历史记录）
│   ├── TrashView（回收站）── 新增
│   └── OnboardingCard（首次引导）
│
├── Toolbar（工具栏）3 个
│   ├── BatchActionBar（批量操作）
│   ├── TidySuggestionBar（整理建议）
│   └── SelectionModeNotice（选择模式）
│
├── Effect（特效）1 个
│   └── ClickEffectLayer（点击动效）── 5 套粒子系统
│
└── QuickStart（快速启动）1 个
    └── QuickStartLayer + SpeedDialGrid
```

### 1.2 设置面板结构

```
SettingsPanel（6 个一级 Tab）
├── appearance（外观）── 皮肤/背景/语言/密度
├── behavior（行为）── 内聚 5 个子面板
│   ├── GeneralSettings（通用行为）
│   ├── ViewLayoutSettings（视图与布局）
│   ├── TimelineSettings（时间轴设置）
│   ├── SearchSettings（搜索设置）
│   └── MemoryGovernanceSettings（内存治理）
├── data（数据）── 导入导出/配额/自动清理
├── privacy（隐私）── 数据收集/权限
├── shortcuts（快捷键）── 自定义快捷键
└── about（关于）── 版本/开源许可
```

---

## 2. 冗余识别（Over-engineering）

### 🔴 严重冗余

#### 2.1 视图模式过度设计（10 种 → 建议 5 种核心）

| 视图 | 问题 | 建议 |
|------|------|------|
| **domain** | ✅ 核心视图，最常用 | 保留 |
| **compact** | 与 domain 的"列表模式"高度重叠 | 合并为 domain 的子模式 |
| **timeline** | 使用场景窄（按时间回顾） | 降级为二级/实验性 |
| **tabgroup** | Chrome 原生标签组用户少 | 降级为二级/实验性 |
| **window** | 使用场景明确（多窗口用户） | 保留 |
| **kanban** | 与 domain 的卡片模式重叠 | 合并为 domain 的卡片布局 |
| **bookmarks** | ❌ 不是标签视图，是独立功能 | 移出 ViewDock，作为独立入口 |
| **frequency** | 与 timeline 的"热标签"维度重叠 | 合并到 timeline 或 insights |
| **grid** | 与 domain 的网格模式重叠 | 合并为 domain 的布局选项 |
| **archive** | ❌ 不是标签视图，是会话管理 | 移出 ViewDock，归入 sessions |

**核心矛盾**：10 种视图让 ViewDock 变成「图标墙」，用户需要记住每个图标的含义。

#### 2.2 DeveloperToolsPage 作为一级页面模式

- **问题**：一个标签管理扩展里嵌入完整的「开发者工具箱」（JSON 格式化、Base64 编解码、颜色转换等 20+ 工具），与核心定位偏离
- **数据**：devtools 页面模式与 workspace/trending 并列，占用一级导航位置
- **建议**：降级为设置中的「工具」面板，或独立弹窗，不作为新标签页的主模式

#### 2.3 ClickEffectLayer 粒子特效

- **问题**：5 套粒子系统（ripple/sparkle/confetti/petal/off）增加了约 2.5KB gzipped + Canvas 渲染开销
- **价值**：对核心功能零贡献，属于「玩具功能」
- **建议**：保留但默认 off，或精简为 1-2 套效果

### 🟡 中度冗余

#### 2.4 热榜（TrendingPage）的独立性

- **问题**：trending 作为一级页面模式，但内容消费与标签管理是两类不同心智模型
- **建议**：可考虑降级为 QuickStartLayer 的一个可选模块，或侧边栏小部件

#### 2.5 历史记录的多重入口

- HistoryPanel（插件自己的历史事件）
- TimelineView（标签按时间排列）
- ArchiveView（归档的会话）
- TrashView（最近关闭的标签）

这四个功能都与「过去发生的事」相关，但分散在不同模块，用户难以区分「历史记录」和「时间轴视图」的差异。

---

## 3. 分类不清（Mis-categorization）

### 🔴 目录结构问题

#### 3.1 BookmarkTreeView / BookmarkView 放在 `features/tabs/`

```
features/tabs/
├── BookmarkTreeView.tsx    ← ❌ 这是书签功能，不是标签
├── BookmarkView.tsx        ← ❌ 同上
├── DomainGroupView.tsx     ← ✅ 标签视图
├── GridView.tsx            ← ✅ 标签视图
├── ...
```

**问题**：书签管理（bookmark-tools.ts, bookmark-auto-rules.ts 在 features/bookmarks/）与书签视图（在 features/tabs/）分离，导致：
- 开发时难以找到相关代码
- 书签功能的「数据层」和「表现层」跨目录

**建议**：将 BookmarkTreeView 和 BookmarkView 移至 `features/bookmarks/views/`。

#### 3.2 ArchiveView 放在 `features/sessions/`，但 archive 是 ViewMode

```
features/sessions/
├── ArchiveView.tsx         ← 会话管理
├── TrashView.tsx           ← 回收站（新增）
└── components/
```

`archive` 作为 ViewMode 存在于 ViewDock 中，但 ArchiveView 不在 `features/tabs/` 下。这本身没问题（归档不是标签），但造成了「视图切换器里有非标签视图」的认知混乱。

**建议**：将 archive 从 ViewDock 移出，作为独立入口（如顶栏按钮或侧边栏）。

### 🟡 设置面板分类问题

#### 3.3 BehaviorPanel 内聚 5 个子面板，但一级 Tab 叫「行为」

当前 BehaviorPanel 包含：
- 通用行为（关闭标签行为、新标签页行为）
- 视图与布局（列数、排序、密度）
- 时间轴（时间轴特有的配置）
- 搜索（搜索配置）
- 内存治理（内存阈值、白名单）

**问题**：「行为」这个词过于宽泛，5 个子面板之间关联度不高。用户找「内存治理」设置时，可能不会想到在「行为」里。

**建议**：将 MemoryGovernanceSettings 和 DataPanel 合并为「系统与存储」Tab；SearchSettings 和 TimelineSettings 可归入各自的父级功能。

---

## 4. 整合机会（Consolidation）

### 4.1 视图模式整合（10 → 5 核心 + 2 高级）

```
核心视图（ViewDock 展示）
├── 域名分组（domain）── 默认，含列表/网格/看板三种布局
├── 窗口分组（window）── 多窗口用户刚需
├── 紧凑列表（compact）── 高密度用户
├── 时间轴（timeline）── 含频率/热标签维度
└── 标签组（tabgroup）── Chrome 原生标签组用户

高级/二级（设置中开启或侧边栏）
├── 书签（bookmarks）── 独立入口，不作为标签视图
└── 归档（archive）── 独立入口，归入 sessions
```

**整合方式**：
- domain/compact/grid/kanban 合并为「域名分组」的 4 种布局选项（列表/紧凑/网格/看板）
- timeline/frequency 合并为「时间轴」的 2 种维度（时间/频率）

### 4.2 设置面板整合（6 Tab → 4 Tab）

```
当前：appearance | behavior | data | privacy | shortcuts | about
建议：appearance | behavior | system | about

其中：
- behavior 保留 General + ViewLayout + Search + Timeline
- system = data(导入导出/配额) + privacy + memory-governance + shortcuts
```

或更激进的方案（4 Tab）：
```
外观（appearance）── 皮肤/背景/语言/布局密度
行为（behavior）── 通用行为/视图/搜索/时间轴
系统（system）── 数据/隐私/存储/快捷键/内存
关于（about）── 版本/许可/诊断
```

### 4.3 历史相关功能整合

```
「时光机」概念统一入口
├── 历史记录（HistoryPanel）── 插件操作事件
├── 时间轴（TimelineView）── 标签打开时间线
├── 归档（ArchiveView）── 手动保存的会话
└── 回收站（TrashView）── 最近关闭的标签
```

在 UI 上可以用一个「时光机」侧边栏或下拉菜单统一这四个入口，减少顶栏按钮数量。

### 4.4 QuickStartLayer 与 TrendingPage 整合

```
新标签页默认内容（可配置）
├── 快速启动（QuickStartLayer）──  SpeedDial 网格
├── 热榜（TrendingPage）── 可选模块
└── 今日洞察（InsightsPanel 摘要）── 新增
```

让用户选择新标签页默认展示什么，而不是硬编码为 QuickStartLayer。

---

## 5. 功能定位重新审视

### 5.1 核心定位：标签管理器 vs 新标签页替代

当前产品有两个身份：
1. **标签管理器**── 管理已有标签（domain/window/compact 视图）
2. **新标签页替代**── 打开新标签时展示内容（QuickStartLayer/trending/devtools）

**问题**：第二个身份稀释了第一个身份。用户安装 GroveTab 是为了管理标签，但打开新标签页时看到的是热榜/开发工具/快速启动。

**建议**：明确核心定位是「标签管理器」，新标签页的内容（QuickStart/trending/devtools）作为可关闭的附加功能。

### 5.2 功能金字塔

```
          ┌─────────────┐
          │  实验性功能  │  热榜/开发工具/点击动效
          │  （可关闭）  │
          ├─────────────┤
          │   高级功能   │  自动规则/洞察/内存治理
          │  （按需开启）│
          ├─────────────┤
          │   核心功能   │  标签视图/搜索/书签/会话
          │  （默认开启）│
          └─────────────┘
```

当前问题：实验性功能（devtools/trending/effects）与核心功能平级展示，用户无法区分重要性。

---

## 6. 代码层面问题

### 6.1 目录结构建议

```
src/features/
├── tabs/                  ← 仅保留标签相关视图
│   ├── views/
│   │   ├── DomainGroupView.tsx   ← 合并 compact/grid/kanban 为布局选项
│   │   ├── WindowView.tsx
│   │   ├── TimelineView.tsx      ← 合并 frequency 为维度切换
│   │   └── TabGroupView.tsx
│   ├── TabItem.tsx
│   ├── TabContextMenu.tsx
│   └── BatchActionBar.tsx
│
├── bookmarks/             ← 书签功能完整闭环
│   ├── views/
│   │   ├── BookmarkTreeView.tsx  ← 从 tabs/ 移入
│   │   └── BookmarkView.tsx      ← 从 tabs/ 移入
│   ├── BookmarkToolsModal.tsx
│   ├── BookmarkAutoRuleModal.tsx
│   ├── bookmark-tools.ts
│   └── bookmark-auto-rules.ts
│
├── sessions/              ← 会话管理
│   ├── ArchiveView.tsx
│   ├── TrashView.tsx
│   └── components/
│
├── history/               ← 历史相关统一
│   ├── HistoryPanel.tsx
│   └── hooks/
│
├── search/
├── insights/
├── quick-start/
├── settings/
├── workspace/
├── effects/               ← 可选，考虑移除或降级
├── developer-tools/       ← 可选，考虑移除或降级
└── trending/              ← 可选，考虑移除或降级
```

### 6.2 配置项膨胀

UserSettings 类型已非常庞大，包含：
- 外观（皮肤/背景/语言/密度/UI 显隐）
- 行为（关闭行为/休眠/视图/时间轴/搜索/内存治理）
- 数据（配额/清理/预设）
- 隐私

**建议**：按模块拆分 settings 类型，避免一个巨型接口。

---

## 7. 竞品对标

| 产品 | 视图模式 | 设置复杂度 | 核心定位 |
|------|----------|------------|----------|
| **OneTab** | 1 种（列表） | 极简 | 标签归档 |
| **Tab Wrangler** | 1 种（列表） | 极简 | 自动关闭 |
| **Toby** | 2-3 种（集合/列表） | 中 | 标签组织 |
| **Workona** | 2-3 种（工作区/列表） | 中 | 工作区管理 |
| **Session Buddy** | 2 种（会话/列表） | 低 | 会话管理 |
| **GroveTab** | **10 种** | **高** | **模糊** |

GroveTab 的视图模式数量是竞品的 3-5 倍，但用户真正高频使用的可能只有 2-3 种。

---

## 8. 推荐行动方案

### Phase 1：快速 wins（1-2 天）

1. **从 ViewDock 移除 bookmarks 和 archive**，改为顶栏独立入口
2. **合并 domain/compact/grid/kanban** 为「域名分组」的 4 种布局选项
3. **将 BookmarkTreeView/BookmarkView 移至 `features/bookmarks/views/`**

### Phase 2：架构重构（3-5 天）

4. **重构 ViewMode 类型**：`'domain' | 'window' | 'timeline' | 'tabgroup'` 核心 4 种
5. **设置面板合并**：behavior 中的 memory-governance 移至 data；appearance 中的 view-layout 移至 behavior
6. **统一「时光机」入口**：History/Archive/Trash/Timeline 统一侧边栏

### Phase 3：定位明确（1-2 天）

7. **DeveloperToolsPage 降级**：从 page mode 移至设置中的「工具」面板
8. **TrendingPage 降级**：从 page mode 移至 QuickStartLayer 的可选模块
9. **ClickEffectLayer 默认 off**

---

## ✅ 行动清单

| # | 行动 | 负责方 | 优先级 | 时间窗 |
|---|------|--------|--------|--------|
| 1 | ViewDock 移除 bookmarks/archive，改为顶栏入口 | 开发 | P1 | 本轮 |
| 2 | domain/compact/grid/kanban 合并为布局选项 | 开发 | P1 | 本轮 |
| 3 | BookmarkTreeView/BookmarkView 目录迁移 | 开发 | P1 | 本轮 |
| 4 | DeveloperToolsPage 从 page mode 降级 | 开发 | P2 | 下轮 |
| 5 | TrendingPage 降级为 QuickStart 模块 | 产品 | P2 | 下轮 |
| 6 | 设置面板重组（4 Tab 方案） | 开发 | P2 | 下轮 |
| 7 | 「时光机」统一入口设计 | 产品 | P2 | 下轮 |
| 8 | UserSettings 类型拆分 | 开发 | P3 | 后续 |

---

## ⚠️ 待确认 / 假设 / Non-goals

- **假设**：老用户已养成使用特定视图的习惯，合并需保留向后兼容（通过 settings migration）
- **待确认**：archive 从 ViewDock 移出后，archive 视图是否还需要？还是仅保留 ArchiveView 面板即可？
- **Non-goals**：本次审视不涉及功能删除，仅做整合和降级；不修改核心存储逻辑

---

## 📚 数据来源

- 代码目录结构：`src/features/` 全部模块
- 视图配置：`src/shared/config/views.ts`
- 设置面板：`src/features/settings/settings-tabs.tsx`
- 页面模式：`src/shared/types/settings.ts`（NewtabPageMode）
- 竞品对标：OneTab、Tab Wrangler、Toby、Workona、Session Buddy 公开信息

---

> 本报告由产品战略团队 AI 协作生成，重要决策请由产品负责人审定。
