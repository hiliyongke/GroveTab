# GroveTab v1.3「打磨与加固」— 需求文档

## 引言

GroveTab 当前版本（v1.2.0）已具备完整功能骨架（17 类 Widget、9 种 Tab 视图、归档/搜索/主题/看板/每日金句/点击动效/视频背景等），但在**"功能完成度"与"交互一致性"上存在较多缺口**——既有"半成品功能"（如番茄钟只显示数字、不会实际倒计时），也有"重复造轮子"（如 260 行手写网格碰撞算法 vs `react-grid-layout`、原生 HTML5 DnD vs `@dnd-kit`、手写农历压缩表 vs `lunar-javascript` 等）。

本版本（v1.3，代号"打磨与加固 / Polish & Harden"）的目标是：

1. **补齐功能缺陷** —— 把已经摆在界面上的能力做到"真正可用"；
2. **用专业库替换手写实现** —— 在体积、稳定性、可维护性三者间做合理权衡，优先引入社区主流、长期维护、TS 支持好的库；
3. **系统性重构交互流程** —— 统一快捷键、拖拽、反馈、键盘可达性、加载/错误态；
4. **0 数据破坏 & 向下兼容** —— 所有存储键 `canopy_*` 保持不变；所有默认值保守；新引入依赖通过 `manualChunks` 按需加载，不突破首屏 JS 预算。

**边界**：本次不新增"产品级"功能（如 AI 摘要、云同步等），只对现有功能做"能用 → 好用"的打磨。

---

## 需求

### 需求 1：番茄钟（Pomodoro）功能补全

**用户故事：** 作为一名想专注工作的用户，我希望番茄钟能真正倒计时并在结束时提醒我，而不仅仅是显示一个静态的数字，以便我能用它辅助我的"工作-休息"节奏。

#### 验收标准

1. WHEN 用户点击"开始"按钮 THEN 番茄钟 SHALL 进入倒计时状态，每秒递减 1。
2. WHEN 用户点击"暂停"按钮 THEN 番茄钟 SHALL 暂停计时并允许"继续"。
3. WHEN 倒计时到 0 THEN 系统 SHALL 发出提醒（浏览器通知 + 可配置的轻音效）并自动切换到"下一模式"（focus → short break → focus → … 每 4 轮 focus 后 long break）。
4. WHEN 当前标签页失焦（document.hidden） THEN 番茄钟 SHALL 使用 `Date.now()` 差值继续推进，回到前台时能正确显示剩余时间，不因 tab 不渲染而"卡住"。
5. WHEN 用户切换焦点/短休/长休模式 THEN 倒计时 SHALL 按该模式的分钟数重置（默认 25/5/15，允许用户在设置中修改）。
6. WHEN 用户开启"浏览器通知" THEN 系统 SHALL 首次使用时请求 `Notification.permission`，拒绝后降级为页面内 Toast。
7. IF 用户关闭并重新打开新标签页 THEN 系统 SHALL 持久化最后一次番茄钟进度（mode + 剩余秒数 + 运行/暂停状态 + 已完成轮次），恢复后可继续。
8. WHEN 完成一轮 focus THEN 系统 SHALL 在本地累计"今日完成番茄数"并在 Widget 中显示。

---

### 需求 2：Widget 网格系统 — 引入 `react-grid-layout`

**用户故事：** 作为一名想自定义工作台的用户，我希望拖拽 Widget 时有现代、流畅、可预测的交互（对齐、占位预览、避让动画、自动紧凑、响应式断点），而不是当前这套轻量手写实现的"抖动与边缘 case"。

#### 验收标准

1. WHEN 项目构建 THEN 系统 SHALL 用 `react-grid-layout`（或其轻量替代 `@dnd-kit/sortable` + 自写一层 grid 封装）替换当前 `DashboardWidgets.tsx` 中手写的 `resolveCollisions` / `clampLayoutItem` / 指针事件拖拽逻辑。
2. WHEN 用户进入"编辑布局"模式 THEN Widget SHALL 支持：
    - 2.1 拖拽 Widget 顶部移动位置；
    - 2.2 拖拽右下角改变尺寸（宽度在 grid 列单位内 1..columns、高度 ≥ 2 行）；
    - 2.3 拖拽过程中实时显示"对齐预览占位"（虚线边框 + 主色填充）；
    - 2.4 其他 Widget 按 "vertical compact" 算法自动避让；
    - 2.5 松手后自动对齐到网格，无抖动。
