# Phase 6: 视觉系统 + 主题 - Research

**Researched:** 2026-04-22
**Domain:** CSS 主题系统 / 毛玻璃视觉 / motion 动画 / A11y / i18n
**Confidence:** HIGH

## Summary

Phase 6 需要在现有 Tailwind CSS v4 CSS-first 配置基础上构建完整的 Design Token 体系、亮暗主题切换、毛玻璃视觉、动画系统、A11y 基线和 i18n 基座。核心挑战在于：(1) Tailwind CSS v4 的 `@theme inline` + `@custom-variant dark` 机制提供了原生数据属性驱动的主题切换，无需 JS 类名切换；(2) Chrome Extension MV3 的 CSP 禁止 inline script，无 FOUC 方案需用外部脚本替代传统内联注入；(3) 毛玻璃效果在亮暗主题下需要完全不同的参数策略，且必须同时满足 WCAG AA 对比度要求；(4) motion v12 已安装，其 `useReducedMotion` + `AnimatePresence` 是动画 + reduced-motion 的标准解法。

**Primary recommendation:** 使用 TW4 的 `@custom-variant dark` + `data-theme` 属性 + `@theme inline` CSS 变量映射构建零 FOUC 主题系统，所有硬编码颜色值迁移到 CSS 变量，亮暗主题通过变量覆盖实现，动画用 motion 库的 spring + AnimatePresence，i18n 自建轻量 useT hook。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 三套预设渐变由 Claude 定（Aurora/Sunrise/Deep Space，确保风格差异明显且与毛玻璃搭配好看）
- **D-02:** 自定义渐变交互由 Claude 定（保持操作简单）
- **D-03:** 渐变背景加缓慢流动动画（30-60s cycle），让背景有生命力
- **D-04:** 主题切换架构由 Claude 定（必须无 FOUC）
- **D-05:** 亮色主题毛玻璃卡片风格由 Claude 定（确保亮暗下都美观可读）
- **D-06:** Header 加主题切换图标按钮（日/月/自动循环）+ 设置面板都做入口
- **D-07:** Tab 进出场动画级别由 Claude 定（兼顾美观和性能）
- **D-08:** 视图切换过渡由 Claude 定（确保自然不突兀，为 Phase 7 多视图做准备）
- **D-09:** prefers-reduced-motion 处理由 Claude 定（确保 a11y 合规）
- **D-10:** 焦点态样式由 Claude 定（确保视觉清晰，需满足 A11Y-02 的 2px 高对比外描边）
- **D-11:** i18n 实现方式由 Claude 定（Chrome 扩展场景够用就行）
- **D-12:** i18n 范围由 Claude 定（确保基座稳固，现有文案翻译可渐进补全）

