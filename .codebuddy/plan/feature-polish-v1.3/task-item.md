# 实施计划 — GroveTab v1.3「打磨与加固」

> 本清单将 16 条需求按「依赖先后 + 改造范围」归并为 10 个可独立提交的编码任务。每个任务对应 1 次 commit，保证增量可回滚。  
> 约定：所有任务完成后，运行 `npm run test && npm run build && npm run check-quota` 作为最终验收闸门。

---

- [ ] 1. 依赖接入与构建治理（地基任务）
    - 在 `package.json` 新增依赖：`react-grid-layout`、`react-resizable`、`@dnd-kit/core`、`@dnd-kit/sortable`、`@dnd-kit/utilities`、`lunar-typescript`、`tinykeys`；评估 `zod` 性价比并给出显式决策注释。
    - 在 `vite.config.ts` 的 `manualChunks` 显式归类：`vendor-grid` / `vendor-dnd` / `vendor-lunar`；`tinykeys` 合入 `vendor-react`。
    - 为 `react-grid-layout` 与 `lunar-typescript` 编写动态 `import()` 包装器（`src/shared/lazy-deps/`），保障首屏不加载。
    - 更新 `CHANGELOG.md` 新增 v1.3 章节骨架（"修复 / 替换 / 增强"三栏）。
    - _需求：15.1, 15.2, 15.5, 8.1, 8.5_

- [ ] 2. 重构番茄钟（Pomodoro）为真正可用的倒计时
    - 在 `src/features/dashboard-widgets/extra-widgets.tsx` 的 `PomodoroWidget` 中实现：基于 `Date.now()` 差值的 tick 逻辑（避免 Tab 失焦卡住）、开始/暂停/继续/重置按钮、mode 自动切换（focus→short→focus→…每 4 轮 long）。
    - 新增 `src/features/dashboard-widgets/pomodoro-engine.ts` 纯函数模块（`computeRemaining`、`nextMode`、`tickReducer`），便于单测。
    - 持久化 `{ mode, remaining, running, completedFocus, startedAt }` 到 `canopy_pomodoro_state`（新增 storage 键）；读取时计算偏移恢复。
    - 完成时请求 `Notification.permission`，成功则发通知；拒绝则降级为 `App.useApp().message.info`；可选轻音效（WebAudio beep，不引入新资源）。
    - 设置面板暴露"focus/short/long 分钟数"配置（写入 `canopy_settings.pomodoro`），默认 25/5/15。
    - 补充单元测试：≥ 4 个（`nextMode`、`tickReducer` 正常推进、跨 tab 失焦恢复、长休切换）。
    - _需求：1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 15.4_

- [ ] 3. 用 `react-grid-layout` 替换手写 Dashboard 网格
    - 删除 `src/features/dashboard-widgets/DashboardWidgets.tsx` 中的 `resolveCollisions` / `clampLayoutItem` / 手写指针事件拖拽逻辑。
    - 使用 `ResponsiveGridLayout`（懒加载），breakpoints `lg/md/sm` 对应 ≥1024 / ≥768 / <768，columns 12/8/1。
    - 新增 `src/features/dashboard-widgets/layout-migrator.ts`：把旧结构 `dashboardWidgets.items[{id,col,row,w,h}]` 适配为 `Layout[]`；首次读取完成迁移并回写。
    - 编辑模式才启用 `isDraggable/isResizable`，非编辑模式锁死；拖拽句柄用 `.drag-handle` 类精准选择，避免影响 widget 内部控件。
    - 引入 `react-grid-layout/css/styles.css` + `react-resizable/css/styles.css`，并用项目主题变量覆写占位预览色。
    - 补充单元测试：≥ 3 个（layout-migrator 旧→新转换、compact 后坐标正确、越界 clamp）。
    - _需求：2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 15.2_

