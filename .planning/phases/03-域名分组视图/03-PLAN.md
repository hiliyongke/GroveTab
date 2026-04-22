# Phase 3 PLAN — 域名分组视图

**Created:** 2026-04-22

## 1. Phase 目标

- 将所有 LiveTab 按注册域名进行分组,并作为新标签页的默认视图;
- 提供可用的域名分组视图组件,支持折叠/展开与批量操作;
- 提供清晰的空状态提示;
- 在设置中提供关闭新标签页接管的开关。

## 2. 非目标(Out of Scope)

- 时间轴视图/紧凑列表/网格卡片/频率视图(交给 Phase 7);
- 去重提示与 InfoBar(交给 Phase 8);
- 复杂视觉与动效(交给 Phase 6)。

## 3. Wave 划分

### Wave 1: 域名提取与分组逻辑

**目标:** 提供稳定的域名提取与分组算法,供视图层复用。

**Tasks:**
- Task 1: 使用 tldts 编写域名工具
  - 在 `src/shared/utils/domain.ts` 中实现 `getDomainInfo`/`getRegisteredDomain` 等函数;
  - 处理异常 URL/空字符串等极端情况;
  - 提供 `DomainInfo` 类型定义。
- Task 2: 域名分组函数
  - 在同一文件中实现 `groupTabsByDomain` 函数;
  - 按注册域名分组,组间按 Tab 数量降序,组内按最近访问时间降序。

### Wave 2: 域名分组视图组件

**目标:** 实现默认视图组件与分组卡片组件,支撑实际 UI 呈现。

**Tasks:**
- Task 3: DomainGroupView 组件
  - 从 tabs store 读取 LiveTab[];
  - 调用 `groupTabsByDomain` 得到分组列表;
  - 展示总 Tab 数与分组数统计;
  - 当无 Tab 时显示空状态提示。
- Task 4: DomainGroupCard 组件
  - 显示域名 favicon、名称与数量徽标;
  - 渲染分组内 Tab 列表;
  - 提供折叠/展开交互;
  - 提供关闭整组 Tab 的操作按钮。

### Wave 3: 折叠状态持久化 + newtab 接管开关

**目标:** 提升视图体验与可配置能力。

**Tasks:**
- Task 5: 折叠状态持久化
  - 为每个域名分组计算稳定的 key(注册域名即可);
  - 在 storage 中存储折叠状态(例如 `uiState.domainGroupsCollapsed`);
  - 在 DomainGroupView 初始化时从 storage 恢复折叠状态;
  - 在用户操作时更新 storage。
- Task 6: newtab 接管开关
  - 在 SettingsPanel 的“行为”分页中增加开关,绑定 `overrideNewTab` 字段;
  - 切换开关时更新 Settings 并在合适的时机提示用户重启浏览器或扩展;
  - 在文案中解释关闭接管的后果与恢复方式。

## 4. 风险与假设

- 假设: tldts 库在当前浏览器环境中表现稳定,解析性能可接受;
- 风险: 折叠状态持久化若实现不当,可能增加 storage 读写压力(分组数量较多时);
- 风险: newtab 接管开关的行为预期需要和用户沟通清晰,避免误关导致“看不到 Canopy”。

## 5. Done 定义(Definition of Done)

- [ ] 域名提取工具和分组函数已在 `domain.ts` 中实现,并有至少 1 个单元测试覆盖常见域名/子域场景;
- [ ] DomainGroupView/DomainGroupCard 可以正确渲染分组视图,组间/组内排序符合设计;
- [ ] 当无 Tab 时显示易懂的空状态提示;
- [ ] 分组折叠状态在刷新页面后保持不变;
- [ ] Settings 面板中提供明显的 newtab 接管开关,功能生效且文案清晰。
