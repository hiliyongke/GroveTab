# GroveTab Design System v1.3

> 本文档是 GroveTab 的设计规范源文件，涵盖 tokens、组件状态矩阵、可访问性标准与实现约定。
> 与评审报告联动：`deliverables/ui-design-review/2026-05-29-ui-design-review.md`

---

## 1. Design Tokens

### 1.1 Spacing（4px 基础单位）

| Token            | 值   | 用途                 |
| ---------------- | ---- | -------------------- |
| `--app-space-1`  | 4px  | 图标内边距、紧凑间隙 |
| `--app-space-2`  | 8px  | 卡片内小间隙         |
| `--app-space-3`  | 12px | 列表项间距           |
| `--app-space-4`  | 16px | 标准卡片内边距       |
| `--app-space-5`  | 20px | 中等区块间距         |
| `--app-space-6`  | 24px | 大区块间距           |
| `--app-space-7`  | 28px | 超大间距             |
| `--app-space-8`  | 32px | 页面级间距           |
| `--app-space-10` | 40px | 区域间距             |
| `--app-space-12` | 48px | 大区域间距           |
| `--app-space-16` | 64px | 最大间距             |

**密度缩放**：通过 `--app-density-scale`（compact=0.85 / default=1.0 / comfortable=1.15）自动缩放。

### 1.2 Typography

| Token                  | 值                     | 用途                 |
| ---------------------- | ---------------------- | -------------------- |
| `--app-font-size-xs`   | 11px                   | 标签、徽章、辅助文字 |
| `--app-font-size-sm`   | 12px                   | 次要信息、提示       |
| `--app-font-size-base` | 13px                   | 正文、卡片标题       |
| `--app-font-size-md`   | 14px                   | 标准正文             |
| `--app-font-size-lg`   | 16px                   | 小标题               |
| `--app-font-size-xl`   | 20px                   | 区域标题             |
| `--app-font-size-2xl`  | 24px                   | 大标题               |
| `--app-font-size-hero` | clamp(24px, 3vw, 38px) | Hero 标题            |

**字重规则**：

- 正文：400（常规）
- 强调/标签：500（Medium）
- 标题：600（Semi Bold）
- Hero 标题：700（Bold）
- **禁止非标准值**（如 760、650）

### 1.3 Color（语义层）

| 层级          | 变量名                      | 说明                     |
| ------------- | --------------------------- | ------------------------ |
| 页面背景      | `--app-page-bg`             | 最底层背景               |
| 容器背景      | `--app-surface-bg`          | 卡片、面板背景           |
| 浮层背景      | `--app-surface-elevated-bg` | Popover、Modal、Dropdown |
| 毛玻璃背景    | `--app-acrylic-bg`          | Hero、ViewDock、浮层     |
| Hover 背景    | `--app-bg-hover`            | 列表项悬停               |
| Active 背景   | `--app-bg-active`           | 按下态                   |
| Selected 背景 | `--app-bg-selected`         | 选中态                   |

**窗口色板**（单源对齐 Chrome ColorEnum）：
| 顺序 | 名称 | Hex | Chrome 对应 |
|------|------|-----|-------------|
| 1 | grey | #9aa0a6 | grey |
| 2 | blue | #4285f4 | blue |
| 3 | red | #ea4335 | red |
| 4 | yellow | #fbbc04 | yellow |
| 5 | green | #34a853 | green |
| 6 | pink | #ff63ed | pink |
| 7 | purple | #9334e6 | purple |
| 8 | cyan | #00b4d8 | cyan |

### 1.4 Radius

| Token               | 值    |
| ------------------- | ----- |
| `--app-radius-xs`   | 2px   |
| `--app-radius-sm`   | 4px   |
| `--app-radius-md`   | 8px   |
| `--app-radius-lg`   | 12px  |
| `--app-radius-pill` | 980px |

### 1.5 Shadow（4 级）

| 级别  | 变量名                    | 用途     |
| ----- | ------------------------- | -------- |
| sm    | `--app-shadow-sm`         | 细微抬升 |
| md    | `--app-shadow-md`         | 卡片默认 |
| lg    | `--app-shadow-card-hover` | 卡片悬停 |
| brand | `--app-shadow-brand-glow` | 主色发光 |

**Hero 搜索框约束**：

