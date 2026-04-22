# Phase 2 PLAN — 新标签页接管 + 数据层

**Created:** 2026-04-22

## 1. Phase 目标

- 接管 Chrome 新标签页,在新标签页中渲染 Canopy 工作台骨架;
- 建立稳健的数据层,打通 Chrome Tabs/Windows/Sessions/Storage 与前端状态;
- 支持实时 Tab 更新(打开/关闭/激活/移动)的增量同步;
- 提供基础 Onboarding 引导,确保首次体验顺滑。

## 2. 非目标(Out of Scope)

- 域名视图/多视图切换(交给 Phase 3/7);
- 搜索/一键归档/去重/会话管理(交给 Phase 5/8);
- 复杂视觉系统(渐变/动效/主题切换交给 Phase 6);
- E2E 验证与性能压测(交给 Phase 10)。

## 3. Wave 划分

### Wave 1: Chrome API 封装 + StorageRepo

**目标:** 为后续所有 Phase 提供统一的浏览器 API 封装与存储抽象。

**Tasks:**
- Task 1: Chrome API Promise 封装
  - 在 `src/chrome/tabs.ts` 中封装 tabs/windows/sessions/storage 常用方法;
  - 保证所有方法返回 Promise,避免 callback 地狱;
  - 提供 favicon 辅助函数。
- Task 2: StorageRepo 抽象
  - 在 `src/repositories/storage-repo.ts` 中封装 chrome.storage.local 访问;
  - 设计 `getData/setData/removeData` 通用接口 + Settings/Meta/Onboarding 辅助方法;
  - 预留容量监控接口,供后续 Phase 使用。

### Wave 2: Service Worker 事件总线 + Zustand tabsSlice

**目标:** 实现标准的 MV3 事件总线,并在前端维护 LiveTab[] 与窗口信息。

**Tasks:**
- Task 3: Service Worker 事件监听
  - 在 `src/sw/index.ts` 中监听 tabs/windows 各类事件;
  - 将事件规范化为统一 payload 并通过 BroadcastChannel 广播。
- Task 4: tabs slice 初始化
  - 在 `src/store/tabs-slice.ts` 中定义 `tabs`, `currentWindowId`, `windows` 等状态字段;
  - 实现 `loadAllTabs()` 方法,从 Chrome API 初始化 LiveTab[] 与 WindowInfo Map;
  - 实现 `handleBroadcast()` 方法,根据 SW 消息做增量更新。

### Wave 3: 新标签页接管 + Onboarding + 冲突检测

**目标:** 在新标签页中渲染工作台骨架,并处理首启与冲突场景。

**Tasks:**
- Task 5: 新标签页入口
  - 在 `manifest.json` 中配置 `chrome_url_overrides.newtab` 指向 newtab 页面;
  - 在 `src/pages/newtab/App.tsx` 中渲染基础布局(顶栏 + 主区域 + 底部区域);
  - 主区域默认使用简单列表/域名视图展示当前所有 Tab。
- Task 6: Onboarding 引导
  - 在 StorageRepo 中增加 Onboarding 完成标记读写接口;
  - 在 newtab 页面加载时检测是否需要展示 Onboarding 卡片;
  - 点击关闭后写入完成标记。
- Task 7: 冲突检测(尚未实现,作为显式待办)
  - 在 newtab 或 settings 初始化阶段调用 chrome.management API 检测其它 newtab 接管扩展;
  - 如存在冲突,在页面显著位置展示提示,引导用户处理冲突;
  - 将该任务作为 Phase 2 未完成项在 EXECUTE/VERIFICATION 中追踪。

## 4. 风险与假设

- 假设: Chrome MV3 Service Worker 广播机制在高频 Tab 事件下仍然可靠,不会丢事件;
- 风险: 未实现冲突检测时,用户可能安装多个 newtab 扩展导致体验混乱;
- 风险: 数据聚合逻辑直接内嵌在 tabs slice 中,若后续需求大幅增长,可能需要引入 TabService 进一步解耦。

## 5. Done 定义(Definition of Done)

- [ ] Chrome API 封装层完成并被 tabs slice/StorageRepo 实际使用;
- [ ] StorageRepo 支持 Settings/Meta/Onboarding 等基础读写,并有最小容量监控接口;
- [ ] SW 事件总线可在 Tab 打开/关闭/激活时正确广播并被前端接收;
- [ ] newtab 页面能渲染当前所有窗口的 Tab 列表,并随事件实时更新;
- [ ] Onboarding 引导卡片能在首次打开时显示,已完成后不再重复出现;
- [ ] 冲突检测逻辑存在明确实现或记录为待办项,并在 EXECUTE/VERIFICATION 中有迹可循。
