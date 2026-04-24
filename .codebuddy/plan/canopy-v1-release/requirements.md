# Canopy v1.0 封板版本 —— 需求文档

## 引言

本次迭代目标是让 Canopy 达到 **v1.0 正式版（全功能封板）** 的状态，对应 `docs/PRD v1.0.md` 中 **全部** P0 / P1 / P2 功能（F-01 ~ F-34）。**范围原则：一次性完整实现 PRD v1.0 功能矩阵的所有项，把原本规划到 v1.1 / v1.2 的条目全部拉回本次迭代**。

**工作原则**：在现有能力基础上**扩展和完善**，不做回退或破坏性重构；已落地的 P0 全量（F-01~F-09）与 P1 多数功能（8 视图、配置预设、快捷键、皮肤渐变、Archive、Settings 5 Tab 等）**保持行为不变**，仅做向上补齐与修缮。

本次迭代需交付 4 大主线，共 22 项需求：

1. **首页工作台收敛**（需求 1-3）：Dashboard Overview 独立化、Onboarding v2、Popup 升级、Activity Strip 最近操作区。
2. **高频操作可见化**（需求 4-8）：归档富交互 Toast、去重严格度三档 UI、重复合并预览 Modal、闲置阈值配置、多选范围摘要。
3. **P1/P2 功能补齐**（需求 13-19）：CommandCenter 四区推荐 + 6 种搜索语法、SW StatsCollector 精确频率、`tag:` 搜索语法、会话合并/分享/三策略恢复、完整导入导出（JSON/MD/TXT/HTML + 3 种冲突策略）、会话自动快照、看板视图（dnd-kit）、OG description 抓取、本地隐私洞察仪表盘、Workspace 雏形。
4. **性能与发布就绪**（需求 9-12、20-22）：包体治理（主 chunk ≤ 280KB/90KB gz）、500 Tab ≥ 55fps、15 条关键 E2E、商店上架素材、隐私政策、CHANGELOG、无回退一致性校验。

所有需求严格遵循 PRD §2.1 产品原则：即开即用、性能优先、本地优先、键盘党友好、可逆操作、渐进增强、认知收敛。

---

## 需求

### 需求 1 — Dashboard Overview 独立组件（F-34 升级）

**用户故事：** 作为一名重度网页工作者，我希望每次打开新标签页时，在首屏就能看到当前工作区的关键统计和高频入口，以便在 3 秒内决定要做什么。

#### 验收标准

1. WHEN 用户打开新标签页 AND `settings.uiVisibility.workspaceOverview` 为 true THEN 系统 SHALL 在 HeroBar 下方、TidySuggestionBar 上方渲染 `DashboardOverview` 组件。
2. WHEN `DashboardOverview` 渲染 THEN 系统 SHALL 展示 6 个统计卡片：标签页数、域名数、窗口数、重复数（红/黄色徽标）、闲置数（灰色徽标）、最近归档（时间 + 名称）。
3. WHEN 用户点击"标签页 N"卡片 THEN 系统 SHALL 平滑滚动到主视图区。
4. WHEN 用户点击"域名 N"卡片 THEN 系统 SHALL 把当前视图切换为 `domain`。
5. WHEN 用户点击"窗口 N"卡片 THEN 系统 SHALL 把当前视图切换为 `window`。
6. WHEN 用户点击"重复 N"卡片 AND 当前有重复 THEN 系统 SHALL 展开 `TidySuggestionBar` 并滚动到重复分区。
7. WHEN 用户点击"闲置 N"卡片 AND 当前有闲置 THEN 系统 SHALL 展开 `TidySuggestionBar` 并滚动到闲置分区。
8. WHEN 用户点击"最近归档"卡片 THEN 系统 SHALL 打开 `ArchivePanel` 并高亮对应会话。
9. WHEN `DashboardOverview` 渲染 THEN 系统 SHALL 显示 3 个高频入口按钮：🔎 搜索标签（触发 `Cmd+K`）、🧹 一键整理（展开 TidySuggestionBar）、💾 归档当前窗口（触发 `Alt+Shift+S`）。
10. IF `settings.uiVisibility.workspaceOverview` 为 false THEN 系统 SHALL 不渲染 `DashboardOverview`。
11. WHEN 某个统计值为 0（如无重复、无闲置、无归档）THEN 系统 SHALL 对应卡片以"中性灰态"展示并禁用点击跳转。
12. WHEN 组件渲染 THEN 系统 SHALL 不超过 1 次 React render 完成首帧（memo + 派生计算缓存）。

---

### 需求 2 — Onboarding v2 双模式引导（F-25 升级）

**用户故事：** 作为一名首次安装扩展的用户，我希望能自主选择"接管新标签页"还是"仅工具栏按钮"两种使用模式，以便按自己的习惯工作。

#### 验收标准