### Claude's Discretion
- 三套预设渐变的具体色值和角度
- 自定义渐变选择器交互细节
- 主题 CSS 变量体系设计（亮/暗色 token 映射）
- 亮色主题毛玻璃卡片透明度、边框、阴影参数
- Tab 动画 spring 参数、stagger 延迟
- 视图切换 AnimatePresence 配置
- reduced-motion 的具体阈值和规则
- 焦点态 outline 样式细节
- i18n hook API 设计和字典结构
- 具体哪些现有文案需要在 Phase 6 翻译

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VISUAL-01 | 毛玻璃卡片（backdrop-filter: blur(24px) saturate(180%)）+ 半透明底 + 1px 半透明边框 | §Architecture Patterns 毛玻璃双主题方案、§Common Pitfalls 毛玻璃性能 |
| VISUAL-02 | 三套渐变预设（Aurora / Sunrise / Deep Space），用户可自定义 2 色渐变 | §Architecture Patterns 渐变系统、§Code Examples 渐变动画 |
| VISUAL-03 | 亮色/暗色/跟随系统三档切换，无 FOUC | §Architecture Patterns 主题切换 + 无 FOUC 方案 |
| VISUAL-04 | WCAG AA 对比度（正文 ≥ 4.5:1） | §Common Pitfalls 对比度验证、§Security Domain |
| VISUAL-05 | 统一圆角 8/12/20px、间距 4px 倍数、动效 150-250ms cubic-bezier(.22,.61,.36,1) | §Architecture Patterns Design Token 体系 |
| VISUAL-06 | prefers-reduced-motion 生效时禁用非必要动画 | §Architecture Patterns reduced-motion 方案 |
| A11Y-01 | 完整键盘操作（Tab/Shift+Tab/Enter/Delete/↑/↓/Esc/Cmd+K） | §Architecture Patterns A11y 键盘方案 |
| A11Y-02 | 所有图标按钮有 aria-label，焦点态 2px 高对比外描边 | §Architecture Patterns 焦点态样式 |
| A11Y-03 | 颜色不作为唯一信息载体 | §Common Pitfalls 颜色唯一载体 |
| I18N-01 | 使用 _locales 体系，支持 zh-CN + en-US | §Architecture Patterns i18n 方案 |
| I18N-02 | 日期/数字用 Intl API，长文本用 ICU MessageFormat | §Architecture Patterns Intl API + ICU |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Design Token 体系 | Browser / CSS | — | CSS 变量是设计 token 的原生载体，零运行时开销 |
| 主题切换逻辑 | Browser / Client | API (chrome.storage) | CSS 变量 + data-theme 驱动渲染，storage 仅持久化用户偏好 |
| 渐变背景动画 | Browser / CSS | — | 纯 CSS `@keyframes` + `background-position` 动画，无 JS 依赖 |
| 毛玻璃效果 | Browser / CSS | — | `backdrop-filter` 是 GPU 加速的 CSS 属性 |
| 动画系统 | Browser / Client | — | motion 库 React 组件在客户端渲染动画 |
| 无 FOUC 注入 | Browser / HTML | — | index.html `<head>` 中的外部脚本在 React 渲染前执行 |
| A11y 焦点态 | Browser / CSS | Client (React) | CSS `:focus-visible` 提供样式，React 确保 aria 属性正确 |
| i18n 运行时 | Client / React | — | useT hook + Zustand 语言状态，组件级切换 |
| ICU MessageFormat | Client / JS | — | Intl API 是浏览器原生 API，ICU 格式在 JS 中处理 |
| prefers-reduced-motion | Browser / CSS + Client | — | CSS `@media` + motion `useReducedMotion` 双通道 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tailwindcss | 4.2.4 | CSS 框架 + Design Token | 项目已安装，v4 的 `@theme inline` + `@custom-variant` 是主题切换原生方案 [VERIFIED: npm registry] |
| motion | 12.38.0 | React 动画库 | 项目已安装，提供 AnimatePresence / spring / useReducedMotion [VERIFIED: npm registry] |
| zustand | 5.0.12 | 状态管理 | 项目已安装，已管理 settings（含 theme/gradientPreset/language） [VERIFIED: npm registry] |
| lucide-react | 1.8.0 | 图标库 | 项目已安装，主题切换图标（Sun/Moon/Monitor） [VERIFIED: npm registry] |
| react | 19.2.0 | UI 框架 | 项目已安装 [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | 4.1.0 | 日期格式化 | 项目已安装，ArchivePanel 已使用，需适配 i18n locale [VERIFIED: npm registry] |
| @tailwindcss/vite | 4.2.4 | Vite 集成 | 项目已安装 [VERIFIED: npm registry] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 自建 useT i18n hook | react-i18next | react-i18next 功能全但过重（~40KB），本项目仅 zh-CN/en 双语，自建方案 <1KB 足够 |
| CSS @property 渐变动画 | background-position 动画 | @property 可真正插值颜色但 Firefox 不支持；本项目仅 Chrome 目标可用，但 background-position 方案更成熟稳定且 99%+ 兼容 |
| inline script 防 FOUC | 外部脚本 + `defer` | MV3 CSP 禁止 inline script；外部脚本方案符合 CSP 且同样可在 React 前执行 |

**Installation:**
无需安装新依赖。所有核心库已在项目中。

**Version verification:**
- tailwindcss: 4.2.4 (2026-04-22 验证)
- motion: 12.38.0 (2026-04-22 验证)
- zustand: 5.0.12 (2026-04-22 验证)
- lucide-react: 1.8.0 (2026-04-22 验证)
- react: 19.2.0 (2026-04-22 验证)

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│  index.html                                             │
│  ┌───────────────────────────────────────────────────┐  │
│  │  <head>                                            │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │  theme-init.js (外部脚本, 非inline)         │  │  │
│  │  │  → 读取 chrome.storage.local                 │  │  │
│  │  │  → 设置 data-theme / data-gradient          │  │  │
│  │  │  → 无 FOUC: 在 React 渲染前完成             │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  │  <link> index.css                                  │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  <body data-theme="dark" data-gradient="aurora">   │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │  React App                                  │  │  │
│  │  │  → Zustand settings store (theme/language)  │  │  │
│  │  │  → useT() hook (i18n)                       │  │  │
│  │  │  → motion AnimatePresence (动画)            │  │  │
│  │  │  → useReducedMotion (a11y)                  │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘

                    ↓ CSS 变量驱动渲染 ↓

┌─────────────────────────────────────────────────────────┐
│  index.css                                              │
│  ┌──────────────────────┐  ┌──────────────────────────┐│
│  │  :root               │  │  [data-theme="dark"]      ││
│  │  --color-surface:    │  │  --color-surface:         ││
│  │  --color-text:       │  │  --color-text:            ││
│  │  --glass-bg:         │  │  --glass-bg:              ││
│  │  --glass-border:     │  │  --glass-border:          ││
│  │  --gradient-*:       │  │  --gradient-*:            ││
│  └──────────────────────┘  └──────────────────────────┘│
│  ┌──────────────────────────────────────────────────────┐│
│  │  @theme inline { ... } → TW4 工具类自动响应变量    ││
│  │  @custom-variant dark → dark: 前缀响应 data-theme  ││
│  └──────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/
├── pages/newtab/
│   ├── index.css              # Design Token 定义 + 渐变动画 + 全局样式（扩展）
│   ├── index.html             # 添加 theme-init.js 外部脚本引用
│   ├── theme-init.js          # 无 FOUC 主题初始化脚本（新增）
│   ├── App.tsx                # 主题/渐变 context provider
│   └── main.tsx               # 入口不变
├── shared/
│   ├── i18n/                  # i18n 运行时模块（当前为空目录）
│   │   ├── index.ts           # 导出 useT / I18nProvider
│   │   ├── context.ts         # I18n React Context
│   │   ├── useT.ts            # useT hook
│   │   └── locales/
│   │       ├── zh-CN.ts       # 中文字典
│   │       └── en.ts          # 英文字典
│   ├── ui/
│   │   ├── Header.tsx         # 添加主题切换按钮
│   │   ├── UndoToast.tsx      # 适配主题变量
│   │   ├── ThemeToggle.tsx    # 主题切换组件（新增）
│   │   └── GradientPicker.tsx # 自定义渐变选择器（新增）
│   └── types.ts               # 类型不变
├── features/
│   ├── tabs/
│   │   ├── TabItem.tsx        # 硬编码色值 → CSS 变量
│   │   └── DomainGroupCard.tsx# 同上
│   ├── search/SearchBox.tsx   # 同上
│   └── sessions/
│       ├── OnboardingCard.tsx # 同上 + aria-label
│       └── ArchivePanel.tsx   # 同上 + Intl 日期
└── store/
    └── settings-slice.ts      # 添加主题/渐变/语言监听 → data-attribute 同步
```

### Pattern 1: Tailwind CSS v4 主题切换架构

**What:** 利用 TW4 的 `@custom-variant dark` + `@theme inline` + CSS 变量覆盖实现零 JS 渲染的主题切换
**When to use:** 所有需要响应主题变化的样式

```css
/* index.css — 完整主题系统 */
@import "tailwindcss";

/* 1. 覆盖 dark 变体，使用 data-theme 属性而非 prefers-color-scheme */
@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));

