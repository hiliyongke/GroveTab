# Phase 2: 新标签页接管 + 数据层 - Discussion Log

> **仅作审计轨迹使用。** 具体决策请以 CONTEXT.md 为准,本日志主要记录曾经考虑过的方案与权衡。

**Date:** 2026-04-22
**Phase:** 02-新标签页接管与数据层
**Areas discussed:** 数据层架构、新标签页入口形态、TabService 抽象与否、冲突检测策略

---

## 数据层抽象方式

| 选项 | 描述 | 结论 |
|------|------|------|
| 独立 TabService 类 | 在 `src/services/tab-service.ts` 中集中封装 tabs/windows/sessions 逻辑,store 只做状态与 action | 未采用(当前)
| Store-first 模式 | 将数据聚合与业务操作直接放在 Zustand slice 中,减少中间层 | ✓ 采用

**备注:** 当前代码已经采用 Store-first 模式(`src/store/tabs-slice.ts`),功能完整,后续如有需要再抽出 TabService。 

## Chrome 扩展接管方式

| 选项 | 描述 | 结论 |
|------|------|------|
| 仅 newtab 接管 | 通过 `chrome_url_overrides.newtab` 接管新标签页 | ✓ 已采用
| popup + newtab 双入口 | 同时提供 popup 快捷入口和 newtab 入口 | 已实现 popup 基础入口,但本 phase 主要关注 newtab

## 冲突检测

| 方案 | 描述 | 结论 |
|------|------|------|
| 不做冲突检测 | 假设用户只安装少量 newtab 扩展,忽略冲突 | 未采纳(风险较高)
| Chrome 管理 API 检测 | 使用 `chrome.management.getAll()` 检测其它扩展是否接管 newtab,有则提示用户 | 待实现(列入后续补课项)

## Deferred Ideas

- 引入 TabService 作为中间层,统一封装 tabs 相关操作,让 store 更聚焦于状态管理。
- 为 SW 事件总线补充心跳/重连机制,在 Service Worker 生命周期波动时提高鲁棒性。

---

*Log created: 2026-04-22 (auto 回溯整理)*