1. WHEN 扩展首次安装 AND 用户首次打开新标签页 THEN 系统 SHALL 展示 `OnboardingCard v2` 全屏欢迎卡片。
2. WHEN `OnboardingCard v2` 渲染 THEN 系统 SHALL 展示两个大按钮：🌐 接管新标签页（推荐，默认高亮）、🧩 仅工具栏按钮。
3. WHEN 用户点击"接管新标签页" THEN 系统 SHALL 设置 `settings.overrideNewTab = true` 并进入 3 步微引导（工作台总览 → 归档演示 → 快捷键帮助）。
4. WHEN 用户点击"仅工具栏按钮" THEN 系统 SHALL 设置 `settings.overrideNewTab = false` 并关闭 Onboarding，后续新标签页恢复为 Chrome 默认。
5. WHEN Onboarding 完成一次 THEN 系统 SHALL 在 storage 写入 `canopy_onboarded: true`，后续不再自动弹出。
6. IF `settings.overrideNewTab` 为 false THEN 系统 SHALL 保证 `chrome.action.onClicked` 或 `Alt+C` 快捷键能打开 Canopy 工作台（通过 `chrome.runtime.getURL('src/pages/newtab/index.html')`）。
7. WHEN 用户进入 设置 → 行为 THEN 系统 SHALL 提供 `overrideNewTab` 开关，允许随时切换两种模式。
8. WHEN 3 步微引导中任一步 THEN 系统 SHALL 支持键盘 `→/←` 切换、`Esc` 跳过。

---

### 需求 3 — Popup 工具栏轻量版升级（F-26）

**用户故事：** 作为一名不希望接管新标签页的用户，我希望点工具栏按钮就能看到搜索、最近标签、归档、打开工作台四个核心操作，以便无侵入地使用扩展。

#### 验收标准

1. WHEN 用户点击工具栏按钮 THEN 系统 SHALL 在 360×520 的 `Popup` 内渲染四区：全局搜索、最近 10 个激活 Tab、"归档当前窗口"大按钮、"打开工作台"按钮。
2. WHEN `Popup` 的搜索框接收输入 THEN 系统 SHALL 复用新标签页 `SearchBox` 的核心搜索逻辑（至少覆盖 `tab/history/recent/engine` 四种结果类型）。
3. WHEN 用户在"最近 10 Tab"列表点击某条 THEN 系统 SHALL 通过 `chrome.tabs.update + windows.update` 跳转该 Tab 并关闭 Popup。
4. WHEN 用户点击"归档当前窗口" AND 当前窗口存在非固定 Tab THEN 系统 SHALL 调用 `archive-service.archiveCurrentWindowTabs()` 并在归档成功后关闭 Popup。
5. WHEN 用户点击"打开工作台" THEN 系统 SHALL `chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/newtab/index.html') })` 并关闭 Popup。
6. WHEN Popup 首次渲染 THEN 系统 SHALL 首屏可见 ≤ 200ms（懒加载非关键模块）。
7. IF 当前没有任何 Tab THEN 系统 SHALL 将"归档当前窗口"按钮置灰并显示提示。

---

### 需求 4 — 归档富交互 Toast（F-06 升级）

**用户故事：** 作为一名常用归档的用户，我希望归档后能直接看到归档结果、跳转归档面板或撤销，以便快速确认并继续工作。

#### 验收标准

1. WHEN 归档原子事务成功完成 THEN 系统 SHALL 在右下角显示 `UndoToast` 富交互形态，包含：文案"已归档 N 个标签到「{sessionName}」"、按钮"查看归档"、按钮"撤销"。
2. WHEN 归档过程中有 Tab 关闭失败 THEN 系统 SHALL 在 Toast 文案中展示"（M 个关闭失败）"子行。
3. WHEN 用户点击"查看归档" THEN 系统 SHALL 打开 `ArchivePanel` 并高亮本次归档的 `sessionId`。
4. WHEN 用户点击"撤销" AND 在 `settings.undoWindowSeconds` 窗口内 THEN 系统 SHALL 按 F-04 Undo 恢复策略恢复本次归档的所有 Tab（优先 `sessions.restore`，兜底 `tabs.create`）。
5. WHEN `settings.undoWindowSeconds` 倒计时结束 THEN 系统 SHALL 自动关闭 Toast 并从 `undo-slice` 清理记录。
6. IF 归档写入 storage 失败 THEN 系统 SHALL 不关闭任何 Tab 并通过 `feedback.error` 展示错误。

---

### 需求 5 — 去重严格度三档 UI（F-13 升级）

**用户故事：** 作为一名有重复 Tab 洁癖的用户，我希望能自定义去重严格度，以便在不同工作节奏下匹配不同规则。

#### 验收标准

1. WHEN 用户进入 设置 → 行为 THEN 系统 SHALL 展示 `dedupStrictness` 三档单选：严格（URL 完全相同）/ 宽松（默认，忽略 `#hash` 与 `utm_*` / `fbclid` / `gclid`）/ 关闭。
2. WHEN 用户切换档位 THEN 系统 SHALL 立即更新 `settings.dedupStrictness` 并触发所有视图和 `TidySuggestionBar` 重新计算去重结果。
3. WHEN `dedupStrictness === 'off'` THEN 系统 SHALL `findDuplicates()` 返回空数组，TidySuggestionBar 的"重复"分区隐藏，Dashboard 的"重复 N"徽标置零。
4. WHEN `dedupStrictness === 'strict'` THEN 系统 SHALL 严格按 URL 完全匹配分组。
5. WHEN `dedupStrictness === 'loose'` THEN 系统 SHALL 对 URL 先去除 `#hash`，再移除匹配 `/^utm_/ | fbclid | gclid` 的 query 参数，再分组。
6. WHEN 每档切换 THEN 系统 SHALL 在设置页底部描述区显示对应档位的"会识别为重复/不会识别"示例（2 行）。