3. WHEN 用户在移动设备（≤ 768 宽度）打开 THEN 系统 SHALL 响应式降级为单列纵向堆叠（ResponsiveGridLayout breakpoints: `lg/md/sm`）。
4. IF 依赖引入后使主入口 JS 超出预算 THEN 系统 SHALL 将 `react-grid-layout` 放入独立 chunk `vendor-grid`，仅在 DashboardWidgets 实际渲染时按需加载。
5. WHEN 用户退出编辑模式 THEN 拖拽句柄 SHALL 自动隐藏，且 Widget 内部交互（按钮、输入框）不受拖拽影响。
6. WHEN 迁移时老用户已有自定义布局 THEN 系统 SHALL 自动适配：读取 `canopy_settings.dashboardWidgets.items` 旧结构转换为 react-grid-layout 的 `Layout[]`，首次渲染不丢失布局。

---

### 需求 3：Kanban 视图 — 引入 `@dnd-kit`

**用户故事：** 作为一名用看板组织 Tab 的用户，我希望拖拽卡片、列排序能有丝滑的动画与触屏/键盘可达性，以便在平板或使用辅助技术时也能正常使用。

#### 验收标准

1. WHEN KanbanView 渲染 THEN 系统 SHALL 使用 `@dnd-kit/core` + `@dnd-kit/sortable` 替换原生 HTML5 `draggable/onDrop`。
2. WHEN 用户拖拽卡片 THEN 系统 SHALL：
    - 2.1 支持跨列移动（当前已支持）；
    - 2.2 支持**列内重排序**（当前不支持）；
    - 2.3 拖拽中给予阴影抬升 + 半透明 overlay；
    - 2.4 列容器在接纳时给予"高亮"反馈。
3. WHEN 用户用键盘（Space 拾起 → 方向键移动 → Space 放下） THEN 系统 SHALL 以无障碍方式完成同样的移动。
4. WHEN 用户拖拽整列 THEN 系统 SHALL 支持**列之间重排序**。
5. WHEN 触屏用户长按卡片 THEN 系统 SHALL 触发拖拽（`TouchSensor` with activation delay 200ms）。
6. IF 拖拽载荷源自"左侧实时 Tab 源栏" THEN 系统 SHALL 保持"不关闭原 Tab，仅复制 URL/title/favicon 到目标列"的既有行为。

---

### 需求 4：SpeedDial 快捷网站 — 拖拽排序

**用户故事：** 作为一名整理书签的用户，我希望用拖拽而不是"← →"按钮来调整快捷网站顺序，以便与现代工具（Chrome 书签栏、iOS 主屏）交互一致。

#### 验收标准

1. WHEN 用户鼠标悬停 Tile THEN Tile SHALL 显示一个"拖拽把手"图标（而非移动箭头）。
2. WHEN 用户拖拽 Tile THEN 系统 SHALL 使用 `@dnd-kit/sortable`（与需求 3 共享依赖）实现网格内重排序。
3. WHEN 用户在两个分组（Tabs）之间拖拽 Tile THEN 系统 SHALL 把 Tile 从原分组移到目标分组（可选扩展；v1.3 MVP 可先不支持跨分组）。
4. WHEN 用户松手 THEN 新顺序 SHALL 通过 `updateSettings({ speedDial })` 持久化。
5. WHEN 触屏用户长按 THEN 同上支持拖拽。
6. WHEN 用户点击 Tile THEN 系统 SHALL 按既有行为打开 URL（新 Tab / 当前 Tab 由配置决定），不被拖拽逻辑误触发。

---

### 需求 5：农历与节假日 — 引入 `lunar-javascript`（或 `lunar-typescript`）

**用户故事：** 作为一名中文用户，我希望日历的农历和节日显示准确、长期可用（不被"2036 年开始失效"的压缩表限制），并包含节气、干支、宜忌等扩展信息。

#### 验收标准

1. WHEN 项目构建 THEN 系统 SHALL 用 `lunar-typescript`（`lunar-javascript` 的 TS 原生版，体积 ~20 KB gz） 替换 `src/features/hero-widgets/lunar-cn.ts` 中的手写压缩表 + `SPRING_FESTIVAL`。
2. WHEN CalendarWidget 渲染当日 THEN 系统 SHALL 显示：
    - 2.1 农历月日（如"正月初一"）；
    - 2.2 农历年干支（如"甲辰年"）；
    - 2.3 当日所处节气（若有，如"立春"）；
    - 2.4 当日节日（农历 or 公历 or 法定节假日，命中任一即显示）。