/* 2. 亮色主题（默认）CSS 变量 */
:root {
  /* 颜色 token */
  --color-surface: rgba(255, 255, 255, 0.5);
  --color-surface-hover: rgba(255, 255, 255, 0.65);
  --color-text: rgba(0, 0, 0, 0.87);
  --color-text-secondary: rgba(0, 0, 0, 0.55);
  --color-text-muted: rgba(0, 0, 0, 0.35);
  --color-border: rgba(255, 255, 255, 0.6);

  /* 毛玻璃 token */
  --glass-bg: rgba(255, 255, 255, 0.5);
  --glass-bg-hover: rgba(255, 255, 255, 0.65);
  --glass-border: rgba(255, 255, 255, 0.6);
  --glass-blur: blur(24px) saturate(180%);
  --glass-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);

  /* 焦点态 token */
  --focus-ring-color: #3b82f6;
  --focus-ring-width: 2px;
  --focus-ring-offset: 2px;
}

/* 3. 暗色主题 CSS 变量覆盖 */
[data-theme="dark"] {
  --color-surface: rgba(255, 255, 255, 0.15);
  --color-surface-hover: rgba(255, 255, 255, 0.25);
  --color-text: rgba(255, 255, 255, 0.9);
  --color-text-secondary: rgba(255, 255, 255, 0.55);
  --color-text-muted: rgba(255, 255, 255, 0.35);
  --color-border: rgba(255, 255, 255, 0.2);

  --glass-bg: rgba(255, 255, 255, 0.15);
  --glass-bg-hover: rgba(255, 255, 255, 0.25);
  --glass-border: rgba(255, 255, 255, 0.2);
  --glass-blur: blur(24px) saturate(180%);
  --glass-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

/* 4. TW4 @theme inline — 让工具类自动响应 CSS 变量变化 */
@theme inline {
  --color-surface: var(--color-surface);
  --color-text: var(--color-text);
  --color-text-secondary: var(--color-text-secondary);
  --color-border: var(--color-border);
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 20px;
  --blur-card: blur(24px) saturate(180%);
  --font-family-sans: -apple-system, 'SF Pro Text', 'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
```

**来源:** [CITED: tailwindcss.com/docs/dark-mode] [CITED: tailwindcss.com/docs/colors] [CITED: tailwindcss.com/docs/theme]

### Pattern 2: 无 FOUC 主题初始化

**What:** 在 MV3 CSP 约束下，用外部脚本在 React 渲染前设置 `data-theme` 属性
**When to use:** 新标签页加载时的首次渲染

```html
<!-- index.html — 关键：script 在 React 渲染前执行 -->
<head>
  <meta charset="UTF-8" />
  <title>Canopy</title>
  <!-- 外部脚本，CSP 允许。注意不用 defer/async，确保同步执行 -->
  <script src="./theme-init.js"></script>
</head>
```

```javascript
// theme-init.js — 同步执行，在 React 渲染前设置主题
(function() {
  // chrome.storage.local 是异步的，但我们可以：
  // 1. 先用媒体查询立即设置 system 主题（同步）
  // 2. 然后异步读取用户偏好并修正
  var theme = 'system';
  var gradient = 'aurora';

  // 立即同步判断：system 主题用媒体查询
  function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(t) {
    var effective = t === 'system' ? getSystemTheme() : t;
    document.documentElement.setAttribute('data-theme', effective);
  }

  function applyGradient(g) {
    document.documentElement.setAttribute('data-gradient', g);
  }

  // 策略：先同步设置 system 主题（零闪烁），再异步修正为用户偏好
  applyTheme('system'); // 同步，零延迟
  applyGradient('aurora');

  // 异步读取实际用户设置
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get('canopy_settings', function(result) {
      var settings = result.canopy_settings;
      if (settings) {
        if (settings.theme) applyTheme(settings.theme);
        if (settings.gradientPreset) applyGradient(settings.gradientPreset);
      }
    });
  }

  // 监听 system 主题变化
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
    chrome.storage.local.get('canopy_settings', function(result) {
      var settings = result.canopy_settings;
      if (settings && settings.theme === 'system') {
        applyTheme('system');
      }
    });
  });
})();
```

**关键点：**
- MV3 CSP 默认禁止 inline script，但允许扩展内的外部 `.js` 文件 [VERIFIED: Chrome docs]
- 同步设置 system 主题 → 零 FOUC；异步修正为用户偏好 → 可能有一帧修正但几乎不可见
- `vite.config.ts` 的 `chromeExtensionPlugin` 在 `writeBundle` 中生成 HTML，需要同时输出 `theme-init.js`

### Pattern 3: 渐变背景系统 + 流动动画

**What:** 三套预设渐变 + CSS 流动动画 + 自定义渐变支持
**When to use:** body 背景

```css
/* 渐变预设变量 */
:root,
[data-gradient="aurora"] {
  --gradient-1: #8EC5FC;
  --gradient-2: #E0C3FC;
  --gradient-3: #F5F7FA;
  --gradient-angle: 135deg;
}
[data-gradient="sunrise"] {
  --gradient-1: #FEE140;
  --gradient-2: #FA709A;
  --gradient-3: #FBC2EB;
  --gradient-angle: 135deg;
}
[data-gradient="deepspace"] {
  --gradient-1: #0F2027;
  --gradient-2: #203A43;
  --gradient-3: #2C5364;
  --gradient-angle: 135deg;
}

