# GroveTab 快捷键清单

**版本**：v1.0
**日期**：2026-05-29
**关联清单**：UX-P0-13

---

## 页面内快捷键

| 快捷键 | 动作 | 说明 |
|---|---|---|
| `⌘K` / `Ctrl+K` | 打开搜索 | 搜索标签页 + 打开命令面板 |
| `⌘P` / `Ctrl+P` | 命令面板 | 全局命令发现入口 |
| `⌘⇧H` / `Ctrl+Shift+H` | 打开历史 | 浏览历史面板 |
| `Escape` | 退出选择/关闭面板 | 多级面板逐级返回 |
| `⌘A` / `Ctrl+A` | 全选标签 | 选择模式下全选当前标签 |

---

## Chrome 全局快捷键（manifest.json）

| 快捷键 | 动作 | 可自定义 |
|---|---|---|
| `Alt+C` | 打开搜索（全局） | ✅ chrome://extensions/shortcuts |
| `Alt+Shift+S` | 打开设置 | ✅ |
| `Alt+K` | 打开命令面板 | ✅ |

---

## 自定义方式

1. **页面内快捷键**：设置 → 行为 → 快捷键
2. **全局快捷键**：chrome://extensions/shortcuts → GroveTab

---

## 注册中心

所有快捷键在 `src/shared/shortcuts/registry.ts` 统一维护。
新增快捷键只需在 `src/shared/config/keybindings.ts` 的 `KEYBINDING_DEFS` 数组中添加一条定义。

Dev mode 下自动检测快捷键冲突，冲突时 console 输出告警。
