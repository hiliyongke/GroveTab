---
name: grovetab-comprehensive-code-audit
overview: 对 GroveTab 扩展项目进行全面代码审查，排除小组件目录，重点检查功能完整性、逻辑正确性、UI布局与设置可用性。
todos:
  - id: review-entry-architecture
    content: 审查入口层与全局架构（App.tsx、popup、sw、chrome/）的逻辑正确性与数据流安全
    status: completed
  - id: review-core-features
    content: 审查核心功能模块（tabs、sessions、search、dashboard、workspace、insights）的功能完整性与代码质量
    status: completed
  - id: review-settings-usability
    content: 深度审查设置模块可用性（所有 panels、设置链路、用户操作流程与即时反馈）
    status: completed
  - id: review-infrastructure
    content: 审查共享基础设施（store slices、shared、services、repositories）的类型安全与架构一致性
    status: completed
  - id: verify-ui-layout
    content: 使用 [MCP:chrome-devtools] 运行扩展并验证UI布局与交互一致性
    status: completed
    dependencies:
      - review-entry-architecture
      - review-core-features
      - review-settings-usability
  - id: compile-report
    content: 汇总审查结果，使用 [skill:gsd-code-review] 生成分类问题报告与优先级改进建议
    status: completed
    dependencies:
      - review-entry-architecture
      - review-core-features
      - review-settings-usability
      - review-infrastructure
      - verify-ui-layout
---

## 产品概述

对 GroveTab Chrome 扩展（v1.3.0）除小组件（dashboard-widgets、hero-widgets）外的全部代码进行系统性质量审查，聚焦功能完整性、逻辑正确性、UI布局完美性与设置可用性。

## 核心审查维度

- **功能完整性**：检查各功能模块是否完整实现声明能力，边缘场景是否被覆盖，是否存在功能遗漏或未实现的声明
- **逻辑正确性**：状态管理一致性、异步流程安全性、数据流正确性、条件判断完备性、重复注册或竞态条件
- **UI布局完美性**：样式一致性、响应式适配、间距对齐、视觉层次、交互反馈、暗色模式兼容性
- **设置可用性**：设置项组织是否合理、操作流程是否直观、即时反馈是否到位、配置与实际效果是否同步、设置持久化可靠性

## 技术栈

- 前端框架：React 19 + TypeScript
- 构建工具：Vite 8
- UI 组件库：Ant Design 6
- 状态管理：Zustand 5
- 扩展平台：Chrome Extension Manifest V3

## 审查方法

1. **静态代码分析**：按模块逐文件审查源码，检查类型安全、逻辑分支、异常处理、死代码
2. **架构一致性检查**：验证是否遵循"UI只读store，不直接调用chrome.* API"的分层约定
3. **数据流审查**：追踪 BroadcastChannel → Store → UI 的同步链路，检查竞态条件与重复订阅
4. **运行时UI验证**：通过 Chrome DevTools MCP 加载扩展，检查各视图渲染与交互表现
5. **设置链路端到端测试**：变更设置项 → 观察UI即时反馈 → 验证持久化 → 刷新后恢复

## 关键审查范围

- **排除目录**：`src/features/dashboard-widgets/`、`src/features/hero-widgets/`
- **重点模块**：`features/settings/`（可用性深度评估）、`features/tabs/`（9种视图）、`pages/newtab/App.tsx`（主入口）、`sw/index.ts`（Service Worker）

## Agent Extensions

### Skill

- **gsd-code-review**
- Purpose: 对核心功能模块代码进行系统性审查，识别逻辑缺陷、安全风险和代码质量问题
- Expected outcome: 产出各模块的审查发现，分类为 bug / 性能隐患 / 可维护性问题

### MCP

- **chrome-devtools**
- Purpose: 运行扩展的新标签页，检查UI布局、样式一致性和交互行为，验证设置变更的即时反馈
- Expected outcome: 通过截图和元素审查验证各视图的视觉表现，确认设置操作流程的顺畅性