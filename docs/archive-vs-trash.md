# Archive vs Trash —— 分工与数据流

**版本**：v1.0
**日期**：2026-05-29
**配套**：`src/features/bookmarks/archive-operations.ts` / `src/features/sessions/TrashView.tsx`

---

## 1. 定位差异

| 维度 | Archive（归档） | Trash（回收站） |
|------|----------------|-----------------|
| **语义** | 主动整理——"我暂时不需要，但以后可能要" | 误删恢复——"我不小心删了，想找回来" |
| **触发** | 用户主动操作（右键 → 归档 / ⌘K → 归档） | 关闭标签 / 批量删除后的自动回收 |
| **数据源** | `chrome.bookmarks`（归档目录下的书签） | `chrome.sessions` / `tabs-slice.closedTabs` |
| **恢复方式** | 从归档视图中恢复到标签 | 从回收站中恢复到标签 |
| **保留期** | 永久（除非用户手动清除） | 30 天自动过期清理 |
| **数据结构** | 书签节点（title + url + dateAdded） | 闭标签记录（tab 对象 + closedAt） |
| **容量限制** | 无（bookmark 存储） | 最近 1000 条 |

---

## 2. 数据流

### 2.1 归档流程

```
标签页 → [用户操作：归档] → archiveTab(url, title)
  ├─ chrome.bookmarks.create → 归档目录
  ├─ chrome.tabs.remove → 关闭标签
  └─ tabs-slice.removeTab → 更新内存状态
```

### 2.2 恢复归档

```
归档视图 → [用户操作：恢复] → restoreFromArchive(bookmarkId)
  ├─ chrome.tabs.create → 打开标签
  ├─ chrome.bookmarks.remove → 删除归档书签
  └─ tabs-slice → 刷新标签列表
```

### 2.3 删除/回收站流程

```
标签页 → [关闭/删除] → closeTab(tabId)
  ├─ chrome.tabs.remove → 关闭标签
  ├─ tabs-slice.addClosedTab → 记录到回收站
  └─ 30 天后自动清理
```

### 2.4 恢复回收站

```
回收站 → [用户操作：恢复] → restoreTab(closedTab)
  ├─ chrome.tabs.create → 打开标签
  └─ tabs-slice.removeClosedTab → 从回收站移除
```

---

## 3. UI 入口映射

| 入口 | 归档 | 回收站 |
|------|------|--------|
| ViewDock | ✅ 一级视图（archive） | ❌ 无（不在 ViewDock） |
| AppHeader 溢出菜单 | ❌ 无 | ✅ Trash 入口 |
| CommandPalette | `panel.openArchive` | `panel.openTrash` |
| 右键菜单 | "归档标签" | ❌ 无 |
| ESC 关闭 | ✅ PanelStack pop | ✅ PanelStack pop |
| URL 路由 | `#/space/workspace/panel/archive` | `#/space/workspace/panel/trash` |

---

## 4. 共享基础

两者共享以下基础设施：

- **PanelStack**：归档和回收站都是面板，支持 ESC 逐级返回
- **URL Hash 路由**：均可通过深链直达
- **feedback 模块**：操作反馈统一走 `feedback.success/error`
- **CommandPalette**：均可通过 ⌘K 搜索打开

---

## 5. 未来优化方向

- **P1-26**：建立统一的数据流层，减少重复的 chrome API 调用
- **归档模板**：将归档的标签组保存为模板，一键恢复工作区
- **回收站合并**：同一 URL 的多次删除合并为一条记录
