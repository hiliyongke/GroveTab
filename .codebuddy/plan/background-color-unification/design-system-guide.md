# 背景色设计系统使用指南

## 概述

本文档详细介绍了浏览器扩展设置界面中使用的背景色设计系统。该系统基于CSS变量构建，支持明暗主题切换、响应式适配和可访问性优化。

## 设计原则

### 1. 层次化设计

- **基础背景色**：布局容器和页面背景
- **表面背景色**：卡片、面板等组件背景
- **悬浮背景色**：模态框、弹出层等悬浮元素
- **交互背景色**：悬停、选中等交互状态

### 2. 主题一致性

- 明暗主题无缝切换
- 色彩对比度符合WCAG标准
- 视觉层次在不同主题下保持一致

### 3. 可访问性优先

- 确保文字与背景的对比度达标
- 支持高对比度模式
- 考虑色盲用户的视觉体验

## 核心变量体系

### 基础背景色变量

```css
--app-bg-layout     /* 布局容器背景 */
--app-bg-container  /* 内容容器背景 */
--app-bg-elevated   /* 悬浮元素背景 */
--app-bg-surface    /* 表面背景 */
```

### 交互状态背景色

```css
--app-bg-hover      /* 悬停状态 */
--app-bg-active     /* 激活状态 */
--app-bg-selected   /* 选中状态 */
--app-bg-disabled   /* 禁用状态 */
```

### 特殊效果背景色

```css
--app-bg-glass      /* 毛玻璃效果 */
--app-bg-mask       /* 遮罩层背景 */
```

## 组件背景色规范

### 设置面板组件

```css
.settings-nav {
  background: var(--app-settings-nav-bg);
}

.settings-content {
  background: var(--app-settings-content-bg);
}

.settings-header {
  background: var(--app-settings-header-bg);
}

.settings-card {
  background: var(--app-settings-card-bg);
}
```

### 模态框组件

```css
.modal {
  background: var(--app-modal-bg);
}

.modal-mask {
  background: var(--app-modal-mask-bg);
}
```

### 导航组件

```css
.navbar {
  background: var(--app-navbar-bg);
}

.navbar-item:hover {
  background: var(--app-navbar-item-hover-bg);
}

.navbar-item.active {
  background: var(--app-navbar-item-active-bg);
}
```

## 主题适配

### 明色主题

```css
[data-theme="light"] {
  --app-bg-layout: #f5f5f5;
  --app-bg-container: #ffffff;
  --app-bg-elevated: #ffffff;
  --app-bg-surface: #fafafa;
}
```

### 暗色主题

```css
[data-theme="dark"] {
  --app-bg-layout: #000000;
  --app-bg-container: #141414;
  --app-bg-elevated: #1f1f1f;
  --app-bg-surface: #262626;
}
```

## 响应式适配

### 移动端适配

```css
@media (max-width: 768px) {
  :root {
    --app-bg-layout: var(--app-bg-container);
    --app-settings-nav-bg: transparent;
  }
}
```

### 高DPI屏幕适配

```css
@media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
  .settings-card {
    background: color-mix(in srgb, var(--app-card-bg) 95%, transparent);
  }
}
```

## 可访问性优化

### 高对比度模式

```css
@media (prefers-contrast: high) {
  :root {
    --app-bg-hover: color-mix(in srgb, var(--app-bg-hover) 20%, #000);
    --app-bg-active: color-mix(in srgb, var(--app-bg-active) 30%, #000);
  }
}
```

### 减少动画模式

```css
@media (prefers-reduced-motion: reduce) {
  .settings-card {
    transition: none;
  }
}
```

## 最佳实践

### 1. 变量使用规范

- 优先使用语义化变量名称
- 避免直接使用硬编码的颜色值
- 在组件样式中引用CSS变量

### 2. 主题切换实现

```javascript
// 切换主题的函数
function toggleTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}
```

### 3. 性能优化

- 使用CSS变量减少重复代码
- 避免不必要的背景色重绘
- 合理使用will-change属性

### 4. 测试验证

- 在不同设备上测试背景色显示
- 验证明暗主题切换效果
- 检查可访问性合规性

## 扩展指南

### 添加新的背景色变量

1. 在`background-colors.less`中定义新变量
2. 为主题适配添加相应的映射
3. 更新本文档中的变量说明

### 创建新的组件背景色

1. 遵循现有的命名规范
2. 确保与现有色彩体系协调
3. 添加相应的主题适配

## 故障排除

### 常见问题

1. **背景色不生效**：检查CSS变量是否正确定义和引用
2. **主题切换无效**：验证data-theme属性是否正确设置
3. **对比度不足**：使用工具检查WCAG合规性

### 调试工具

- 浏览器开发者工具中的CSS变量面板
- 颜色对比度检查工具
- 主题切换调试工具

## 版本历史

- v1.0.0 (2024-01-01)：初始版本，建立基础背景色体系
- v1.1.0 (2024-01-15)：添加明暗主题适配
- v1.2.0 (2024-02-01)：优化可访问性和响应式适配
