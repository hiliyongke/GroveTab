# 样式体系使用指南

本项目已从纯 CSS 迁移至 **Less + CSS Modules** 体系，本文档说明如何正确使用全局变量、Mixin 以及样式模块。

---

## 1. 核心原则

| 场景 | 使用方式 | 示例 |
|------|---------|------|
| **编译时常量**（间距、字号、圆角、动效时长） | Less `@` 变量 | `@app-space-3`, `@app-radius-md` |
| **运行时动态值**（颜色、主题色、皮肤色） | CSS `--` 变量 | `var(--app-primary)`, `var(--ant-color-text)` |
| **组件局部样式** | CSS Modules（`.module.less`） | `import styles from './Card.module.less'` |
| **全局共享样式** | Less Mixin + 变量文件 | `@import (reference) '~@/shared/styles/_variables.less'` |

> ⚠️ **严禁**在 `.module.less` 中硬编码颜色值或重复写视觉模式。应优先使用 Less 变量/Mixin，其次使用 CSS 变量。

---

## 2. 全局 Less 变量

文件位置：`src/shared/styles/_variables.less`

### 2.1 间距体系

基于 4px 单位，支持密度缩放：

```less
@spacing-unit: 4px;              // 基础单位
@density-scale: 1;               // 密度缩放系数（运行时可通过 JS 修改）

@app-space-1: 4px;               // 基础间距
@app-space-2: 8px;               // 紧凑间距
@app-space-3: 12px;              // 默认内边距
@app-space-4: 16px;              // 卡片间距
@app-space-5: 24px;              // 区块间距
@app-space-6: 32px;              // 大区块间距

@app-card-gap: 16px;             // 卡片间隙
@app-card-padding: 16px;         // 卡片内边距
@app-section-gap: 24px;          // 区块间距
```

### 2.2 字体体系

```less
@app-font-size: 14px;            // 基础正文字号
@app-font-family-code: 'SF Mono', 'Fira Code', ...;  // 等宽字体
```

### 2.3 圆角体系

```less
@app-radius-xs: 2px;
@app-radius-sm: 4px;
@app-radius-md: 6px;
@app-radius-lg: 8px;
@app-radius-pill: 980px;         // 全圆角（药丸形）
@app-radius-circle: 50%;         // 正圆形
```

### 2.4 动效时长

```less
@app-motion-duration: 0.2s;      // 默认过渡时长
@app-motion-duration-slow: 0.3s;  // 慢速（展开/收起）
@app-motion-duration-mid: 0.18s;  // 中速（hover）
@app-motion-duration-fast: 0.1s;  // 快速（按钮反馈）
```

### 2.5 卡片交互参数

```less
@app-card-border-width: 1px;
@app-card-hover-border-width: 1px;
@app-card-lift-distance: 2px;     // hover 上浮距离
```

### 2.6 毛玻璃参数

```less
@app-glass-blur: 20px;            // 模糊值
@app-glass-saturate: 180;         // 饱和度（%）
```

### 2.7 组件高度

```less
@app-search-height: 44px;         // 搜索框高度
@app-header-height: 48px;         // 顶部导航栏高度
```

---

## 3. 全局 Less Mixins

文件位置：`src/shared/styles/_mixins.less`

### 3.1 毛玻璃效果 `.glass-effect()`

```less
@import (reference) '~@/shared/styles/_mixins.less';

.my-panel {
  .glass-effect();                    // 默认 blur=20px, saturate=180%
  .glass-effect(40, 200);             // 自定义 blur=40px, saturate=200%
}
```

参数：
- `@blur` (Number): 模糊值（px），默认 `@app-glass-blur` (20)
- `@saturate` (Number): 饱和度（%），默认 `@app-glass-saturate` (180)

### 3.2 卡片 hover 上浮 `.card-lift()`

```less
.my-card {
  .card-lift();                       // 默认上浮 2px
  .card-lift(4px, 0.3s);             // 自定义上浮 4px，动画 0.3s
}
```

参数：
- `@lift` (Length): 上浮距离，默认 `@app-card-lift-distance` (2px)
- `@duration` (Time): 动画时长，默认 `@app-motion-duration` (0.2s)

### 3.3 行级 hover 背景 `.row-hover()`

