# Roadmap: Canopy

**Created:** 2026-04-22
**Phases:** 10
**Granularity:** Fine

## Phase Overview

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | 项目脚手架 | 搭建可运行的 MV3 扩展开发环境 | — | 3 |
| 2 | 新标签页接管 + 数据层 | 新标签页显示工作台骨架，Chrome API 数据流通 | NEWTAB-01, TABS-01~06, STORE-01 | 4 |
| 3 | 域名分组视图 | 默认视图完整可用，分组折叠/展开 | DOMAIN-01~04 | 3 |
| 4 | Tab 操作 + Undo | 跳转/关闭/批量关闭/Undo 全链路通 | OPS-01~05 | 4 |
| 5 | 搜索 + 一键归档 | 搜索和归档核心闭环 | SEARCH-01~04, ARCHIVE-01~05 | 4 |
| 6 | 视觉系统 + 主题 | 毛玻璃+渐变+亮暗切换 | VISUAL-01~06, A11Y-01~03, I18N-01~02 | 4 |
| 7 | 多视图切换 | 时间轴+紧凑+网格+频率 | TIMELINE-01~02, COMPACT-01, GRID-01, FREQ-01~03 | 4 |
| 8 | 去重 + 归档管理 + 导入导出 | 增强 Tab 管理和会话管理 | DEDUP-01~02, SESSION-01~03, EXPORT-01~03, SETTINGS-01~02 | 4 |
| 9 | 标签备注 + 看板 + 书签 + 固定 | 高阶组织和自定义能力 | TAGS-01~02, KANBAN-01~02, BOOKMARK-01~02, PIN-01 | 4 |
| 10 | 自动快照 + 检索增强 + 打磨 | 上架前完善和优化 | SNAPSHOT-01, SEARCH-02~03, STORE-02~05 | 3 |

## Phase Details

### Phase 1: 项目脚手架
**Goal:** 搭建可运行的 MV3 扩展开发环境，HMR 热更新正常

**Requirements:** (基础设施，无直接 REQ-ID)

**Plans:**
1. 初始化 Vite + CRXJS + React 18 + TypeScript 项目
2. 配置 manifest.json（MV3，权限 tabs/storage/favicon/alarms/sessions/contextMenus）
3. 配置 Tailwind CSS + CSS 变量体系
4. 创建文件结构（src/pages / src/features / src/shared / src/store / src/services / src/repositories / src/chrome / src/sw）
5. 配置 Vitest + ESLint + Prettier
6. 配置 _locales（zh-CN + en）基础 messages.json
7. 确保 `pnpm dev` 可以热更新加载扩展到 Chrome

**Success Criteria:**
1. `pnpm dev` 启动后 Chrome 加载扩展，新标签页显示 "Canopy" 占位页面
2. 修改 React 组件后 HMR 自动刷新
3. `pnpm test` 运行 Vitest 通过

**UI hint:** no

---

### Phase 2: 新标签页接管 + 数据层
**Goal:** 新标签页显示工作台骨架，Chrome API 数据流通，Tab 列表可渲染

**Requirements:** NEWTAB-01, NEWTAB-03, TABS-01~06, STORE-01

**Plans:**
1. 实现 chrome API promisified wrappers（tabs / windows / sessions / storage）
2. 实现 StorageRepo（chrome.storage.local 分区读写 + 封装）
3. 实现 SW 事件总线（监听 tabs 事件 → BroadcastChannel 广播）
4. 实现 Zustand tabsSlice（LiveTab[] 状态 + 增量更新 actions）
5. 实现 TabService（queryAll / onEvent / 过滤特殊 URL / 隐私窗口排除）
6. 新标签页接管 + 基础布局（顶栏 + 左侧栏 + 主区域）
7. 主区域渲染 Tab 简单列表（favicon + 标题 + 域名 + 窗口标识）
8. 首次打开 Onboarding 引导卡片
9. 冲突检测（其他扩展接管新标签页时提示）

**Success Criteria:**
1. 新开 Tab 显示所有窗口的 Tab 列表
2. 打开/关闭/切换 Tab 后列表实时更新
3. chrome:// / file:// 等特殊 URL 正确处理
4. 首次安装显示 Onboarding

**UI hint:** yes

---

### Phase 3: 域名分组视图
**Goal:** 默认视图完整可用，域名分组 + 折叠展开

**Requirements:** NEWTAB-02, DOMAIN-01~04

**Plans:**
1. 实现 PSL 注册域名提取工具函数（使用 tldts 或 psl 库）
2. 实现域名分组逻辑（hostname → 注册域名映射 + 分组排序）
3. 实现域名分组卡片组件（favicon + 域名 + 数量徽标 + 展开列表）
4. 实现折叠/展开交互 + 状态持久化到 storage
5. 空状态设计（无 Tab 时引导）
6. 设置中"关闭新标签页接管"选项（NEWTAB-02）

