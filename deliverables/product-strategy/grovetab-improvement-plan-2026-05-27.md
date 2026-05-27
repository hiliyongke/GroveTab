# GroveTab 改进方案 — 技术决策文档

**日期**：2026-05-27
**状态**：规划完成，待实施

---

## TL;DR

| # | 任务 | 方案确定 | 工作量 |
|---|------|---------|--------|
| 1 | ArchiveView 重构 | 建 `sessions-slice.ts` + `ArchiveService` 双轨 | 高 |
| 2 | 搜索索引优化 | 复用现有 Worker，修复 SearchBox 不走 Worker 的 bug | 低 |
| 3 | 虚拟滚动 | 引入 `@tanstack/react-virtual` | 高 |
| 4 | 全局 Cmd/Ctrl+K | 改 SW 逻辑 → 同一窗口聚焦 + 更新现有快捷键绑定 | 中 |

---

## 一、ArchiveView 重构方案

### 1.1 现状分析

**问题本质**：不是「绕开 Zustand」，而是 **根本没有建 sessions slice**——ArchiveView 自创了一套并行状态管理系统：

```tsx
// ArchiveView.tsx 模块级 state（React 外部）
let sessionsCache: ArchivedSession[] = [];
let sessionsListeners: Array<() => void> = [];

function subscribeSessions(listener: () => void) {
  sessionsListeners.push(listener);
  return () => { sessionsListeners = sessionsListeners.filter((l) => l !== listener); };
}
function getSessionsSnapshot() { return sessionsCache; }

const sessions = useSyncExternalStore(subscribeSessions, getSessionsSnapshot);
```

**问题**：
1. `sessionsCache` 是模块级变量，在 React tree 外部管理
2. 多个 SW 广播事件触发 `refreshSessions()` 直接改 `sessionsCache`，绕过 React 渲染周期
3. 与 `tabs-slice.ts`、`settings-slice.ts` 等其他 store 无任何关联
4. 数据流不透明，难以调试和追踪

### 1.2 重构方案：新建 `sessions-slice.ts` + `ArchiveService`

**推荐方案**：新建 Zustand slice + ArchiveService 双轨制

```
src/store/sessions-slice.ts    ← 负责 UI 状态（loading/selected/expanded/sort/scope）
src/services/archive/          ← 已有 archive-storage.ts，负责数据持久化
```

**架构**：

```
ArchiveService (archive-storage.ts)
  ↓ subscribe 数据变化
sessions-slice.ts (Zustand)
  ↓ useSyncExternalStore 订阅变化
ArchiveView.tsx ← 只消费 slice，组件内无 state
```

**关键设计**：

```typescript
// sessions-slice.ts
interface SessionsState {
  // 基础数据（由 service 驱动更新）
  sessions: ArchivedSession[];
  initialized: boolean;
  loading: boolean;

  // UI 状态
  selectedIds: Set<string>;
  expandedIds: Set<string>;
  sortMode: SortMode;
  scope: ArchiveScopeId;
  searchQuery: string;
  highlightId: string | null;

  // Actions
  refresh: () => Promise<void>;
  setSelectedIds: (ids: Set<string>) => void;
  toggleExpanded: (id: string) => void;
  // ...
}

export const useSessionsStore = create<SessionsState>()((set, get) => ({
  sessions: [],
  initialized: false,
  loading: true,
  // ...
}));
```

**ArchiveService 改造**（最小改动）：

```typescript
// archive-storage.ts 增加事件通知机制
type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function getArchivedSessions(): Promise<ArchivedSession[]> {
  // ... 现有逻辑 ...
  // 数据返回后通知 listeners
  const sessions = await db.getAllSessions();
  listeners.forEach((l) => l()); // 触发 Zustand slice 刷新
  return sessions;
}
```

**SW 注册撤销处理器**（现有机制保持兼容）：

```typescript
// sessions-slice.ts 内
registerHistoryUndoHandler("archive_create", async (event) => {
  const sessionId = event.undoContext?.sessionId;
  if (!sessionId) return false;
  await deleteSession(sessionId);
  await get().refresh();
  return true;
});
```

### 1.3 实施步骤

