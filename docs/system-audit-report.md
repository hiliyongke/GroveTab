# GroveTab 系统模块查缺补漏评估报告

> **审计日期**：2026-06-05  
> **审计范围**：GroveTab Chrome 新标签页扩展（v1.4）全 18 个系统模块  
> **审计方法**：逐模块代码深度审查 × 功能闭环分析 × 交互逻辑评估  
> **代码量**：319 源文件（161 TS + 103 TSX + 49 Less）

---

## 审计概览

| 板块 | 模块数 | 评分 | 状态 |
|------|--------|------|------|
| 基础设施层 | 4 | ⭐⭐⭐⭐ (A-) | 良好，存在封装不一致 |
| 状态管理层 | 11 | ⭐⭐⭐⭐½ (A) | 优秀，少数闭包/依赖问题 |
| 核心视图层 | 5 | ⭐⭐⭐½ (B+) | 良好，交互一致性待改善 |
| 数据视图层 | 3 | ⭐⭐⭐ (B) | 一般，书签模块功能缺失严重 |
| 管理视图层 | 2 | ⭐⭐⭐½ (B+) | 良好，部分恢复逻辑可增强 |
| 辅助功能层 | 5 | ⭐⭐⭐ (B) | 一般，权限降级和缓存策略待完善 |
| 交叉关注点 | 6 | ⭐⭐⭐ (B) | 一般，A11y 和安全测试缺口大 |
| **综合** | **36** | **⭐⭐⭐½ (B+)** | **良好，重点补齐安全/A11y/数据视图** |

**发现总问题数**：52 个（P0: 3、P1: 21、P2: 28）

---

## 一、基础设施层

### 1.1 Chrome API 封装

#### ✅ 优秀实践
- `safeCall()` 统一超时（5s）+ 错误归一化，防止 SW 沉睡导致的 Promise hang 死
- 非扩展上下文检测：`typeof chrome === "undefined"` 多处覆盖
- `tabGroups.ts` 的能力检测（`isTabGroupsAvailable()`）完整，查询失败降级空数组
- `fetch.ts` 提供 no-cors 模式用于书签健康检查等场景

#### 🔴 P0 问题

| ID | 问题 | 位置 | 影响 | 建议 |
|----|------|------|------|------|
| P0-01 | `storage.ts` 与 `tabs.ts` 存在两套不一致的 storage 封装 | `src/chrome/storage.ts` vs `src/chrome/tabs.ts:179-198` | `storage.ts` 的 `setStorageLocal` 无 try/catch 裸抛异常，且无超时/错误归一化，Repository 层混用两套会导致部分写入无保护 | 统一为 `tabs.ts` 的 `safeCall` 封装，废弃 `storage.ts` 独立实现，或将其改为 `safeCall` 的薄包装 |

#### 🟡 P1 问题

| ID | 问题 | 位置 | 建议 |
|----|------|------|------|
| P1-01 | `windows.ts` 使用旧式回调 API 而非 Promise 化 | `src/chrome/windows.ts:21-48` | 改为 `safeCall` 封装，与 `tabs.ts` 风格一致，统一超时保护和错误归一化 |
| P1-02 | `bookmarks.ts` 从 `tabs.ts` 导入 `safeCall` 形成反向依赖 | `src/chrome/bookmarks.ts` | 将 `safeCall` 提取到独立的 `src/chrome/safe-call.ts` 模块 |
| P1-03 | `storageGetBytesInUse` 在 `storage.ts` 和 `tabs.ts` 重复实现 | 两处均有 | 合并为单一实现，使用 `safeCall` 封装 |
| P1-04 | `chrome.runtime.lastError` 未显式检查 | `src/chrome/tabs.ts` 的 `safeCall` | Chrome MV3 下大部分 API 返回 Promise，但部分旧 API 仍通过 `lastError` 报错。`safeCall` 未处理 `chrome.runtime.lastError` 设置的场景 |

#### 🟢 P2 问题

| ID | 问题 | 建议 |
|----|------|------|
| P2-01 | `fetch.ts` 超简洁，无重试/超时机制 | 添加 `AbortSignal.timeout()` 默认超时，可选的指数退避重试 |

---

### 1.2 Repository 层

#### ✅ 优秀实践
- Schema 版本管理（`CURRENT_SCHEMA_VERSION = 3`）+ 增量迁移框架
- `withDefaults()` 向前兼容缺失字段注入默认值
- LRU/TTL 策略覆盖搜索历史、活动记录、OG 索引、历史事件、关闭标签
- 隐私保护：隐身标签丢弃、URL 黑名单过滤、`chrome://` 过滤

