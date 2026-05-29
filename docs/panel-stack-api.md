# GroveTab PanelStack API 文档

**版本**：v1.0
**日期**：2026-05-29
**配套**：`src/shared/panels/panel-stack-store.ts` / `use-panel-stack.ts`

---

## 1. 概述

PanelStack 是面板栈管理模块，替代了原来的 6 个独立 `useState`（showSearch / showSettings / showInsights / showHistory / showTrash / showArchive），统一为栈结构管理，支持嵌套面板和 ESC 逐级返回。

---

## 2. PanelDescriptor 结构

```typescript
interface PanelDescriptor {
  /** 面板 ID */
  id: PanelId;
  /** 子面板 ID（如 settings 的 about/appearance 子页） */
  subId?: string;
  /** 上下文数据（如搜索面板的初始查询） */
  context?: Record<string, unknown>;
}
```

### 合法 PanelId

| PanelId | 含义 | 对应面板 |
|---------|------|----------|
| `search` | 搜索 | SearchPanel |
| `settings` | 设置 | SettingsPanel |
| `insights` | 洞察 | InsightsPanel |
| `history` | 历史 | HistoryPanel |
| `trash` | 回收站 | TrashView |
| `archive` | 归档 | ArchiveView |
| `commandPalette` | 命令面板 | CommandPalette |

---

## 3. Store API

### 3.1 Zustand Store (`panel-stack-store.ts`)

```typescript
import { usePanelStackStore } from "@/shared/panels/panel-stack-store";

// 读取状态
const stack = usePanelStackStore((s) => s.stack);
const currentTop = usePanelStackStore((s) => s.currentTop);

// 操作
const { push, pop, replace, clear, close } = usePanelStackStore.getState();
```

#### 操作说明

| 方法 | 签名 | 说明 |
|------|------|------|
| `push` | `(panel: PanelDescriptor) => void` | 压入面板到栈顶 |
| `pop` | `() => void` | 弹出栈顶面板（返回上一级） |
| `replace` | `(panel: PanelDescriptor) => void` | 替换栈顶面板 |
| `clear` | `() => void` | 清空整个栈 |
| `close` | `(panelId: PanelId) => void` | 关闭指定面板（从栈中移除） |

---

## 4. React Hook API (`use-panel-stack.ts`)

```typescript
import { usePanelStack } from "@/shared/panels/use-panel-stack";

function MyComponent() {
  const panelStack = usePanelStack();

  // 便捷方法
  panelStack.openSearch();
  panelStack.openSettings("appearance");
  panelStack.openInsights();
  panelStack.openHistory();
  panelStack.openTrash();
  panelStack.openCommandPalette();
}
```

### 便捷方法

| 方法 | 等价于 |
|------|--------|
| `openSearch()` | `push({ id: "search" })` |
| `openSettings(subId?)` | `push({ id: "settings", subId })` |
| `openInsights()` | `push({ id: "insights" })` |
| `openHistory()` | `push({ id: "history" })` |
| `openTrash()` | `push({ id: "trash" })` |
| `openCommandPalette()` | `push({ id: "commandPalette" })` |

---

## 5. ESC 收敛机制

ESC 键全局监听逻辑（在 `use-panel-stack.ts` 中注册）：

1. **栈非空** → `pop()` 弹出栈顶面板
2. **栈空 + 有 Modal** → Modal 自行处理关闭
3. **栈空 + 无 Modal** → 无操作

嵌套面板场景（如 Settings → Shortcuts）：
- ESC 逐级返回上一级面板（而非一次性关闭所有面板）
- 每次按 ESC 仅 `pop()` 一次

---

## 6. 与 URL Hash 的同步

- PanelStack 的 `push/pop/replace/clear` 操作会触发 URL Hash 更新
- URL 变更（如浏览器前进/后退）会同步到 PanelStack
- 双向同步通过 `use-url-sync.ts` 中的 subscribe 回调实现
- URL Hash 仅记录当前最顶层面板（不记录完整栈）

---

## 7. 使用约束

1. **面板唯一性**：同一 PanelId 在栈中仅出现一次（`push` 时会检查是否已存在）
2. **栈深度限制**：最大深度 10 层，超出时自动 `pop` 底层
3. **命令面板特殊处理**：`commandPalette` 在 `pop` 后会自动清空搜索查询

---

## 8. 单测覆盖

- `tests/unit/panel-stack.test.ts`：21 用例，覆盖 push/pop/replace/clear/ESC/唯一性/深度限制
