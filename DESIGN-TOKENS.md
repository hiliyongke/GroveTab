# 设计规范 Token 定义

> 本文档定义 Tabs 项目统一的设计规范 Token。所有组件必须使用这些 Token，禁止硬编码数值。

## 圆角规范（Border Radius）

所有圆角值必须从皮肤配置中动态派生，通过 CSS 变量使用：

| Token 名称 | CSS 变量 | 派生来源 | 用途 |
|-------------|-----------|----------|------|
| `radius-xs` | `--app-radius-xs` | `skin.borderRadiusXS` | 标签、小徽章 |
| `radius-sm` | `--app-radius-sm` | `skin.borderRadiusSM` | 输入框、下拉菜单 |
| `radius-md` | `--app-radius-md` | `skin.borderRadius` | 按钮、小型卡片 |
| `radius-lg` | `--app-radius-lg` | `skin.borderRadiusLG` | 卡片、模态框 |
| `radius-pill` | `--app-radius-pill` | 固定值 `980px` | CTA 按钮、胶囊标签 |
| `radius-circle` | `--app-radius-circle` | 固定值 `50%` | 圆形按钮、头像 |

### 使用示例

```css
/* ✅ 正确：使用 CSS 变量 */
.app-card {
  border-radius: var(--app-radius-lg);
}

.app-button-pill {
  border-radius: var(--app-radius-pill);
}

/* ❌ 错误：硬编码值 */
.app-card {
  border-radius: 12px;  /* 应该使用 var(--app-radius-lg) */
}
```

---

## 间距规范（Spacing）

基于 4px 基础单位的 8 点网格系统：

| Token 名称 | CSS 变量 | 值 | 用途 |
|-------------|-----------|-----|------|
| `space-1` | `--app-space-1` | `4px` | 最小间距（图标与文字） |
| `space-2` | `--app-space-2` | `8px` | 基础间距（元素间） |
| `space-3` | `--app-space-3` | `12px` | 中等间距（组件内） |
| `space-4` | `--app-space-4` | `16px` | 大间距（卡片 padding） |
| `space-5` | `--app-space-5` | `24px` | 区隔间距（模块间） |
| `space-6` | `--app-space-6` | `32px` | 大区隔间距（section 间） |

### 密度缩放

间距支持密度缩放，通过 `--app-density-scale` 控制：

```css
/* 基础值 */
--app-space-1: calc(4px * var(--app-density-scale, 1));
--app-space-2: calc(8px * var(--app-density-scale, 1));
/* ... 以此类推 */
```

### ✅ 何时可以硬编码间距值

以下情况**可以接受**硬编码间距值：

1. **规范值（4 的倍数）**：
   - ✅ `4px`, `8px`, `12px`, `16px`, `24px`, `32px` 等
   - ✅ 这些值符合 8 点网格系统，硬编码也是业界最佳实践
   - ✅ 参考：Ant Design、Tailwind CSS 等都允许规范值硬编码

2. **复合值中的非规范值**：
   - ✅ `padding: 14px 18px 12px;` — 如果某些值不在规范中，整个复合值可以硬编码
   - ✅ 避免定义无意义的变量名（如 `--app-space-14px`）

3. **布局微调值**：
   - ✅ `margin: 1px;` — 细微调整可以硬编码
   - ✅ 这些值通常不会被主题系统控制

### ❌ 何时必须使用 CSS 变量

以下情况**必须**使用 CSS 变量：

1. **非 4 倍数的间距值**：
   - ❌ `padding: 5px;` → ✅ `padding: var(--app-space-1);`
   - ❌ `margin: 10px;` → ✅ 需要定义新的规范值或使用最近的规范值

2. **圆角值**：
   - ❌ `border-radius: 3px;` → ✅ `border-radius: var(--app-radius-xs);`
   - ❌ `border-radius: 10px;` → ✅ `border-radius: var(--app-radius-md);`

3. **需要主题级别控制的值**：
   - ❌ 硬编码值无法响应主题切换
   - ✅ 使用 CSS 变量可以在皮肤层面统一调整

---

## 阴影规范（Shadows）

| Token 名称 | CSS 变量 | 用途 |
|-------------|-----------|------|
| `shadow-card` | `--app-shadow-card` | 卡片默认阴影 |
| `shadow-card-hover` | `--app-shadow-card-hover` | 卡片 hover 阴影 |
| `shadow-floating` | `--app-shadow-floating` | 浮动栏阴影 |
| `shadow-brand-glow` | `--app-shadow-brand-glow` | 品牌辉光阴影 |

---

## 字体规范（Typography）

| Token 名称 | CSS 变量 | 用途 |
|-------------|-----------|------|
| `font-family-base` | `--app-font-family-base` | 正文字体 |
| `font-family-heading` | `--app-font-family-heading` | 标题字体 |
| `font-weight-body` | `--app-font-weight-body` | 正文字重 |
| `font-weight-heading` | `--app-font-weight-heading` | 标题字重 |

---

## 动画规范（Motion）

| Token 名称 | CSS 变量 | 用途 |
|-------------|-----------|------|
| `motion-duration-fast` | `--app-motion-duration-fast` | 快速动画（hover） |
| `motion-duration-mid` | `--app-motion-duration-mid` | 中等动画（展开） |
| `motion-duration-slow` | `--app-motion-duration-slow` | 慢速动画（页面切换） |

---

## 禁止使用的硬编码值

以下硬编码值**必须**替换为对应的 CSS 变量：

### 圆角

- ❌ `3px`, `4px`, `5px`, `6px`, `7px`, `9px`, `10px`, `16px`, `20px`
- ✅ 使用 `var(--app-radius-xs|sm|md|lg)`

### 间距

- ❌ `1px`, `2px`, `3px` 等非 4 的倍数
- ✅ 使用 `var(--app-space-1|2|3|4|5|6)`

---

## 重构优先级

1. **高优先级**：高频使用的组件（卡片、按钮、输入框）
2. **中优先级**：低频使用的组件（模态框、通知栏）
3. **低优先级**：一次性组件（关于页面、设置页面）

---

## 检查方法

运行以下命令检查硬编码值：

```bash
# 查找硬编码的 border-radius
grep -r "border-radius:\s*[0-9]\+px" src/ --include="*.css"

# 查找硬编码的 padding/margin
grep -r "padding:\s*[0-9]\+px" src/ --include="*.css"
grep -r "margin:\s*[0-9]\+px" src/ --include="*.css"
```
