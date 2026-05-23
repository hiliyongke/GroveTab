# 样式开发指南

## 概述

本项目已统一使用 **CSS Modules** 方案（`.module.less` 文件）。本文档说明样式开发规范和迁移最佳实践。

## 判断：全局 vs CSS Modules

### ✅ 使用 CSS Modules（默认选择）

适用于：

- 组件级样式（feature/_, shared/ui/_）
- 页面级样式（pages/_/styles/_.module.less）
- 样式只在一个组件/页面中使用

**标识**：文件名包含 `.module.less`

```less
// ✅ 正确：ArcSidebar.module.less
.arcSidebar {
  display: flex;
}
```

```tsx
// ✅ 正确：导入和使用
import styles from "./ArcSidebar.module.less";

<div className={styles.arcSidebar}>...</div>;
```

### 🔒 保持全局 Less（特殊情况）

仅适用于包含以下选择器的文件：

- `html`, `body`, `#root` 等根元素选择器
- `:root` CSS 变量定义
- 全局工具类（如 `.app-hover-reveal`）

**全局文件列表**（不得转换为 CSS Modules）：

- `src/styles/global.less` - 全局效果、动画、工具类
- `src/pages/newtab/prepaint.less` - 预渲染（color-scheme, body 背景）
- `src/pages/newtab/styles/app-shell.less` - 全局布局类
- `src/shared/styles/_variables.less` - Less 变量（局部文件）
- `src/shared/styles/_mixins.less` - Less Mixins（局部文件）

## 命名规范

### CSS Modules：camelCase

```less
// ✅ 正确：camelCase
.popupShell {
}
.popupBrandMark {
}
.popupActionsPrimary {
}

// ❌ 错误：kebab-case（CSS Modules 中可用但不符合规范）
.popup-shell {
}
.popup-brand-mark {
}
```

### 全局类：kebab-case

```less
/* ✅ 正确：全局类使用 kebab-case */
.app-hover-reveal {
}
.app-scrollbar-thin {
}
```

## 迁移检查清单

迁移一个 `.less` 文件到 CSS Modules 时，遵循以下步骤：

### 1. 审计

```bash
# 查找样式文件的所有类名使用
grep -r "className=.*your-class" src/

# 确认是否只在单个组件中使用
# 如果在多个页面/组件中使用 → 保持全局或移动到 src/styles/
```

### 2. 转换

- [ ] 重命名文件：`Component.less` → `Component.module.less`
- [ ] 转换所有类名：kebab-case → camelCase
- [ ] 处理嵌套选择器中的全局类：使用 `:global(.global-class)`
- [ ] 更新组件导入：`import './Component.less'` → `import styles from './Component.module.less'`
- [ ] 更新所有 className 引用：`"class-name"` → `{styles.className}`
- [ ] 组合全局类：``className={`${styles.localClass} global-class`}``

### 3. 验证

```bash
# 类型检查
npm run type-check

# Lint
npm run lint

# 构建测试
npm run build

# 手动验证 UI
```

### 4. 提交

```bash
git add -A
git commit -m "refactor(styles): migrate Component to CSS Modules"
```

## 常见错误和解决方案

### Error 1: 全局类在 CSS Modules 中失效

**问题**：迁移后，全局工具类（如 `app-hover-reveal`）不生效。

**原因**：CSS Modules 默认将所有类名局部化。

**解决**：组合全局类时使用字符串（不使用 `styles.` 前缀）

```tsx
// ❌ 错误
<div className={`${styles.popupRow} ${styles.app-hover-reveal-host}`}>

// ✅ 正确
<div className={`${styles.popupRow} app-hover-reveal-host`}>
```

### Error 2: Ant Design 类名被局部化

**问题**：CSS Modules 中覆盖 Ant Design 组件样式不生效。

**原因**：`.popup-actions .ant-btn` 中 `.ant-btn` 被局部化。

**解决**：使用 `:global()` 包裹 Ant Design 类名

```less
/* ❌ 错误：.ant-btn 会被局部化 */
.popupActions {
  .ant-btn {
    box-shadow: 0 6px 18px rgba(43, 107, 255, 0.08);
  }
}

/* ✅ 正确：使用 :global() */
.popupActions {
  :global(.ant-btn) {
    box-shadow: 0 6px 18px rgba(43, 107, 255, 0.08);
  }
}
```

### Error 3: 数据属性选择器失效

**问题**：`[data-skin='apple']` 内的样式不生效。

**原因**：CSS Modules 会局部化所有类名，但属性选择器内的类名也需要处理。

**解决**：确保嵌套在属性选择器内的类名也正确转换

```less
/* ✅ 正确：属性选择器保持原样，内部类名转换为 camelCase */
[data-skin="apple"] {
  .popupShell {
    letter-spacing: -0.01em;
  }
}
```

### Error 4: Less 局部文件（`_*.less`）被当作样式文件处理

**问题**：`_variables.less` 或 `_mixins.less` 被错误迁移。

**原因**：这些文件只包含 Less 变量和 Mixin 定义，不生成 CSS。

**解决**：不迁移这些文件，它们通过 `@import` 在其他 Less 文件中使用。

## 迁移进度

| 文件                                       | 状态                  | Commit    |
| ------------------------------------------ | --------------------- | --------- |
| `src/features/arc-sidebar/ArcSidebar.less` | ✅ 已迁移             | `b2f12b0` |
| `src/pages/popup/styles/index.less`        | ✅ 已迁移             | `bea1863` |
| `src/pages/newtab/index.less`              | ✅ 已删除（重复文件） | 前一提交  |
| `src/styles/global.less`                   | 🔒 保持全局           | -         |
| `src/pages/newtab/prepaint.less`           | 🔒 保持全局           | -         |
| `src/pages/newtab/styles/app-shell.less`   | 🔒 保持全局           | -         |

## 最佳实践

1. **新组件默认使用 CSS Modules** - 不要创建新的 `.less` 文件（除非是全局样式）
2. **优先迁移再删除** - 先创建 `.module.less`，确认无误后再删除旧文件
3. **保持提交原子性** - 每个组件/页面的迁移单独提交
4. **手动验证 UI** - 类型检查和 Lint 通过后，务必手动检查样式是否正确
5. **文档同步更新** - 迁移后更新本文档的进度表格

## 参考资料

- [CSS Modules 官方文档](https://github.com/css-modules/css-modules)
- [Vite CSS Modules 配置](https://vitejs.dev/guide/features.html#css-modules)
- [Ant Design 样式覆盖](https://ant.design/docs/react/customize-theme)