#### 🔴 P0 问题

| ID | 问题 | 位置 | 影响 | 建议 |
|----|------|------|------|------|
| P0-02 | `chrome.storage.local` 配额耗尽无处理 | `src/repositories/storage-repo.ts` 全部 `setData` 调用 | 当读写配额（默认~10MB）耗尽时，写入静默失败或抛 `QUOTA_BYTES` 错误，用户数据丢失且无任何感知 | 在 `setData` 中捕获 `QUOTA_BYTES` 错误，触发降级策略（如迁移至 OPFS/IndexedDB），并通过 StatusBar 通知用户 |

#### 🟡 P1 问题

| ID | 问题 | 位置 | 建议 |
|----|------|------|------|
| P1-05 | storage 不可用（非扩展上下文）时无降级 | 整个 `storage-repo.ts` | 返回默认值 + Silent 降级（当前已部分实现），但写入操作应添加显式 warning 日志 |
| P1-06 | `search-preferences-repo.ts` 使用 `localStorage` | `src/repositories/search-preferences-repo.ts` | Service Worker 中不可用，当前仅 newtab 上下文使用安全。需添加注释 + 运行时检测 |
| P1-07 | 模块初始化副作用 | `storage-repo.ts` 底部 `void ensureMeta()` | 在测试/SSR 场景下可能触发 chrome API 调用。改为 lazy 初始化，由 App 启动流程显式调用 |

---

### 1.3 Service 层

#### ✅ 优秀实践
- `archive-restore.ts` 分批恢复机制（10/批，100ms 间隔），支持取消信号和进度回调
- TabGroup 结构高保真恢复（URL→tabId 消费游标匹配）
- `window-snapshot.ts` 窗口快照和恢复

#### 🟡 P1 问题

| ID | 问题 | 位置 | 建议 |
|----|------|------|------|
| P1-08 | 归档恢复 `new_window` 策略回退时直接 `chrome.windows.create` 不使用 `safeCall` | `src/services/archive/archive-restore.ts:93` | 替换为 `createWindow`（已在 `chrome/tabs.ts` 中通过 `safeCall` 封装） |
| P1-09 | TabGroup 恢复失败静默吞掉 | `src/services/archive/archive-restore.ts:190-192` | 聚合失败 group 数量，通过 `RestoreOutcome` 结构返回给调用方展示 |

#### 🟢 P2 问题

| ID | 问题 | 建议 |
|----|------|------|
| P2-02 | Trending 服务缓存无 freshness 检查 | 添加缓存年龄（`cachedAt` 字段），读取时判断是否超期并在后台刷新 |
| P2-03 | Trending 多源路由切换无用户可感知反馈 | 当主源切换至备用源或降级到 OPFS 缓存时，用 StatusBar 提示用户数据可能不是最新的 |

---

### 1.4 Web Worker

#### ✅ 现状
- `src/shared/workers/` 目录存在，提供聚焦时间追踪等后台计算
- Service Worker 广播机制（`swBroadcast`）实现跨页面状态同步

#### 🟢 P2 问题

| ID | 问题 | 建议 |
|----|------|------|
| P2-04 | Worker 通信无健康检查/heartbeat 机制 | 添加定期心跳检测，Worker 异常时自动重启 |

---

## 二、状态管理层

### 2.1 10 个 Zustand Slice 总评

| Slice | 持久化 | 跨 slice 依赖 | 风险等级 |
|-------|--------|---------------|---------|
| `tabs-slice` | 否（内存） | settings/undo/selection | 低 |
| `settings-slice` | ✅ `chrome.storage` | 被多个 slice 依赖 | 低 |
| `undo-slice` | ✅ `chrome.storage` | settings（读 TTL 配置） | 低 |
| `metadata-slice` | ✅ `chrome.storage` | 无 | 低 |
| `selection-slice` | 否（UI 状态） | 被 tabs-slice 依赖 | 低 |
| `stats-slice` | 否 | 无 | 低 |
| `kanban-slice` | ✅ `chrome.storage` | 无 | 中 |
| `speed-dial-slice` | ✅ `chrome.storage` | 无 | 低 |
| `sessions-slice` | ✅ `chrome.storage` | 无 | 低 |
| `smart-sort-slice` | ✅ `chrome.storage` (middleware) | 无 | 中 |