---

### 需求 6 — 重复合并预览 Modal（F-13）

**用户故事：** 作为一名谨慎的用户，在一键合并重复 Tab 前，我希望能逐条勾选保留项，以便避免误删。

#### 验收标准

1. WHEN 用户在 `TidySuggestionBar` 点击"预览"（或重复分组卡上的"预览合并"）THEN 系统 SHALL 弹出 `DuplicatePreviewModal`。
2. WHEN `DuplicatePreviewModal` 渲染 THEN 系统 SHALL 按重复分组展示所有组，每组内列出全部重复 Tab（title + url + 窗口 + 打开时间），并默认勾选"最旧一条"作为保留项。
3. WHEN 用户改变某组的保留项 THEN 系统 SHALL 更新该组的"将关闭"数和 Modal 底部总计"将关闭 N 个 / 保留 M 个"。
4. WHEN 用户点击"合并"按钮 THEN 系统 SHALL 批量关闭所有"未勾选"的 Tab，作为**单条 Undo** 记录推入 `undo-slice`，并显示 Toast"已合并 N 个重复标签"。
5. WHEN 用户点击"忽略本次" THEN 系统 SHALL 关闭 Modal 且不进行任何操作。
6. WHEN 用户点击"全不勾选"/"全部勾选最旧" THEN 系统 SHALL 提供一键切换的辅助按钮。
7. IF 某组只剩 1 个 Tab（被其他操作消费）THEN 系统 SHALL 自动将其从 Modal 中移除，避免零项组。

---

### 需求 7 — 闲置阈值可配（F-13 / F-09）

**用户故事：** 作为一名不同工作节奏的用户，我希望能自定义"闲置"的时间阈值，以便匹配我的实际使用习惯。

#### 验收标准

1. WHEN 用户进入 设置 → 行为 THEN 系统 SHALL 展示 `idleThresholdMinutes` 下拉：6 小时 / 12 小时 / 24 小时（默认）/ 3 天 / 7 天。
2. WHEN 用户切换阈值 THEN 系统 SHALL 立即更新 `settings.idleThresholdMinutes` 并触发 `detectIdleTabs` 重新识别。
3. WHEN `idle-detect.ts::detectIdleTabs` 被调用 THEN 系统 SHALL 使用 `settings.idleThresholdMinutes` 而非硬编码 24h。
4. WHEN Dashboard 的"闲置 N"徽标、TidySuggestionBar 的"闲置"分区触发 THEN 系统 SHALL 使用统一阈值源。

---

### 需求 8 — 多选范围反馈 + 选中摘要（F-08 升级）

**用户故事：** 作为一名多选大量 Tab 的用户，我希望看到"已选 N 个 · 来自 M 个域名 · 跨 K 个窗口"的摘要，以便确认选择范围。

#### 验收标准

1. WHEN `selection-slice.selectedTabIds.size > 0` THEN 系统 SHALL 在 `SelectionModeNotice` 顶部浮条渲染"已选 N 个 · 来自 M 个域名 · 跨 K 个窗口"三项摘要。
2. WHEN 用户进入选择模式 THEN 系统 SHALL 在 `CompactView` / `DomainGroupView` 的可选区域显示细微虚线边框以提示可选范围。
3. WHEN 用户按下 `Cmd+A` / `Ctrl+A` AND 焦点在主视图区 THEN 系统 SHALL 全选"当前视图可见"的所有 Tab（而非全部 Tab）。
4. WHEN 用户按下 `Esc` THEN 系统 SHALL 清空选择并退出选择模式。
5. WHEN `BatchActionBar` 渲染 THEN 系统 SHALL 把"关闭 / 归档 / 休眠 / 加标签 / 加备注"5 个动作合并为**单条 Undo** 记录（批量原子事务）。

---

### 需求 9 — 包体治理与拆包（性能硬指标）

**用户故事：** 作为一名对性能敏感的用户，我希望新标签页在 150ms 内看到骨架、600ms 内看到有意义内容，以便不拖慢我的工作流。

#### 验收标准

1. WHEN `pnpm build` 输出 THEN 系统 SHALL 保证**主 chunk（newtab 入口）≤ 280 KB（原始） / ≤ 90 KB（gzip）**。
2. WHEN `SearchBox` 被加载 THEN 系统 SHALL 通过动态 `import()` 拆分为独立 chunk（含 `minisearch` + `pinyin-pro`）。
3. WHEN `SettingsPanel` 被加载 THEN 系统 SHALL 通过动态 `import()` 拆分为独立 chunk（含所有 `panels/*` + 皮肤 / 渐变预设）。
4. WHEN `ArchivePanel` 被加载 THEN 系统 SHALL 通过动态 `import()` 拆分为独立 chunk（含 `import-export.ts`）。
5. WHEN `antd` 被引入 THEN 系统 SHALL 仅静态引入 ≤ 10 个核心组件；`Modal / Popover / Select / Drawer / DatePicker / Upload` 走 lazy。
6. WHEN `lucide-react` 被引入 THEN 系统 SHALL 按路径导入（形如 `lucide-react/dist/esm/icons/x.js`）以保证 tree-shake。
7. WHEN `tldts / pinyin-pro / minisearch` 被使用 THEN 系统 SHALL 通过动态 `import()` 按需加载，不进入主 chunk。
8. WHEN `vite.config.ts` 构建完成 THEN 系统 SHALL 在 `scripts/check-quota.mjs` 中输出各 chunk 的大小报告。
9. WHEN 首次进入新标签页（无缓存）AND 测试环境打开 500 Tab THEN 系统 SHALL 保证首屏骨架 ≤ 150ms P95、首屏有意义内容 ≤ 600ms P95、交互帧率 ≥ 55 fps P95。