- [ ] 4. 用 `@dnd-kit` 重构 Kanban 视图（卡片 + 列双层排序）
    - 在 `src/features/tabs/KanbanView.tsx` 移除原生 `draggable/onDrop`；用 `DndContext` + `PointerSensor`（触屏 `TouchSensor` activationDelay:200）+ `KeyboardSensor` 包裹。
    - 卡片用 `useSortable` 支持**列内重排序** + 跨列移动；列用另一层 `SortableContext` 支持**列排序**。
    - 拖拽时用 `DragOverlay` 渲染抬升副本（阴影 + 0.9 透明）；目标列容器在 `isOver` 时高亮背景。
    - 保留"左侧实时 Tab 源栏"拖入目标列的既有复制语义（不关闭原 Tab）。
    - 补充单元测试：≥ 2 个（列内重排 reducer、跨列移动 reducer）。
    - _需求：3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 5. 用 `@dnd-kit/sortable` 改造 SpeedDial / Todo / Sticky 三处列表交互
    - **SpeedDial**（`src/features/hero-widgets/SpeedDialWidget.tsx`）：用 `SortableContext` + 网格 strategy 替换 "← →" 按钮；hover 显示拖拽把手；点击 Tile 仍打开 URL（点击与拖拽用 `activationConstraint: { distance: 6 }` 区分）。
    - **TodoWidget**（`src/features/dashboard-widgets/widgets.tsx`）：加入拖拽排序、hover 显示删除按钮、顶部"N/M 完成率"胶囊、已完成超 24h 自动折叠分组、Esc 清空输入保留焦点。
    - **StickyWidget**：从单条升级为"最多 10 条"垂直列表，5 色可选，行内 `Textarea` 自动扩展、失焦自动保存、空内容自动清理、`Popconfirm` 删除、拖拽排序；数据结构迁移到 `canopy_sticky_notes`，旧单条内容作为首条自动迁入。
    - 补充单元测试：≥ 2 个（sticky 旧→新迁移、todo 完成率统计）。
    - _需求：4.1-4.6, 10.1-10.6, 11.1-11.5_

- [ ] 6. 用 `lunar-typescript` 替换手写农历压缩表
    - 删除 `src/features/hero-widgets/lunar-cn.ts` 中的压缩表数据和 `SPRING_FESTIVAL` 写死映射，改为薄封装 `lunar-typescript` 的 `Lunar.fromDate()` / `Solar.fromDate()`。
    - 暴露接口：`getLunarInfo(date) → { monthDay, ganzhiYear, jieqi?, festival? }`；节日合并规则：农历节日 → 公历节日 → 法定节假日命中任一即显示。
    - `CalendarWidget` 仅在 locale=zh 时渲染农历信息；en 保留既有 `SOLAR_HOLIDAYS_EN`。
    - 通过动态 `import('lunar-typescript')` 按需加载；仅在 CalendarWidget 挂载后触发。
    - 补充单元测试：≥ 2 个（2036 年正月初一正确、清明节气命中）。
    - _需求：5.1, 5.2, 5.3, 5.4, 5.5, 15.2_

- [ ] 7. 用 `tinykeys` 重写全局快捷键 Hook + JSON 高亮 + 天气降级
    - **快捷键**：重写 `src/shared/hooks/use-keybinding.ts`，用 `tinykeys({ '$mod+k': handler, ... })`；在 input/textarea/contenteditable 聚焦时默认禁用（Esc 例外）；`ShortcutsPanel` 根据 `navigator.platform` 动态展示 ⌘/Ctrl。
    - **JSON Widget**：在 `src/features/dashboard-widgets/extra-widgets.tsx` 的 `JsonFormatterWidget` 加入 ~100 行自写 tokenizer（键/字符串/数字/布尔/null），用 CSS 类染色；解析错误从 `e.message` 的 `position` 反推行列号；复制按钮仍复制纯文本。
    - **天气降级**：在 `src/features/hero-widgets/WeatherWidget.tsx` 抽出 `src/features/hero-widgets/weather-providers.ts`，实现 `fetchWttr` + `fetchOpenMeteo` + `fetchGeo`；失败时链式降级；全部失败但有缓存则展示缓存+离线徽标；均无则"点击重试"按钮清缓存。
    - 补充单元测试：≥ 3 个（tinykeys input 禁用逻辑、JSON tokenizer、天气 provider fallback 链）。
    - _需求：6.1-6.5, 7.1-7.5, 9.1-9.5_