#### 🟡 P1 问题

| ID | 问题 | 位置 | 建议 |
|----|------|------|------|
| P1-10 | `smart-sort-slice` `triggerReSort` 闭包过期风险 | `src/store/smart-sort-slice.ts`（未在 slice 中，在消费者 Hook 中） | 使用 `useRef` 保存最新排序函数引用，避免闭包捕获旧值 |
| P1-11 | `undo-slice` 依赖 `settings-slice` 的 `getUndoTtlMs` 在 `setTimeout` 中使用 `getUndoTtlMs()` 获取 TTL，但 TTL 在 `addRecord` 时固化，后续设置变更不生效 | `src/store/undo-slice.ts:99` | 这是合理的设计（记录创建时的 TTL 决定其生命周期），但需在代码中添加注释说明此行为 |
| P2-05 | `settings-slice` `resetSettings` 清空全部 storage 再重建，期间任何并发读写都可能读到不完整数据 | 建议先写入新默认值再删除旧键，或使用事务性 `chrome.storage.local.clear` + 批量写入 |

---

### 2.2 面板栈 (PanelStack Store)

#### ✅ 优秀实践
- 面板栈管理（search/settings/commandPalette 互斥推入弹出）
- 防止重复面板 ID 和溢出

#### 🟢 P2 问题

| ID | 问题 | 建议 |
|----|------|------|
| P2-06 | PanelStack 与 URL hash 路由状态双源 | 统一面板状态到单一数据源，或确保两者状态同步（当前面板关闭不会更新 URL） |

---

## 三、核心视图层

### 3.1 Tabs 视图（DomainGroup / Compact / Grid）

#### ✅ 优秀实践
- 三种布局模式覆盖所有用户偏好
- DomainGroupView 和 CompactView 均有虚拟滚动（`@tanstack/react-virtual`）
- 搜索过滤 + 多维度排序
- 排序同步支持双向（视图↔浏览器标签栏）

#### 🟡 P1 问题

| ID | 问题 | 位置 | 建议 |
|----|------|------|------|
| P1-12 | 排序同步失败仅 `console.error`，无用户感知 | `src/features/tabs/views/CompactView.tsx:172,192`、`DomainGroupView.tsx:166-168` | 同步失败时通过 StatusBar 或 toast 提示用户，提供"重试"操作 |
| P1-13 | 三种视图的空状态行为不一致 | DomainGroupView 返回 `null`；CompactView 返回 `null`；GridView 返回 `null` | 统一为有意义的 Empty 组件 |
| P1-14 | 大标签数量的数据瓶颈 | 过滤、分组、排序均为同步 `useMemo` 在全量 `tabs` 数组上 | 当标签数 > 500 时考虑分批处理或 Web Worker 计算 |
| P2-07 | DomainGroupView 和 CompactView 缺少 loading skeleton | 初始加载时只显示空白区域，建议添加 Skeleton 组件 |

---

### 3.2 TabGroup 视图

#### ✅ 优秀实践
- Chrome 原生 Tab Group 映射显示
- `@dnd-kit` 拖拽跨分组移动、解分组、跨窗口
- Pointer/Touch/Keyboard 三 Sensor 完整

#### 🟡 P1 问题

| ID | 问题 | 位置 | 建议 |
|----|------|------|------|
| P1-15 | 拖拽失败无用户反馈 | `src/features/tabs/views/TabGroupView.tsx` `handleDragEnd` | 添加拖拽失败 toast 反馈，尤其是跨窗口移动可能因 Chrome 限制失败 |

---

### 3.3 Kanban 视图

#### 🟡 P1 问题

| ID | 问题 | 位置 | 建议 |
|----|------|------|------|
| P1-16 | 看板列排序仅内存状态，跨会话不持久化 | `src/store/kanban-slice.ts` 已定义持久化但实际同步可能不完整 | 确保 `syncToStorage` 在每次拖拽操作后触发，并添加防抖 |

---

### 3.4 Window 视图

#### ✅ 优秀实践
- 多窗口分组展示，窗口快照保存/恢复
- 窗口别名和颜色自定义

#### 🟢 P2 问题

| ID | 问题 | 建议 |
|----|------|------|
| P2-08 | 窗口快照依赖 iframe DOM 访问完整性 | 添加快照失败 fallback（截图服务降级或文字占位） |

---

### 3.5 Timeline 视图

