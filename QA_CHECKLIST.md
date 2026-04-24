# Canopy v1.0 QA 上架清单

> 目的：发布 v1.0.0 到 Chrome Web Store 前的最后闸口。每项必须勾选✅才可发布。

## A. 构建与包体

- [x] `npm run build` 无错误、无 manifest 重写异常
- [x] `npm run check-quota` 全部阈值通过（newtab.js ≤ 280 KB / 90 KB gz，SW ≤ 60 KB，CSS ≤ 80 KB，chunk ≤ 750 KB）
- [x] 实测：newtab.js 67.80 KB（20.39 KB gz）
- [x] `dist/manifest.json` 版本 = `1.0.0`
- [x] `dist/sw.js` 可作为 service_worker 正常加载
- [x] `dist/src/pages/newtab/index.html` 可作为新标签页正常加载
- [x] `dist/src/pages/popup/index.html` 弹出窗 360×520 正常

## B. 功能回归（需求对照）

| # | 功能 | 验证步骤 | 状态 |
| --- | --- | --- | --- |
| 1 | 首页 DashboardOverview 6 卡片 | 打开新标签页 → 看见卡片 → 点击每张卡片直达 | ✅ |
| 2 | Onboarding v2 欢迎屏 | 清 `canopy_onboarded` 后刷新 → 二择按钮 → 3 步微引导 → ←/→/Esc | ✅ |
| 3 | ActivityStrip 60min 窗口 | 归档一次 → 胶囊出现 + 撤销按钮 + 查看归档按钮 | ✅ |
| 4 | Popup 360×520 四区 | 点 toolbar 图标 → 搜索 / 最近 10 Tab / 归档 / 打开工作台 | ✅ |
| 5 | 去重三档 `strict/loose/off` | 设置切换 → TidySuggestionBar 与 Dashboard 数字同步变化 | ✅ |
| 6 | 闲置阈值 5 档 | 设置切换 → 闲置数字同步 | ✅ |
| 7 | DuplicatePreviewModal | TidySuggestionBar → 预览 → 单选 / 合并 → 单条 Undo | ✅ |
| 8 | SelectionMode 摘要 Cmd+A Esc | 按 Ctrl 点 2 个 Tab → 摘要显示 · Cmd+A 全选 · Esc 退出 | ✅ |
| 9 | UndoToast 富交互 | 归档 → Toast 显示"已归档 N 到 ⟨name⟩"+ 查看归档按钮 | ✅ |
| 10 | 合并会话 | ArchivePanel → 多选 → 合并 → 新会话按 URL 去重 | ✅ |
| 11 | 分享会话 | 会话条 → 分享按钮 → 下载 JSON | ✅ |
| 12 | 三策略恢复 | 会话 → 恢复 → 新窗口/当前窗口（超 30 Tab 分批） | ✅ |
| 13 | 自动快照 | 设置频率 → 当前窗口 ≥ 10 Tab 时闹钟触发 → ArchivePanel 中 hidden 会话 | ✅ |
| 14 | 搜索语法 `site:/in:/tag:/has:/pinned:` | parseQuery 单测覆盖 ✔ | ✅ |
| 15 | StatsCollector + FrequencyView | 切多次 Tab → FrequencyView 实时重排 → 数据缺失时显示"数据重建中"Tag | ✅ |
| 16 | InsightsPanel 4 卡片 | 设置入口 → 折线 / 柱状 / 统计 / Top 5 | ✅ |
| 17 | 多格式导入导出 | JSON / MD / TXT / HTML 四格式导出；JSON / HTML / OneTab 导入 | ✅ |
| 18 | 3 种冲突策略 | applyImport 单测覆盖 skip/append/replace | ✅ |
| 19 | OG 抓取开关 | 设置开启 → 权限请求 → 加载任一页面 → `canopy_og_index` 有记录 | ✅ |
| 20 | WorkspaceSwitcher | Header 显示 chip → Dropdown 切换 → Tag chip X 清除 | ✅ |
| 21 | KanbanView 第 9 种视图 | 视图栏切到 Kanban → 默认 4 列 → 左栏拖入 → 卡片可见 → 删除 / 另存为归档 | ✅ |
| 22 | manualChunks 生效 | `dist/chunks/feat-*.js` + `vendor-*.js` 按路径分离 | ✅ |
| 23 | 单测 ≥ 79 用例全绿 | `npm test` | ✅ |

## C. 国际化

- [x] `_locales/zh_CN/messages.json` 含 `appName` / `appDescription` 等核心键
- [x] `_locales/en/messages.json` 同步
- [x] `src/shared/i18n/zh-CN.ts` / `en.ts` 新增 70+ 条封板文案
- [x] manifest 通过 `__MSG_appName__` / `__MSG_appDescription__` 接入本地化

## D. 可访问性

- [x] DuplicatePreviewModal 按钮与复选框具备 `aria-label`
- [x] DashboardOverview 卡片 `role="button"` + Enter/Space 键盘触发
- [x] UndoToast `role="alert"` + `aria-live="polite"`
- [x] Onboarding v2 Modal `closable=false` + Esc 键盘 finish
- [x] 所有 Tag/Button 使用语义标签，无纯 `<div onClick>`

## E. 隐私与数据

- [x] PRIVACY.md 随版本发布同步更新
- [x] 无任何第三方分析 / 埋点 SDK
- [x] OG 抓取路径仅在 `enableOgFetch=true && <all_urls> 已授权` 时触发
- [x] InsightsPanel → 一键清除所有本地统计可用

## F. 上架资产

- [ ] Chrome Web Store 截图（5 张，1280×800）— 待美工产出
- [ ] Promo tile（440×280）— 待美工产出
- [ ] 商店描述（中/英双语，200 字内）
- [ ] 分类：Productivity / Workflow & Planning
- [ ] 隐私政策 URL / 支持 URL 配置
- [ ] 打包 `dist/` 为 zip（脚本：`npm run release`）
