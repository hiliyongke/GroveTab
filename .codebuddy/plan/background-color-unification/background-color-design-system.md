# 背景色统一性设计系统

## 设计原则

### 1. 统一性原则

- 所有背景色必须使用CSS变量，禁止硬编码色值
- 建立清晰的背景色层级体系（layout → container → elevated → surface）
- 确保明暗主题的一致性适配

### 2. 可访问性原则

- 所有背景色与文字颜色的对比度必须达到WCAG AA标准
- 支持高对比度模式适配
- 提供语义化的颜色变量命名

### 3. 响应式原则

- 背景色在不同设备尺寸下保持协调
- 支持动态内容变化时的背景色稳定性
- 确保浏览器缩放时的视觉一致性

## 背景色层级体系

### 1. 基础背景色层级

```css
/* 页面布局背景（最底层） */
--app-bg-layout: var(--ant-color-bg-layout);

/* 容器背景（主要内容区域） */
--app-bg-container: var(--ant-color-bg-container);

/* 提升背景（卡片、浮层等） */
--app-bg-elevated: var(--ant-color-bg-elevated);

/* 表面背景（按钮、输入框等） */
--app-bg-surface: var(--ant-color-fill-quaternary);
```

### 2. 交互状态背景色

```css
/* 悬停状态 */
--app-bg-hover: color-mix(in srgb, var(--app-color-primary) 8%, transparent);

/* 激活状态 */
--app-bg-active: color-mix(in srgb, var(--app-color-primary) 12%, transparent);

/* 选中状态 */
--app-bg-selected: color-mix(in srgb, var(--app-color-primary) 16%, transparent);
```

### 3. 特殊用途背景色

```css
/* 毛玻璃效果背景 */
--app-bg-glass: color-mix(in srgb, var(--app-bg-elevated) 85%, transparent);

/* 遮罩层背景 */
--app-bg-mask: color-mix(in srgb, #000 45%, transparent);

/* 错误状态背景 */
--app-bg-error: var(--ant-color-error-bg);

/* 警告状态背景 */
--app-bg-warning: var(--ant-color-warning-bg);

/* 成功状态背景 */
--app-bg-success: var(--ant-color-success-bg);
```

## CSS变量命名规范

### 1. 语义化命名规则

```css
/* 基础语义 */
--app-bg-{层级}-{状态}-{主题}

/* 示例 */
--app-bg-container-light      /* 浅色主题容器背景 */
--app-bg-elevated-hover-dark  /* 深色主题提升背景悬停状态 */
--app-bg-surface-disabled     /* 禁用状态的表面背景 */
```

### 2. 组件特定背景色

```css
/* 设置面板 */
--app-settings-nav-bg: color-mix(in srgb, var(--app-bg-elevated) 72%, transparent);
--app-settings-content-bg: var(--app-bg-container);

/* 新标签页 */
--app-newtab-hero-bg: var(--app-bg-glass);
--app-newtab-card-bg: var(--app-bg-elevated);

/* 模态框 */
--app-modal-bg: var(--app-bg-glass);
--app-modal-mask-bg: var(--app-bg-mask);
```

## 明暗主题适配规范

### 1. 主题变量映射

```css
/* 浅色主题默认值 */
:root,
[data-theme="light"] {
  --app-bg-layout: #f5f5f5;
  --app-bg-container: #ffffff;
  --app-bg-elevated: #fafafa;
  --app-bg-surface: #f0f0f0;
}

/* 深色主题覆盖 */
[data-theme="dark"] {
  --app-bg-layout: #141414;
  --app-bg-container: #1f1f1f;
  --app-bg-elevated: #2a2a2a;
  --app-bg-surface: #333333;
}
```

### 2. 主题切换平滑过渡

```css
/* 为背景色添加过渡效果 */
* {
  transition: background-color 0.3s ease;
}

/* 减少动画用户的过渡效果 */
@media (prefers-reduced-motion: reduce) {
  * {
    transition: none;
  }
}
```

## 可访问性规范

### 1. 对比度验证标准

```css
/* 确保所有背景色与文字颜色的对比度 */
--app-text-primary: var(--ant-color-text);
--app-text-secondary: var(--ant-color-text-secondary);
--app-text-tertiary: var(--ant-color-text-tertiary);

/* 对比度验证工具类 */
.app-contrast-valid {
  /* 确保对比度 >= 4.5:1 (AA标准) */
  background-color: var(--app-bg-container);
  color: var(--app-text-primary);
}
```

### 2. 高对比度模式支持

```css
/* 高对比度模式检测 */
@media (prefers-contrast: high) {
  :root {
    --app-bg-container: #ffffff;
    --app-text-primary: #000000;
    --app-border-primary: #000000;
  }

  [data-theme="dark"] {
    --app-bg-container: #000000;
    --app-text-primary: #ffffff;
    --app-border-primary: #ffffff;
  }
}
```

## 实现优先级

### 第一阶段：基础统一化

1. 替换所有硬编码背景色为CSS变量
2. 统一设置面板的背景色层级
3. 确保新标签页的背景色一致性

### 第二阶段：主题适配

1. 完善明暗主题的背景色映射
2. 添加主题切换的平滑过渡
3. 验证所有皮肤预设的背景色适配

### 第三阶段：可访问性优化

1. 实施对比度验证机制
2. 添加高对比度模式支持
3. 进行全面的可访问性测试

## 最佳实践

### 1. 代码规范

```css
/* ✅ 推荐：使用语义化CSS变量 */
.background-example {
  background-color: var(--app-bg-container);
}

/* ❌ 避免：硬编码色值 */
.background-bad-example {
  background-color: #ffffff; /* 硬编码，不推荐 */
}
```

### 2. 组件开发规范

```typescript
// 组件中应使用统一的背景色变量
const Component = () => (
  <div
    style={{
      backgroundColor: 'var(--app-bg-container)',
      color: 'var(--app-text-primary)'
    }}
  >
    Content
  </div>
);
```

### 3. 测试验证规范

```javascript
// 自动化测试：验证背景色对比度
const validateContrast = (bgColor, textColor) => {
  const contrastRatio = calculateContrast(bgColor, textColor);
  expect(contrastRatio).toBeGreaterThanOrEqual(4.5); // WCAG AA标准
};
```

## 维护指南

### 1. 新增背景色变量

当需要新增背景色时：

1. 在对应的层级中添加CSS变量
2. 确保明暗主题都有适配值
3. 更新设计系统文档
4. 进行对比度验证

### 2. 修改现有背景色

修改背景色时：

1. 检查所有使用该变量的组件
2. 验证新颜色的可访问性
3. 更新主题适配值
4. 进行回归测试

### 3. 废弃背景色变量

废弃背景色时：

1. 标记变量为已废弃
2. 提供迁移指南
3. 在下一个主要版本中移除

这个设计系统为背景色统一性改进提供了完整的规范和指导。
