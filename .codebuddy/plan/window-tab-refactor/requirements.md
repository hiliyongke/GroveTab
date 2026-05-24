# 窗口 Tab 模块重构 — 需求文档

## 引言

当前的窗口视图 [`WindowView.tsx`](../../../src/features/tabs/WindowView.tsx) 仅作为「按窗口折叠展示标签 + 一键合并」的轻量容器，对 Chrome 的 `chrome.tabGroups` 标签组能力利用不足，缺少标签组与标签页之间的可视化操作、跨窗口拖拽、批量重组等高阶交互。本次重构的目标是：

1. **整合标签分组能力**：把 Chrome 原生 Tab Group 真正提升为窗口视图的一等公民——可视化、可创建、可改名/换色、可折叠、可拖拽进出。
2. **统一卡片式布局语言**：对齐 [`DomainGroupView.tsx`](../../../src/features/tabs/DomainGroupView.tsx) 的瀑布流卡片视觉范式，使「窗口卡片」成为标签组与标签页的承载容器，建立「窗口 → 标签组 → 标签页」三级清晰层次。
3. **流畅的拖拽与跨窗口操作**：基于现有 `@dnd-kit/*` 与 `motion/react` 能力，支持「标签 ↔ 标签组」「标签 ↔ 窗口」「标签组 ↔ 窗口」「窗口顺序」四类拖拽，所有结果通过 `chrome.tabs.move` / `chrome.tabGroups.move` / `chrome.tabGroups.update` 实时下发到浏览器。
4. **充分发挥最新 Chrome 能力**：依托 Chrome 89+ 的 `chrome.tabGroups`（M89）、Tab Groups Save & Sync（M126+）、Tab Discard、Tab Group Collapsed 等 API，在不增加额外宿主权限的前提下提供更聪明的整理体验。

本文档关注**需求规格**而非实现细节；具体技术方案与任务拆分在后续阶段产出。

---

## 需求

### 需求 1：以「窗口卡片」为核心的可视化布局

**用户故事：** 作为一名经常打开多窗口工作的重度浏览器用户，我希望窗口视图能像域名分组视图一样以卡片网格呈现，让每个窗口的标签组与标签页一目了然，以便我快速理解当前会话全貌。

#### 验收标准

1. WHEN 用户切换到窗口视图 THEN 系统 SHALL 以卡片瀑布流（参考 `app-domain-masonry`）形式渲染当前所有 Chrome 窗口，每个窗口为一张独立卡片。
2. WHEN 卡片为「当前窗口」 THEN 系统 SHALL 在卡片头部显示「当前窗口」徽章并优先排在第一位。
3. WHEN 窗口处于 `focused === true` THEN 系统 SHALL 在卡片标题区显示「聚焦中」状态色条/Tag。
4. WHEN 窗口为隐身（incognito）窗口 THEN 系统 SHALL 在卡片显示明显的隐身图标与不同色调，且**不允许**与普通窗口之间的标签互拖。
5. IF 用户在设置中开启了「固定列数」 THEN 系统 SHALL 按指定列数（1–6）布局；否则 SHALL 按 `column-width: 360px` 自适应。
6. WHEN 系统中只存在 1 个窗口 THEN 系统 SHALL 仍以单列卡片形式展示，保持视觉一致而不退化为列表。

---

### 需求 2：标签组（Tab Group）的可视化整合

**用户故事：** 作为一名希望系统化整理标签的用户，我希望在窗口卡片内能直接看到 Chrome 原生标签组的颜色、名称、折叠状态，并能直接对标签组进行操作，以便不再需要切回浏览器顶栏来管理分组。

#### 验收标准

1. WHEN 一个窗口内存在 Chrome 原生标签组 THEN 系统 SHALL 在该窗口卡片内以「子卡片/分隔区块」形式展示每个标签组，并复用其原生颜色（`grey/blue/red/yellow/green/pink/purple/cyan/orange`）。
2. WHEN 用户点击标签组头部 THEN 系统 SHALL 切换该组在 Chrome 中的 `collapsed` 状态（调用 `chrome.tabGroups.update`），UI 同步收起/展开标签项。
3. WHEN 用户右键点击标签组头部或点击「⋯」按钮 THEN 系统 SHALL 提供以下操作：重命名、改色（9 色板）、解散组（ungroup）、关闭组、休眠组内全部标签、移动到新窗口。
4. WHEN 用户对未分组标签发起「创建分组」操作 THEN 系统 SHALL 调用 `chrome.tabs.group` 并允许立即输入名称与选择颜色。
5. WHEN Chrome 端标签组发生变化（外部改名/换色/折叠） THEN 系统 SHALL 通过 SW broadcast 在 200ms 内同步到 UI，无需手动刷新。
6. IF 当前 Chrome 不支持 `chrome.tabGroups`（极旧版本或权限被拒） THEN 系统 SHALL 优雅降级为「仅按窗口分组」形态并在提示区给出说明。
7. WHEN 一个标签组下没有任何标签时（用户拖光后） THEN 系统 SHALL 自动让 Chrome 销毁该空组（这是 Chrome 默认行为），UI 同步移除空组卡片。