- 最多 2 层 shadow
- 禁止 backdrop-filter（Hero 区本身无复杂背景）
- 禁止 transform/scale hover（避免布局抖动）
- 交互反馈使用 border-color 变化

### 1.6 Motion

| Token                        | 值    | 用途            |
| ---------------------------- | ----- | --------------- |
| `--app-motion-duration-fast` | 150ms | hover、focus    |
| `--app-motion-duration`      | 300ms | 展开/折叠、切换 |
| `--app-motion-duration-slow` | 500ms | 页面过渡        |
| easing                       | ease  | 默认缓动        |

**Reduced Motion**：

- 用户设置 `reducedMotion: on` 或系统 `prefers-reduced-motion: reduce` 时，所有 duration 变为 `0s`
- 通过 `--app-motion-duration*` 变量统一控制

---

## 2. Component States（8 态矩阵）

所有交互组件必须覆盖以下 8 种状态：

| 状态     | 视觉表现                  | 实现方式                       |
| -------- | ------------------------- | ------------------------------ |
| Default  | 正常样式                  | 基础 class                     |
| Hover    | 背景/边框变化             | `:hover`                       |
| Active   | 按下态，颜色加深          | `:active`                      |
| Focus    | 聚焦环                    | `:focus-visible`               |
| Disabled | 置灰，cursor: not-allowed | `:disabled` 或 `aria-disabled` |
| Loading  | 骨架屏或 spinner          | `Spin` / `Skeleton`            |
| Error    | 红色边框/提示             | `status="error"`               |
| Empty    | 空状态插画+提示           | `Empty` 或 `FeatureEmptyState` |

### 2.1 Button（含 antd Button 覆盖）

```less
/* 全局 token 已覆盖，禁止 !important */
.app-button {
  /* 由 ConfigProvider.theme.components.Button 统一控制 */
}
```

**禁止**：在 CSS Module 中使用 `!important` 覆盖 antd Button 的 hover/active 样式。
**正确做法**：通过 `ConfigProvider.theme.components.Button.textHoverBg` 等 token 全局化。

### 2.2 IconButton（图标按钮）

- 最小触控目标：44×44px（WCAG 2.1）
- 必须有 `aria-label`
- focus-visible 使用 2px solid primary 环

### 2.3 Card（GroupCardShell）

- 身份色条通过 `--app-domain-card-bar` CSS 变量传递
- 窗口颜色通过 `data-accent-color` 属性（规划中）
- 折叠/展开必须有 `aria-expanded`

---

## 3. Accessibility Standards

### 3.1 WCAG 2.1 AA 合规

| 要求         | 实现                                                   |
| ------------ | ------------------------------------------------------ |
| 颜色对比度   | 正文 ≥ 4.5:1，大文字 ≥ 3:1                             |
| 聚焦环对比度 | 暗色主题使用 55% opacity primary（≥ 4.5:1 on #1f1f1f） |
| 触控目标     | 最小 44×44px                                           |
| 键盘导航     | 所有交互元素可通过 Tab 到达                            |
| 屏幕阅读器   | role、aria-label、aria-describedby 齐全                |

### 3.2 Focus Ring

```less
/* 亮色 */
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--app-color-primary) 35%, transparent);
}

/* 暗色 —— 提升对比度 */
[data-theme="dark"] :focus-visible {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--app-color-primary) 55%, transparent);
}
```

### 3.3 ARIA 约定

| 元素          | 必需属性                                    |
| ------------- | ------------------------------------------- |
| ViewDock item | `role="tab"`, `aria-selected`, `aria-label` |
| 折叠按钮      | `aria-expanded`                             |
| 图标按钮      | `aria-label`                                |
| 色板选择器    | `aria-label`（颜色名称）                    |
| Modal         | `aria-labelledby` 或 `aria-label`           |

---

## 4. Implementation Rules

### 4.1 禁止清单

| ❌ 禁止                                    | ✅ 替代                                            |
| ------------------------------------------ | -------------------------------------------------- |
| `style={{ fontSize: 13 }}`                 | CSS Module class                                   |
| `font-weight: 760`                         | `font-weight: 700`                                 |
| `!important` 覆盖 antd                     | ConfigProvider token                               |
| `transform: translateY(-2px) scale(1.006)` | `border-color` 变化                                |
| `backdrop-filter` in Hero                  | 简化背景层                                         |
| 16 色窗口色板                              | 8 色 Chrome 标准                                   |
| 原生 `<button>`                            | `Button type="text"`（已解决 flex 问题则可用原生） |
| `position: fixed` 隐藏锚点                 | `Modal` 或 `getPopupContainer`                     |