---

### 需求 10 — 本地埋点 & 关键 E2E 测试

**用户故事：** 作为产品团队，我需要通过本地埋点量化核心指标，并通过 E2E 测试保障封板质量不退化。

#### 验收标准

1. WHEN 用户打开新标签页 THEN 系统 SHALL 在 `canopy_metrics` 写入 `newtab_open { ts }` 事件（不上传）。
2. WHEN 用户切换视图 THEN 系统 SHALL 写入 `view_switch { from, to }`。
3. WHEN 归档 / 恢复 / 搜索 / 整理 / 休眠 / 应用配置预设发生 THEN 系统 SHALL 写入对应事件（字段严格按 PRD §17.1）。
4. WHEN 首屏 FCP 达成 / FPS 采样完成 THEN 系统 SHALL 写入 `perf_fcp { ms }` / `perf_fps_sample { p50, p95 }`。
5. WHEN `pnpm test:e2e` 运行 THEN 系统 SHALL 跑通 PRD §16.2 中列出的 15 条关键 E2E 场景（安装→工作台、分组正确、Undo 恢复、Save All Tabs、搜索高亮、导入导出、500 Tab 帧率、Quota 告警、`Cmd+K` 聚焦、深色切换无 FOUC、批量归档 Toast、重复合并、合并窗口、配置预设、无痕隔离）。
6. WHEN `pnpm test:unit` 运行 THEN 系统 SHALL 对 `shared/utils`、`services/archive-service`、`repositories/storage-repo` 达到 ≥ 80% 行覆盖率。
7. WHEN 打开 设置 → 关于 THEN 系统 SHALL 提供"清除所有统计"按钮，清空 `canopy_metrics`。

---

### 需求 11 — 上架素材与发布就绪

**用户故事：** 作为产品负责人，我需要所有上架 Chrome Web Store 所需的素材与文档就绪，以便一次性通过审核。

#### 验收标准

1. WHEN 仓库 `docs/` 目录存在 THEN 系统 SHALL 包含：`CHANGELOG.md`（v1.0 条目）、`QA_CHECKLIST.md`（手动回归清单）、`PRIVACY.md`（隐私政策）、`ARCHITECTURE.md`（架构图）。
2. WHEN 仓库根目录 THEN 系统 SHALL 包含 `README.md`（含截图 + 安装步骤 + 许可证 + 开源地址）。
3. WHEN 仓库 `public/store-assets/`（或 `docs/store-assets/`）存在 THEN 系统 SHALL 包含：128 / 48 / 16 三种尺寸图标、3–5 张 1280×800 截图占位、30s GIF 演示脚本（录制指南文档即可）。
4. WHEN `manifest.json` 构建 THEN 系统 SHALL 严格对齐 PRD §11.2：`permissions` 仅含 `tabs / storage / favicon / alarms / sessions / contextMenus / tabGroups / activeTab`；`optional_permissions` 为 `history / bookmarks`；`optional_host_permissions` 为 `<all_urls>`；`host_permissions` 为空数组；`incognito: "split"`；三条 `commands` 均已声明。
5. WHEN 发布脚本 `scripts/release.mjs` 运行 THEN 系统 SHALL 自动 bump 版本号（`package.json` + `manifest.json` 双写）、执行 `pnpm build`、生成 `canopy-v1.0.0.zip`、追加 `CHANGELOG.md` 条目。
6. WHEN 隐私政策 `docs/PRIVACY.md` 生成 THEN 系统 SHALL 明确声明：零外部请求（favicon 除外）、零账号、零上报；所有数据位于 `chrome.storage.local` / IndexedDB；用户可随时清空。
7. WHEN `_locales/zh_CN/messages.json` 和 `_locales/en/messages.json` 存在 THEN 系统 SHALL 覆盖扩展 `name / description / action_title` 等必填键，满足商店上架要求。

---

### 需求 12 — 无回退的一致性校验

**用户故事：** 作为开发团队，我需要确保封板前所有 P0 / P1 现有功能不因本次升级发生退化，以便放心发布 v1.0。

#### 验收标准

1. WHEN v1.0 构建完成 THEN 系统 SHALL 确保 PRD §5.1 功能矩阵中标记 ✅ 的所有功能行为（F-01~F-04、F-07、F-08、F-09 的 P0 子集；F-10、F-16、F-17、F-18、F-19、F-21、F-22、F-30、F-31、F-32、F-33 的 P1 子集）全部保持或优于当前实现。
2. WHEN 本次迭代添加的所有持久化字段（如 `canopy_onboarded`、新的 `settings.idleThresholdMinutes`、metrics 新事件）THEN 系统 SHALL 携带 `schemaVersion` 并在 `MigrationRunner` 中提供空迁移（或显式迁移脚本）。
3. WHEN `chrome.storage.local` 现有数据读取 THEN 系统 SHALL 对缺失字段使用合理默认值（向前兼容），不因字段缺失抛错。
4. WHEN 深色模式 / prefers-reduced-motion / 高对比度场景启用 THEN 系统 SHALL 保证本次新增的 `DashboardOverview`、`OnboardingCard v2`、`DuplicatePreviewModal`、富交互 Toast 满足 WCAG AA 与动效降级规则（PRD §10.4 / §15.1）。