---

### 需求 3：三级层次的拖拽与排序

**用户故事：** 作为追求高效的用户，我希望能用拖拽自由地把标签从一个组拖到另一个组、从一个窗口拖到另一个窗口，以便重新组织我的工作上下文，而不是反复点击右键菜单。

#### 验收标准

1. WHEN 用户在同一标签组内拖拽某个标签 THEN 系统 SHALL 调用 `chrome.tabs.move` 将其移动到组内目标位置，组属性保持不变。
2. WHEN 用户把标签拖入同窗口的另一个标签组 THEN 系统 SHALL 先 `chrome.tabs.move` 到目标位置，再 `chrome.tabs.group({ groupId, tabIds })` 将其加入目标组。
3. WHEN 用户把标签拖出标签组到「未分组区域」 THEN 系统 SHALL 调用 `chrome.tabs.ungroup` 将其脱组。
4. WHEN 用户把标签从一个窗口卡片拖到另一个窗口卡片（标签组内/外区域均允许） THEN 系统 SHALL 通过 `chrome.tabs.move({ windowId, index })` 跨窗口移动，并按落点决定是否合并到目标组。
5. WHEN 用户拖拽**整个标签组卡片**到另一个窗口 THEN 系统 SHALL 调用 `chrome.tabGroups.move({ windowId, index: -1 })` 整组迁移，保留组名与颜色。
6. WHEN 用户拖拽**窗口卡片**到瀑布流的其他位置 THEN 系统 SHALL 持久化该顺序到 `useSettingsStore`（仅 UI 排序，不改 Chrome 内部窗口列表），刷新后仍然生效。
7. WHEN 拖拽过程中 THEN 系统 SHALL 在落点处显示视觉反馈：
   - 同组重排：2px 蓝色横线 placeholder
   - 跨组：目标组卡片高亮 8% accent 背景 + 1px 实心描边
   - 跨窗口：目标窗口卡片整体高亮 + 角标提示「拖入此窗口」
8. WHEN 拖拽来源为隐身窗口、目标为普通窗口（或反之） THEN 系统 SHALL 显示「禁止图标」并不响应放置（Chrome 隐身分离原则）。
9. IF 拖拽 API 调用失败（如目标 tab 已被关闭） THEN 系统 SHALL 通过 `feedback.error` 提示，并 `loadAllTabs({ silent: true })` 兜底刷新还原 UI。
10. WHEN 用户在拖拽中按住 `Esc` THEN 系统 SHALL 取消本次拖拽，UI 回到原状。

---

### 需求 4：批量选择与跨窗口批量操作

**用户故事：** 作为一名需要快速整理大量标签的用户，我希望能多选标签后一次性把它们移到新窗口或新分组，以便摆脱逐个拖拽的繁琐。

#### 验收标准

1. WHEN 用户进入多选模式（已有 `useSelectionStore`） THEN 系统 SHALL 在卡片每个标签项前显示选择框，已选中标签拖拽时 SHALL 整体一起被搬运。
2. WHEN 选中 N 个标签 AND 用户在 BatchActionBar 点击「移到新窗口」 THEN 系统 SHALL 调用 `chrome.windows.create({ tabId })` + `chrome.tabs.move` 批量迁移。
3. WHEN 选中 N 个标签 AND 用户点击「加入新分组」 THEN 系统 SHALL 弹出名称+颜色选择器，确认后调用 `chrome.tabs.group({ createProperties, tabIds })`。
4. WHEN 选中 N 个标签 AND 用户点击「加入现有分组」 THEN 系统 SHALL 显示当前所有窗口的 Tab Group 列表（带颜色与名称），点选即合并。
5. WHEN 选中跨多个窗口的标签 AND 执行加入分组操作 THEN 系统 SHALL 先把所有目标 tab `move` 到目标 group 所在窗口，再 `group`，过程对用户透明。