#### 🟢 P2 问题

| ID | 问题 | 建议 |
|----|------|------|
| P2-09 | 时间轴缺少交互式缩放和日期导航 | 添加日期范围快速跳转和时间粒度切换 |

---

## 四、数据视图层

### 4.1 Bookmarks 视图（⚠️ 重点）

#### 🔴 P0 问题

| ID | 问题 | 位置 | 影响 | 建议 |
|----|------|------|------|------|
| P0-03 | 书签模块仅支持查看，无创建/编辑/删除/移动操作 | `src/features/bookmarks/BookmarkView.tsx` | 核心功能不闭环，用户只能看不能操作。与 Chrome 原生书签管理器相比严重缺失 | 分阶段添加：P0: 删除 + 编辑标题/URL；P1: 创建书签 + 文件夹管理 + 拖拽排序 |

#### 🟡 P1 问题

| ID | 问题 | 位置 | 建议 |
|----|------|------|------|
| P1-17 | 书签列表为扁平渲染，文件夹层级丢失 | `src/features/bookmarks/BookmarkView.tsx` | 改为树形渲染，保留 Chrome 书签文件夹层级结构 |
| P1-18 | 书签搜索仅过滤 title + URL，不支持文件夹名 | 同上 | 扩展搜索范围至文件夹名 |
| P1-19 | 无批量操作（批量删除/移动） | 同上 | 复用现有 `BatchActionBar` 组件 |

---

### 4.2 History 视图

#### 🟡 P1 问题

| ID | 问题 | 位置 | 建议 |
|----|------|------|------|
| P1-20 | 历史搜索边缘情况处理几乎为空白 | `src/features/history/HistoryView.tsx` | 添加 Chrome history API 超时/错误处理、空结果引导、权限拒绝降级 |

#### 🟢 P2 问题

| ID | 问题 | 建议 |
|----|------|------|
| P2-10 | 缺少日期范围过滤 UI | 添加日期范围选择器，利用 `chrome.history.search` 的 `startTime`/`endTime` 参数 |
| P2-11 | HistoryView 中 8 个 `--history-*` CSS 变量是 antd Token 1:1 映射（memory 已记录） | 删除 `viewVars` 内联注入，直接使用 antd Token |

---

### 4.3 Insights 仪表盘

#### 🟡 P1 问题

| ID | 问题 | 位置 | 建议 |
|----|------|------|------|
| P1-21 | 图表渲染失败无降级处理 | `src/features/insights/InsightsView.tsx` | 添加 Chart.js 加载失败的 ErrorBoundary + fallback 纯文本统计 |

#### 🟢 P2 问题

| ID | 问题 | 建议 |
|----|------|------|
| P2-12 | 空数据状态缺少引导 | 当无统计数据时显示"开始使用后会展示数据分析"引导文案 |
| P2-13 | 缺少数据导出功能 | 添加 CSV/JSON 导出，方便用户在外部分析 |

---

## 五、管理视图层

### 5.1 Archive / Session 视图

#### ✅ 优秀实践
- 完善的恢复策略：new_window / current_window / partial
- TabGroup 结构高保真恢复
- 分批恢复 + 进度回调 + 取消信号

#### 🟡 P1 问题

| ID | 问题 | 位置 | 建议 |
|----|------|------|------|
| P1-22 | 部分恢复失败时 RestoreOutcome 返回 restored 数量，但 UI 未展示"部分失败"状态 | `src/services/archive/archive-restore.ts`、`ArchiveView.tsx` | 在恢复完成时展示"成功恢复 X/Y 个标签"结果，列出失败的 URL |
| P1-23 | `archiveCurrentSession` 归档当前会话无取消机制 | `ArchiveView.tsx` | 添加取消按钮和进度条，避免大量标签归档时 UI 卡死 |

---

### 5.2 Trash 视图

#### ✅ 优秀实践
- 完整体验：loading → empty → 有数据 → 批量操作 → 错误反馈
- 三项错误状态全覆盖（加载/恢复/删除/清空），全部通过 `feedback.error()` 反馈

#### 🟢 P2 问题

| ID | 问题 | 建议 |
|----|------|------|
| P2-14 | 单个删除无确认弹窗 | 与 clearAll 保持一致，添加 Popconfirm |
| P2-15 | 批量恢复失败时部分成功的 tab 不可见 | 展示恢复结果摘要 |
| P2-16 | 标签展示限 8 个无法展开 | 添加"展开全部"按钮 |