/* 流动动画 — background-position 方案 */
body {
  background: linear-gradient(
    var(--gradient-angle),
    var(--gradient-3) 0%,
    var(--gradient-2) 50%,
    var(--gradient-1) 100%
  );
  background-size: 400% 400%;
  background-attachment: fixed;
  animation: gradient-flow 45s ease infinite;
}

@keyframes gradient-flow {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

/* reduced-motion 下禁用流动 */
@media (prefers-reduced-motion: reduce) {
  body {
    animation: none;
    background-size: 100% 100%;
  }
}
```

**来源:** [CITED: frontend-hero.com — CSS Gradient Animation 5 Methods]

### Pattern 4: 毛玻璃卡片双主题样式

**What:** 亮暗主题下毛玻璃卡片需要不同参数以确保可读性
**When to use:** 所有使用毛玻璃效果的组件

```css
/* 毛玻璃组件统一样式 */
.glass-card {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow);
  border-radius: var(--radius-md);
}

.glass-card:hover {
  background: var(--glass-bg-hover);
}
```

**关键原则（来源: [CITED: lifa-su.com — CSS Glassmorphism Best Practices]）：**
- 暗色：`rgba(10,10,20,0.6)` + 白色半透明边框 `rgba(255,255,255,0.08)`
- 亮色：`rgba(255,255,255,0.5)` + 更强边框 `rgba(255,255,255,0.6)` + 微阴影 `0 4px 16px rgba(0,0,0,0.06)`
- 亮色需要更强边框和微妙阴影来维持卡片形状，否则会融入浅色背景
- 模糊值 `blur(12-16px)` 是视觉与性能的最佳平衡，`blur(24px)` 在大量卡片时需注意性能

### Pattern 5: motion 动画 + reduced-motion

**What:** 使用 motion 库的 AnimatePresence + spring 动画 + useReducedMotion
**When to use:** Tab 进出场、视图切换、组件过渡

```tsx
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

