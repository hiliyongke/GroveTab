# Phase 2: 新标签页接管 + 数据层 - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning (回溯式补档)

<domain>
## Phase 边界

本阶段聚焦于:
- 用 Chrome MV3 能力接管新标签页,让用户在每次打开新标签页时看到 Canopy 工作台骨架;
- 建立稳定的数据层,包括:
  - Tabs/Windows/Sessions/Storage 的 Promise 封装层;
  - Service Worker 事件总线 + BroadcastChannel 广播机制;
  - Zustand 中的 tabs 状态切片,维护 LiveTab[] 及窗口信息;
  - 基础布局(顶栏/左侧栏/主区域)和 Tab 列表渲染;
  - 首次打开的 Onboarding 引导。

不包括: 域名视图/多视图切换/搜索/归档/去重/设置等后续阶段的业务能力。
</domain>

<decisions>
## 实现决策(与实际代码对齐)

### 数据与 API 封装
- **D-01:** 使用 `src/chrome/tabs.ts` 作为 Chrome API Promise 封装层,集中封装:
  - tabs/windows/sessions/storage 相关常用调用
  - favicon 辅助函数
- **D-02:** 使用 `src/repositories/storage-repo.ts` 作为存储仓库抽象层,负责:
  - 以命名空间前缀(`canopy_*`)管理 chrome.storage.local
  - 暴露 Settings/Meta/Onboarding 等高层读写方法
- **D-03:** Service Worker 放在 `src/sw/index.ts`,负责:
  - 监听 tabs/windows 事件
  - 通过 BroadcastChannel(`canopy-sw-broadcast`)向前端广播增量事件

### 状态管理
- **D-04:** 不单独创建 TabService 类,而是将 Tab 聚合逻辑放在 Zustand tabs slice 中(`src/store/tabs-slice.ts`):
  - 负责 LiveTab[] 与 WindowInfo Map 的维护
  - 处理 SW 广播事件,执行增量更新
  - 提供跳转/关闭/批量关闭等操作
- **D-05:** 隐私窗口排除与 URL 过滤逻辑集中在 tabs slice 与 chrome 工具函数中,而非独立服务类。

### 新标签页入口
- **D-06:** 新标签页主应用位于 `src/pages/newtab/App.tsx`,直接渲染完整应用骨架:
  - 顶栏(Header): logo + 搜索入口 + 视图切换 + 主题/设置入口
  - 主区域: 默认使用域名分组视图显示 Tab 列表
  - 底部: Undo Toast、模态层
- **D-07:** Onboarding 引导通过 `src/features/sessions/OnboardingCard.tsx` 实现,配合 StorageRepo 记录完成状态。

### 尚未覆盖的点
- **D-08:** 暂未实现“其他扩展已接管新标签页”的冲突检测逻辑; 该能力保留在 Phase 2 的未来补充项中,可能需要使用 chrome.management API。

</decisions>

<canonical_refs>
## 规范引用

下游在规划/实现时应优先阅读:
- `.planning/PROJECT.md` — 项目整体上下文与技术栈
- `.planning/ROADMAP.md` — Phase 2 目标/计划/成功标准
- `.planning/REQUIREMENTS.md` — NEWTAB/TABS/STORE 相关需求条目
- `src/chrome/tabs.ts` — Chrome API 封装
- `src/repositories/storage-repo.ts` — 存储仓库封装
- `src/sw/index.ts` — MV3 Service Worker 事件总线
- `src/store/tabs-slice.ts` — Tab 状态聚合与事件处理
- `src/pages/newtab/App.tsx` — 新标签页入口与布局骨架
</canonical_refs>

<code_context>
## 现有代码洞察

- Chrome API 封装: `src/chrome/tabs.ts:1-99`
- StorageRepo: `src/repositories/storage-repo.ts:1-108`
- Service Worker: `src/sw/index.ts:1-119`
- Tabs Store: `src/store/tabs-slice.ts:1-252`
- Newtab App: `src/pages/newtab/App.tsx:1-184`
- Onboarding 卡片: `src/features/sessions/OnboardingCard.tsx:1-55`

上述文件表明,Phase 2 相关的数据层与新标签页骨架已经基本落地,唯一明显缺口是 newtab 冲突检测逻辑。
</code_context>

<specifics>
## 具体想法

- 冲突检测建议在设置 store 或 newtab 初始化阶段引入,使用 chrome.management 查询已安装扩展中是否有其它 newtab 接管者,必要时提示用户。
- 未来若需要将 tabs 逻辑进一步拆分,可以在当前实现基础上引入 `TabService` 作为 store 与 chrome 封装之间的中间层,但不是当下必要。

</specifics>

<deferred>
## 延后处理事项

- newtab 冲突检测的具体现实装与交互设计(可放入后续一个专门的子任务或 patch phase 中完成)。

</deferred>

---

*Phase: 02-新标签页接管与数据层*
*Context gathered: 2026-04-22*