---

### 需求 13 — CommandCenter 升级（F-05b）：四区推荐 + 8 种结果类型

**用户故事：** 作为一名键盘党重度用户，我希望打开命令中心能直接看到最近操作、推荐动作、最近搜索、热门关键词，并能搜索动作 / 会话 / 书签 / 标签，以便一个快捷键搞定所有高频场景。

#### 验收标准

1. WHEN 用户打开 `SearchBox` 且未输入任何字符 THEN 系统 SHALL 展示四区推荐：① 最近操作（来自 `metadata-slice.recentActivity` ring buffer，最多 5 条）、② 推荐动作（归档当前窗口 / 整理重复 / 打开归档 / 切换主题 / 打开设置，至少 5 条）、③ 最近搜索（最多 5 条，按时间倒序）、④ 热门关键词（最多 5 条，按搜索次数倒序）。
2. WHEN 用户输入关键词 THEN 系统 SHALL 在同一结果列表中混排 8 种结果类型：`tab | history | recent | engine | action | session | bookmark | tag`，并在每项前显示区分图标与类型标签。
3. WHEN 用户输入 `site:<domain>` THEN 系统 SHALL 仅返回 hostname 匹配的结果。
4. WHEN 用户输入 `in:archive` THEN 系统 SHALL 仅在归档会话中检索。
5. WHEN 用户输入 `in:live` THEN 系统 SHALL 仅在实时 Tab 中检索。
6. WHEN 用户输入 `in:bookmark` THEN 系统 SHALL 仅在书签中检索（如无 `bookmarks` 权限则提示申请）。
7. WHEN 用户输入 `tag:<name>` THEN 系统 SHALL 仅返回打过该 tag 的 Tab 或会话。
8. WHEN 用户输入 `has:note` THEN 系统 SHALL 仅返回带 `metadata.note` 的 Tab。
9. WHEN 用户输入 `pinned:true` THEN 系统 SHALL 仅返回 `metadata.pin` 为 true 的 Tab。
10. WHEN 用户同时输入多个语法（以空格分隔）THEN 系统 SHALL 按 AND 组合过滤。
11. WHEN `action` 类结果被选中 THEN 系统 SHALL 调用其 `run()` 回调并关闭命令中心。
12. WHEN 用户的每一次搜索 THEN 系统 SHALL 将关键词写入 `searchHistory`（最多 20 条，去重，按 LRU 淘汰）。

---

### 需求 14 — SW StatsCollector 精确频率（F-11 升级）

**用户故事：** 作为一名希望看到真实使用频率的用户，我希望"使用频率"视图基于真实的 `onActivated` 计数（而非 `lastAccessed` 近似），以便它能准确反映我"最近 7 天用得最多"的 Tab。

#### 验收标准

1. WHEN Service Worker 启动 THEN 系统 SHALL 初始化 `StatsCollector`，订阅 `chrome.tabs.onActivated` 事件。
2. WHEN `chrome.tabs.onActivated` 触发 THEN 系统 SHALL 对目标 Tab 的 URL（去除 hash）记一次 +1 到内存中的 `activationCounts`。
3. WHEN 距上次持久化 ≥ 30 秒 OR `chrome.runtime.onSuspend` 触发 THEN 系统 SHALL 将 `activationCounts` 合并写入 `chrome.storage.local::canopy_stats`。
4. WHEN 计数数据落盘 THEN 系统 SHALL 按"日"聚合并保留最近 30 天（按 URL × day 二维表），早于 30 天的数据自动清理。
5. IF 用户已授予 `history` 权限 THEN 系统 SHALL 在 SW 启动时用 `chrome.history.getVisits` 校正最近 7 天计数（取 max(internalCount, history.visitCount)）。
6. WHEN `FrequencyView` 渲染 THEN 系统 SHALL 按"最近 7 天激活次数"降序展示 Top 30 Tab，并移除原"约"字样。
7. WHEN `canopy_stats` 数据缺失或损坏 THEN 系统 SHALL 回退到 `lastAccessed` 近似并在 UI 角标提示"数据重建中"。

---

### 需求 15 — 会话管理扩展（F-14 升级）：合并 / 分享 / 三策略恢复

**用户故事：** 作为一名长期使用归档的用户，我希望能合并多个会话、单独分享某个会话、并按三种策略恢复，以便精细化管理归档库。

#### 验收标准

