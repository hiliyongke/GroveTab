# Phase 6: 视觉系统 + 主题 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 06-视觉系统与主题
**Areas discussed:** 渐变背景方案, 主题切换机制, 动效体系, A11y+i18n

---

## 渐变背景方案

| Option | Description | Selected |
|--------|-------------|----------|
| Aurora=极光绿紫 / Sunrise=暖橙粉金 / Deep Space=深蓝紫黑 | 对比鲜明的三档 | |
| Aurora=冷蓝绿 / Sunrise=暖橙黄 / Deep Space=暗灰紫 | 偏克制的三档 | |
| Claude 定 | 确保三套风格差异明显且都与毛玻璃搭配好看 | ✓ |

**User's choice:** Claude 定，确保三套风格差异明显且与毛玻璃搭配好看
**Notes:** 用户不纠结具体色值，信任 Claude 的审美判断

| Option | Description | Selected |
|--------|-------------|----------|
| 两个颜色选择器 + 实时预览 | 简单直接 | |
| 预设调色板(8-12色)选2色 + 颜色选择器兜底 | 降低选择焦虑 | |
| Claude 定 | 确保操作简单即可 | ✓ |

**User's choice:** Claude 定，确保操作简单

| Option | Description | Selected |
|--------|-------------|----------|
| 加缓慢流动动画(30-60s cycle) | 让背景有生命力 | ✓ |
| 静态渐变 | 性能优先 | |
| reduced-motion 时关闭，默认开启 | 折中 | |

**User's choice:** 是 — 加缓慢流动动画(30-60s cycle)，让背景有生命力

---

## 主题切换机制

| Option | Description | Selected |
|--------|-------------|----------|
| CSS 变量 + data-theme 属性 | 内联脚本渲染前注入，无 FOUC | |
| Tailwind dark: 变体 | media 或 class 策略切换 | |
| Claude 定 | 必须无 FOUC | ✓ |

**User's choice:** Claude 定，但必须无 FOUC

| Option | Description | Selected |
|--------|-------------|----------|
| 亮色 bg-white/70 + 微阴影 | 类 macOS 浅色毛玻璃 | |
| 亮色 bg-white/40 + 较强边框 | 保持透明感但增强对比 | |
| Claude 定 | 确保亮暗下都美观可读 | ✓ |

**User's choice:** Claude 定，确保亮暗下都美观可读

| Option | Description | Selected |
|--------|-------------|----------|
| Header 右侧主题切换图标 | 日/月/自动循环切换 | |
| 仅设置面板切换 | Phase 8 时再加 | |
| Header + 设置面板都做 | 双入口 | ✓ |

**User's choice:** Header 加图标 + 设置面板都做

---

## 动效体系

| Option | Description | Selected |
|--------|-------------|----------|
| 全量动画 spring + stagger，500+ 简化 | 兼顾美观和性能 | |
| 仅分组级别动画 | Tab 内部瞬态 | |
| Claude 定 | 兼顾美观和性能即可 | ✓ |

**User's choice:** Claude 定，兼顾美观和性能

| Option | Description | Selected |
|--------|-------------|----------|
| 淡入淡出 150ms | 简单稳定 | |
| 交叉溶解 + 轻微上移 | 类 iOS | |
| Claude 定 | 确保过渡自然不突兀 | ✓ |

**User's choice:** Claude 定，确保过渡自然不突兀

| Option | Description | Selected |
|--------|-------------|----------|
| 完全禁用所有动画 | 尊重用户选择 | |
| 保留必要状态过渡，去掉装饰性 | 折中方案 | |
| Claude 定 | 确保 a11y 合规 | ✓ |

**User's choice:** Claude 定，确保 a11y 合规

---

## A11y + i18n

| Option | Description | Selected |
|--------|-------------|----------|
| 2px 亮色实线外描边 | 清晰实用 | |
| 2px 发光环效果 | 更柔和美观 | |
| Claude 定 | 确保视觉清晰 | ✓ |

**User's choice:** Claude 定，确保视觉清晰

| Option | Description | Selected |
|--------|-------------|----------|
| 自建轻量 i18n hook | 零依赖，够用 | |
| react-intl / i18next | 功能全但偏重 | |
| Claude 定 | Chrome 扩展场景够用就行 | ✓ |

**User's choice:** Claude 定，Chrome 扩展场景够用就行

| Option | Description | Selected |
|--------|-------------|----------|
| 只做基座 + 核心文案 | 其余随功能补全 | |
| Phase 6 一次性翻译所有 | 工作量大 | |
| Claude 定 | 确保基座稳固 | ✓ |

**User's choice:** Claude 定，确保基座稳固

---

## Claude's Discretion

- 三套预设渐变具体色值和角度
- 自定义渐变选择器交互细节
- 主题 CSS 变量体系设计
- 亮色主题毛玻璃卡片参数
- Tab 动画 spring 参数
- 视图切换 AnimatePresence 配置
- reduced-motion 具体规则
- 焦点态 outline 样式
- i18n hook API 和字典结构
- Phase 6 翻译范围

## Deferred Ideas

None — discussion stayed within phase scope