- [ ] 8. SearchBox 与 Popup 交互细节修复
    - **SearchBox**（`src/features/search/SearchBox.tsx`）：query 非空时保底注入"用 {默认引擎} 搜索 {query}"项；方向键循环导航；Enter 触发高亮项默认动作；Alt+Enter 后台打开；Esc 第一次清空、第二次关闭；历史权限失败时显示"开启权限"按钮；`autoComplete=off spellCheck=false`。
    - **Popup**（`src/pages/popup/`）：最近 Tab 列表 hover 显示 X 关闭按钮（调用 `chrome.tabs.remove`）；输入框自动聚焦，支持 `Cmd/Ctrl+K` toggle（复用统一 tinykeys）；Enter 按默认搜索引擎跳转；主题与 AntdThemeProvider 同步。
    - 补充单元测试：≥ 2 个（SearchBox 循环导航边界、Esc 两阶段）。
    - _需求：12.1-12.8, 13.1-13.5_

- [ ] 9. 统一错误边界、加载态与 i18n/a11y 补齐
    - 在 `src/shared/components/ErrorBoundary.tsx` 包装每一个 Widget 卡片（在 `DashboardWidgets` 网格渲染处），错误时展示"加载失败 · 点击重试"占位，不带崩其他 Widget。
    - 改造所有 `React.lazy + Suspense`：给 lazy 增加 `.catch` 重试 + 超时；fallback 从 Spin 升级为骨架屏（`src/shared/components/SkeletonWidget.tsx`）。
    - 初始化失败（tabs/settings/metadata/kanban）时，新增顶部错误横幅组件，允许"重试"且不阻塞已就绪模块。
    - 统一用 `App.useApp().message.error` 代替散落的 `console.error`（归档/导入/导出/合并等）。
    - 新增文案同步写入 `src/shared/i18n/zh-CN.ts` 与 `en.ts`；全部新 UI 元素补齐 `aria-label`、语义化标签、Enter/Space 支持；尊重 `prefers-reduced-motion`。
    - _需求：14.1-14.5, 16.1-16.5_

- [ ] 10. 最终验收：构建预算、单测聚合、文档收尾
    - 运行 `npm run check-quota`，确认 `newtab.js` ≤ 280 KB raw / 90 KB gz；若超则回头调整 `manualChunks` 拆分。
    - 汇总所有任务的单元测试，确认新增 ≥ 15 个、总数 ≥ 94 个且全绿。
    - 补全 `CHANGELOG.md` v1.3 章节三栏内容；在 `README.md` / `ARCHITECTURE.md` 同步"Dashboard 网格已迁移至 react-grid-layout、拖拽统一 @dnd-kit、快捷键统一 tinykeys、农历切换 lunar-typescript"四项关键变更说明；保留"老用户存储键 100% 兼容"声明。
    - 手动回归 `QA_CHECKLIST.md` 关键路径（番茄钟端到端 1 轮、Dashboard 拖拽缩放、Kanban 列内重排、SpeedDial 拖拽、农历 2036 显示、Cmd+K 搜索、Popup 关闭 Tab）。
    - 构建 zip 产物（`dist.zip`），在 Chrome 扩展开发者模式加载验证无控制台错误。
    - _需求：15.1, 15.3, 15.4, 15.5_

---

## 任务依赖关系

```
1 (地基)
├── 2 (番茄钟，不依赖新库)
├── 3 (react-grid-layout) ─── 需要 1
├── 4 (@dnd-kit Kanban) ───── 需要 1
├── 5 (@dnd-kit 三处列表) ─── 需要 1, 可与 4 并行但建议顺序避免 dnd 升级冲突
├── 6 (lunar-typescript) ──── 需要 1
├── 7 (tinykeys + JSON + Weather) ─ 需要 1
├── 8 (SearchBox + Popup) ─── 需要 7（复用 tinykeys）
├── 9 (错误边界 + i18n) ───── 需要 2-8 完成，对所有新增 UI 统一增强
└── 10 (终检) ────────────── 所有前置完成
```

## 验收闸门（每任务结束必过）

1. `npm run type-check` 通过
2. `npm run lint` 无新增错误
3. `npm run test` 全绿（增量 + 历史）
4. 手动打开 `chrome://extensions` 加载 `dist/` 验证该任务涉及功能无回归
