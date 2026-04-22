# Phase 3 EXECUTE — 域名分组视图

**Created:** 2026-04-22

> 本文记录当前代码对 Phase 3 目标的实际实现情况,以及与 PLAN 的偏差。

## 1. 执行概览

- 现状: 域名提取、分组逻辑与视图组件已经全部实现,可以作为默认视图正常使用;
- 缺口: 折叠状态持久化与 newtab 接管开关 UI 尚未实现。

## 2. 已实现内容

1. 域名提取与分组
   - 文件: `src/shared/utils/domain.ts:1-92`
   - 内容:
     - 使用 tldts 实现 `getDomainInfo`/`getRegisteredDomain` 等函数;
     - 实现 `groupTabsByDomain` 按注册域名分组,并按数量/时间排序。

2. 域名分组视图组件
   - 默认视图: `src/features/tabs/DomainGroupView.tsx:1-53`
     - 从 tabs store 读取 LiveTab[];
     - 调用 `groupTabsByDomain` 获取分组列表;
     - 展示总 Tab 数与分组数统计;
     - 当无 Tab 时渲染空状态提示。
   - 分组卡片: `src/features/tabs/DomainGroupCard.tsx:1-108`
     - 显示域名 favicon、名称、数量徽标;
     - 渲染分组内 Tab 列表;
     - 提供折叠/展开交互;
     - 提供关闭整组 Tab 的入口。

3. 空状态
   - 当无 Tab 或过滤结果为空时,会显示友好提示文案,提示用户打开一些网页后再回来查看。

## 3. 与 PLAN 的偏差

1. 折叠状态持久化
   - PLAN: 期望在 storage 中持久化每个分组的折叠状态;
   - 实际: 仅在 `DomainGroupCard` 组件内部使用 `useState` 管理折叠状态,刷新后会重置;
   - 状态: 功能交互已具备,持久化部分尚未实现,需在后续补课。

2. newtab 接管开关 UI
   - PLAN: 在 SettingsPanel“行为”分组中提供关闭 newtab 接管的开关;
   - 实际: `UserSettings.overrideNewTab` 字段和 storage 持久化已经准备好,但设置面板未暴露对应控件;
   - 状态: 模型已具备,UI 未连通。

## 4. 遗留事项

- [ ] 为域名分组折叠状态增加持久化实现;
- [ ] 在 SettingsPanel 中增加 newtab 接管开关,并配套友好文案与行为验证。

---

*本执行记录基于当前代码的回溯整理,后续如对域名视图有任何改动,请同步更新本文件。*