3. WHEN 用户 locale 为非中文（en） THEN 系统 SHALL 仅显示公历节日表（保留既有 `SOLAR_HOLIDAYS_EN`）。
4. WHEN 依赖引入后使主入口超预算 THEN 系统 SHALL 将 `lunar-typescript` 打入独立 chunk `vendor-lunar`，仅在 CalendarWidget 实际挂载时动态 import。
5. WHEN 用户切换年份（2036+） THEN 系统 SHALL 仍正确显示农历（因 lunar-typescript 覆盖 1900-2100）。

---

### 需求 6：全局快捷键 — 引入 `tinykeys`

**用户故事：** 作为一名键盘流用户，我希望快捷键体验一致（跨平台 Ctrl/Cmd 归一、input 中自动禁用、顺序组合键支持），而非分散在各处手写 `e.key === 'k' && (e.ctrlKey || e.metaKey)`。

#### 验收标准

1. WHEN 项目构建 THEN 系统 SHALL 用 `tinykeys`（体积 ~1 KB gz）替换 `src/shared/hooks/use-keybinding.ts` 中的手写事件解析。
2. WHEN 用户焦点在 `<input>/<textarea>/[contenteditable]` 中 THEN 全局快捷键 SHALL 默认禁用（Esc 例外）；用户可通过 `preventWhenEditing: false` 显式开启。
3. WHEN 用户按 `$mod+K`（tinykeys 语法，自动映射 Cmd/Ctrl） THEN 搜索浮层 SHALL 切换开关（既有逻辑保留）。
4. WHEN ShortcutsPanel 渲染"快捷键帮助" THEN 帮助文案 SHALL 根据当前 OS（macOS / Windows）动态显示 ⌘ 或 Ctrl。
5. WHEN 两个快捷键互相冲突 THEN ShortcutsPanel 冲突检测 SHALL 保留现有行为不变。

---

### 需求 7：JSON 格式化 Widget — 语法高亮与错误定位

**用户故事：** 作为开发者用户，我希望 JSON widget 能高亮键/字符串/数字，并在解析失败时给出行列定位，而不是一堆黑白文字加一行报错。

#### 验收标准

1. WHEN JSON 解析成功 THEN 输出区 SHALL 使用**纯 CSS 语法高亮**（键蓝 / 字符串绿 / 数字紫 / 布尔红） —— 采用自写的 ~100 行极简高亮器，避免引入 shiki/highlight.js（> 100 KB）。
2. WHEN JSON 解析失败 THEN 错误提示 SHALL 包含具体行号与列号（通过 `e.message` 中的 `position` 换算）。
3. WHEN 输入为空 THEN 输出区 SHALL 显示占位提示（既有行为保留）。
4. WHEN 用户切换缩进 2/4/压缩 THEN 输出 SHALL 立即重新格式化（既有行为保留）。
5. WHEN 用户点击"复制结果" THEN 系统 SHALL 复制高亮前的纯文本。

---

### 需求 8：数据校验与迁移 — 引入 `zod`（或保留纯手写，按权衡决定）

**用户故事：** 作为用户，我希望导入第三方备份文件时，即使格式略有偏差（多字段、少字段），系统也能"该降级降级、该拒绝拒绝"，而非直接崩溃或静默写入脏数据。

#### 验收标准

1. WHEN 项目构建 THEN 系统 SHALL 评估引入 `zod`（~12 KB gz）的性价比；若引入，用于 `import-export.ts`、`storage-repo.ts` 的运行时校验。
2. WHEN 替代方案选择 THEN 保留现有手写校验（已比较严谨） + 补充"导入时 schema 版本号强校验" + "字段白名单剪裁"，zero-cost 改造。
3. WHEN 导入文件缺失 `version` 字段 THEN 系统 SHALL 给出明确错误提示："该备份文件缺少 version 字段，无法确认格式"，而非静默按 v1 处理。
4. WHEN 导入文件版本高于当前支持版本 THEN 系统 SHALL 拒绝导入并提示"该备份由新版 GroveTab 生成，请升级扩展后再试"。
5. **最终决策由技术方案阶段敲定**，本需求要求"显式决策 + 统一边界处理"。

---

### 需求 9：天气数据源 — 自动降级

**用户故事：** 作为国内用户，我希望在 wttr.in 偶尔不可达时，天气 Widget 能自动尝试备用源（open-meteo），而非直接显示"不可用"。

#### 验收标准

1. WHEN wttr.in 请求失败（超时 / 非 2xx / CORS） THEN 系统 SHALL 自动 fallback 到 open-meteo，用相同的缓存键落盘。
2. WHEN 使用 open-meteo THEN 系统 SHALL 先用 `https://ipapi.co/json/` 或 `https://ipwho.is/` 获取大致经纬度（auto 模式），或用用户手填城市的 geocoding API 换坐标（manual 模式）。
3. WHEN 两个数据源都失败但有本地缓存 THEN 展示缓存 + "离线"徽标（既有行为保留）。
4. WHEN 用户关闭天气（mode=off） THEN 系统 SHALL 不发起任何网络请求（既有行为保留）。
5. IF 所有数据源+缓存都不可用 THEN UI SHALL 显示"天气暂不可用，点击重试"按钮，点击后清缓存并重新尝试。

