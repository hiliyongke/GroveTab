# GroveTab 项目记忆

## 当前版本：1.3.0

## 近期动态（2026-05-27）

### GroveTab 产品分析 & 改进规划

#### 已完成改进

1. **搜索索引修复（高优先级 ✅）**
   - 问题：SearchBox 使用 useSearchIndex（主线程同步构建），每次打开卡 200-500ms
   - 发现：已有 `unified-search.worker.ts`（Web Worker 实现）+ `use-unified-search-index.ts`
   - 修复：新建 `use-search-bridge.ts`，将 Worker 异步结果适配为同步接口给 `useSearchResults`
   - 改动：SearchBox 第 34 行 import 切换，约 50 行适配代码

2. **全局 Cmd/Ctrl+K 快捷键（高优先级 ✅）**
   - 问题：SW 的 toggle-search 每次创建新 tab，体验差
   - 修复：
     - manifest.json: `"Command+K"` for macOS（Alt+K 保留给 Windows/Linux）
     - SW index.ts: 先查找已打开的 GroveTab 窗口 → 聚焦 → 发 `toggle-search` 消息
     - App.tsx: 新增 `toggle-search` 消息监听

3. **ArchiveView 重构（P1 ✅）**
   - 问题：ArchiveView 使用 `useSyncExternalStore` + 模块级 cache，绕开 Zustand
   - 修复：新建 `store/sessions-slice.ts`（Zustand）+ `useSessionsStore`
   - ArchiveView 全部改用 `useSessionsStore` 订阅
   - 删除了模块级 sessionsCache/listeners，删除了 registerHistoryUndoHandler

4. **DomainGroupView 虚拟滚动（P1 ✅）**
   - 问题：DomainGroupView 无虚拟滚动，500+ 标签时 DOM 超 2000+ 节点
   - 修复：引入 `@tanstack/react-virtual`，超过 20 个分组时启用
   - 每列独立虚拟化，`measureElement` 实时更新折叠/展开高度

#### 技术笔记

- `@tanstack/react-virtual` 3.13.24 已安装（package.json）
- `useUnifiedSearchIndex` 的 Worker `ready` 信号表示索引已构建完成可搜索
- sessions-slice 的 `refreshSessions` 可被 undo-bus 的 `archive_create` 事件触发
- VirtualColumn 组件的 `useVirtualizer` 需要稳定的列数组引用（由 DomainGroupView 提供）

## 踩坑经验

（以下由 AI 在实际调用中自动积累，请勿手动删除）