1. WHEN 用户在 `ArchivePanel` 多选 ≥ 2 个会话并点击"合并" THEN 系统 SHALL 弹出合并确认 Modal，展示合计 Tab 数、去重后 Tab 数、新会话命名输入框。
2. WHEN 用户确认合并 THEN 系统 SHALL 按 URL 去重（忽略 `#hash` + utm/fbclid/gclid）合并所有 Tab，创建新会话，删除源会话，并作为**单条 Undo**记录推入 `undo-slice`。
3. WHEN 用户在单个会话条目点击"分享" THEN 系统 SHALL 触发浏览器下载 `canopy-session-<id>.json`（包含该会话的完整元数据）。
4. WHEN 用户点击某会话的"恢复"按钮 THEN 系统 SHALL 弹出策略选择 Popover：`new_window`（默认，新窗口打开全部）/ `current_window`（追加到当前窗口末尾）/ `partial`（勾选 Modal）。
5. WHEN 用户选择 `partial` THEN 系统 SHALL 打开 `PartialRestoreModal` 列出会话内所有 Tab，默认全选，点击"恢复所选"后只恢复勾选项。
6. WHEN 恢复的 Tab 数 > 30 THEN 系统 SHALL 分批恢复（10 个 / 批，间隔 100ms），并在右下角展示 `Progress`（`恢复中 x/N` + 可取消）。
7. WHEN 用户点击"取消" THEN 系统 SHALL 停止后续批次但不回滚已恢复的 Tab，并显示 Toast 提示当前进度。
8. WHEN 大批量恢复完成 THEN 系统 SHALL 展示富 Toast "已恢复 N 个标签 · 分 M 批" 并提供"再次归档"快捷按钮。

---

### 需求 16 — 完整导入导出（F-15 升级）：JSON / MD / TXT / HTML + 3 种冲突策略

**用户故事：** 作为一名跨设备 / 跨浏览器的用户，我希望能按多种格式导出归档并能从文件、Chrome 书签、OneTab 导入，以便在任意环境恢复工作。

#### 验收标准

1. WHEN 用户进入 设置 → 数据 → 导出 THEN 系统 SHALL 展示 4 种格式单选：`JSON`（默认，完整数据）/ `Markdown`（标题+URL 列表）/ `TXT`（一行一 URL）/ `HTML`（Chrome 书签格式）。
2. WHEN 用户选择 `Markdown` 导出 THEN 系统 SHALL 按"## 会话名" + "- [title](url)" 的层级生成文件。
3. WHEN 用户选择 `TXT` 导出 THEN 系统 SHALL 按一行一 URL 生成（会话间用空行分隔）。
4. WHEN 用户选择 `HTML` 导出 THEN 系统 SHALL 生成合法的 Netscape Bookmark File Format 1 `<DL>` 树，可被其他浏览器导入。
5. WHEN 用户进入 设置 → 数据 → 导入 THEN 系统 SHALL 展示三个入口：`从本地文件`（支持所有 4 种格式，自动识别）/ `从 Chrome 书签`（需 `bookmarks` 权限）/ `从 OneTab`（兼容 `|` 分隔）。
6. WHEN 导入触发 THEN 系统 SHALL 要求用户先选择冲突策略：`skip`（默认，URL 已存在则跳过）/ `append`（全部追加到新会话）/ `replace`（二次确认 + 输入 `DELETE` 才执行）。
7. WHEN 导入源 > 5 MB OR 行数 > 20000 OR 单会话 > 500 KB THEN 系统 SHALL 拒绝并展示错误 Toast。
8. WHEN 导入完成 THEN 系统 SHALL 展示结果 Toast："已导入 N 个会话 / M 个标签（跳过 K 条重复）"，并写入 `recentActivity`。
9. WHEN HTML 导入 THEN 系统 SHALL 将 `<H3>` 解析为会话名，`<A>` 解析为 Tab；未分组的 `<A>` 归入"未命名"会话。

---

### 需求 17 — `tag:` 搜索语法完整接入（F-12 升级）

**用户故事：** 作为一名使用标签的用户，我希望 `tag:` 语法能精确命中所有打过该 tag 的 Tab 与会话，并支持一键"仅显示该 tag"。

#### 验收标准

1. WHEN 用户在 `SearchBox` 输入 `tag:<name>` THEN 系统 SHALL 查询 `metadata-slice` 的 URL→tags 索引，返回所有命中的 Tab + 所有包含该 tag 的会话。
2. WHEN 某 Tab 设置 tag THEN 系统 SHALL 校验：≤ 10 个 tag、每个 ≤ 20 字符；超出则拒绝并提示。
3. WHEN tag 首次创建 THEN 系统 SHALL 基于 tag 字符串 hash 稳定生成颜色并在 UI 所有 tag chip 上应用。
4. WHEN 用户在右键菜单点击 "加标签" THEN 系统 SHALL 弹出 `TagEditorPopover`，内嵌现有全局 tag 下拉 + 新建输入框。
5. WHEN 用户在某 tag chip 上点击"仅显示" THEN 系统 SHALL 把 SearchBox 填为 `tag:<name>` 并进入搜索结果视图。
6. WHEN 用户在设置或工作台进入"标签管理" THEN 系统 SHALL 列出所有 tag + 使用计数，支持重命名（连带更新所有引用）与删除（二次确认）。

---

### 需求 18 — 会话自动快照（F-23）

**用户故事：** 作为一名偶尔意外关闭整个浏览器的用户，我希望系统能定期自动快照当前窗口 Tab，以便事故后找回工作。

#### 验收标准