---

### 需求 10：StickyWidget 便签 — 多条 & 颜色

**用户故事：** 作为一名依赖便签记录的用户，我希望一次能记录多条不同颜色的便签，而非只有一条。

#### 验收标准

1. WHEN Widget 渲染 THEN 系统 SHALL 支持最多 10 条便签，垂直列表 + 每条卡片独立色彩（5 色可选：黄 / 粉 / 绿 / 蓝 / 紫）。
2. WHEN 用户点击"新建便签" THEN 系统 SHALL 新建一张空白便签并聚焦输入。
3. WHEN 用户点击某条便签 THEN 进入**行内编辑**（不弹 Modal），Textarea 自动扩展行数；失焦时自动保存。
4. WHEN 用户拖拽便签 THEN 支持重排序（复用 `@dnd-kit/sortable`）。
5. WHEN 用户点击"删除"图标 THEN 弹 Popconfirm 二次确认后删除。
6. IF 某条便签内容为空 THEN 系统 SHALL 自动删除（除非用户正在编辑）。

---

### 需求 11：Todo Widget — 基础增强

**用户故事：** 作为一名待办管理用户，我希望 Todo 能删除、重排序、显示完成率，而不仅仅是添加 + 勾选。

#### 验收标准

1. WHEN 用户鼠标悬停某条 Todo THEN 系统 SHALL 显示"删除"按钮。
2. WHEN 用户拖拽 Todo THEN 支持排序（复用 `@dnd-kit/sortable`）。
3. WHEN Widget 渲染 THEN 顶部 SHALL 显示"今日完成率 N/M"胶囊（M=总数，N=已完成数）。
4. WHEN 某条 Todo 处于已完成状态超过 24h THEN 系统 SHALL 默认把它折叠到"已完成"分组下方（可展开）。
5. WHEN 用户在输入框按 Esc THEN 系统 SHALL 清空输入并保留焦点。

---

### 需求 12：SearchBox — 交互细节修复

**用户故事：** 作为一名高频搜索用户，我希望搜索浮层的加载态、空态、键盘导航完全一致，不会出现"点一下没反应"或"Enter 没走默认引擎"的尴尬。

#### 验收标准

1. WHEN 浮层打开 THEN 输入框 SHALL 自动聚焦（既有行为），且 `autoComplete="off" spellCheck={false}`。
2. WHEN 用户输入 THEN 系统 SHALL 按 180ms debounce 触发搜索（既有行为保留）。
3. WHEN 结果集为空但 query 非空 THEN 系统 SHALL 始终显示至少 1 条"用 `{默认引擎}` 搜索 {query}"兜底项。
4. WHEN 用户按方向键 THEN 系统 SHALL 在结果列表中循环导航（到底后回到第 1 条，到顶后回到末尾）。
5. WHEN 用户按 Enter THEN 系统 SHALL 执行当前高亮项的默认动作（聚焦 Tab / 打开 URL / 网页搜索）。
6. WHEN 用户按 Alt+Enter THEN 系统 SHALL "后台打开"（既有行为保留）。
7. WHEN 用户按 Esc 两次 THEN 第 1 次清空输入，第 2 次关闭浮层。
8. WHEN 浮层加载历史记录权限检测失败 THEN UI SHALL 显示"开启历史记录权限"按钮，点击后调用 `requestHistoryPermission`。

---

### 需求 13：Popup 面板 — 增强与一致性

**用户故事：** 作为一名从工具栏快速操作的用户，我希望 Popup 支持快速关闭某个 Tab、搜索直达、快捷键（同新标签页）以及与新标签页的一致视觉。

#### 验收标准

1. WHEN Popup 显示"最近 10 个激活 Tab"列表 THEN 每一行 SHALL 在 hover 时显示"关闭"按钮（X 图标），点击即关闭该 Tab。
2. WHEN Popup 打开 THEN 输入框 SHALL 自动聚焦，支持 `Cmd/Ctrl+K` toggle。
3. WHEN 用户按 Enter THEN 系统 SHALL 用 `默认搜索引擎` 打开搜索结果页（与新标签页默认行为一致）。
4. WHEN Popup 底部"关于 GroveTab"链接被点击 THEN 系统 SHALL 打开新标签页并跳转到 `#about` 锚点（既有行为保留）。
5. WHEN 主题变化（浅色/深色） THEN Popup SHALL 响应 `AntdThemeProvider`（与新标签页同步）。