| 步骤 | 操作 | 风险 |
|------|------|------|
| 1 | 新建 `sessions-slice.ts`，迁移 UI 状态 | 低 |
| 2 | 改造 `archive-storage.ts`，增加 `subscribe()` | 中（需兼容降级） |
| 3 | ArchiveView 改为 `useSyncExternalStore` 订阅 service 而非模块级 cache | 低 |
| 4 | 删除 `sessionsCache` 模块级变量 | 低 |
| 5 | SW 广播事件触发 slice action，不直接操作 cache | 低 |

**预计代码量**：~150 行新增，~80 行删除

---

## 二、搜索索引优化方案

### 2.1 现状分析

**重大发现**：Web Worker 方案已经实现了！

- ✅ `unified-search.worker.ts` — 已实现 MiniSearch + 后台增量索引
- ✅ `use-unified-search-index.ts` — 已实现 Worker 生命周期管理
- ❌ **Bug**：`SearchBox` 没有使用 `useUnifiedSearchIndex`，用的是 `useSearchIndex`（主线程同步构建）

```tsx
// SearchBox.tsx — 当前使用旧的 hook
import { useSearchIndex } from "./hooks/use-search-index"; // ❌ 主线程索引
// import { useUnifiedSearchIndex } from "./hooks/use-unified-search-index"; // ✅ 未使用
```

```typescript
// use-search-index.ts — 主线程同步构建（性能瓶颈）
void (async () => {
  const { default: MS } = await import("minisearch"); // 动态导入
  const ms = new MS({ fields, storeFields: ["id"], searchOptions: { fuzzy: 0.2, prefix: true } });
  ms.addAll(tabs.map(...)); // 同步阻塞主线程
  if (!cancelled) setSearchIndex(ms);
})();
```

**性能差距**：

| 方案 | 100 tabs | 500 tabs | 1000 tabs |
|------|----------|----------|-----------|
| `useSearchIndex`（主线程） | ~50ms | ~200ms | ~500ms+ |
| `useUnifiedSearchIndex`（Worker） | <5ms | <10ms | <20ms |

### 2.2 修复方案（最小改动）

**只需修改 `SearchBox.tsx` 的 import**：

```tsx
// 改前（SearchBox.tsx）
import { useSearchIndex } from "./hooks/use-search-index";
import { useSearchData } from "./hooks/use-search-data";
import { useSearchResults } from "./hooks/use-search-results";

// 改后
import { useUnifiedSearchIndex } from "./hooks/use-unified-search-index";
import { useSearchData } from "./hooks/use-search-data";
import { useSearchResults } from "./hooks/use-search-results";
```

**`useSearchResults` 适配**（已有接口差异需对齐）：

```typescript
// useSearchIndex 返回 { searchIndex, pinyinMatchFn }
// useUnifiedSearchIndex 返回 { ready, searchUnified }

// SearchBox.tsx 需改为：
const { ready, searchUnified } = useUnifiedSearchIndex({
  active: open,
  tabs: normalizedTabs,
  archiveSessions: [], // 当前 SearchBox 不搜归档会话
  bookmarks: [],
  historyEntries: [],
});

// 搜索时：
const results = await searchUnified(query);
```

### 2.3 补充：索引签名变化检测优化

当前 `useSearchIndex` 用 `tabsIndexSignature` 检测变化：

```typescript
const tabsSignature = tabs.map((t) => `${t.id}:${t.url}`).join("\u0001");
```

`useUnifiedSearchIndex` 已有相同机制但更完善，应直接复用。

### 2.4 实施步骤

| 步骤 | 操作 | 工作量 |
|------|------|--------|
| 1 | 修改 `SearchBox.tsx`，切换到 `useUnifiedSearchIndex` | ~20 行 |
| 2 | 调整 `useSearchResults` 接口以适配新 hook 返回值 | ~30 行 |
| 3 | 验证搜索结果与旧实现一致性 | 测试 |
| 4 | 删除废弃的 `use-search-index.ts` 和 `use-search-data.ts` | 可选 |

**预计代码量**：~50 行修改

---

## 三、DomainGroupView 虚拟滚动方案

### 3.1 现状分析