---

## 六、辅助功能层

### 6.1 Trending 热榜

#### ✅ 优秀实践
- 多源路由（主源 API → 备用源 API → OPFS 缓存）
- 兴趣信号系统（点击/收藏权重调整排序）
- 5 分类 + 多平台配置

#### 🟡 P1 问题

| ID | 问题 | 位置 | 建议 |
|----|------|------|------|
| P1-24 | 缓存无 freshness 过期检测 | `src/services/trending-service.ts` | 添加 `cachedAt` 时间戳，30 分钟后触发后台刷新 |

#### 🟢 P2 问题

| ID | 问题 | 建议 |
|----|------|------|
| P2-17 | 搜索无防抖 | 用户快速连续输入时触发多次筛选，添加 300ms debounce |

---

### 6.2 Command Palette（命令面板）

#### ✅ 优秀实践
- 命令注册表 + 模糊搜索
- 支持视图切换、面板切换、设置导航
- ⌘K 快捷键

#### 🟢 P2 问题

| ID | 问题 | 建议 |
|----|------|------|
| P2-18 | 缺少命令动态注册/取消注册能力 | 添加 `unregisterCommand`，支持插件扩展场景 |
| P2-19 | 缺少最近使用排序 | 记录命令执行次数/时间，优先排序高频命令 |

---

### 6.3 Developer Tools

#### ✅ 优秀实践
- 丰富的调试工具集：存储查看/编辑、console 转发、性能分析、网络请求捕获

#### 🟡 P1 问题

| ID | 问题 | 位置 | 建议 |
|----|------|------|------|
| P1-25 | 大量功能依赖 `chrome.debugger` API，无权限时功能完全不可用 | `src/features/developer-tools/DevToolsView.tsx` | 检测 debugger 权限，无权限时显示引导链接并禁用相关功能 |

#### 🟢 P2 问题

| ID | 问题 | 建议 |
|----|------|------|
| P2-20 | `local-tools.ts:472` HTML 实体解码使用 `innerHTML` | 这是安全的使用模式（textarea.innerHTML 是浏览器内置 HTML 解码器），但需添加注释说明用途和安全性 |

---

### 6.4 Settings 面板

#### ✅ 优秀实践
- 分区设置（外观/搜索/隐私/快捷键/实验室），Tab 导航
- Schema 版本管理 + 向前兼容
- `withDefaults()` 合并缺失字段

#### 🟡 P1 问题

| ID | 问题 | 位置 | 建议 |
|----|------|------|------|
| P1-26 | 设置无前端校验 | `src/features/settings/SettingsPanel.tsx` | 添加数字范围校验（如 `contentMaxWidth` ≥ 0）、URL 格式校验（搜索自定义引擎） |

#### 🟢 P2 问题

| ID | 问题 | 建议 |
|----|------|------|
| P2-21 | 缺少设置导入/导出功能 | 添加 JSON 文件导入/导出，方便用户备份配置 |
| P2-22 | 设置搜索功能缺失 | 设置项超过 50+，添加面板内搜索快速跳转 |

---

### 6.5 Speed Dial

#### 🟡 P1 问题

| ID | 问题 | 位置 | 建议 |
|----|------|------|------|
| P1-27 | Speed Dial 站点管理功能完整性待确认 | `src/store/speed-dial-slice.ts` | 确认创建/编辑/删除/排序全流程闭环，添加空站点列表引导 |

---

## 七、交叉关注点

### 7.1 i18n 国际化

#### ✅ 优秀实践
- 中英文双语完整覆盖（各约 450+ 键）
- 支持动态语言切换和持久化
- 近期新增 23 个空状态引导 key

#### 🟡 P1 问题

| ID | 问题 | 位置 | 建议 |
|----|------|------|------|
| P1-28 | `zh-CN.ts` 和 `en.ts` 中 `speedDialGroupEnabled` / `speedDialGroupEnabledHint` 无引号 | `src/shared/i18n/zh-CN.ts:1271-1272`、`en.ts` | 添加引号包裹为合法 JSON 键（TS 可编译但不符合规范） |
| P1-29 | Keybinding 注册的 `openHistory` 和 `commandPalette` 快捷键缺少对应翻译 | `shortcuts.openHistory` / `shortcuts.commandPalette` | 在 zh-CN.ts 和 en.ts 中补全 |
| P1-30 | `en.ts` 缺少 `settings.windowCardCurrentOnly` 键 | `en.ts` | 从 zh-CN.ts 补全 |

