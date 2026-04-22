# Phase 04 · 执行计划

## 总策略：**保签名，换实现**

`@/shared/ui` 的 import 路径和导出名保持不变，内部实现从 Radix+Tailwind 切换到 antd。这样 features 层理论上不需要 import 改动，只有 className 清理。

---

## Wave 1 · 环境搭建（0.5d）

**W1.1** 依赖安装与清理

```bash
pnpm add antd @ant-design/icons
pnpm remove @radix-ui/react-dialog @radix-ui/react-tooltip @radix-ui/react-slot \
            class-variance-authority tailwind-merge \
            tailwindcss @tailwindcss/vite
```

**W1.2** 全局 Provider 改造

- 新建 `src/shared/ui/AntdThemeProvider.tsx`：包一层 `ConfigProvider`，token 走 `docs/ui-mock/tokens.md`
- `ThemeProvider.tsx` 保留暗色侦测能力，但把产出的 `data-theme` 桥接到 antd 的 `algorithm: darkAlgorithm`
- App 根：`ThemeProvider > AntdThemeProvider > I18nProvider > GradientBackground > AppContent`

**W1.3** 全局样式重置

- 删除 `src/pages/newtab/index.css` 几乎全部 Tailwind 内容
- 保留：滚动条样式、selection、字体栈
- 引入 `antd/dist/reset.css`
- 废除 `tailwind.config`、`@tailwindcss/vite` 插件（vite.config.ts）

**验证**：`pnpm dev` 启动不报错，页面可打开（样式大面积错乱正常，进入 Wave 2 修复）。

---

## Wave 2 · 原子组件重写（1d）

按当前 primitives 清单，**一比一用 antd 轻封装**，保持 props 签名兼容。

| 文件                                     | 新实现                                                              |
| ---------------------------------------- | ------------------------------------------------------------------- |
| `primitives/Button.tsx`                  | `Button` 包 antd `Button`，映射 variant→`type`，size→`size`         |
| `primitives/IconButton.tsx`              | `<Button type="text" shape="circle" icon={...} />`                  |
| `primitives/Input.tsx`                   | antd `Input`                                                        |
| `primitives/Textarea.tsx`（新）          | antd `Input.TextArea`                                               |
| `primitives/Card.tsx`                    | antd `Card` variant=outlined                                        |
| `primitives/Badge.tsx`                   | antd `Tag`（保持 `style` 透传以支持自定义 bg）                      |
| `primitives/Dialog.tsx`                  | antd `Modal`（keep Radix-like props: open/onOpenChange/title/children） |
| `primitives/Tooltip.tsx`                 | antd `Tooltip`（`TooltipProvider` 变成空包装以保留兼容）            |
| `primitives/ScrollArea.tsx`              | 简单 div `overflow-auto` + 自定义滚动条样式（antd 无此组件）         |
| `primitives/Separator.tsx`               | antd `Divider`                                                      |
| `primitives/Kbd.tsx`                     | 保留纯 CSS 实现（简单 span）                                        |
| `index.ts`                               | 导出列表不变                                                        |

**验证**：`pnpm test`（vitest）基础通过；primitives 视觉稿与 `newtab.html` 对齐。

---

## Wave 3 · 高阶组件迁移（1d）

| 文件                                 | 迁移要点                                                      |
| ------------------------------------ | ------------------------------------------------------------- |
| `shared/ui/Header.tsx`               | antd `Layout.Header` + `Space` + `Button`，去 className       |
| `shared/ui/ViewSwitcher.tsx`         | antd `Segmented`                                              |
| `shared/ui/ThemeToggle.tsx`          | antd `Button` type="text" icon 切换                           |
| `shared/ui/UndoToast.tsx`            | 切换到 antd `message.useMessage()` 或 `notification`           |
| `shared/ui/GradientBackground.tsx`   | 仅保留背景 gradient 逻辑，去 className 类名                   |
| `shared/ui/GradientPicker.tsx`       | antd `Popover` + `Radio.Group` 预设                           |

---

## Wave 4 · features 层迁移（1.5d）

顺序由浅到深：

1. `features/sessions/OnboardingCard.tsx` → antd `Card` + `Space` + `Button`
2. `features/tabs/DedupInfoBar.tsx` → antd `Alert` + action 按钮
3. `features/tabs/TabItem.tsx` → `List.Item` + `Tag` + `Button`
4. `features/tabs/DomainGroupCard.tsx` → `Card` + 自定义 header
5. `features/tabs/DomainGroupView.tsx` → CSS columns 布局保留，内容用 DomainGroupCard
6. `features/tabs/TimelineView.tsx` → `Card` 分组 + `List`
7. `features/tabs/CompactView.tsx` → `Card` + `List` 紧凑密度
8. `features/tabs/GridView.tsx` → antd `Row/Col` + `Card` hoverable
9. `features/tabs/FrequencyView.tsx` → `Card` + `Progress`
10. `features/tabs/TabContextMenu.tsx` → antd `Dropdown` trigger=contextMenu
11. `features/search/SearchBox.tsx` → antd `Modal` + `Input` + 结果 `List`
12. `features/sessions/ArchivePanel.tsx` → antd `Drawer` + `List`
13. `features/settings/SettingsPanel.tsx` → antd `Drawer` + `Form` + `Switch`/`Select`/`Radio.Group`

---

## Wave 5 · 清理与验收（0.5d）

- 全局 grep `className=` 确认残余合理（只剩布局级的 style={{}} 或极少数）
- 全局 grep `tailwind`、`tw-` 彻底清零
- 删除 `src/pages/newtab/index.css` 无用部分，只保留滚动条与字体
- `pnpm build` 通过，扩展 `dist/` 可加载
- 在 Chrome 中实装测试：新标签页打开、搜索（⌘K）、各视图切换、暗色模式、归档、设置
- 打包体积对比报告（删 Tailwind + 加 antd 的净增）

---

## 风险清单

| 风险                         | 应对                                                           |
| ---------------------------- | -------------------------------------------------------------- |
| antd css-in-js 在扩展 CSP 下插 style 被拒 | 提前验证，必要时用 `@ant-design/cssinjs` 的 `StyleProvider hashPriority="high"` |
| 包体积暴涨（antd ~600KB gzip） | Vite tree-shaking + manualChunks，按需引入 icons              |
| ConfigProvider 切主题抖动     | 用 `theme.useToken()` + CSS variable 桥接，避免重挂组件        |
| i18n locale 对接              | `ConfigProvider locale={zhCN}`                                 |
| Motion 动画与 antd 内置动效冲突 | Motion 只用于页面级进出，组件级让 antd 自己处理                |

---

## 里程碑与交付节奏

```
D1 上午  Wave 1（环境）
D1 下午  Wave 2（primitives）开始
D2       Wave 2 完成 + Wave 3
D3       Wave 4 前半（简单组件）
D4       Wave 4 后半（Drawer/Modal/Form）
D5       Wave 5（清理 + 验收）
```

**每个 Wave 结束需要你过目一次**再推进下一波。