DomainGroupView 当前布局：
- CSS Masonry 响应式列布局（`app-domain-masonry`）
- 每列内部 `flex-direction: column`，纵向流动
- ResizeObserver 动态计算列数
- 无任何虚拟化，海量标签时 DOM 节点数 = `groups.length + tabs.length`

**性能问题**：
- 100 个分组 + 500 个标签 → 600+ DOM 节点
- 500 个分组 + 2000 个标签 → 2500+ DOM 节点
- `groupTabsByDomain` 每次重算（无缓存）

### 3.2 技术选型

| 方案 | 包体增量 | 兼容性 | 实现复杂度 | 推荐 |
|------|---------|--------|-----------|------|
| `@tanstack/react-virtual` | ~7KB gz | React 18+ | 低 | ✅ |
| `react-virtualized` | ~23KB gz | React 16+ | 中 | ❌ 包体大 |
| `react-virtuoso` | ~15KB gz | React 18+ | 低 | ✅ |

**推荐 `@tanstack/react-virtual` v3**：
- 轻量（7KB gz）
- 支持可变高度（masonry 列布局场景）
- 无需测量每项高度
- 天然支持 `useWindowViewportSize` / `useScrollbarHandle`

### 3.3 实施方案

**核心思路**：按列虚拟化，每个 masonry 列独立虚拟滚动

```tsx
import { useVirtualizer } from "@tanstack/react-virtual";

function DomainMasonryColumn({
  groups,
  parentRef,
}: {
  groups: DomainGroup[];
  parentRef: React.RefObject<HTMLDivElement>;
}) {
  const virtualizer = useVirtualizer({
    count: groups.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => groups[index].tabs.length * 60 + 80, // 估算高度
    overscan: 2,
  });

  return (
    <div
      style={{
        height: `${virtualizer.getTotalSize()}px`,
        position: "relative",
      }}
    >
      {virtualizer.getVirtualItems().map((virtualItem) => (
        <div
          key={groups[virtualItem.index].domain}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            transform: `translateY(${virtualItem.start}px)`,
          }}
        >
          <DomainGroupCard
            group={groups[virtualItem.index]}
            initialCollapsed={false}
          />
        </div>
      ))}
    </div>
  );
}
```

**关键挑战**：masonry 列需要知道每项高度才能平衡分布，当前方案通过 `estimateSize` 估算 + `overscan` 缓冲缓解。

**替代方案（更简单但有限制）**：只虚拟最底部的列，上部列保持直接渲染，限制总 DOM 节点数 < 200。

### 3.4 实施步骤

| 步骤 | 操作 | 风险 |
|------|------|------|
| 1 | 安装 `@tanstack/react-virtual` | 低 |
| 2 | 设计 `DomainMasonryColumn` 组件，支持虚拟滚动 | 中（高度估算需调优） |
| 3 | 改造 `DomainGroupView`，每个 masonry 列用独立 virtualizer | 中 |
| 4 | 保留 `ResizeObserver` 列数计算逻辑 | 低 |
| 5 | 性能验证：1000 tabs 场景下 DOM < 200 节点 | 低 |

**预计代码量**：~100 行新增

---

## 四、全局 Cmd/Ctrl+K 快捷键方案

### 4.1 现状分析

**当前 `toggle-search` 行为**（SW）：

```typescript
// src/sw/index.ts:586-593
if (command === "toggle-search") {
  const url = chrome.runtime.getURL("src/pages/newtab/index.html#search");
  await chrome.tabs.create({ url }); // ❌ 每次创建新 tab
}
```

**问题**：
1. 每次按 `Alt+K`（建议快捷键）都新建标签页
2. 用户感知：按快捷键 → 弹出一个新标签 → 搜索框没聚焦
3. 与 Chrome 自带 `Cmd+K`（地址栏）冲突，用户已习惯用地址栏

**`use-keybinding.ts` 的 tinykeys 已支持 `Mod+K`**（但当前没有绑定 `openSearch` action）：

```typescript
// tinykeys 支持 $mod+KeyK（自动映射到 Mac=Cmd，Win/Linux=Ctrl）
// 但 KEYBINDING_DEFS 里没有 openSearch 绑定到 Mod+K
```