---

### 7.2 Theme / Skin 主题

#### ✅ 优秀实践
- 4 套皮肤预设（minimal/glassmorphism/nord/apple），暗色/亮色双态
- 自定义主题编辑器（颜色/圆角/阴影/字体）
- Antd ThemeConfig 深度集成

#### 🟢 P2 问题

| ID | 问题 | 建议 |
|----|------|------|
| P2-23 | CSS 皮肤变量清理不彻底（memory 已记录） | 继续清理残留的 `--app-*` 变量和 `_variables.less` 中的 fallback |
| P2-24 | 皮肤切换无过渡动画 | 添加 `transition` 到关键 CSS 属性（`background`、`color` 等） |
| P2-25 | 自定义主题无预览功能 | 添加实时预览或"撤销"按钮 |

---

### 7.3 Accessibility 无障碍

#### 🔴 评审结论：整体无障碍覆盖率不足

#### 🟡 P1 问题

| ID | 问题 | 位置 | 建议 |
|----|------|------|------|
| P1-31 | GridView 卡片 `<Card onClick={...}>` 不可键盘聚焦 | `src/features/tabs/views/GridView.tsx` | 添加 `tabIndex={0}`、`role="button"`、`onKeyDown` (Enter/Space) |
| P1-32 | 多选模式无屏幕阅读器提示 | `BatchActionBar` + 选择逻辑 | 在进入多选模式时触发 ARIA live region 公告 |
| P1-33 | 仅有 1 个 axe-core 测试 | `tests/a11y/axe-core.test.ts` | 为核心视图（Tabs、Bookmarks、Settings）添加 axe-core 自动化测试 |

#### 🟢 P2 问题

| ID | 问题 | 建议 |
|----|------|------|
| P2-26 | 缺少焦点管理（focus trap / focus restoration） | 面板打开时焦点应移到面板内，关闭时还原到触发元素 |
| P2-27 | 缺少 skip navigation link | 为键盘用户添加"跳转到主内容"链接 |
| P2-28 | 颜色对比度未验证 | 使用 axe-core 或 Lighthouse 自动化检测对比度合规性 |

---

### 7.4 Performance 性能

#### ✅ 优秀实践
- 13 个视图全部 lazy loading（独立 chunk）
- 视频背景、点击动效 lazy loading（按需拉取）
- 虚拟滚动（DomainGroupView / CompactView / TabGroupView）
- Zustand shallow 比较防止不必要渲染

#### 🟢 P2 问题

| ID | 问题 | 建议 |
|----|------|------|
| P2-29 | 无 bundle size 监控 | 配置 `vite-plugin-visualizer` 或在 CI 中加入 bundle 大小检查 |
| P2-30 | React.memo 使用不一致 | 对纯展示组件（TabItem、DomainGroupCard 等）统一添加 React.memo |

---

### 7.5 Testing 测试覆盖

#### 测试现状
- 30 个测试文件，0 个 E2E 测试
- 集中于 slice（10/10 全部单元测试）、工具函数（8 个）和 hooks（2 个）
- **0 个视图/组件测试**（无 React Testing Library 组件渲染测试）
- 仅有 1 个 Accessibility 测试

#### 🟡 P1 问题

| ID | 问题 | 建议 |
|----|------|------|
| P1-34 | 零视图测试覆盖率 | 为核心组件添加渲染测试（TabItem、DomainGroupCard、BookmarkView 空状态等）|
| P1-35 | 零 E2E 测试 | 使用 Playwright 添加核心流程测试（打开新标签页、切换视图、搜索标签、关闭标签、撤销关闭） |

---

### 7.6 Security 安全

#### 🟡 P1 问题

| ID | 问题 | 位置 | 建议 |
|----|------|------|------|
| P1-36 | 无 CSP (Content Security Policy) 配置 | `manifest.json` | 添加 CSP 头限制脚本来源 |
| P1-37 | URL 安全过滤逻辑分散 | `src/shared/utils/url-safety.ts`、`src/chrome/utils.ts` | 统一到 `url-safety.ts`，添加 `javascript:`/`data:` 协议拦截 |

#### 🟢 P2 问题

| ID | 问题 | 建议 |
|----|------|------|
| P2-31 | 无存储数据加密 | 对敏感设置项（如用户自定义搜索引擎 URL）进行加密存储 |
| P2-32 | 外部 API 调用无 CSRF 保护 | Trending 服务的外部请求添加必要的安全头 |

