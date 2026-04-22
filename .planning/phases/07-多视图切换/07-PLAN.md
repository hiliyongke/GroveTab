# Phase 7 PLAN — 多视图切换

**Created:** 2026-04-22

## Wave 1: 基础设施 + 视图切换器 + viewMode state

### Task 1: viewMode slice
- 在 store 中新增 `viewMode` 状态: `'domain' | 'timeline' | 'compact' | 'grid' | 'frequency'`
- 持久化到 chrome.storage.local
- `setViewMode` action

### Task 2: ViewSwitcher 组件
- 顶栏图标组: 5 个图标按钮 (LayoutGrid/List/Clock/Grid3x3/TrendingUp)
- 当前选中高亮
- aria-label + tooltip

### Task 3: App 集成
- Header 中嵌入 ViewSwitcher
- AppContent 根据 viewMode 渲染对应视图组件
- 域名分组视图作为默认

## Wave 2: 时间轴 + 紧凑列表

### Task 4: TimelineView
- 按 lastAccessed 降序排列 tabs
- 分段: 今天/昨天/本周/更早
- 每段可折叠
- 使用 TabItem 组件

### Task 5: CompactView
- 一行一 Tab (favicon + title + domain + badges)
- @tanstack/react-virtual 虚拟滚动
- 固定行高 40px

## Wave 3: 网格视图 + 频率视图 + SW StatsCollector

### Task 6: GridView
- 大卡片: favicon/域名色块 + title + domain + tab count badge
- 响应式网格 (2/3/4 列)
- 域名色块: domain 字符串 hash → HSL 色值

### Task 7: SW StatsCollector
- SW 监听 onActivated → 防抖计数写入 storage
- 数据结构: `{ url: { activations: number, lastActivatedAt: number } }`
- 启动时校正: App 加载时用 chrome.tabs.query 更新

### Task 8: FrequencyView
- 按 7 天激活次数降序
- Top 30 显示
- 每条显示: favicon + title + 激活次数 badge + 最近访问时间