**Success Criteria:**
1. Tab 按注册域名正确分组，子域名合并
2. 分组间按 Tab 数降序，组内按最近激活降序
3. 折叠状态刷新后保持
4. 设置中可关闭接管

**UI hint:** yes

---

### Phase 4: Tab 操作 + Undo
**Goal:** 跳转/关闭/批量关闭/Undo 全链路可用

**Requirements:** OPS-01~05

**Plans:**
1. 实现 Tab 点击跳转逻辑（同窗/跨窗/最小化/跨桌面场景）
2. 实现单个关闭 + Undo Toast 组件
3. 实现 Undo 恢复逻辑（优先 chrome.sessions.restore）
4. 实现批量关闭（按域名组 / 全部非固定）+ >20 二次确认
5. Undo 队列持久化到 storage（批量操作写入一条 Undo 记录）
6. 实现 BroadcastChannel 广播 Undo 状态（跨新标签页同步）

**Success Criteria:**
1. 点击 Tab 正确跳转（包括跨窗口）
2. 关闭后 Undo Toast 出现，5s 内撤销成功
3. 批量关闭 >20 个时需确认
4. 关闭新标签页后重新打开仍可撤销

**UI hint:** yes

---

### Phase 5: 搜索 + 一键归档
**Goal:** 搜索和归档核心闭环完成

**Requirements:** SEARCH-01~04, ARCHIVE-01~05

**Plans:**
1. 实现搜索框组件（Cmd+K / / 快捷键聚焦，Esc 清空）
2. 集成 MiniSearch（Tab 标题 + URL 索引，150ms 防抖）
3. 实现搜索结果高亮 + 空结果引导
4. 实现 Save All Tabs 按钮 + 右键菜单 + popup 入口
5. 实现归档原子事务（先写 storage → tabs.remove → 落地页）
6. 实现归档排除规则（扩展自身、chrome://、隐私窗口、pinned 可选）
7. 实现归档落地页（"已归档 N 个 Tab · 查看归档"）
8. 实现简易归档列表查看 + 单个/全部恢复

**Success Criteria:**
1. Cmd+K 聚焦搜索，实时过滤，高亮匹配
2. Save All Tabs 归档成功，Tab 关闭，落地页显示
3. 恢复归档的 Tab 到新窗口
4. 归档冲突名自动加时间戳

**UI hint:** yes

---

### Phase 6: 视觉系统 + 主题
**Goal:** 毛玻璃+渐变视觉完整落地，亮暗切换，A11y + i18n 基线

**Requirements:** VISUAL-01~06, A11Y-01~03, I18N-01~02

**Plans:**
1. 实现 Design Token 体系（CSS 变量：radius / blur / elevation / font / space / gradient）
2. 实现三套渐变预设背景组件 + 自定义渐变选择器
3. 实现毛玻璃卡片样式 + 半透明边框
4. 实现主题切换逻辑（light / dark / system）+ 无 FOUC
5. 实现所有动效（spring 动画 / 视图切换淡入淡出 / Tab 进出场）
6. 实现 prefers-reduced-motion 检测
7. 补全所有 aria-label + 焦点态样式 + 键盘操作
8. 检查颜色对比度 ≥ 4.5:1
9. 实现颜色不作为唯一信息载体
10. 补全 _locales 双语翻译
11. 日期/数字用 Intl API

**Success Criteria:**
1. 毛玻璃+渐变视觉效果到位，三套预设可切换
2. 亮/暗/跟随系统三档切换无闪烁
3. 全键盘操作可达，焦点态清晰
4. 对比度 ≥ 4.5:1
5. 中英文界面切换正确

**UI hint:** yes

---

### Phase 7: 多视图切换
**Goal:** 5 种视图模式全部实现，视图切换器可用

**Requirements:** TIMELINE-01~02, COMPACT-01, GRID-01, FREQ-01~03

**Plans:**
1. 实现视图切换器组件（右上角图标组/下拉）
2. 实现时间轴视图（按时间分段 Feed 流 + lastAccessed 数据来源）
3. 实现紧凑列表视图（一行一 Tab + @tanstack/react-virtual 虚拟滚动）
4. 实现网格卡片视图（OG image 抓取 → favicon → 域名色块四级降级）
5. 实现 SW StatsCollector（onActivated 计数 + 立即落盘 + alarms 心跳）
6. 实现使用频率视图（7 天激活次数排序 + Top 30）
7. 实现频率数据校正（新标签页打开时 chrome.tabs.query + chrome.history）
8. 实现 Zustand viewMode slice + 持久化默认视图