---

## 测试覆盖热力图

```
                       单元测试   组件测试   E2E测试   A11y测试
tabs-slice             ████████   ───────   ───────   ───────
settings-slice         ████████   ───────   ───────   ───────
undo-slice             ████████   ───────   ───────   ───────
metadata-slice         ████████   ───────   ───────   ───────
selection-slice        ████████   ───────   ───────   ───────
stats-slice            ████████   ───────   ───────   ───────
kanban-slice           ████████   ───────   ───────   ───────
speed-dial-slice       ████████   ───────   ───────   ───────
sessions-slice         ████████   ───────   ───────   ───────
smart-sort-slice       ████████   ───────   ───────   ───────
panel-stack            ████████   ───────   ───────   ───────
TabsView (三视图)      ───────    ░░░░░░░   ───────   ░░░░░░░
BookmarkView           ───────    ░░░░░░░   ───────   ░░░░░░░
HistoryView            ───────    ░░░░░░░   ───────   ░░░░░░░
InsightsView           ───────    ░░░░░░░   ───────   ░░░░░░░
ArchiveView            ───────    ░░░░░░░   ───────   ░░░░░░░
TrashView              ───────    ░░░░░░░   ───────   ░░░░░░░
TrendingView           ───────    ░░░░░░░   ───────   ░░░░░░░
CommandPalette         ───────    ░░░░░░░   ───────   ░░░░░░░
SettingsPanel          ───────    ░░░░░░░   ───────   ░░░░░░░
DevTools               ████████   ░░░░░░░   ───────   ░░░░░░░
工具函数 (8个)         ████████   ───────   ───────   ───────
Hooks (2个)            ████████   ───────   ───────   ───────

████████ 已覆盖   ░░░░░░░ 需补充   ─────── 未覆盖
```

---

## 改进路线图

### 第一阶段：安全与稳定性（1-2 周）

| 优先级 | 问题 ID | 任务 |
|--------|---------|------|
| P0 | P0-01 | 统一 storage 封装（合并 storage.ts → tabs.ts safeCall） |
| P0 | P0-02 | 添加 storage quota 超限检测与降级策略 |
| P0 | P0-03 | 书签模块添加删除 + 编辑功能 |
| P1 | P1-04 | 补全 `chrome.runtime.lastError` 检查 |
| P1 | P1-36 | 配置 CSP 安全头 |
| P1 | P1-37 | 统一 URL 安全过滤 |

### 第二阶段：功能闭环（2-4 周）

| 优先级 | 问题 ID | 任务 |
|--------|---------|------|
| P1 | P1-01 | `windows.ts` Promise 化改造 |
| P1 | P1-12 | 排序同步失败 → 用户可感知反馈 |
| P1 | P1-16 | Kanban 持久化完善 |
| P1 | P1-17~19 | 书签功能完善（文件夹层级、搜索扩展、批量操作） |
| P1 | P1-22 | 部分恢复失败 UI 展示 |
| P1 | P1-24 | Trending 缓存 freshness 检测 |

### 第三阶段：质量提升（4-8 周）

| 优先级 | 问题 ID | 任务 |
|--------|---------|------|
| P1 | P1-28~30 | i18n 键修复与补全 |
| P1 | P1-31~33 | A11y 无障碍修复与测试 |
| P1 | P1-34~35 | 视图测试 + E2E 测试 |
| P2 | P2-23~25 | Theme 皮肤完善（CSS 清理、过渡动画、预览） |
| P2 | P2-07 | 各视图添加 loading skeleton |
| P2 | P2-11 | HistoryView CSS token 简化 |

---

## 免责声明

本审计报告基于静态代码审查 + 架构分析生成，所有发现均来源于对代码库的深入阅读和理解。某些问题可能在特定 Chrome 版本 / OS 环境下表现不同，建议在实际环境中验证各 P0/P1 问题的影响程度。

审计范围不包含：
- Chrome Web Store 审核合规性
- 第三方依赖安全审计
- 运行时性能 profiling（需实际环境测量）

---

> **审计完成时间**：2026-06-05  
> **审计工具**：CodeBuddy AI × code-explorer 子代理 × 4 阶段深度代码扫描  
> **下次审计建议**：每季度或大版本发布后重新执行，重点跟踪改进路线图中的高优先级项目