```less
.my-list-item {
  .row-hover();                       // 默认使用 antd fill-tertiary
  .row-hover(rgba(0, 0, 0, 0.05));   // 自定义 hover 背景色
}
```

参数：
- `@bg-color` (Color): hover 背景色，默认 `var(--ant-color-fill-tertiary)`
- `@duration` (Time): 过渡时长，默认 `@app-motion-duration-fast` (0.1s)

### 3.4 浮层容器 `.surface-elevated()`

```less
.my-dropdown {
  .surface-elevated();                // 毛玻璃 + 阴影 + 圆角
}
```

无需参数，自动应用：
- `var(--app-surface-elevated-bg)` 背景
- `.glass-effect()` 毛玻璃
- `var(--app-shadow-floating)` 阴影
- `var(--app-floating-radius)` 圆角

### 3.5 软分隔线 `.divider-soft()`

```less
.my-divider-v {
  .divider-soft(vertical);            // 竖向分隔线（1×20px）
}
.my-divider-h {
  .divider-soft(horizontal);          // 横向分隔线（100%×1px）
}
```

### 3.6 键帽样式 `.kbd-style()`

```less
.my-shortcut {
  .kbd-style();                       // 生成标准快捷键标签样式
}
```

### 3.7 时间线标题 hover `.timeline-header-hover()`

```less
.my-timeline-header {
  .timeline-header-hover();           // 默认 secondary → primary
}
```

### 3.8 身份色条 hover `.accent-bar-hover()`

```less
.my-accent-bar {
  .accent-bar-hover(3px);             // hover 时从 2px 加粗到 3px
}
```

---

## 4. 组件样式模块标准写法

```tsx
// MyComponent.tsx
import styles from './MyComponent.module.less';

export function MyComponent() {
  return <div className={styles.container}>...</div>;
}
```

```less
// MyComponent.module.less
@import (reference) '~@/shared/styles/_variables.less';
@import (reference) '~@/shared/styles/_mixins.less';

.container {
  padding: @app-space-3 @app-space-4;
  border-radius: @app-radius-md;
  background: var(--app-surface-card-bg);

  .card-lift();                       // 复用 Mixin
}
```

---

## 5. 运行时 CSS 变量（不通过 Less 管理）

这些变量由 `AntdThemeProvider` 或皮肤系统动态注入，在 Less 中直接消费即可：

```less
.my-element {
  color: var(--ant-color-text);                   // antd 主题色
  background: var(--app-surface-card-bg);         // 应用表面色
  border-color: var(--ant-color-border);          // 边框色
  box-shadow: var(--app-shadow-card);             // 卡片阴影
}
```

**不要**在 Less 中覆盖 antd Component Token（如 `Modal.borderRadiusLG`），应通过 antd 的主题配置体系修改。

---

## 6. 主题/皮肤嵌套规则

使用 Less 嵌套替代平铺选择器：

```less
// ✅ 推荐
.my-component {
  background: var(--app-surface-card-bg);

  [data-skin='apple'] & {
    border-radius: 10px;

    [data-theme='dark'] & {
      background: rgba(30, 30, 30, 0.8);
    }
  }
}

// ❌ 不推荐
.my-component { background: var(--app-surface-card-bg); }
[data-skin='apple'] .my-component { border-radius: 10px; }
[data-theme='dark'][data-skin='apple'] .my-component { background: rgba(30, 30, 30, 0.8); }
```

---

## 7. 快速参考表

| 需求 | 方案 |
|------|------|
| 统一间距 | `@app-space-1` ~ `@app-space-6` |
| 统一圆角 | `@app-radius-xs` ~ `@app-radius-lg` |
| 统一动效 | `@app-motion-duration` 系列 |
| 毛玻璃效果 | `.glass-effect()` Mixin |
| 卡片 hover 上浮 | `.card-lift()` Mixin |
| 列表行 hover | `.row-hover()` Mixin |
| 浮层面板 | `.surface-elevated()` Mixin |
| 动态颜色 | `var(--ant-*)` / `var(--app-*)` CSS 变量 |
| 皮肤适配 | Less 嵌套 `[data-skin='xxx'] &` |

---

*本文档与 `src/shared/styles/_variables.less`、`src/shared/styles/_mixins.less` 同步维护。*