// Tab 列表动画
function TabList({ tabs }) {
  return (
    <AnimatePresence mode="popLayout">
      {tabs.map((tab, i) => (
        <motion.div
          key={tab.id}
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{
            type: 'spring',
            stiffness: 350,
            damping: 30,
            delay: i * 0.03, // stagger
          }}
        >
          <TabItem tab={tab} />
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

// 视图切换动画
function ViewTransition({ current, children }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={current}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// reduced-motion 检测 — CSS + JS 双通道
// CSS: @media (prefers-reduced-motion: reduce) { ... }
// JS: useReducedMotion hook
function AnimatedComponent() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      animate={shouldReduceMotion ? { opacity: 1 } : { x: 0 }}
      transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring' }}
    />
  );
}
```

**来源:** [CITED: motion.dev/docs/react-animation] [CITED: motion.dev/docs/react-accessibility] [CITED: motion.dev/docs/react-use-reduced-motion]

### Pattern 6: A11y 焦点态样式

**What:** 使用 `:focus-visible` + 2px solid outline + outline-offset
**When to use:** 所有可交互元素

```css
/* 全局焦点态 — 只在键盘导航时显示 */
*:focus-visible {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
}

/* 移除鼠标点击时的焦点框 */
*:focus:not(:focus-visible) {
  outline: none;
}

/* 暗色主题焦点颜色调整 */
[data-theme="dark"] {
  --focus-ring-color: #60a5fa; /* blue-400，暗色下更亮 */
}
```

**为什么用 outline 而非 border：**
- outline 不影响布局（不增加元素尺寸）
- outline-offset 可让焦点环与元素有间距
- 2px solid 是 WCAG 推荐的最小可见描边宽度

**来源:** [CITED: MDN :focus-visible] [CITED: w3school :focus-visible]

### Pattern 7: 自建轻量 i18n 系统

**What:** useT hook + 字典对象 + Zustand 语言状态，无需重依赖
**When to use:** 所有面向用户的文字

```typescript
// src/shared/i18n/context.ts
import { createContext, useContext } from 'react';
import type { Locale } from '@/shared/types';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export const I18nContext = createContext<I18nContextValue>(null!);
export const useI18n = () => useContext(I18nContext);

// src/shared/i18n/useT.ts
export function useT() {
  const { t } = useI18n();
  return t;
}

// src/shared/i18n/locales/zh-CN.ts
export default {
  'header.search': '搜索',
  'header.archive': '归档',
  'header.tabCount': '{count} 个标签页',
  'toast.closed': '已关闭 {count} 个标签页',
  'toast.undo': '撤销',
  'search.placeholder': '搜索标签页...',
  'search.results': '找到 {count} 个结果',
  'search.empty': '没有找到匹配的标签页',
  'search.hint': '试试其他关键词',
  'onboarding.title': '欢迎使用 Canopy 🌿',
  'onboarding.subtitle': '你的标签，一目了然。',
  'onboarding.desc': '每次打开新标签页，所有已打开的网页都会在这里展示。按域名分组、搜索、归档——3 秒内找到任何标签。',
  'onboarding.start': '开始使用',
  'archive.title': '归档会话',
  'archive.empty': '暂无归档会话',
  'archive.emptyHint': '点击归档按钮保存当前所有标签页',
  'archive.tabCount': '{count} 个标签页',
  'archive.restore': '恢复',
  'archive.delete': '删除',
  'theme.light': '浅色',
  'theme.dark': '深色',
  'theme.system': '跟随系统',
  'gradient.aurora': '极光',
  'gradient.sunrise': '日出',
  'gradient.deepspace': '深空',
  'gradient.custom': '自定义',
  'loading.tabs': '加载标签页中...',
} as const;

// src/shared/i18n/locales/en.ts
export default {
  'header.search': 'Search',
  'header.archive': 'Archive',
  'header.tabCount': '{count} tabs',
  // ... 同结构英译
} as const;
```

**ICU MessageFormat 需求分析：**
- 当前只有简单插值 `{count}`，无复数/性别等复杂需求
- `Intl.PluralRules` 可在需要时简单扩展，无需引入 ICU 库
- 日期格式化用 `Intl.DateTimeFormat`，数字用 `Intl.NumberFormat`（I18N-02 要求）

### Pattern 8: Intl API 日期/数字格式化

**What:** 替换 date-fns 硬编码 locale，使用 Intl API 自动适配语言
**When to use:** 日期显示（ArchivePanel 等）

```typescript
// 替换 ArchivePanel 中的 date-fns 硬编码中文
function formatDate(timestamp: number, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'zh-CN' ? 'zh-CN' : 'en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

// 数字格式化
function formatNumber(num: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'zh-CN' ? 'zh-CN' : 'en').format(num);
}
```

**来源:** [CITED: MDN Intl.DateTimeFormat] [ASSUMED: Intl API 是浏览器原生标准]

### Anti-Patterns to Avoid
- **硬编码颜色值（如 `bg-white/15`, `text-white/90`）：** 所有颜色必须用 CSS 变量，否则亮色主题无法切换
- **inline script 防 FOUC：** MV3 CSP 禁止 inline script，用外部脚本方案
- **仅用 `prefers-color-scheme` 驱动暗色模式：** 用户需要手动切换，必须支持 data-theme 属性驱动
- **`blur(40px+)` 大面积毛玻璃：** 性能杀手，8-16px 是最佳平衡，24px 用于小面积卡片
- **多层毛玻璃叠加：** 一层优雅，两层混乱，三层性能灾难——仅最顶层用 backdrop-filter
- **颜色作为唯一信息载体：** 如仅用红色表示关闭按钮，需同时加图标 + 文字
- **`border` 做焦点环：** 会影响布局和元素尺寸，用 `outline`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 主题切换 | JS 操作 style 属性切换颜色 | CSS 变量 + data-theme 属性 | 零 JS 渲染开销，CSS 原生级联 |
| 暗色模式工具类 | 自定义 dark 前缀 | TW4 `@custom-variant dark` | 官方支持，编译时生成 |
| 动画弹簧物理 | 自写 spring 数学 | motion `type: 'spring'` | 运动学方程复杂，motion 已优化 |
| reduced-motion 检测 | `window.matchMedia` 手写 | `useReducedMotion` hook | motion 库已封装，自动响应变化 |
| 组件卸载动画 | `setTimeout` + 状态管理 | `AnimatePresence` | 自动管理 DOM 移除时机 |
| 日期/数字国际化 | 手写格式化 | `Intl.DateTimeFormat` / `Intl.NumberFormat` | 浏览器原生，自动适配 locale |
| i18n 重框架 | react-i18next (40KB+) | 自建 useT hook (<1KB) | 仅 zh-CN/en 双语，无需复杂功能 |
| 焦点态样式 | `border` + 计算 padding | `outline` + `outline-offset` | outline 不影响布局 |

**Key insight:** 本项目目标仅 Chrome 浏览器，无需考虑 Firefox/Safari 兼容性，可以放心使用 `backdrop-filter`、`@property`、`:focus-visible` 等 Chrome 完整支持的特性。

## Common Pitfalls

### Pitfall 1: 毛玻璃亮色主题对比度不足
**What goes wrong:** 亮色主题下 `rgba(255,255,255,0.15)` 的毛玻璃卡片在浅色渐变背景上几乎不可见
**Why it happens:** 毛玻璃效果在暗色主题下天然好看（白边+暗底），但亮色主题下白底+白边=融合
**How to avoid:** 亮色主题使用更高的背景不透明度(0.5+)，更强的边框(rgba(255,255,255,0.6))，添加微阴影(0 4px 16px rgba(0,0,0,0.06))
**Warning signs:** 亮色主题下卡片看起来"消失"在背景中

### Pitfall 2: FOUC — 首帧渲染闪白
**What goes wrong:** 新标签页先渲染亮色默认样式，再切换为暗色，产生闪烁
**Why it happens:** React 渲染是异步的，`useEffect` 中读取 storage 设置主题时已经渲染了一帧
**How to avoid:** 在 `index.html` 的 `<head>` 中用外部脚本同步设置 `data-theme`，确保 CSS 在首帧就应用正确变量
**Warning signs:** 暗色主题用户看到一帧白屏闪烁

### Pitfall 3: MV3 CSP 阻止 inline script
**What goes wrong:** 在 `index.html` 中写 `<script>...</script>` 被浏览器 CSP 拒绝
**Why it happens:** MV3 默认 CSP 禁止所有 inline script
**How to avoid:** 使用外部 `.js` 文件（CSP 允许扩展内的外部脚本），`vite.config.ts` 的 `chromeExtensionPlugin` 需要输出 `theme-init.js`
**Warning signs:** 控制台报 CSP 违规错误，inline script 不执行

### Pitfall 4: 渐变动画 + 毛玻璃性能
**What goes wrong:** 500+ Tab 场景下 `backdrop-filter` + 渐变动画导致帧率低于 55fps
**Why it happens:** 每个 `backdrop-filter` 元素需要 GPU 单独合成纹理，`blur(24px)` 开销大，叠加渐变动画持续重绘
**How to avoid:** (1) 仅卡片使用 backdrop-filter，不嵌套；(2) 渐变动画用 `background-position` 而非重绘渐变；(3) 折叠的分组卡片不渲染子项；(4) 考虑长列表用 `content-visibility: auto`
**Warning signs:** Perf DevTools 帧率 < 55fps

### Pitfall 5: 对比度验证不充分
**What goes wrong:** 在某些渐变背景色上，毛玻璃卡片文字对比度 < 4.5:1
**Why it happens:** 渐变背景色域广，某些区域（如深色区域+暗色文字）对比度可能不足
**How to avoid:** (1) 毛玻璃背景不透明度 ≥ 0.5；(2) 使用 Chrome DevTools 的对比度检查器；(3) 在三种渐变预设的最暗区域验证
**Warning signs:** 部分卡片文字难以辨认

### Pitfall 6: 颜色作为唯一信息载体
**What goes wrong:** 仅用颜色区分状态（如红色=关闭、绿色=恢复），色盲用户无法区分
**Why it happens:** 设计师/开发者默认色觉正常视角
**How to avoid:** 每个颜色信号同时配合图标（✕/↩/⚡）+ 文字标签。UndoToast 已有图标+文字。需检查 ArchivePanel 的恢复/删除按钮
**Warning signs:** 按钮仅用颜色区分，无图标或文字

### Pitfall 7: 渐变切换时的闪烁
**What goes wrong:** 切换渐变预设时背景瞬间跳变
**Why it happens:** CSS 变量变化导致 `linear-gradient` 立即重绘
**How to avoid:** 使用伪元素层叠 + opacity 过渡实现渐变切换动画（约 300ms crossfade）
**Warning signs:** 切换预设时背景"跳"一下

## Code Examples

### 完整主题系统 index.css（扩展版）
```css
/* 来源: TW4 官方文档模式 + 项目现有结构 */
@import "tailwindcss";

/* ── 主题变体 ────────────────────────────── */
@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));

/* ── 渐变预设 ────────────────────────────── */
:root,
[data-gradient="aurora"] {
  --gradient-1: #F5F7FA;
  --gradient-2: #E0C3FC;
  --gradient-3: #8EC5FC;
}
[data-gradient="sunrise"] {
  --gradient-1: #FEE140;
  --gradient-2: #FA709A;
  --gradient-3: #FBC2EB;
}
[data-gradient="deepspace"] {
  --gradient-1: #0F2027;
  --gradient-2: #203A43;
  --gradient-3: #2C5364;
}

/* ── 亮色 Token（默认）────────────────────── */
:root {
  --color-surface: rgba(255, 255, 255, 0.5);
  --color-surface-hover: rgba(255, 255, 255, 0.65);
  --color-text-primary: rgba(0, 0, 0, 0.87);
  --color-text-secondary: rgba(0, 0, 0, 0.55);
  --color-text-muted: rgba(0, 0, 0, 0.35);
  --color-border: rgba(255, 255, 255, 0.6);
  --glass-bg: rgba(255, 255, 255, 0.5);
  --glass-border: rgba(255, 255, 255, 0.6);
  --glass-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  --focus-ring-color: #3b82f6;
}

/* ── 暗色 Token ────────────────────────────── */
[data-theme="dark"] {
  --color-surface: rgba(255, 255, 255, 0.15);
  --color-surface-hover: rgba(255, 255, 255, 0.25);
  --color-text-primary: rgba(255, 255, 255, 0.9);
  --color-text-secondary: rgba(255, 255, 255, 0.55);
  --color-text-muted: rgba(255, 255, 255, 0.35);
  --color-border: rgba(255, 255, 255, 0.2);
  --glass-bg: rgba(255, 255, 255, 0.15);
  --glass-border: rgba(255, 255, 255, 0.2);
  --glass-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  --focus-ring-color: #60a5fa;
}

/* ── TW4 @theme inline（让工具类响应变量）── */
@theme inline {
  --color-surface: var(--color-surface);
  --color-text-primary: var(--color-text-primary);
  --color-text-secondary: var(--color-text-secondary);
  --color-border: var(--color-border);
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 20px;
  --font-family-sans: -apple-system, 'SF Pro Text', 'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --blur-card: blur(24px) saturate(180%);
  --ease-standard: cubic-bezier(.22,.61,.36,1);
}

/* ── 全局样式 ────────────────────────────── */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--font-family-sans);
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
  background: linear-gradient(135deg, var(--gradient-1), var(--gradient-2), var(--gradient-3));
  background-size: 400% 400%;
  background-attachment: fixed;
  animation: gradient-flow 45s ease infinite;
}

