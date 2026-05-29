# GroveTab URL Hash 路由协议

**版本**：v1.0
**日期**：2026-05-29
**配套**：`src/shared/routing/hash-router.ts` / `use-url-sync.ts` / `route-telemetry.ts`

---

## 1. 路由规范

### 1.1 URL 格式

```
#/space/{spaceId}[/view/{viewId}][/panel/{panelId}[/{subId}]]
```

### 1.2 示例

| URL | 含义 |
|-----|------|
| `#/space/workspace` | 主工作区（默认） |
| `#/space/workspace/view/timeline` | 工作区 + 时间线视图 |
| `#/space/workspace/panel/settings` | 工作区 + 设置面板 |
| `#/space/workspace/view/tabs/panel/search` | 工作区 + tabs 视图 + 搜索面板 |
| `#/space/workspace/panel/settings/about` | 工作区 + 设置面板（关于子页） |
| `#/space/trending` | 发现页 |
| `#/space/devtools` | 开发者工具 |

### 1.3 合法值

| 层级 | 合法值 |
|------|--------|
| **spaceId** | `workspace` / `trending` / `devtools` |
| **viewId** | `tabs` / `timeline` / `tabgroup` / `window` / `kanban` / `frequency` / `archive` |
| **panelId** | `search` / `settings` / `insights` / `history` / `trash` / `archive` / `commandPalette` |
| **subId** | 任意字符串（如 settings 的 `about` / `appearance` / `behavior` / `system`） |

---

## 2. RouteDescriptor 结构

```typescript
interface RouteDescriptor {
  /** 空间 ID */
  spaceId: string;
  /** 视图 ID（可选） */
  viewId?: ViewMode;
  /** 面板 ID（可选） */
  panelId?: string;
  /** 面板子 ID（可选） */
  subId?: string;
}
```

---

## 3. 旧版 Hash 兼容

| 旧版 Hash | 映射到 |
|-----------|--------|
| `#settings` | `#/space/workspace/panel/settings` |
| `#about` | `#/space/workspace/panel/settings/about` |
| `#search` | `#/space/workspace/panel/search` |

迁移逻辑在 `hash-router.ts` 的 `LEGACY_HASH_MAP` 中定义，dev mode 输出 console.info 日志。

---

## 4. 核心 API

### 4.1 HashRouter（单例）

```typescript
import { getRouter } from "@/shared/routing";

const router = getRouter();

// 启动/停止 hashchange 监听
router.start();
router.stop();

// 获取当前路由
router.getRoute(); // RouteDescriptor

// 程序化导航
router.navigate({ viewId: "timeline" });
router.navigate({ panelId: "settings" }, { replace: true });

// 订阅路由变更
const unsubscribe = router.subscribe((event) => {
  console.log(event.route, event.previous, event.source);
});
unsubscribe(); // 清理
```

### 4.2 useUrlSync（React Hook）

```typescript
import { useUrlSync } from "@/shared/routing";

function MyComponent() {
  const { route, navigate, switchView, switchSpace, openPanel, closePanel } = useUrlSync();

  // route.spaceId, route.viewId, route.panelId, route.subId
  // 切换视图
  switchView("timeline");

  // 切换空间
  switchSpace("trending");

  // 打开/关闭面板
  openPanel("settings", "appearance");
  closePanel();
}
```

### 4.3 路由埋点

```typescript
import { getRouteStats, clearRouteStats } from "@/shared/routing/route-telemetry";

// 获取统计（异步）
const stats = await getRouteStats();

// 清除统计
await clearRouteStats();
```

- **Dev mode**：路由变更自动输出 `console.info`
- **Prod mode**：路由变更自动写入 `chrome.storage.local`

---

## 5. 与 PanelStack 的关系

- URL Hash 仅记录当前路由状态（最顶层面板）
- PanelStack 维护面板栈（支持嵌套面板 ESC 逐级返回）
- 两者通过 `use-url-sync.ts` 双向同步
- PanelStack 的 `push/pop/replace` 操作会同步更新 URL

---

## 6. 设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 路由方案 | URL Hash（非 History API） | Chrome 扩展 newtab 页面不支持 History API |
| 默认空间 | `workspace` | 主工作区是 90%+ 用户的核心场景 |
| 旧版兼容 | 首次启动自动迁移 | 避免硬破坏老用户书签深链 |
| 埋点存储 | chrome.storage.local | 不依赖外部服务，用户数据留在本地 |

---

## 7. 单测覆盖

- `tests/unit/hash-router.test.ts`：32 用例，覆盖解析/序列化/旧版兼容/导航
- `tests/unit/legacy-view-map.test.ts`：6 用例，覆盖旧视图迁移
