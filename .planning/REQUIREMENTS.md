# Requirements: Canopy

**Defined:** 2026-04-22
**Core Value:** 每次新开 Tab，3 秒内找到并跳转到目标页面

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### 新标签页接管

- [ ] **NEWTAB-01**: 扩展安装后自动接管 chrome://newtab，显示 Canopy 工作台
- [ ] **NEWTAB-02**: 用户可在设置中关闭新标签页接管，回退 Chrome 默认
- [ ] **NEWTAB-03**: 检测到其他扩展冲突时，显示说明卡片引导解决

### 实时 Tab 聚合

- [ ] **TABS-01**: 查询并展示所有窗口的已打开 Tab（跨窗口聚合）
- [ ] **TABS-02**: 实时监听 Tab 创建/更新/删除/激活/移动事件，视图无需刷新自动更新
- [ ] **TABS-03**: 每个 Tab 显示 favicon、标题、域名、窗口标识、活跃状态、固定状态
- [ ] **TABS-04**: 特殊 URL 处理：chrome:// / edge:// / file:// / chrome-extension:// / about:blank / 扩展自身新标签页各有展示/归档/跳转规则
- [ ] **TABS-05**: 隐私窗口 Tab 默认不展示，即使开启无痕访问也不纳入归档
- [ ] **TABS-06**: 新标签页首次打开时显示 4 步 Onboarding 引导

### 域名分组视图

- [ ] **DOMAIN-01**: 按 PSL 注册域名聚合 Tab，分组卡片显示站点 favicon + 域名 + Tab 数量
- [ ] **DOMAIN-02**: 分组内部按最近激活时间降序，分组间按 Tab 数量降序
- [ ] **DOMAIN-03**: 分组可折叠/展开，折叠状态持久化到 chrome.storage.local
- [ ] **DOMAIN-04**: 子域名合并规则（m.example.com + www.example.com → example.com）

### Tab 操作

- [ ] **OPS-01**: 点击 Tab 卡片跳转到目标 Tab（同窗口直接激活，跨窗口激活+聚焦窗口，最小化窗口先恢复）
- [ ] **OPS-02**: 关闭单个 Tab，附 Undo Toast（5 秒窗口，可配置 3-10 秒）
- [ ] **OPS-03**: 批量关闭（按域名组关闭、关闭所有非固定），超过 20 个需二次确认
- [ ] **OPS-04**: Undo 队列持久化到 storage，关闭新标签页后仍可撤销
- [ ] **OPS-05**: Undo 优先使用 chrome.sessions.restore，兜底 chrome.tabs.create

### 全局搜索

- [ ] **SEARCH-01**: 顶部搜索框实时过滤 Tab 标题 + URL
- [ ] **SEARCH-02**: 快捷键 / 或 Cmd+K 聚焦搜索框，Esc 清空并失焦
- [ ] **SEARCH-03**: 输入防抖 150ms，命中关键字高亮
- [ ] **SEARCH-04**: 搜索结果为空时显示引导文案

### 一键归档

- [ ] **ARCHIVE-01**: Save All Tabs 按钮 + 右键菜单 + 工具栏 popup 入口
- [ ] **ARCHIVE-02**: 归档排除扩展自身新标签页、chrome://、隐私窗口 Tab，pinned 可选
- [ ] **ARCHIVE-03**: 归档为原子事务：先写 storage 成功再 tabs.remove，失败可回滚
- [ ] **ARCHIVE-04**: 归档完成后新建标签页作为"归档完成落地页"
- [ ] **ARCHIVE-05**: 归档会话名冲突时自动加时间戳后缀

### 本地持久化

- [ ] **STORE-01**: chrome.storage.local 存储 10 个分区 key（settings / sessions:index / sessions:<id> / stats / kanban / tags / notes / foldState / undo / metrics）
- [ ] **STORE-02**: 容量监控：每次写入前检查 getBytesInUse，超 8 MiB 触发告警
- [ ] **STORE-03**: 超过 8 MiB 自动降级到 IndexedDB，索引元数据仍在 storage.local
- [ ] **STORE-04**: 所有持久化实体带 schemaVersion，启动时 MigrationRunner 链式升级
- [ ] **STORE-05**: 迁移前备份到 migration_backup_<ts>（保留最近 3 份）

### 视觉系统

- [ ] **VISUAL-01**: 毛玻璃卡片（backdrop-filter: blur(24px) saturate(180%)）+ 半透明底 + 1px 半透明边框
- [ ] **VISUAL-02**: 三套渐变预设（Aurora / Sunrise / Deep Space），用户可自定义 2 色渐变
- [ ] **VISUAL-03**: 亮色/暗色/跟随系统三档切换，无 FOUC
- [ ] **VISUAL-04**: WCAG AA 对比度（正文 ≥ 4.5:1）
- [ ] **VISUAL-05**: 统一圆角 8/12/20px、间距 4px 倍数、动效 150-250ms cubic-bezier(.22,.61,.36,1)
- [ ] **VISUAL-06**: prefers-reduced-motion 生效时禁用非必要动画

### 可访问性与国际化