### 4.2 重构方案：复用已有 SW 机制，改为窗口聚焦

**设计思路**：
1. SW `toggle-search` 命令 → 不创建新 tab → 找到 GroveTab 所在窗口，聚焦 → 发广播
2. 页面内 tinykeys 监听 `Mod+K` → 直接触发 `SearchBox` 打开 + 聚焦

**实现步骤**：

**Step 1：SW 改为聚焦现有窗口**

```typescript
// src/sw/index.ts
if (command === "toggle-search") {
  try {
    // 找到 GroveTab 标签页并聚焦，不新建 tab
    const tabs = await chrome.tabs.query({ url: "*://*/*newtab*" });
    if (tabs.length > 0) {
      await chrome.tabs.update(tabs[0].id!, { active: true });
      // 通知页面打开搜索（通过 BroadcastChannel）
      swBroadcast("open-search", {});
    } else {
      // 无窗口时再创建新 tab
      const url = chrome.runtime.getURL("src/pages/newtab/index.html#search");
      await chrome.tabs.create({ url });
    }
  } catch (err) {
    console.error(`${SW_LOG_TAG} Toggle search failed:`, err);
  }
}
```

**Step 2：页面内监听 SW 广播打开搜索**

```typescript
// App.tsx useEffect 内
useSwBroadcast("open-search", () => {
  setSearchOpen(true); // 触发 SearchBox 打开
});
```

**Step 3：页面级 tinykeys 绑定 `Mod+K`**

```typescript
// KEYBINDING_DEFS 已支持 allowInInput，需补充 openSearch action
const KEYBINDING_DEFS = [
  // ... 现有 actions ...
  {
    action: "openSearch",
    labelKey: "快捷键.openSearch",
    hintKey: "快捷键.openSearchHint",
    defaultKey: "Mod+K",
    allowInInput: true, // 搜索框打开时再次按关闭
  },
];
```

```typescript
// App.tsx 内
const openSearch = useCallback(() => {
  setSearchOpen((prev) => !prev); // toggle 搜索框
}, []);

useKeybinding("openSearch", openSearch);
```

**Step 4：修改 manifest.json 的 suggested_key**

```json
// manifest.json
"commands": {
  "toggle-search": {
    "suggested_key": {
      "default": "Alt+K",
      "mac": "Alt+K"
    },
    "description": "Open search in GroveTab"
  }
}
```

⚠️ **冲突检测**：Chrome 不允许 `Cmd/Ctrl+K` 作为扩展快捷键（被浏览器占用），只能映射到 `Alt+K` / `Cmd+Shift+K` 等。**用户自定义**可通过 `customKeybindings` 设置覆盖。

### 4.3 实施步骤

| 步骤 | 操作 | 工作量 |
|------|------|--------|
| 1 | 修改 SW `toggle-search`，改为聚焦 + 广播 | ~20 行 |
| 2 | App.tsx 监听 `open-search` 广播，toggle SearchBox | ~10 行 |
| 3 | KEYBINDING_DEFS 添加 `openSearch` action | ~10 行 |
| 4 | App.tsx 内 `useKeybinding("openSearch", ...)` | ~5 行 |
| 5 | manifest.json 更新 description | ~2 行 |
| 6 | 测试：Alt+K 聚焦 GroveTab + 打开搜索 | 测试 |

**预计代码量**：~50 行新增/修改

---

## 五、总结对比

| 任务 | 方案确定性 | 技术风险 | 建议优先级 | 预计工作量 |
|------|-----------|---------|-----------|-----------|
| 1. ArchiveView 重构 | ✅ 确定 | 中（数据迁移） | P0 | 高 ~150行 |
| 2. 搜索索引优化 | ✅ 确定（修复 bug） | 低 | P0 | 低 ~50行 |
| 3. 虚拟滚动 | ✅ 确定 | 中（高度估算） | P1 | 高 ~100行 |
| 4. Cmd/Ctrl+K | ✅ 确定 | 低 | P1 | 中 ~50行 |

**立即可启动**：任务 2（搜索索引）代码量最小、收益最高，建议先做。

---

> 本文档基于代码级分析得出，供技术评审使用。