### 4.2 CSS Module 约定

```tsx
// ✅ 正确
import styles from "./Component.module.less";
<div className={styles["app-component-name"]} />

// ✅ 正确（多个 class）
<div className={`${styles["app-item"]} ${isActive ? styles["is-active"] : ""}`} />
```

### 4.3 动态样式

以下情况允许内联 style：

1. CSS 自定义变量注入（`--app-*`）
2. 动态颜色计算（`getStatusColor()`）
3. DnD transform（`CSS.Translate.toString()`）
4. antd 组件的 `styles` prop（如 Modal.body.padding）

---

## 5. View States（5 视图三态）

| 视图            | Empty 状态 | Loading 状态     | Error 状态 |
| --------------- | ---------- | ---------------- | ---------- |
| WindowView      | ✅ `Empty` | 无需（同步数据） | 无需       |
| DomainGroupView | ✅ `Empty` | 无需             | 无需       |
| TabGroupView    | ✅ `Empty` | 无需             | 无需       |
| CompactView     | ✅ `Empty` | 无需             | 无需       |
| KanbanView      | ✅ `Empty` | 无需             | 无需       |

---

## 6. Changelog

### v1.4.0 (2026-05-29)

- **质量门禁清零**：ESLint 0 errors（前 32→0）、Stylelint 0 problems、Knip 0 unused、i18n 0 缺失
- **孤儿模块清理**：删除 bookmarks 整包 + Window 增强（HealthIndicator / Timeline / TabThumbnailTooltip / DragOnboarding 等）共 18 个文件
- **antd v6 Button token 扩展**：补齐 `textTextHoverColor` / `textTextActiveColor` / `paddingBlockSM` / `paddingInlineSM`；Modal `paddingContentHorizontalLG` / `paddingMD`；新增 Drawer / Popover token
- **Token 体系补强**：新增 4 级 shadow token（`--app-shadow-0..3`）+ 3 档 motion token（`--app-motion-fast/base/slow`）+ `--app-easing-standard`
- **Hero 单层 shadow**：从两层（外阴影 + inset）改为 `var(--app-shadow-1)` 单层，与 Card 等重
- **Focus ring 现代化**：`outline: 2px solid + outline-offset: 2px`，暗色补 1px 内描边
- **Stylelint 规则口径重整**：浮层覆盖层 / newtab 全局架构 / module.less 三层差分豁免，从 2237 problems 收敛到 0
- **核心 Store 测试补强**：新增 metadata / stats / sessions / smart-sort 四套 slice 测试，共 61 用例（350 → 411）
- **键盘快捷键体系**：新增 `useGlobalShortcuts` hook，⌘1-7 切视图、Esc 逐级退出、输入框抑制、14 条单元测试
- **设置抽屉搜索**：SettingsShell 新增搜索框 + 命中过滤 + 空态提示
- **i18n 字典完整化**：新增/翻译 214 条英文，达成 1398 词条 0 缺失 0 未登记
- **pnpm 配置迁移**：`onlyBuiltDependencies` / `patchedDependencies` 从 `package.json` 迁到 `pnpm-workspace.yaml`
- **CI 工作流加固**：新增 Stylelint 与 i18n:check 步骤，lint 设 `--max-warnings=2100` 阻断回退

### v1.3.0 (2026-05-29)

- **Hero 搜索框视觉减重**：shadow 从 4 层压缩到 2 层，移除 backdrop-filter 和 transform
- **Button token 全局化**：ConfigProvider 设置 textHoverBg/textActiveBg，消除 132 处 `!important`
- **窗口色板单源化**：8 色对齐 Chrome ColorEnum
- **Focus ring 暗色对比度**：从 35% 提升到 55% opacity
- **内联 style 清零**：CommandPalette、WindowHealthIndicator、WindowToolbar、ViewDock
- **QuickToggle 重构**：Popover+隐藏锚点 → Modal
- **ViewDock touch target**：bottom 模式从 38px 加大到 44px
- **KanbanView 空状态**：新增 `Empty` 提示