- [ ] **A11Y-01**: 完整键盘操作（Tab/Shift+Tab/Enter/Delete/↑/↓/Esc/Cmd+K）
- [ ] **A11Y-02**: 所有图标按钮有 aria-label，焦点态 2px 高对比外描边
- [ ] **A11Y-03**: 颜色不作为唯一信息载体
- [ ] **I18N-01**: 使用 _locales 体系，支持 zh-CN + en-US
- [ ] **I18N-02**: 日期/数字用 Intl API，长文本用 ICU MessageFormat

### 时间轴视图

- [ ] **TIMELINE-01**: 按 Tab 打开时间倒序 Feed 流，分段"今天/昨天/本周/更早"
- [ ] **TIMELINE-02**: 时间来源优先 chrome.tabs.lastAccessed（Chrome 116+），不可用由 SW 维护

### 紧凑列表视图

- [ ] **COMPACT-01**: 一行一 Tab（favicon + 标题 + 域名），超过 100 条启用虚拟滚动

### 网格卡片视图

- [ ] **GRID-01**: 大卡片 + 预览图，四级降级：OG image → Twitter Card → 高清 favicon → 域名色块

### 使用频率视图

- [ ] **FREQ-01**: SW 监听 onActivated 累加计数，立即落盘（防 SW 休眠丢失）
- [ ] **FREQ-02**: 按"最近 7 天激活次数"降序，默认 Top 30
- [ ] **FREQ-03**: 新标签页打开时用 chrome.tabs.query + chrome.history 校正

### 去重检测

- [ ] **DEDUP-01**: 自动检测相同 URL 的 Tab（严格/宽松规则可配置，宽松忽略 #hash 和 utm_* 等跟踪参数）
- [ ] **DEDUP-02**: 顶部非侵入 InfoBar 提示，带"一键合并"和"本次忽略"

### 归档会话管理

- [ ] **SESSION-01**: 归档会话列表、重命名、删除（Undo）、合并、复制
- [ ] **SESSION-02**: 全部恢复默认新窗口打开，>30 个 Tab 分批打开（每批 10 个间隔 100ms）
- [ ] **SESSION-03**: 单个恢复在当前窗口末尾新建 Tab

### 导入/导出

- [ ] **EXPORT-01**: 导出格式 JSON / Markdown / 纯文本 / HTML 书签格式
- [ ] **EXPORT-02**: 导入冲突策略：跳过重复（默认）/ 全部追加 / 完全替换（需输入 DELETE 确认）
- [ ] **EXPORT-03**: 导入最大文件 5MB，行数限制 20K

### 设置面板

- [ ] **SETTINGS-01**: 分类：外观 / 行为 / 数据 / 快捷键 / 关于
- [ ] **SETTINGS-02**: 一键清空本地数据需 2 步确认 + 输入"DELETE"

### 标签与备注

- [ ] **TAGS-01**: 为 Tab 或归档会话添加 tag（最多 10 个，每个 ≤20 字符）+ note（≤500 字符）
- [ ] **TAGS-02**: 搜索支持 tag:xxx 语法过滤

### 看板视图

- [ ] **KANBAN-01**: 拖拽 Tab 到自定义 Column（工作/学习/娱乐），dnd-kit
- [ ] **KANBAN-02**: Column 可增删改、排序，看板布局持久化

### 书签整合

- [ ] **BOOKMARK-01**: 读取 chrome.bookmarks 作为第三数据源，域名分组中独立标记
- [ ] **BOOKMARK-02**: 支持"Tab 转书签"和"从书签打开"

### 固定/置顶

- [ ] **PIN-01**: Tab 或域名分组可置顶，置顶项不参与"关闭所有"，状态持久化

### 会话自动快照

- [ ] **SNAPSHOT-01**: 每天/每周自动对当前 Tab 创建隐藏快照，支持时间机器式回溯

### 全文检索增强

- [ ] **SEARCH-02**: 索引 title + OG description（不抓正文），通过 SW fetch 获取（需 host_permissions，按需申请）
- [ ] **SEARCH-03**: 支持拼音首字母搜索（pinyin-pro）

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### 跨浏览器

- **CROSS-01**: Edge 适配（Chromium 内核，基本兼容）
- **CROSS-02**: Firefox 适配（MV3 差异处理）
- **CROSS-03**: 多语言扩展（ja / ko / de / fr 等）

### 高阶

- **ADV-01**: 云同步（Chrome sync 或自建后端，可选）
- **ADV-02**: 付费 Pro 版（高级主题 / 无限快照 / 云同步）
- **ADV-03**: 网页截图云存储

## Out of Scope

| Feature | Reason |
|---------|--------|
| 团队协作/多人共享 | 本产品是单人工具，不做账号体系 |
| 抓取网页正文索引 | 隐私+性能风险，只索引 title+meta |
| 自动分类 AI | 分组规则全部确定性，不引入 ML |
| 广告/推荐 | 纯工具，不做内容平台 |
| 移动端 | Chrome/Edge 桌面为唯一目标 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| (To be filled by roadmap) | | |

**Coverage:**
- v1 requirements: 47 total
- Mapped to phases: 0
- Unmapped: 47 ⚠️

---
*Requirements defined: 2026-04-22*
*Last updated: 2026-04-22 after initial definition*
