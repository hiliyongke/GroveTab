---
wave: 2
depends_on: [06-PLAN-1]
files_modified:
  - src/features/tabs/TabItem.tsx
  - src/features/tabs/DomainGroupCard.tsx
  - src/features/tabs/DomainGroupView.tsx
  - src/features/tabs/TabList.tsx
  - src/shared/ui/Header.tsx
  - src/shared/ui/UndoToast.tsx
  - src/features/search/SearchBox.tsx
  - src/features/sessions/ArchivePanel.tsx
  - src/features/sessions/OnboardingCard.tsx
  - src/pages/newtab/App.tsx
  - src/pages/newtab/index.css
autonomous: true
requirements_addressed:
  - VISUAL-01
  - VISUAL-04
  - VISUAL-06
  - A11Y-01
  - A11Y-02
  - A11Y-03
---

# Plan 06-2: 组件样式迁移 + A11y 焦点态

**Objective:** 将所有硬编码的白色/透明样式迁移为 CSS 变量引用，实现亮暗主题自动适配。补全 aria-label、焦点态样式、键盘操作。

## Task 1: 迁移 TabItem 样式

<read_first>
- src/features/tabs/TabItem.tsx
- src/pages/newtab/index.css (new token system from Plan 1)
</read_first>

<action>
更新 `src/features/tabs/TabItem.tsx` 中的硬编码样式，替换为 CSS 变量引用：

1. 卡片容器：`bg-white/15 hover:bg-white/25` → `bg-surface hover:bg-surface-hover`
2. 边框：`border border-white/20` → `border border-border`
3. 文本色：`text-white/90` → `text-text`，`text-white/50` → `text-text-secondary`
4. Badge 图标：`text-white/40` → `text-text-muted`，`text-blue-300/60` → `text-text-muted`
5. 关闭按钮：`hover:bg-white/20 text-white/60 hover:text-white/90` → `hover:bg-surface-hover text-text-muted hover:text-text`
6. 添加 `aria-label` 到关闭按钮：`aria-label="关闭标签页"`
7. 整个按钮添加焦点态：`focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2`
</action>

<acceptance_criteria>
- TabItem.tsx does NOT contain `bg-white/15` or `text-white/90` or `border-white/20`
- TabItem.tsx contains `bg-surface` and `bg-surface-hover`
- TabItem.tsx contains `text-text` and `text-text-secondary`
- TabItem.tsx contains `focus-visible:outline-2`
- TabItem.tsx contains `aria-label="关闭标签页"`
</acceptance_criteria>

## Task 2: 迁移 DomainGroupCard 样式

<read_first>
- src/features/tabs/DomainGroupCard.tsx
</read_first>

<action>
更新 `src/features/tabs/DomainGroupCard.tsx`：

1. Group header: `bg-white/10 hover:bg-white/20` → `bg-surface hover:bg-surface-hover`
2. 边框: `border-white/15` → `border-border`
3. Chevron: `text-white/40` → `text-text-muted`
4. 域名: `text-white/80` → `text-text`
5. 徽标: `bg-white/15 text-white/50` → `bg-badge text-text-secondary`
6. 关闭全部按钮: `hover:bg-red-500/30 text-white/40 hover:text-red-300` 保持不变（红色是语义色）
7. 添加 `aria-label`：展开/折叠按钮 `aria-label={collapsed ? '展开' : '折叠'}`，关闭按钮 `aria-label="关闭此域名所有标签页"`
8. 添加焦点态: `focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2`
</action>

<acceptance_criteria>
- DomainGroupCard.tsx does NOT contain `bg-white/10` or `text-white/80`
- DomainGroupCard.tsx contains `bg-surface` and `text-text`
- DomainGroupCard.tsx contains `focus-visible:outline-2`
- DomainGroupCard.tsx contains `aria-label` on collapse and close buttons
</acceptance_criteria>

## Task 3: 迁移 Header + UndoToast 样式

<read_first>
- src/shared/ui/Header.tsx
- src/shared/ui/UndoToast.tsx
</read_first>

<action>
1. 更新 `src/shared/ui/Header.tsx`：
   - 品牌图标: `text-white/80` → `text-text`
   - 品牌文字: `text-white/90` → `text-text`
   - 搜索/归档按钮: `bg-white/10 hover:bg-white/20 border-white/10 text-white/50 hover:text-white/80` → `bg-surface hover:bg-surface-hover border-border text-text-secondary hover:text-text`
   - kbd: `bg-white/10 text-white/30` → `bg-badge text-text-muted`
   - 标签计数: `text-white/40` → `text-text-muted`
   - 所有按钮添加焦点态: `focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2`
   - 搜索按钮添加 `aria-label="搜索标签页"`