@keyframes gradient-flow {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@media (prefers-reduced-motion: reduce) {
  body { animation: none; background-size: 100% 100%; }
}

/* ── 焦点态 ────────────────────────────── */
*:focus-visible {
  outline: 2px solid var(--focus-ring-color);
  outline-offset: 2px;
}
*:focus:not(:focus-visible) {
  outline: none;
}

/* ── 毛玻璃工具类 ────────────────────────── */
.glass {
  background: var(--glass-bg);
  backdrop-filter: var(--blur-card);
  -webkit-backdrop-filter: var(--blur-card);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow);
}
.glass:hover {
  background: var(--color-surface-hover);
}
```

### TabItem 迁移示例（硬编码 → CSS 变量）
```tsx
/* 迁移前: */
<button className="bg-white/15 hover:bg-white/25 backdrop-blur-xl border border-white/20 text-white/90 text-sm">

/* 迁移后: */
<button className="glass rounded-[var(--radius-md)] text-[var(--color-text-primary)] text-sm
  transition-all duration-200 cursor-pointer">
```

### ThemeToggle 组件
```tsx
import { Sun, Moon, Monitor } from 'lucide-react';
import { useSettingsStore } from '@/store';

const themeIcons = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const themeOrder: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];

export function ThemeToggle() {
  const theme = useSettingsStore((s) => s.settings.theme);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const Icon = themeIcons[theme];

  const cycle = () => {
    const next = themeOrder[(themeOrder.indexOf(theme) + 1) % 3];
    updateSettings({ theme: next });
    // 同步 data-theme 属性
    const effective = next === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : next;
    document.documentElement.setAttribute('data-theme', effective);
  };

  return (
    <button
      onClick={cycle}
      aria-label={`切换主题，当前：${theme}`}
      className="w-8 h-8 flex items-center justify-center rounded-full
        glass text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]
        transition-all duration-150 cursor-pointer"
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TW3 `darkMode: 'class'` in tailwind.config | TW4 `@custom-variant dark` in CSS | TW4 (2025) | CSS-first 配置，无需 JS config 文件 |
| Framer Motion `framer-motion` 包 | `motion` + `motion/react` 导入 | v11+ (2024) | 包名变更，API 兼容 |
| TW3 `theme.extend` in JS config | TW4 `@theme` / `@theme inline` in CSS | TW4 (2025) | 设计 token 在 CSS 中定义 |
| `border` 做焦点环 | `outline` + `:focus-visible` | 2019+ | 不影响布局，键盘专用 |
| `prefers-color-scheme` only | `data-theme` 属性 + `@custom-variant` | 2020+ | 支持手动切换 |
| CSS gradient 无法动画 | `background-size: 400%` + position 动画 | 2018+ | 纯 CSS 渐变流动 |
| i18n 重框架 (react-i18next) | 自建轻量 hook | — | <1KB vs 40KB+ |

**Deprecated/outdated:**
- `framer-motion` 包名：已改为 `motion`，从 `motion/react` 导入 React 组件
- TW3 `tailwind.config.ts`：TW4 不再使用 JS 配置文件，全部在 CSS 中
- `dark:` 前缀默认用 `prefers-color-scheme`：需用 `@custom-variant dark` 覆盖为 `data-theme` 驱动

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@theme inline` 中引用的 CSS 变量在变量值变化时自动更新 Tailwind 工具类 | Architecture Patterns | 如果不自动更新，需要手动刷新或用 JS 切换类名 |
| A2 | MV3 默认 CSP 允许扩展内部的外部脚本文件 | Pattern 2 无 FOUC | 如果不允许，需要其他方案如 content script 注入 |
| A3 | motion v12 的 `useReducedMotion` 返回 boolean 且自动响应系统设置 | Pattern 5 | 需验证 API 签名 |
| A4 | Chrome Extension `chrome.storage.local.get` 可在非 Service Worker 上下文（newtab 页面）中同步调用 | Pattern 2 | 如果只能异步，FOUC 防护需要调整策略 |
| A5 | `backdrop-filter` 在 Chrome 新标签页中渲染正常（与普通网页无差异） | Architecture Patterns | Chrome 扩展页面可能有特殊渲染限制 |
| A6 | 自建 useT hook + 字典对象足够满足 i18n 需求（无需 ICU 库） | Pattern 7 | 如果后续需要复数/性别等，需要引入 Intl.PluralRules 或 ICU 库 |

## Open Questions

1. **渐变切换过渡方案**
   - What we know: CSS 变量切换会导致 `linear-gradient` 立即重绘
   - What's unclear: 是否需要伪元素 crossfade 过渡，还是可以接受瞬间切换
   - Recommendation: 先实现瞬间切换，后续可优化为 crossfade（使用伪元素层叠 + opacity 过渡）

2. **@theme inline 变量响应性**
   - What we know: TW4 `@theme inline` 可以引用外部 CSS 变量
   - What's unclear: 当 CSS 变量值通过 `[data-theme]` 选择器改变时，Tailwind 工具类是否自动更新
   - Recommendation: 根据官方文档模式，`@theme inline` 中的变量引用会在 CSS 变量变化时自动生效——但需在实现时验证

3. **500+ Tab 场景下 backdrop-filter 性能**
   - What we know: 折叠分组时子项不渲染，实际可见卡片数量有限
   - What's unclear: 在最坏情况下（所有分组展开），backdrop-filter 的 GPU 合成开销
   - Recommendation: 实现后用 Perf DevTools 验证，必要时对折叠区域用 `content-visibility: auto`

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Chrome Browser | 扩展运行时 | ✓ | — | — |
| tailwindcss | Design Token + 主题 | ✓ | 4.2.4 | — |
| motion | 动画系统 | ✓ | 12.38.0 | — |
| zustand | 状态管理 | ✓ | 5.0.12 | — |
| lucide-react | 主题切换图标 | ✓ | 1.8.0 | — |
| date-fns | 日期格式化 | ✓ | 4.1.0 | Intl.DateTimeFormat 替代 |
| vitest | 测试框架 | ✓ | 4.1.0 | — |

**Missing dependencies with no fallback:**
- None — 所有核心依赖已安装

**Missing dependencies with fallback:**
- None

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 + React Testing Library 16.3.0 |
| Config file | vitest.config.ts |
| Quick run command | `npm test -- --reporter=verbose` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VISUAL-01 | 毛玻璃卡片在亮暗主题下正确渲染 | unit | `npm test -- tests/unit/theme.test.ts` | ❌ Wave 0 |
| VISUAL-02 | 渐变预设切换正确更新 data-gradient | unit | `npm test -- tests/unit/gradient.test.ts` | ❌ Wave 0 |
| VISUAL-03 | 主题切换更新 data-theme 属性 | unit | `npm test -- tests/unit/theme-toggle.test.ts` | ❌ Wave 0 |
| VISUAL-04 | 对比度计算 ≥ 4.5:1 | unit | `npm test -- tests/unit/contrast.test.ts` | ❌ Wave 0 |
| VISUAL-06 | reduced-motion 禁用动画 | unit | `npm test -- tests/unit/reduced-motion.test.ts` | ❌ Wave 0 |
| A11Y-02 | 焦点态样式应用 | unit | `npm test -- tests/unit/focus-visible.test.ts` | ❌ Wave 0 |
| I18N-01 | i18n hook 正确翻译文案 | unit | `npm test -- tests/unit/i18n.test.ts` | ❌ Wave 0 |
| I18N-02 | Intl API 日期/数字格式化 | unit | `npm test -- tests/unit/intl-format.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/theme.test.ts` — covers VISUAL-01, VISUAL-03
- [ ] `tests/unit/gradient.test.ts` — covers VISUAL-02
- [ ] `tests/unit/contrast.test.ts` — covers VISUAL-04
- [ ] `tests/unit/reduced-motion.test.ts` — covers VISUAL-06
- [ ] `tests/unit/focus-visible.test.ts` — covers A11Y-02
- [ ] `tests/unit/i18n.test.ts` — covers I18N-01
- [ ] `tests/unit/intl-format.test.ts` — covers I18N-02
- [ ] `tests/unit/theme-toggle.test.tsx` — ThemeToggle 组件交互测试

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | 扩展无认证需求 |
| V3 Session Management | no | 无服务端会话 |
| V4 Access Control | no | 无角色权限 |
| V5 Input Validation | yes | 自定义渐变颜色值需验证（hex/rgb 格式） |
| V6 Cryptography | no | 无加密需求 |

### Known Threat Patterns for Chrome Extension + CSS

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via CSS injection (自定义渐变颜色) | Tampering | 验证颜色值为合法 hex/rgb，拒绝含 JS 的值 |
| Storage data tampering | Tampering | chrome.storage.local 仅扩展自身可写，风险低 |
| CSS 变量覆盖攻击 | Spoofing | data-theme 值白名单验证（light/dark/system） |

### V5 Input Validation — 自定义渐变

```typescript
// 自定义渐变颜色值验证
const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
const RGB_COLOR_REGEX = /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)$/;

