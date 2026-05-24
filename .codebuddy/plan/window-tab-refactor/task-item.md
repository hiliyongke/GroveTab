# 实施计划

> 基于 [requirements.md](./requirements.md) 的 10 个需求，将重构拆解为 10 个可独立交付的编码任务，按依赖顺序排列。每个任务均为编码动作（写、改、测）。

- [ ] 1. 扩展 Chrome API 封装与 Service Worker 广播
  - 在 [`src/chrome/tabs.ts`](../../../src/chrome/tabs.ts) 与新增 `src/chrome/tabGroups.ts` 中补齐 `chrome.tabGroups.query/update/move`、`chrome.tabs.group/ungroup`、`chrome.windows.create({ tabId })` 的 Promise 化封装
  - 在 SW 侧新增 `tab-grouped` / `tab-ungrouped` / `tab-group-updated` / `window-card-order-changed` 四类 broadcast 事件
  - 实现 `chrome.tabGroups` 不可用时的 feature-detect 与降级回调
  - _需求：2.5、2.6、3.1、3.2、3.3、3.5、7.1、7.2_

- [ ] 2. 设置项与 metadata 结构扩展
  - 在 [`src/store/slices/settings-slice.ts`] 新增 `windowCardColumns` / `windowCardDefaultCollapsed` / `windowCardShowGroupSection` / `windowCardShowGhostDropZone` / `windowCardAccentBarPosition` / `windowCardOrder` / `closeConfirmThreshold` 字段及默认值合并逻辑
  - 在 metadata-slice 新增 `windowAliases: Record<number, string>` 与启动期失效 windowId 的 GC 钩子
  - 在「设置 → 视图布局」面板补全对应控件，接入 `updateSettings` 乐观更新
  - _需求：5.4、7.3、7.4、9.1、9.2、10.1_

- [ ] 3. 抽取共用卡片基座组件 GroupCardShell
  - 从 [`DomainGroupCard.tsx`](../../../src/features/tabs/DomainGroupCard.tsx) 抽取 accent-bar / 头部 / Reorder 列表 / 折叠摘要 / 末尾占位 等通用结构为 `src/features/tabs/components/GroupCardShell.tsx`
  - 抽取共用 hook：`useCardCollapse`、`useCardReorder`，供 DomainGroupCard 与新窗口卡片复用
  - 保证 [`DomainGroupView.tsx`](../../../src/features/tabs/DomainGroupView.tsx) 切换到新组件后视觉与行为完全一致（既有快照/单测通过）
  - _需求：1.1、1.5、1.6、6.1、10.3_

- [ ] 4. 实现 WindowCard 与 TabGroupSection 组件
  - 新增 `src/features/tabs/WindowView/WindowCard.tsx`，基于 GroupCardShell 渲染单个窗口；头部显示「当前窗口」徽章、聚焦色条、隐身图标、自定义别名编辑入口、合并/关闭/拆分操作菜单
  - 新增 `src/features/tabs/WindowView/TabGroupSection.tsx`，渲染窗口内 Chrome 原生 Tab Group：原生颜色条、标题、折叠按钮、9 色板改色、重命名、解散组、组迁移到新窗口、休眠组内全部
  - 实现「未分组区域」与「拖到此处新建分组」末尾占位
  - _需求：1.2、1.3、1.4、2.1、2.2、2.3、2.4、2.7、5.2、5.4_

- [ ] 5. 重构 WindowView 主入口为瀑布流
  - 重写 [`WindowView.tsx`](../../../src/features/tabs/WindowView.tsx)：使用 `app-domain-masonry` 列宽自适应（受 `windowCardColumns` 控制）渲染 WindowCard 列表
  - 按 `windowCardOrder` + 「当前窗口优先」+ 「focused 次之」三段式排序合并窗口列表
  - 折叠/展开默认行为遵循 `windowCardDefaultCollapsed` 设置
  - 保证 [`tests/unit/view-registry.test.ts`](../../../tests/unit/view-registry.test.ts) 注册测试通过
  - _需求：1.1、1.2、1.3、1.5、1.6、8.3、9.2、10.4_

