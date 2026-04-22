# Canopy

## What This Is

Canopy 是一款替换 Chrome 新标签页的标签管理器扩展。每次新开 Tab 时，用户进入一个美观（毛玻璃+渐变风格）、高效（多视图切换）、可检索的"标签工作台"，统一管理当前所有已打开的 Tab、历史归档会话和书签。面向 50+ Tab 并发的重度网页工作者，以及追求美学的 Chrome/Edge 用户。

## Core Value

每次新开 Tab，3 秒内找到并跳转到目标页面——新标签页就是你的标签工作台。

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

- [ ] 新标签页接管（chrome_url_overrides.newtab）
- [ ] 实时 Tab 聚合展示（跨窗口、实时事件更新、特殊 URL 处理、隐私窗口策略）
- [ ] 按域名分组视图（默认视图，PSL 注册域名聚合，折叠状态持久化）
- [ ] 基础 Tab 操作（跨窗口跳转、关闭/批量关闭、Undo Toast）
- [ ] 全局搜索（标题+URL 实时过滤、Cmd+K 快捷键、高亮匹配）
- [ ] 一键归档（OneTab 式 Save All、原子事务、归档后落地页）
- [ ] 本地持久化（chrome.storage.local + 容量监控 + IndexedDB 降级）
- [ ] 毛玻璃+渐变视觉系统（亮/暗双主题、三套渐变预设）
- [ ] 键盘全盘可达 + A11y 基线（WCAG 2.1 AA）
- [ ] i18n 双语基座（zh-CN / en-US）
- [ ] 时间轴视图（按打开时间 Feed 流）
- [ ] 紧凑列表视图（虚拟滚动）
- [ ] 网格卡片视图（OG image → favicon → 域名色块四级降级）
- [ ] 使用频率视图（SW 计数 + 立即落盘）
- [ ] 去重检测（可配置严格/宽松规则）
- [ ] 归档会话管理（重命名/删除/合并/恢复）
- [ ] 导入/导出（JSON/Markdown/纯文本/HTML 书签格式）
- [ ] 设置面板（主题/默认视图/快捷键/数据管理）
- [ ] 标签与备注（自定义 tag + note，搜索语法 tag:xxx）
- [ ] 看板视图（拖拽自定义分组，dnd-kit）
- [ ] 书签整合（chrome.bookmarks 读取，域名分组中标记区分）
- [ ] 固定/置顶（Tab 或分组置顶，不参与"关闭所有"）
- [ ] 会话自动快照（每天/每周自动快照）
- [ ] 全文检索增强（title + OG description 索引）

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- 团队协作/多人共享 — 本产品是单人工具，不做账号体系和云同步
- 抓取网页正文做全文索引 — 只索引 title+meta，不读 body（隐私+性能）
- 跨浏览器数据互通 — Chrome/Firefox 数据不打通，除非手动导出导入
- 广告/推荐/站点打分 — 纯工具，不做内容平台
- 自动分类 AI — 分组规则全部确定性，不引入 ML
- 移动端 — Chrome/Edge 桌面为唯一目标
- v1 付费版 — 长期免费

## Context

- **竞品格局**：OneTab（收纳强但 UI 朴素）、Toby（看板好但需登录）、Workona（功能全但复杂）、Momentum/Tabby Cat（视觉美但无 Tab 管理）、Tab Manager Plus（弹窗搜索强但非新标签页）
- **差异化定位**：OneTab 的收纳能力 + Toby 的视图丰富度 + Momentum 的视觉美感 − 所有云端/登录复杂度
- **技术环境**：Chrome Manifest V3 是唯一新规范；MV3 Service Worker 30s 休眠需要特殊处理；chrome.storage.local 10MiB 上限需要容量监控；`captureVisibleTab` 只能截当前 Tab 不适用于全量缩略图
- **目标用户画像**：重度网页工作者(50%)、内容创作者/学生(30%)、美学追求者(20%)
- **品牌**：Canopy（树冠，寓意收束+视觉柔和）

## Constraints

- **扩展规范**: Must use Manifest V3 — Chrome/Edge 唯一支持的新规范
- **性能**: 500+ Tab 场景 ≥ 55 fps，首屏 ≤ 200ms (P95)
- **隐私**: 零外部请求，所有数据 chrome.storage.local，不上传任何服务器
- **存储**: chrome.storage.local 上限 10 MiB，需容量监控 + IndexedDB 降级
- **SW 生命周期**: MV3 Service Worker 30s 休眠，关键数据必须立即落盘
- **权限敏感度**: Chrome 商店对 `tabs`/`<all_urls>` 审核敏感，MVP 不申请 `<all_urls>`
- **技术栈**: React 18 + TypeScript + Vite + CRXJS + Tailwind + Zustand + Framer Motion

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 品牌名 Canopy | "树冠"寓意收束+视觉柔和，比 "Tabs" 更有辨识度 | — Pending |
| 毛玻璃+渐变风格 | 用户选择，类 Arc/macOS Big Sur 视觉 | — Pending |
| 本地优先隐私安全 | 不上传任何数据，零外部请求 | — Pending |
| 缩略图用 OG image 四级降级 | captureVisibleTab 只能截当前 Tab，且需敏感权限 | — Pending |
| MiniSearch 取代 Fuse.js | Fuse.js 在 >5K 条数据明显变慢 | — Pending |
| MVP 不申请 host_permissions | 避免 Chrome 商店审核风险 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-22 after initialization*