function validateColor(value: string): boolean {
  return HEX_COLOR_REGEX.test(value) || RGB_COLOR_REGEX.test(value);
}
```

## Sources

### Primary (HIGH confidence)
- Tailwind CSS v4 官方文档 — dark-mode, theme, colors, adding-custom-styles [CITED: tailwindcss.com]
- Motion v12 官方文档 — AnimatePresence, useReducedMotion, spring transitions [CITED: motion.dev]
- Chrome Extension MV3 CSP 文档 [CITED: developer.chrome.com]
- npm registry 版本验证 [VERIFIED: npm view]

### Secondary (MEDIUM confidence)
- Glassmorphism 可访问性最佳实践 [CITED: lifa-su.com]
- CSS 渐变动画 5 种方法 [CITED: frontend-hero.com]
- CRXJS HTML Inline Scripts Plugin 分析 [CITED: deepwiki.com]

### Tertiary (LOW confidence)
- [ASSUMED] @theme inline 变量响应性 — 基于 TW4 文档模式推断，需验证
- [ASSUMED] chrome.storage.local 在 newtab 页面可直接调用 — 常见模式，需验证

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 所有核心库已安装，版本已验证，API 已通过 Context7 确认
- Architecture: HIGH — TW4 @custom-variant + @theme inline 是官方推荐模式，无 FOUC 方案有明确技术路径
- Pitfalls: HIGH — 毛玻璃亮色对比度、MV3 CSP、渐变动画性能均有明确来源的实践指导
- i18n: MEDIUM — 自建方案可行但需验证是否满足 I18N-02 的 ICU MessageFormat 需求

**Research date:** 2026-04-22
**Valid until:** 2026-05-22（30 天，稳定技术栈）
