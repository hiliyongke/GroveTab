# 反馈三态语义规范

**版本**：v1.0
**日期**：2026-05-29
**关联清单**：UX-P0-08

---

## 1. 三态定义

| 类型 | 组件 | 持续时间 | 用途 | z-index |
|---|---|---|---|---|
| **持久状态** | StatusBar | 直到被主动清除 | 整理建议、选择模式、降级提示 | 1000 |
| **瞬时反馈** | Toast（feedback.xxx） | 3-5s 自动消失 | 操作成功/失败、UndoToast | 1100 |
| **阻塞确认** | Modal.confirm | 用户响应前不消失 | 删除确认、危险操作 | 1200 |

---

## 2. 使用规则

### 2.1 持久状态 → StatusBar

```ts
import { useStatusBarStore } from "@/shared/store/status-bar-slice";

// 推入消息
useStatusBarStore.getState().pushMessage({
  content: "12 个待整理标签页",
  type: "warning",
  action: { label: "一键整理", onClick: handleTidy },
});

// 移除消息
useStatusBarStore.getState().removeMessage(id);
```

**场景**：
- 选择模式提示（"已选 N 个标签"）
- 整理建议（"N 个待整理"）
- 降级提示（"初始化失败，使用缓存模式"）
- 任何需要用户主动操作才能消除的状态

### 2.2 瞬时反馈 → Toast

```ts
// ✅ 正确：通过 feedback 桥
import { feedback } from "@/shared/ui/feedback";
feedback.success("已保存模板");
feedback.error("操作失败，请重试");

// ❌ 禁止：直接使用 antd message
import { message } from "antd";
message.success("..."); // 不允许
```

**场景**：
- 操作成功/失败反馈（保存、删除、归档等）
- UndoToast（"已关闭 N 个标签 [撤销]"）
- 复制链接成功等轻量反馈

### 2.3 阻塞确认 → Modal

```ts
import { feedback } from "@/shared/ui/feedback";
feedback.modal.confirm({
  title: "确认删除",
  content: "此操作不可恢复",
  okText: "删除",
  okType: "danger",
  onOk: async () => { /* 执行删除 */ },
});
```

**场景**：
- 批量删除确认
- 恢复出厂设置确认
- 任何不可逆操作

---

## 3. 代码示例

### React 组件内使用 feedback

```tsx
import { feedback } from "@/shared/ui/feedback";

function MyComponent() {
  const handleSave = async () => {
    try {
      await saveData();
      feedback.success("保存成功");
    } catch (err) {
      feedback.error("保存失败", err);
    }
  };
}
```

### Store / 非 React 代码使用 feedback

```ts
// Zustand store action 中
import { feedback } from "@/shared/ui/feedback";

export const useTabsStore = create((set, get) => ({
  closeTab: async (id) => {
    try {
      await chrome.tabs.remove(id);
      feedback.success("标签已关闭");
    } catch (err) {
      feedback.error("关闭标签失败", err);
    }
  },
}));
```

---

## 4. 迁移规则

| 旧写法 | 新写法 |
|---|---|
| `message.success(x)` | `feedback.success(x)` |
| `message.error(x)` | `feedback.error(x)` |
| `message.warning(x)` | `feedback.warning(x)` |
| `message.info(x)` | `feedback.info(x)` |
| `Modal.confirm({...})` | `feedback.modal.confirm({...})` |

**禁止**：`import { message } from 'antd'` 直接使用（React 组件内应通过 `App.useApp()` 或 `feedback` 桥）

---

## 5. 约束

- StatusBar 同时只显示 1 条消息，多余的排队
- ToastQueue 最多 3 个堆叠
- 持久状态和瞬时反馈不能互换（不要用 Toast 显示需要用户操作的状态）