---

### 需求 5：窗口级别的快捷操作

**用户故事：** 作为一名管理多窗口的用户，我希望窗口卡片头部能直接提供「合并、拆分、关闭、最小化、命名」等动作，以便不离开 NewTab 也能完成窗口级整理。

#### 验收标准

1. WHEN 用户在窗口卡片头部点击「合并到当前窗口」 THEN 系统 SHALL 把该窗口所有标签 `move` 到当前窗口，并复用现有 `BATCH=10` 的分批策略避免超时。
2. WHEN 用户在窗口卡片头部点击「在新窗口打开此组」（针对标签组） THEN 系统 SHALL 调用 `chrome.windows.create` 并把该组迁入新窗口。
3. WHEN 用户在窗口卡片点击「关闭该窗口」 THEN 系统 SHALL 二次确认（若标签数 > 阈值 `closeConfirmThreshold`），确认后 `chrome.windows.remove`。
4. WHEN 用户对窗口设置自定义名称（仅 UI 层，不影响 Chrome） THEN 系统 SHALL 持久化到 metadata（`windowAliases` 新字段）并在卡片头部展示。
5. WHEN 一次性选中多个窗口（多选模式延伸） THEN 系统 SHALL 提供「合并选中窗口」「按域名重整为分组」两类批量动作。

---

### 需求 6：视觉反馈与无障碍

**用户故事：** 作为一名注重操作流畅度的用户，我希望每次拖拽、点击、键盘操作都能立即看到视觉反馈，且键盘也能完成核心动作，以便保证高效与可访问性。

#### 验收标准

1. WHEN 任何动画/反馈触发 THEN 系统 SHALL 使用统一的 `motion/react` 动效时长（≤ 240ms）与 ant-motion 缓动曲线，避免抖动。
2. WHEN 用户使用 `Tab` 键在卡片间巡航 THEN 系统 SHALL 提供清晰的 focus ring（复用 `--ant-color-primary-border` 主题变量）。
3. WHEN 用户使用 `Space` 键拾起标签、方向键移动、`Space` 键放下 THEN 系统 SHALL 完成等价于鼠标拖拽的操作（`@dnd-kit/core` 自带 KeyboardSensor 能力）。
4. WHEN 拖拽中标签经过目标分组 THEN 目标分组 SHALL 在 80ms 内出现高亮，离开时 120ms 内淡出，避免视觉跳变。
5. WHEN 任意操作处于异步执行中（loading） THEN 触发按钮 SHALL 进入 antd `loading` 状态，禁止重复点击。
6. WHEN 用户启用了「prefers-reduced-motion」 THEN 系统 SHALL 退化拖拽过渡为瞬间 snap，去除缓动。

---

### 需求 7：跨会话与跨窗口的状态同步

**用户故事：** 作为一名会同时打开多个 NewTab 标签的用户，我希望在一个标签里做的拖拽/分组操作能即时同步到其他 NewTab 标签，以及跨设备（若开启 Sync）保留窗口顺序偏好。

#### 验收标准

1. WHEN 任一 NewTab 完成标签拖拽/分组操作 AND 操作成功 THEN 系统 SHALL 通过 SW broadcast（`tab-moved`/`tab-grouped`/`tab-ungrouped`/`tab-group-updated`）通知所有 NewTab 在 200ms 内更新 UI。
2. IF SW broadcast 丢失（极少数） THEN 系统 SHALL 在窗口/标签组级别每 30s 兜底 `loadAllTabs({ silent: true })`，避免长时间陈旧状态。
3. WHEN 用户调整窗口卡片顺序 THEN 系统 SHALL 把顺序写入 `useSettingsStore.settings.windowCardOrder`，跟随设置同步逻辑落地。
4. WHEN 用户对窗口设置自定义别名 THEN 系统 SHALL 写入 `metadata-slice.windowAliases: Record<windowId, string>`；windowId 失效（窗口关闭）时下次启动 SHALL 自动 GC 该条目。

---

### 需求 8：性能与边界情况

**用户故事：** 作为一名同时打开几百个标签的极端用户，我希望窗口视图依然流畅，不卡顿、不掉帧，以便我可以在重度场景下放心使用。

#### 验收标准

