# Phase 3: 域名分组视图 - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning (回溯式补档)

<domain>
## Phase 边界

本阶段聚焦于:
- 将 LiveTab[] 按注册域名(PSL/tldts)分组;
- 提供默认的“域名分组视图”作为新标签页的主视图;
- 支持分组的折叠/展开、排序和空状态展示;
- 在设置中提供是否接管新标签页的开关。

不包括: 搜索、一键归档、去重、会话管理、多视图切换(时间轴/紧凑/网格/频率)等功能,这些由后续 Phase 承担。
</domain>

<decisions>
## 实现决策(与当前代码对齐)

### 域名提取
- **D-01:** 使用 `tldts` 库在 `src/shared/utils/domain.ts` 中实现注册域名提取逻辑(`getRegisteredDomain` 等);
- **D-02:** 定义 `DomainInfo` 类型,统一描述域名/注册域名/顶级域等结构,为视图与分组逻辑提供基础。

### 分组与排序
- **D-03:** 在 `src/shared/utils/domain.ts:57-84` 中实现 `groupTabsByDomain` 函数:
  - 按注册域名分组 LiveTab[];
  - 分组之间按 Tab 数量降序排列;
  - 组内按最近访问时间(lastAccessed)降序排列;
  - 固定 Tab 有单独排布策略,在视图层进行优先展示。

### 视图组件
- **D-04:** 默认视图组件为 `DomainGroupView` (`src/features/tabs/DomainGroupView.tsx:1-53`),职责:
  - 调用分组逻辑,将 LiveTab[] 转换为域名分组列表;
  - 展示统计信息(总 Tab 数、域名分组数);
  - 根据当前 filters/search 结果渲染分组或空状态。
- **D-05:** 分组卡片组件为 `DomainGroupCard` (`src/features/tabs/DomainGroupCard.tsx:1-108`),职责:
  - 显示域名 favicon、名称、数量徽标;
  - 渲染分组内 Tab 列表,支持折叠/展开;
  - 提供关闭整组 Tab 的操作入口。

### 折叠/展开与持久化
- **D-06:** 当前实现中,每个分组的折叠状态使用组件内部状态(`useState`)管理,刷新后会丢失;
- **D-07:** 未来计划将折叠状态持久化到 storage,以域名或 groupId 作为 key,在本 Phase 中记为明确的待完成项。

### newtab 接管开关
- **D-08:** 类型上已经在 `UserSettings` 中定义 `overrideNewTab` 字段(`src/shared/types.ts:72`),并在 StorageRepo 中有对应持久化;
- **D-09:** 当前 UI 中尚未暴露该控制项,需要在后续对 SettingsPanel 进行补充,本 Phase 中记为待完成项。

</decisions>

<canonical_refs>
## 规范引用

- `.planning/PROJECT.md` — 产品整体定位与核心约束;
- `.planning/ROADMAP.md` — Phase 3「域名分组视图」目标/计划/成功标准;
- `.planning/REQUIREMENTS.md` — DOMAIN/NEWTAB 相关需求;
- `src/shared/utils/domain.ts:1-92` — 域名提取与分组逻辑;
- `src/features/tabs/DomainGroupView.tsx:1-53` — 域名分组视图主组件;
- `src/features/tabs/DomainGroupCard.tsx:1-108` — 分组卡片组件;
- `src/shared/types.ts:60-80` — UserSettings 等类型定义;
- `src/repositories/storage-repo.ts:1-120` — Settings/Meta 持久化逻辑。
</canonical_refs>

<code_context>
## 现有代码洞察

- 分组和视图逻辑已经可以完整支撑“域名分组视图”作为默认视图;
- 折叠/展开交互已经实现,但缺少跨会话持久化;
- newtab 接管开关已经在模型层存在,但尚未出现在 UI 层,属于典型“模型已备,界面未连”的状态。
</code_context>

<specifics>
## 具体想法

- 折叠状态持久化可以复用 Settings/Meta 或单独引入一个 `uiState` 命名空间,按注册域名 key 存储;
- newtab 接管开关可以放入设置面板的“行为”分组中,提供显眼的描述和警示文案;
- 域名分组视图后续还可以与去重功能联动,在 InfoBar 或卡片上标记重复程度。

</specifics>

<deferred>
## 延后处理事项

- 折叠状态持久化的具体实现与性能权衡;
- Settings UI 中 newtab 接管开关的布局与文案设计。

</deferred>

---

*Phase: 03-域名分组视图*
*Context gathered: 2026-04-22*