1. WHEN Service Worker 启动 THEN 系统 SHALL 创建 `chrome.alarms.create('canopy-auto-snapshot', { periodInMinutes: 60 })`。
2. WHEN `canopy-auto-snapshot` 闹钟触发 AND 当前窗口 Tab ≥ 10 AND 距上次快照 > 6 小时 THEN 系统 SHALL 静默创建一个 `hidden: true` 的 `ArchivedSession`，命名格式 `自动快照 · YYYY-MM-DD HH:mm`。
3. WHEN 用户进入 设置 → 行为 THEN 系统 SHALL 展示 `autoSnapshotFrequency` 下拉：`off` / `6h` / `12h`（默认）/ `24h`。
4. WHEN `autoSnapshotFrequency === 'off'` THEN 系统 SHALL 清除 `canopy-auto-snapshot` 闹钟。
5. WHEN 用户点击 `ArchivePanel` 顶部的"自动快照"折叠头 THEN 系统 SHALL 展开列出所有 `hidden: true` 的自动快照会话，默认按时间倒序。
6. WHEN 自动快照总数 > 20 THEN 系统 SHALL 自动删除最老的一条（FIFO），避免无限增长。
7. WHEN 用户将某个自动快照"转为正式" THEN 系统 SHALL 把 `hidden` 置为 false 并允许重命名。

---

### 需求 19 — 看板视图（F-20）：dnd-kit 拖拽聚合

**用户故事：** 作为一名多项目并行者，我希望能用拖拽把 Tab 归入"工作 / 学习 / 娱乐"列，以便工作台变成一个 Kanban。

#### 验收标准

1. WHEN `pnpm install` 完成 THEN 系统 SHALL 已将 `@dnd-kit/core` + `@dnd-kit/sortable` 列入 `dependencies`。
2. WHEN 用户从视图切换器选择 `kanban` THEN 系统 SHALL 渲染 `KanbanView`，默认展示 4 列：`工作 / 学习 / 娱乐 / 待看`。
3. WHEN `KanbanView` 首次加载 THEN 系统 SHALL 从 `chrome.storage.local::canopy_kanban` 读取用户配置；若无，则使用默认 4 列。
4. WHEN 用户点击"新增列"/"重命名列"/"删除列" THEN 系统 SHALL 更新 `canopy_kanban.columns` 并持久化。
5. WHEN 用户把一个 Tab 卡片拖入某列 THEN 系统 SHALL 将 `{ url, tabId }` 写入对应列的 `urls` 数组，**不关闭原 Tab**（纯视图聚合）。
6. WHEN 某 Tab 被关闭 THEN 系统 SHALL 在看板中以"已离线"灰态卡片继续展示，点击后尝试用 `chrome.tabs.create` 重新打开。
7. WHEN 用户点击某列的"另存为归档会话" THEN 系统 SHALL 将该列 URL 列表作为一个新 `ArchivedSession` 存档。
8. WHEN 看板视图尺寸 < 720px THEN 系统 SHALL 列横向滚动展示，保持可用。
9. WHEN `prefers-reduced-motion` THEN 系统 SHALL 禁用拖拽动画但保留拖拽功能。

---

### 需求 20 — Activity Strip 最近操作状态区（F-27）

**用户故事：** 作为一名频繁操作的用户，我希望能在 Hero 下方看到最近 60 分钟内的操作回放，以便快速回滚或查看。

#### 验收标准

1. WHEN 归档 / 恢复 / 导入 / 导出 / 权限授予 / 清空归档 等关键事件发生 THEN 系统 SHALL 把 `ActivityRecord { id, type, ts, summary, primaryAction?, secondaryAction? }` 推入 `metadata-slice.recentActivity` ring buffer（最多 20 条，72h 过期）。
2. WHEN `recentActivity` 非空 AND 最近条目 ts 距今 ≤ 60 分钟 THEN 系统 SHALL 在 HeroBar 下方、Dashboard Overview 上方渲染 `ActivityStrip` 横向胶囊条。
3. WHEN `ActivityStrip` 渲染 THEN 系统 SHALL 展示每条记录的图标 + 摘要（如 "📦 已归档 32 个标签到「4月24日 15:02」"）+ 最多 2 个行动按钮（如"↩ 恢复" / "查看"）。
4. WHEN 用户点击"↩ 恢复" AND 该记录对应 `undo-slice` 中未过期的 UndoGroup THEN 系统 SHALL 执行还原。
5. WHEN 用户点击"查看" THEN 系统 SHALL 根据 type 跳转到对应位置（归档→ArchivePanel + 高亮；导入→结果 Modal）。
6. WHEN 最近条目 ts 距今 > 60 分钟 THEN 系统 SHALL 隐藏 `ActivityStrip`（但数据保留供 CommandCenter 空输入推荐使用）。
7. WHEN `settings.uiVisibility.activityStrip` 为 false THEN 系统 SHALL 不渲染。

---

### 需求 21 — OG description 受控抓取（F-24）

**用户故事：** 作为一名希望搜索更精准的用户，我希望在我**显式开启**后，系统能抓取每个 Tab 的 OG description 建索引，以便搜索能命中页面摘要。

#### 验收标准