2. 更新 `src/shared/ui/UndoToast.tsx`：
   - 容器: `bg-black/60` → `bg-surface` (需加 `backdrop-blur-xl`)
   - 文本: `text-white/80` → `text-text`
   - 撤销按钮: `bg-white/20 hover:bg-white/30 text-white/90` → `bg-badge hover:bg-surface-hover text-text`
   - 关闭按钮: `hover:bg-white/20 text-white/50 hover:text-white/80` → `hover:bg-surface-hover text-text-muted hover:text-text`
   - 添加 `role="alert"` 和 `aria-live="polite"` 到容器
</action>

<acceptance_criteria>
- Header.tsx does NOT contain `text-white/80` or `bg-white/10`
- Header.tsx contains `bg-surface` and `text-text`
- Header.tsx contains `focus-visible:outline-2`
- UndoToast.tsx does NOT contain `bg-black/60` or `text-white/80`
- UndoToast.tsx contains `role="alert"` or `aria-live="polite"`
</acceptance_criteria>

## Task 4: 迁移 SearchBox + ArchivePanel + OnboardingCard 样式

<read_first>
- src/features/search/SearchBox.tsx
- src/features/sessions/ArchivePanel.tsx
- src/features/sessions/OnboardingCard.tsx
</read_first>

<action>
1. 更新 `src/features/search/SearchBox.tsx`：所有 `text-white/xx`、`bg-white/xx`、`border-white/xx` 替换为对应 CSS 变量引用。搜索框输入框用 `bg-surface`。结果项用 `bg-surface hover:bg-surface-hover`。空结果文案用 `text-text-muted`。

2. 更新 `src/features/sessions/ArchivePanel.tsx`：同上模式替换。面板背景用 `bg-surface backdrop-blur-xl`。

3. 更新 `src/features/sessions/OnboardingCard.tsx`：同上模式替换。

4. 所有交互元素添加 `focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2`。
</action>

<acceptance_criteria>
- SearchBox.tsx does NOT contain `text-white/` or `bg-white/` or `border-white/`
- ArchivePanel.tsx does NOT contain `text-white/` or `bg-white/`
- OnboardingCard.tsx does NOT contain `text-white/` or `bg-white/`
- All three files contain `focus-visible:outline-2`
</acceptance_criteria>

## Task 5: 添加全局焦点态样式 + A11y 基础

<read_first>
- src/pages/newtab/index.css
</read_first>

<action>
在 `src/pages/newtab/index.css` 中添加全局 A11y 样式：

```css
/* Focus visible styles — A11Y-02 */
*:focus-visible {
  outline: 2px solid var(--canopy-focus-ring);
  outline-offset: 2px;
}

/* Remove default focus outline, use :focus-visible instead */
*:focus {
  outline: none;
}

/* Ensure minimum touch target size — A11Y-01 */
button,
[role="button"] {
  min-height: 32px;
  min-width: 32px;
}

/* Color should not be the only information carrier — A11Y-03 */
/* This is handled at component level by ensuring icons + text accompany colors */
```

同时在 index.css 中确保 Tailwind 可以使用 `focus-visible:` 前缀。
</action>

<acceptance_criteria>
- index.css contains `:focus-visible` rule with `outline: 2px solid var(--canopy-focus-ring)`
- index.css contains `outline-offset: 2px`
- index.css contains `*:focus { outline: none; }`
- index.css contains `button` min-height/min-width rule
</acceptance_criteria>

## Task 6: 更新 App.tsx loading 和空状态样式

<read_first>
- src/pages/newtab/App.tsx
</read_first>

<action>
更新 `src/pages/newtab/App.tsx`：

1. Loading 状态: `text-white/50` → `text-text-muted`
2. "加载标签页中..." 文本改为 `text-text-muted`

</action>

<acceptance_criteria>
- App.tsx does NOT contain `text-white/50` or `text-white/90`
- App.tsx contains `text-text-muted`
</acceptance_criteria>

## must_haves

- 所有组件样式从硬编码白色改为 CSS 变量
- 亮/暗主题下所有组件自动适配
- 焦点态 2px outline 高对比可见
- 所有交互按钮有 aria-label
- 颜色不作为唯一信息载体（图标+文字双重编码）