1. WHEN 当前打开标签数 ≤ 500 AND 窗口数 ≤ 20 THEN 视图首屏渲染 SHALL 在 200ms 内完成（M2 MacBook 基准）。
2. WHEN 标签数 > 500 THEN 系统 SHALL 对未展开的窗口卡片标签列表使用「按需 mount」策略（折叠态不渲染列表 DOM）。
3. WHEN 窗口卡片折叠 THEN 系统 SHALL 在 header 显示「N 个标签 / M 个分组」摘要，避免用户必须展开才能感知规模。
4. WHEN 拖拽大量（> 50）标签时 THEN 系统 SHALL 在源处显示「拖拽中：N 个标签」浮动徽章，而非真实渲染 N 个克隆 DOM，避免 GPU 压力。
5. WHEN 用户在拖拽中浏览器端发生 SW broadcast（其他 NewTab 改动） THEN 系统 SHALL 暂缓应用 broadcast，待拖拽结束再合并状态，避免视图抖动。
6. IF `chrome.tabs.move` 一次性数量 > 50 THEN 系统 SHALL 自动按 BATCH=10 分批执行，每批之间 `await` 并提供进度反馈。

---

### 需求 9：设置项与可定制性

**用户故事：** 作为一名追求个性化的用户，我希望能配置窗口卡片的列数、是否显示空分组、默认折叠/展开等行为，以便贴合我的工作流。

#### 验收标准

1. WHEN 用户进入「设置 → 视图布局」 THEN 系统 SHALL 提供以下窗口视图相关项：
   - `windowCardColumns`：1–6 / `auto`，默认 `auto`
   - `windowCardDefaultCollapsed`：`current-only` / `all-expanded` / `all-collapsed`，默认 `current-only`
   - `windowCardShowGroupSection`：是否显示标签组子卡片，默认 `true`
   - `windowCardShowGhostDropZone`：是否在末尾显示「拖到此处新建分组/窗口」占位，默认 `true`
   - `windowCardAccentBarPosition`：`left` / `top` / `none`，与 DomainGroupCard 对齐
2. WHEN 用户切换上述任意设置 THEN 视图 SHALL 立即响应（不需要刷新），符合现有 `updateSettings` 乐观更新约定。
3. WHEN 用户首次进入新版窗口视图 THEN 系统 SHALL 通过一次性引导卡片告知拖拽与分组核心交互；用户关闭后不再展示。

---

### 需求 10：迁移与兼容

**用户故事：** 作为一名老用户，我希望从旧版 [`WindowView.tsx`](../../../src/features/tabs/WindowView.tsx) 升级到新版后已有的设置不丢失，行为变化有提示。

#### 验收标准

1. WHEN 用户首次升级到新版 THEN 系统 SHALL 不破坏现有 `useSettingsStore` 已存在的字段；新增字段 SHALL 走 settings-slice 的默认值合并机制。
2. WHEN 旧版的「合并所有窗口到当前窗口」按钮被引用 THEN 新版 SHALL 在窗口卡片头部保留等价入口，并在功能首发时通过 tooltip「位置已更新」提示一次。
3. WHEN 重构后存在公共组件可被复用（如 `DomainGroupCard` 的 accent-bar/header/Reorder 模式） THEN 实现 SHALL 抽取共用 hooks/组件而非复制粘贴。
4. WHEN 单元测试目录下已存在 `view-registry.test.ts` THEN 重构 SHALL 保证窗口视图仍然在 view registry 中正常注册并通过既有测试。
5. WHEN 重构落地 THEN 既有的国际化键 `window.*` SHALL 兼容并新增本次必要的 `windowGroup.*`、`windowDrag.*` 国际化命名空间。

---

## 成功标准（Definition of Done）

- ✅ 所有上述需求的 EARS 条目均通过手工测试或自动化测试。
- ✅ 重构后的窗口视图与域名分组视图在视觉与交互上「同源」，用户切换无割裂感。
- ✅ 至少覆盖 4 类拖拽路径（同组重排 / 同窗换组 / 跨窗 / 窗口排序），均能稳定下发到 Chrome。
- ✅ 在 500 标签 / 10 窗口 / 30 标签组的压力场景下仍保持 60fps 拖拽。
- ✅ 不引入新的宿主权限；继续使用现有 `tabs` + `tabGroups` 即可。
- ✅ 无障碍：核心操作均可纯键盘完成，焦点可见。