**Success Criteria:**
1. 5 种视图（域名分组/时间轴/紧凑/网格/频率）切换正常
2. 500+ Tab 下紧凑列表虚拟滚动流畅
3. 频率视图数据准确（SW 休眠后不丢计数）
4. 网格视图 OG image 正确降级

**UI hint:** yes

---

### Phase 8: 去重 + 归档管理 + 导入导出 + 设置
**Goal:** 增强 Tab 管理和会话管理能力

**Requirements:** DEDUP-01~02, SESSION-01~03, EXPORT-01~03, SETTINGS-01~02

**Plans:**
1. 实现去重检测引擎（严格/宽松规则 + 跟踪参数白名单）
2. 实现去重 InfoBar 组件 + 一键合并/本次忽略
3. 实现归档会话管理面板（列表/重命名/删除/合并/复制）
4. 实现会话恢复策略（新窗口打开 + >30 分批 + 单个恢复）
5. 实现导出功能（JSON / Markdown / 纯文本 / HTML 书签格式）
6. 实现导入功能（冲突策略：跳过/追加/替换 + 5MB/20K 限制 + 输入 DELETE 确认）
7. 实现设置面板（外观/行为/数据/快捷键/关于 五分类）
8. 实现一键清空本地数据（2 步确认 + 输入 DELETE）

**Success Criteria:**
1. 重复 Tab 检测正确，InfoBar 提示非侵入
2. 归档会话可重命名/删除(Undo)/合并/恢复
3. 导出 JSON → 清空 → 导入后数据一致
4. 设置面板所有选项生效

**UI hint:** yes

---

### Phase 9: 标签备注 + 看板 + 书签 + 固定
**Goal:** 高阶组织和自定义能力

**Requirements:** TAGS-01~02, KANBAN-01~02, BOOKMARK-01~02, PIN-01

**Plans:**
1. 实现 Tag/Note 数据模型 + storage 持久化
2. 实现 Tab 卡片右键菜单（添加标签/备注）
3. 实现标签色块（hash 稳定色）+ 备注 icon
4. 实现搜索 tag:xxx 语法解析
5. 实现看板视图（dnd-kit 拖拽 + Column CRUD + 布局持久化）
6. 实现书签数据源（chrome.bookmarks 读取 + 域名分组中标记区分）
7. 实现"Tab 转书签" + "从书签打开"
8. 实现固定/置顶功能（Tab/分组置顶 + 状态持久化 + 不参与关闭所有）

**Success Criteria:**
1. 可为 Tab 添加 tag 和 note，搜索 tag:xxx 过滤正确
2. 看板视图拖拽归类正常，刷新后保持
3. 书签在域名分组中以独立标记显示
4. 置顶项不受"关闭所有"影响

**UI hint:** yes

---

### Phase 10: 自动快照 + 检索增强 + 打磨
**Goal:** 上架前完善和优化，存储健壮性

**Requirements:** SNAPSHOT-01, SEARCH-02~03, STORE-02~05

**Plans:**
1. 实现容量监控（getBytesInUse + 8 MiB 告警 + 存储容量条）
2. 实现 IndexedDB 降级（容量超阈值自动切换）
3. 实现数据迁移框架（schemaVersion + MigrationRunner + 备份）
4. 实现会话自动快照（chrome.alarms 定时 + 隐藏快照 + 时间机器回溯）
5. 实现 OG description 索引（SW fetch HEAD/GET + host_permissions 按需申请）
6. 实现拼音首字母搜索（pinyin-pro + 预构建索引）
7. 性能压测与优化（500 / 1000 Tab 场景）
8. 本地埋点实现（newtab_open / view_switch / perf_fcp / perf_fps_sample 等）
9. E2E 测试完善（Playwright 10 个关键场景）
10. Chrome 商店素材准备

**Success Criteria:**
1. 存储容量超 8 MiB 时告警 + 自动降级到 IndexedDB
2. 自动快照每天创建，可回溯
3. OG 索引 + 拼音搜索工作正常
4. 500 Tab 下帧率 ≥ 55 fps，首屏 ≤ 200ms
5. 10 个 E2E 场景全过

**UI hint:** yes

---

## Phase Dependencies

```
Phase 1 (脚手架)
  └── Phase 2 (数据层)
       ├── Phase 3 (域名视图)
       │    └── Phase 4 (Tab操作)
       │         └── Phase 5 (搜索+归档)
       │              ├── Phase 6 (视觉+主题)
       │              └── Phase 7 (多视图)
       │                   └── Phase 8 (去重+管理)
       │                        └── Phase 9 (标签+看板)
       │                             └── Phase 10 (快照+打磨)
```

**Parallelizable groups:**
- Phase 6 (视觉) and Phase 7 (多视图) can run in parallel after Phase 5

---
*Roadmap created: 2026-04-22*