---

### 需求 14：错误边界与加载态 — 统一改造

**用户故事：** 作为任何用户，我希望任何一个 Widget / Panel 崩溃都不会带崩整个页面，且所有异步操作都有清晰的"加载 / 错误 / 空"三态。

#### 验收标准

1. WHEN 任一 Widget 渲染抛错 THEN 该 Widget 卡片 SHALL 被 `ErrorBoundary` 捕获并展示"加载失败 · 点击重试"占位，其他 Widget 不受影响。
2. WHEN 任一懒加载 panel（Settings / Archive / Insights / SearchBox） `React.lazy` 网络失败 THEN `Suspense` fallback SHALL 显示"加载失败，请刷新"而非无限 Spin。
3. WHEN 任一异步操作（归档 / 导入 / 导出 / 合并等） 抛错 THEN 系统 SHALL 通过 `App.useApp().message.error` 展示明确错误消息，并在 `console.error` 留痕。
4. WHEN 初始化加载（tabs / settings / metadata / kanban） 任一失败 THEN 系统 SHALL 显示顶部错误横幅 + "重试"按钮，且**不阻塞**已成功加载的模块渲染。
5. WHEN 用户切换视图（Timeline / Compact / Grid / …） 过程中 lazy chunk 加载 THEN 视图区 SHALL 显示骨架屏（而非空白）。

---

### 需求 15：依赖与构建治理

**用户故事：** 作为维护者，我希望新引入的依赖不破坏首屏 JS 预算（≤ 280 KB raw / 90 KB gz），且所有新依赖都在 `manualChunks` 中有显式归类。

#### 验收标准

1. WHEN `npm run build` 完成 THEN `newtab.js` SHALL ≤ 280 KB raw、≤ 90 KB gz（与 v1.2 持平或更优）。
2. WHEN 引入以下新依赖 THEN `vite.config.ts` 的 `manualChunks` SHALL 显式归类：
    - `react-grid-layout` + `react-resizable` → `vendor-grid`
    - `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` → `vendor-dnd`
    - `lunar-typescript` → `vendor-lunar`
    - `tinykeys` → 进 `vendor-react` 或保留内联（体积极小）
    - `zod`（如采纳） → `vendor-zod`
3. WHEN `npm run check-quota` 运行 THEN 所有阈值 SHALL 通过，违反即 CI 失败（既有行为保留）。
4. WHEN 单元测试运行 THEN 新增功能 SHALL 至少覆盖：
    - 番茄钟时间推进与模式切换纯函数；
    - Grid layout 迁移适配器（旧结构 → RGL Layout[]）；
    - 天气多数据源降级策略；
    - JSON 高亮输出的 tokenizer。
    新增单测 ≥ 15 个，总数 ≥ 94 且全绿。
5. WHEN 新功能上线 THEN `CHANGELOG.md` SHALL 新增 v1.3 章节，按"修复 / 替换 / 增强"三栏记录，并保留旧用户存储键 100% 兼容声明。

---

### 需求 16：可访问性与 i18n 补齐

**用户故事：** 作为使用屏幕阅读器或非中文用户，我希望新增的功能都有 `aria-label`、键盘可达、对应 en/zh-CN 双语文案。

#### 验收标准

1. WHEN 新增任一 UI 元素 THEN 该元素 SHALL 有语义化的 HTML 标签（`<button>` 替代 `<div onClick>`）。
2. WHEN 需要视觉图标+文字组合 THEN 图标 SHALL 用 `aria-hidden="true"`，文字单独可读。
3. WHEN 交互需要键盘触发 THEN 支持 `Enter / Space` 激活。
4. WHEN 任何新增文案 THEN `src/shared/i18n/zh-CN.ts` 与 `en.ts` SHALL 同时更新，且 i18n key 遵守既有命名约定（`{feature}.{action}`）。
5. WHEN `prefers-reduced-motion: reduce` THEN 新增动画 SHALL 尊重该偏好，回退为即时切换。

---

### 成功标准（整体）

- 番茄钟可真正使用（端到端走完 1 轮 focus → break）；
- 所有拖拽交互（Dashboard 网格 / Kanban / SpeedDial / Todo / Sticky）都走 `@dnd-kit` 或 `react-grid-layout`，体验一致；
- 农历显示在 2036+ 仍准确；
- 天气具备双数据源降级；
- 首屏 JS 预算不突破，单测全绿；
- 老用户升级 v1.2 → v1.3 数据 0 破坏。