- [ ] 6. 接入 dnd-kit 多上下文，打通三级拖拽
  - 在 WindowView 顶层建立单一 `DndContext`，使用 `@dnd-kit/core` 的多 Droppable：`tab-in-group` / `tab-in-window-ungrouped` / `group-section` / `window-card`
  - 实现 4 类拖拽落地：① 同组重排 ② 同窗换组（move + group） ③ 跨窗口（move(windowId)）④ 整组迁移（tabGroups.move）
  - 拖拽落点视觉反馈：横线 placeholder / accent 高亮 / 整体高亮 + 角标，并在 `prefers-reduced-motion` 下退化
  - 隐身-非隐身互拖时 `onDragOver` 中标记 disabled 并显示禁止图标；`Esc` 取消；KeyboardSensor 启用
  - API 失败时 `feedback.error` + `loadAllTabs({ silent: true })` 兜底
  - _需求：3.1、3.2、3.3、3.4、3.5、3.7、3.8、3.9、3.10、6.2、6.3、6.4、6.6_

- [ ] 7. 窗口卡片排序 + 窗口级快捷动作
  - 在窗口瀑布流外层启用 `SortableContext`，落地后写入 `useSettingsStore.windowCardOrder`，并广播 `window-card-order-changed` 同步其他 NewTab
  - 实现 WindowCard 头部三个动作：「合并到当前窗口」（复用现有 BATCH=10 分批 + 进度反馈）、「关闭窗口」（标签数 > `closeConfirmThreshold` 时 antd `Modal.confirm` 二次确认）、「自定义别名」（点头部 inline 编辑，写入 `windowAliases`）
  - 兼容旧版「合并所有窗口」入口的位置变化提示（一次性 tooltip）
  - _需求：3.6、5.1、5.3、5.4、7.3、10.2_

- [ ] 8. 多选模式与批量操作扩展
  - 扩展 [`BatchActionBar`] 在窗口视图下新增三个按钮：「移到新窗口」、「加入新分组」（弹出名称+9 色板）、「加入现有分组」（列出全部窗口的 Tab Group 选择器）
  - 实现跨窗口批量加入分组：先按目标 group 所在 windowId 把全部 tab `move` 过去再 `group`，过程对用户透明并显示进度
  - 已选中标签拖拽时整体作为「N 个标签」浮动徽章一起搬运（避免渲染 N 份克隆 DOM）
  - 多选窗口时新增「合并选中窗口」「按域名重整为分组」批量动作
  - _需求：4.1、4.2、4.3、4.4、4.5、5.5、8.4_

- [ ] 9. 性能优化与状态同步加固
  - 折叠态窗口卡片不挂载内层标签列表 DOM（按需 mount），头部展示「N 标签 / M 分组」摘要
  - 拖拽进行中暂缓应用 SW broadcast（用 ref 暂存），`onDragEnd` 后再 flush，避免视图抖动
  - 当 `chrome.tabs.move` 数量 > 50 时按 BATCH=10 分批 + 进度反馈；30s 兜底 `loadAllTabs({ silent: true })` 保活
  - 在 `tests/unit/` 新增窗口视图渲染性能 smoke 测试（500 tabs / 20 windows mock 下首屏 ≤ 200ms 断言）
  - _需求：7.1、7.2、8.1、8.2、8.5、8.6_

- [ ] 10. 国际化、引导卡片与单测补齐
  - 新增 i18n 命名空间 `windowGroup.*`、`windowDrag.*`（中英），保留兼容 `window.*` 现有键
  - 实现首次进入新版窗口视图的一次性引导卡片（介绍拖拽 + 分组），关闭后写入 metadata 不再展示
  - 为新增的 reducer/hook（settings 字段、windowAliases GC、拖拽落点路由函数）补充单元测试，并扩展 [`tests/unit/view-registry.test.ts`](../../../tests/unit/view-registry.test.ts) 覆盖新视图注册
  - _需求：6.5、9.3、10.4、10.5_