1. WHEN 用户进入 设置 → 行为 THEN 系统 SHALL 提供 `enableOgFetch` 开关，默认关闭，并明确说明"将读取网页 meta 描述，需要授予 `<all_urls>` 权限"。
2. WHEN 用户打开 `enableOgFetch` THEN 系统 SHALL 调用 `chrome.permissions.request({ origins: ['<all_urls>'] })` 动态申请权限；用户拒绝则回滚开关。
3. WHEN `enableOgFetch` 为 true AND 新 Tab 加载完成 THEN 系统 SHALL 在 SW 中以 `fetch HEAD + 少量 GET`（Range 0-51200）方式拉取 HTML；超时 3s / 限 50KB / 并发 ≤ 5。
4. WHEN 抓取成功 THEN 系统 SHALL 用 DOMParser 抽取 `<meta property="og:description">` 优先，回退 `<meta name="description">`，写入 IndexedDB `canopy_og_index` 表。
5. WHEN `SearchBox` 启动 MiniSearch 索引 THEN 系统 SHALL 合并 `title + og:description` 作为倒排索引输入，相关度加权 `title: 3, ogDesc: 1`。
6. WHEN 抓取失败（网络错误 / 非 HTML）THEN 系统 SHALL 静默跳过，不写入错误日志，不提示用户。
7. WHEN 用户关闭 `enableOgFetch` THEN 系统 SHALL 移除 `<all_urls>` 权限，并提供"清空 OG 索引"按钮。
8. WHEN `canopy_og_index` 行数 > 10000 THEN 系统 SHALL 按 LRU 淘汰旧条目。

---

### 需求 22 — 本地隐私洞察仪表盘（F-28）

**用户故事：** 作为一名重视本地数据的用户，我希望能看到自己最近 7 天的使用习惯统计（全部本地计算），以便了解自己的浏览行为。

#### 验收标准

1. WHEN 用户点击 Header 的 "我的数据" 入口 THEN 系统 SHALL 打开 `InsightsPanel`。
2. WHEN `InsightsPanel` 渲染 THEN 系统 SHALL 展示 4 个卡片：① 近 7 天每日新标签页打开次数（折线图）/ ② Top 10 访问域名（柱状图）/ ③ 累计归档 tab 数 + 估算节省内存（`tabCount × 80MB`，仅文案）/ ④ 使用频率前 5 的操作（来自 `canopy_metrics`）。
3. WHEN 折线图 / 柱状图渲染 THEN 系统 SHALL 仅使用轻量纯 SVG（不引入 echarts / chart.js），控制包体增量 ≤ 15 KB（原始）。
4. WHEN 用户点击"清除所有统计" THEN 系统 SHALL 二次确认后清空 `canopy_metrics` + `canopy_stats` + `canopy_og_index` + `recentActivity`。
5. WHEN `InsightsPanel` 代码 THEN 系统 SHALL 通过 `React.lazy` 动态加载，不进入主 chunk。
6. WHEN 无任何统计数据 THEN 系统 SHALL 展示空态 "还没有统计数据，用一段时间后再回来看看吧"。

---

### 需求 23 — Workspace 雏形（F-29）

**用户故事：** 作为一名有多重身份（工作 / 私人）的用户，我希望能保存最多 3 个"工作区"过滤组合，以便一键在不同上下文切换视图。

#### 验收标准

1. WHEN 用户进入 设置 → 数据 THEN 系统 SHALL 展示 "工作区" 区块，允许管理最多 3 个 `Workspace { id, name, filter: { tagIds, domains } }`。
2. WHEN 用户尝试创建第 4 个 Workspace THEN 系统 SHALL 提示 "免费版最多 3 个" 并禁用创建按钮（保留 `FeatureGate` 接口为未来付费版预留）。
3. WHEN 用户点击 Header 上的 Workspace 切换器 THEN 系统 SHALL 展示所有 Workspace 列表 + "清除筛选" 选项。
4. WHEN 用户选中某 Workspace THEN 系统 SHALL 将当前主视图过滤为：Tab 含任一 `tagIds` OR hostname 属于 `domains`。
5. WHEN 某 Workspace 被激活 THEN 系统 SHALL 在 Header 或 HeroBar 以 chip 高亮显示其名字 + 可点"×"快速退出。
6. WHEN 激活的 Workspace 对应 filter 结果为空 THEN 系统 SHALL 展示空态 "此工作区暂无 Tab，要不要换一个？" + 切换 / 清除按钮。
7. WHEN 用户刷新页面 THEN 系统 SHALL 记忆最后激活的 Workspace（`settings.lastActiveWorkspaceId`）。

---

## 封板原则

本需求文档涵盖 **PRD v1.0 功能矩阵中 F-01 ~ F-34 的全部条目**，不再保留"v1.1 / v1.2 留待后续"的口径。上架前必须满足：

1. PRD §5.1 表格中所有 `✅` / `⚠️` 行到达 `✅ 完整` 状态。
2. PRD §8 所列 P2 功能（F-20 / F-23 / F-24 / F-27 / F-28 / F-29）全部实现至"可用"级别。
3. 性能硬指标全部达标（主 chunk ≤ 280 KB / gz 90 KB、500 Tab ≥ 55 fps、首屏 FCP ≤ 600ms P95）。
4. 15 条关键 E2E 全部 PASS。
5. 上架素材、隐私政策、CHANGELOG、QA Checklist 齐备。

任何临近封板仍有 **性能 / 稳定性** 退化的高风险需求，可在本文档内部降级到"最小可用"形态，但**不得从范围里移除**。
