# Canopy — 全新标签页·标签管理 Chrome 扩展 · 产品需求文档 (PRD)

> 版本：**v0.2** ｜ 更新日期：2026-04-22 ｜ 作者：Yorke + AI Pair
> 变更摘要（相对 v0.1）：新增「非目标」「用户故事」「空/错/载三态」「特殊 URL 与隐私窗口策略」「存储容量评估」「消息协议」「并发竞态」「A11y / i18n / 测试 / 埋点」「文件结构」「术语表」；扩充竞品对比；修正 favicon 权限、缩略图可行性、SW 休眠等技术事实错误。

---

## 目录
1. 产品概述
2. 产品原则 & 非目标
3. 目标用户 & 用户故事
4. 竞品分析
5. 功能范围（P0 / P1 / P2）
6. 三态设计（空 / 加载 / 错误）
7. 信息架构 & 视觉规范
8. 技术方案
9. 数据模型 & 存储策略
10. 消息协议 & 并发模型
11. 可访问性 & 国际化
12. 测试策略 & 质量保证
13. 本地埋点（隐私友好）& 度量口径
14. 工程规范（文件结构 / 版本 / 发布流）
15. MVP 推荐与迭代路线
16. 成功指标
17. 风险与未决问题
18. 术语表

---

## 1. 产品概述

### 1.1 一句话定位
**一款替换 Chrome 新标签页的标签管理器**——每次新开 Tab，都进入一个美观、高效、可检索的"标签工作台"，统一管理当前所有已打开的 Tab、历史归档会话和书签。

### 1.2 解决什么问题
| 场景痛点 | 现状 | 本产品方案 |
| --- | --- | --- |
| Tab 数量爆炸，找不到想要的页面 | Chrome 原生 Tab 条拥挤，只剩 favicon | 新标签页 = 工作台，域名分组 + 全文搜索 |
| 太多 Tab 吃内存 | OneTab 能收纳但 UI 朴素，归档后二次查找困难 | 一键归档 + 美观的归档浏览器 + 按时间/域名二次检索 |
| 新标签页空白浪费 | 默认只有搜索 + 缩略图 | 新标签页承载"实时 Tab + 历史会话 + 书签"三合一 |
| 多窗口分散 | 跨窗口 Tab 难以统一管理 | 聚合所有窗口的 Tab，统一视图 |

---

## 2. 产品原则 & 非目标

### 2.1 产品原则
1. **即开即用**：安装即生效，默认体验已经足够美观可用。
2. **性能优先**：500+ Tab 场景下仍保持 ≥ 55 fps 交互，首屏 ≤ 200ms (P95)。
3. **本地优先、隐私安全**：所有数据存在 `chrome.storage.local`，零外部请求（除 favicon / OG 图本身）。
4. **键盘党友好**：所有高频操作都有快捷键，可全键盘操作。
5. **可逆操作**：关闭 / 归档 / 删除 均可撤销（Undo Toast，≥ 5 秒）。
6. **渐进增强**：缺权限 / 缺 API 时优雅降级，不崩溃。

### 2.2 非目标（Non-Goals，明确不做的事）
> 划清边界是为了未来不被反复拉回讨论。

- ❌ **不做团队协作 / 多人共享**：本产品是单人工具，不涉及账号体系和云端同步。
- ❌ **不做抓取网页正文做全文索引**：只索引 `title` + `meta description`，不读 body（隐私 + 性能）。
- ❌ **不做跨浏览器数据互通**：Chrome 与 Firefox 数据不打通，除非用户手动导出导入。
- ❌ **不做广告、推荐、站点打分**：纯工具，不做内容平台。
- ❌ **不做自动分类 AI**：分组规则全部确定性（域名 / 时间 / 频率），不引入机器学习。
- ❌ **不做移动端**：Chrome / Edge 桌面为唯一目标。
- ❌ **v1 不做付费版**：长期保持免费，可后续评估捐赠 / Pro 版。

---

## 3. 目标用户 & 用户故事

### 3.1 目标用户画像
| 画像 | 占比预估 | 典型特征 |
| --- | --- | --- |
| **重度网页工作者**（开发者 / 研究员 / 分析师） | 50% | 50–300 Tab 并发，跨多窗口，常用搜索和归档 |
| **内容创作者 / 学生**（写作 / 学习） | 30% | 开很多 Tab 做参考，需要按项目分组、加备注 |
| **美学追求者 / 生产力玩家** | 20% | 关心视觉风格，喜欢尝试新工具，分享到社交网络 |

### 3.2 核心用户故事（User Stories）
以 `As a <角色>, I want <能力>, so that <价值>` 结构编写，覆盖 MVP。

| ID | 用户故事 | 对应功能 |
| --- | --- | --- |
| US-01 | 作为开发者，我一天要开 80 个 Tab，我想每次新开 Tab 时看到所有已打开 Tab 按域名分组，**所以**我能在 3 秒内找到想要的那个。 | F-01 / F-02 / F-03 |
| US-02 | 作为研究员，我经常搜索过去打开的页面，我想在新标签页直接键入关键词过滤，**所以**不必打开历史记录。 | F-05 |
| US-03 | 作为重度用户，Tab 太多拖慢浏览器，我想一键收起所有 Tab 并稍后恢复，**所以**能保留思路但释放内存。 | F-06 |
| US-04 | 作为误操作常犯者，我不小心关闭了一整组 Tab，我想 5 秒内撤销，**所以**不用翻历史一个个恢复。 | F-04 (Undo) |
| US-05 | 作为切换电脑的用户，我想把归档会话导出成文件，**所以**能在另一台电脑上导入恢复。 | F-15 |
| US-06 | 作为知识管理者，我想给某个 Tab 或会话加标签和备注，**所以**后续能按主题检索。 | F-12 |
| US-07 | 作为多项目并行者，我想用拖拽的方式把 Tab 归入"工作/学习/娱乐"列，**所以**工作台就是我的 Kanban。 | F-20 |
| US-08 | 作为美学用户，我想新标签页看起来像 Arc 浏览器一样漂亮，**所以**我愿意每天打开十几次。 | 视觉规范 |

### 3.3 反用户故事（Anti-Stories，避免踩坑）
- ❌ 作为用户，我**不希望**新标签页每次都闪烁、加载 1 秒以上才出内容。
- ❌ 作为隐私用户，我**不希望**发现扩展向任何外部服务器发请求。
- ❌ 作为快节奏用户，我**不希望**关键操作需要二次确认打断心流（除不可逆操作外）。

---

## 4. 竞品分析

### 4.1 竞品矩阵
| 产品 | 核心形态 | 优势 | 劣势 | 我们的差异点 |
| --- | --- | --- | --- | --- |
| **OneTab** | 工具栏按钮 → 列表页 | 轻量、省内存、用户多 | UI 过时、无视图切换、无搜索体验差 | 新标签页接管 + 多视图 + 美学 |
| **Toby** | 新标签页工作台 | 看板分组、云同步 | 需注册登录、隐私隐忧、免费版有限 | 本地优先、零账号、更快 |
| **Workona** | 新标签页工作空间 | 强大的 workspace | 复杂、学习曲线高、付费 | 聚焦标签管理、上手即用 |
| **Tab Manager Plus** | 弹窗 | 强大搜索 | UI 非新标签页、偏工具感 | 沉浸式工作台 |
| **Momentum / Tabby Cat** | 新标签页美化 | 视觉出色 | 无 Tab 管理能力 | 视觉 + 生产力双强 |
| **Tree Style Tab (Firefox)** | 侧边树 | 层级清晰 | 仅 Firefox、非新标签页 | 跨浏览器、新标签页形态 |

### 4.2 差异化总结
本产品 = **OneTab 的收纳能力** + **Toby 的视图丰富度** + **Momentum 的视觉美感** − **所有云端 / 登录复杂度**。

---

## 5. 功能范围

### 5.1 功能总览
| 模块 | 功能点 | 优先级 |
| --- | --- | --- |
| 新标签页接管 | 覆盖 `chrome://newtab` | P0 |
| 实时 Tab 聚合 | 跨窗口 Tab、实时事件更新 | P0 |
| 视图：域名分组 | 默认视图 | P0 |
| 视图：时间轴 / 紧凑 / 网格 / 频率 / 看板 | 其他 5 种 | P1–P2 |
| Tab 基础操作 | 跳转 / 关闭 / 批量关闭 / Undo | P0 |
| 全局搜索 | 实时过滤 + 高亮 | P0 |
| 一键归档 | OneTab 式 Save All | P0 |
| 本地持久化 | chrome.storage.local | P0 |
| 去重 / 标签备注 / 导入导出 | 增强 | P1 |
| 会话管理 / 设置面板 | 增强 | P1 |
| 看板 / 书签整合 / 固定 / 自动快照 / 检索增强 | 高阶 | P2 |

### 5.2 P0 功能详述（MVP）

#### F-01 新标签页接管
- `manifest.json` 的 `chrome_url_overrides.newtab` 指向 `newtab.html`。
- **降级路径**：若用户装了其他接管扩展导致冲突 → 首次运行检测并给出说明卡片（"检测到另一扩展也接管了新标签页，请在 chrome://extensions 禁用其中一个"）。
- 设置面板可关闭接管（仍保留扩展功能，通过工具栏按钮打开工作台页）。

#### F-02 实时 Tab 聚合展示
- `chrome.tabs.query({})` 初始化；监听 `onCreated / onUpdated / onRemoved / onActivated / onMoved / onAttached / onDetached` 做增量更新。
- 每条 Tab 展示：favicon / 标题 / 域名 / `windowId`（窗口标识） / 当前是否激活 / 是否固定。
- **隐私窗口**（Incognito）策略：
  - 默认**不展示**隐私窗口的 Tab（MV3 默认无权访问，除非用户在扩展页勾选"允许在无痕模式下运行"）。
  - 若用户手动开启无痕访问，也**不将无痕 Tab 纳入归档**（避免持久化敏感历史）。
- **特殊 URL**处理规则：

  | URL 类型 | 展示 | 可归档 | 可跳转 | favicon 处理 |
  | --- | --- | --- | --- | --- |
  | `https://...` / `http://...` | ✅ | ✅ | ✅ | chrome://favicon2/ API |
  | `chrome://` / `edge://` / `about:` | ✅ | ❌（归档无意义） | ✅ | 默认占位图 |
  | `chrome-extension://` | ✅（显示扩展名） | ❌ | ✅ | 占位图 |
  | `file://` | ✅（提示"本地文件"） | ✅ | ✅ | 文档图标 |
  | 扩展自身的新标签页 | ❌（排除） | ❌ | — | — |
  | `about:blank` / 空 URL | ❌ | ❌ | — | — |

#### F-03 按域名分组视图（默认视图）
- 按 `hostname` 聚合；子域名规则：`m.example.com` 与 `www.example.com` 合并为 `example.com`（使用 PSL（公共后缀列表）识别注册域名）。
- 分组卡片：站点 favicon / 域名 / Tab 数量徽标 / 展开后为紧凑列表。
- 排序：分组间按 Tab 数降序；组内按"最近激活时间"降序。
- 分组折叠状态持久化到 `chrome.storage.local`（按 hostname 索引）。

#### F-04 基础 Tab 操作
- **跳转语义**：
  - 目标 Tab 在同窗口 → `chrome.tabs.update(id, {active:true})`。
  - 目标 Tab 在另一窗口 → 同上 + `chrome.windows.update(winId, {focused:true})`。
  - 目标 Tab 最小化 → 先 `chrome.windows.update(winId, {state:'normal'})` 再聚焦。
  - 目标 Tab 在另一虚拟桌面 / Space（macOS）→ 调用聚焦 API，由 OS 处理，产品层告知用户"已跳转，可能需要切换桌面"。
- **关闭单个 Tab**：卡片右上角 × 按钮；弹 Undo Toast（5s，可配置 3–10s）。Undo 恢复策略：`chrome.sessions.restore(sessionId)`（推荐，因为能恢复历史），兜底用 `chrome.tabs.create({url, windowId})`。
- **批量关闭**：
  - "关闭本组"：仅关闭该域名下的 Tab。
  - "关闭所有非固定"：排除 `pinned:true` 和扩展自身新标签页。
  - 批量操作**一次性**写入一条 Undo 记录（而非逐条，避免撤销疲劳）。
  - 超过 20 个 Tab 的批量操作需二次确认（防误操作）。

#### F-05 全局搜索
- 顶部搜索框实时过滤 Tab `title` + `url`。
- 快捷键：`/` 或 `Cmd+K` / `Ctrl+K` 聚焦；`Esc` 清空并失焦。
- 输入防抖 150ms；命中高亮用 `<mark>` 标签（可样式化）。
- 搜索范围：当前视图内容（域名视图搜索所有 Tab；归档视图搜索所有会话内 Tab）。
- 搜索结果为空时给出引导文案"未找到匹配的 Tab，试试更短的关键词？"。

#### F-06 一键归档（OneTab 式）
- 入口：顶部"Save All Tabs"按钮 + 右键菜单 + 工具栏按钮（popup）。
- 归档流程：
  1. 收集所有"可归档 Tab"（排除：扩展自身新标签页、`chrome://`、`edge://`、隐私窗口 Tab、`pinned:true` 可选）。
  2. 序列化为 `ArchivedSession` 写入 storage。
  3. 批量 `chrome.tabs.remove(ids)` 关闭被归档的 Tab。
  4. 由于新标签页自身会在最后一个 Tab 关闭时触发浏览器新建行为，**归档后主动在当前窗口新开一个新标签页**作为"归档完成落地页"，显示"已归档 N 个 Tab · 查看归档"。
- 归档冲突：若当前会话名已存在 → 自动加时间戳后缀。

#### F-07 本地持久化
- `chrome.storage.local`（上限 10 MiB，需做容量监控，详见 §9.3）。
- 持久化内容：归档会话、设置、折叠状态、标签 / 备注、看板布局、本地埋点计数器。
- 不持久化：实时 Tab 本身（每次打开新标签页从 `chrome.tabs.query` 拉取）。

### 5.3 P1 功能详述
_（结构保持 v0.1，以下为本次补强要点）_

#### F-10 多视图切换器
| 视图 | 描述 | 补强说明 |
| --- | --- | --- |
| 时间轴 | 按打开时间倒序，分段"今天 / 昨天 / 本周 / 更早" | 时间来源：优先 `chrome.tabs.lastAccessed`（Chrome 116+），不可用时用 SW 维护的 `lastAccessedAt` |
| 紧凑列表 | 一行一 Tab，信息密度高 | 必须接入虚拟滚动（> 100 条） |
| 网格卡片 | 大卡片 + 预览图 | **⚠️ 缩略图方案修订**：`chrome.tabs.captureVisibleTab` 仅能截当前活动 Tab，不可用于全量缩略图。实际方案：**OG image（`<meta property="og:image">`）→ Twitter Card → 高清 favicon → 域名色块**四级降级；OG 抓取通过 SW `fetch` 的 HEAD/GET（仅 title+meta，10KB 限流） |

#### F-11 使用频率视图
- 数据来源：**SW + 定时持久化**。SW 监听 `onActivated` 累加计数 → 每 30s 或 SW 即将挂起时写入 storage（防丢）。
- 由于 MV3 SW 30s 休眠，丢事件兜底：新标签页打开时用 `chrome.tabs.query` 和 `chrome.history.getVisits`（若授权）校正。
- 展示：按"最近 7 天激活次数"降序，默认 Top 30。

#### F-12 标签与备注
- Tag 规则：字符串数组，最多 10 个，每个 ≤ 20 字符；建议色（hash 生成稳定色）。
- Note：Markdown 纯文本 ≤ 500 字符。
- 索引键：`url`（不含 hash，可配置是否含 query）。

#### F-13 去重检测
- 规则可配置：
  - 严格：`url` 完全相同。
  - 宽松（默认）：忽略 `#hash` 和跟踪参数（`utm_*`、`fbclid`、`gclid`）。
- 提示位置：顶部非侵入 InfoBar，带"一键合并"与"本次忽略"。

#### F-14 归档会话管理
- 会话操作：重命名、删除（Undo）、合并、复制、分享（导出单个会话）。
- 恢复策略：
  - "全部恢复"默认**新窗口**打开（避免污染当前窗口）。
  - 一次性恢复 > 30 个 Tab → 提示"这会打开 N 个 Tab 可能较慢，继续？"并分批打开（每批 10 个、间隔 100ms）。
  - "单个恢复"在当前窗口末尾新建 Tab。

#### F-15 导入 / 导出
- 导出：JSON（完整） / Markdown / 纯文本（一行一 URL） / HTML（书签格式，Chrome 可导入）。
- 导入冲突策略：
  - 跳过重复（默认）
  - 全部追加（可能产生重复）
  - 完全替换（二次确认）
- 导入最大文件 5 MB，行数限制 20K。

#### F-16 设置面板
- 设置项分类：外观 / 行为 / 数据 / 快捷键 / 关于。
- **一键清空**带 2 步确认 + 输入"DELETE"才执行。

### 5.4 P2 功能详述
_保持 v0.1 结构，补充以下要点：_

#### F-24 全文检索增强（技术修订）
- 仅索引 `title` + OG `description`，**不抓页面正文**（隐私 + MV3 限制）。
- OG 抓取通过 SW `fetch`，需要 `host_permissions: ["<all_urls>"]`，会在商店审核时需要额外说明；若想避免此权限，改为被动索引（只有用户显式点击"建立索引"才抓）。
- 拼音首字母：使用 `pinyin-pro` 库，预构建索引，SW 中处理。

---

## 6. 三态设计（空 / 加载 / 错误）

### 6.1 空状态
| 场景 | 展示内容 |
| --- | --- |
| 首次安装，没有归档 | Onboarding 卡片：4 步引导（打开几个网页 → 新开 Tab 查看工作台 → 试试归档 → 快捷键帮助） |
| 当前没有任何 Tab（理论不可能，但要防御） | 插画 + "打开你的第一个标签吧" + 常用入口按钮 |
| 搜索无结果 | "没有找到匹配的 Tab" + 清空搜索按钮 |
| 归档视图无会话 | "还没有归档会话。点击 Save All Tabs 开始" |

### 6.2 加载状态
- 首次进入：骨架屏（Skeleton），**最多显示 200ms**，超过才出 loading spinner。
- 切换视图：淡入淡出 150ms。
- 归档 / 批量操作：内联 Progress Bar + 可取消按钮（大批量时）。

### 6.3 错误状态
| 错误 | 用户感知 | 开发者可见 |
| --- | --- | --- |
| Storage 写入失败（配额满） | InfoBar："本地存储已满，建议清理归档" + 跳转清理页 | 控制台 error |
| Tab 操作权限被拒 | Toast："无法操作此 Tab（系统受限页面）" | 错误日志 |
| Chrome API 调用抛错 | 降级到只读模式，保留已加载内容 | Sentry-like 本地日志（不外发） |
| SW 无响应 | 新标签页自行 fallback 到直接 `chrome.tabs.query` | SW ping 超时日志 |

---

## 7. 信息架构 & 视觉规范

### 7.1 页面布局
_（保持 v0.1 ASCII 图，略）_

### 7.2 视觉风格（毛玻璃 + 渐变）
#### 视觉 Token
| Token | 值 |
| --- | --- |
| `--radius-sm` | 8px |
| `--radius-md` | 12px |
| `--radius-lg` | 20px |
| `--blur-card` | `blur(24px) saturate(180%)` |
| `--elev-1` | `0 1px 2px rgba(0,0,0,.04), 0 2px 8px rgba(0,0,0,.04)` |
| `--elev-2` | `0 4px 16px rgba(0,0,0,.08)` |
| `--font` | `-apple-system, SF Pro Text, Inter, PingFang SC, ...` |
| `--space-unit` | 4px（间距以 4 的倍数） |

#### 渐变预设
- Aurora（默认亮）：`linear-gradient(135deg, #F5F7FA 0%, #E0C3FC 50%, #8EC5FC 100%)`
- Sunrise：`linear-gradient(135deg, #FEE140 0%, #FA709A 100%)`
- Deep Space（默认暗）：`linear-gradient(135deg, #0F2027 0%, #203A43 50%, #2C5364 100%)`
- 用户可自定义（颜色选择器生成 2 色渐变）。

#### 视觉验收标准（Definition of Done · Design）
- [ ] 主页面满足 WCAG AA 级对比度（正文 ≥ 4.5:1）。
- [ ] 任意渐变背景上卡片可读（前景文字清晰）。
- [ ] 深色模式下所有图标、阴影、边框自洽。
- [ ] 500 Tab 下渲染不掉帧（Perf DevTools 确认 ≥ 55 fps）。
- [ ] 所有可点击元素在 44×44 px 以上（移动/触屏兼容）。
- [ ] 所有动效时长 150–250ms，缓动 `cubic-bezier(.22,.61,.36,1)`。
- [ ] 品牌词 / 按钮大小写、标点统一（中文/英文混排）。

### 7.3 交互细节
_（同 v0.1，新增以下）_
- **焦点态**：键盘聚焦元素必须有 2px 高对比外描边（a11y 要求）。
- **拖拽态**：拖起元素跟随指针，目标 drop zone 高亮 + 虚线；取消拖放时动画回弹。
- **长按态**：长按 Tab 卡 → 弹出 Context Menu（标签 / 备注 / 固定 / 导出等）。

---

## 8. 技术方案

### 8.1 技术栈（修订版）
| 层 | 选型 | 说明 |
| --- | --- | --- |
| 扩展规范 | **Manifest V3** | Chrome / Edge 必须 |
| 前端框架 | **React 18 + TypeScript 5** | — |
| 构建 | **Vite 5 + `@crxjs/vite-plugin` v2** | HMR；**备选 wxt.dev**（若 CRXJS 在 SW HMR 有问题则切换） |
| 样式 | **Tailwind CSS 3 + CSS Variables** | 主题切换通过 CSS var |
| 动画 | **Framer Motion 11** | — |
| 状态 | **Zustand 4** | — |
| 存储 | `chrome.storage.local` 封装 + **IndexedDB 降级**（容量超阈值自动切换） | — |
| 拖拽 | **dnd-kit** | — |
| 虚拟列表 | **@tanstack/react-virtual** | — |
| 搜索 | **MiniSearch**（取代 Fuse.js） | Fuse.js 在 > 5K 条明显变慢 |
| 图标 | **Lucide React** | — |
| 日期 | **date-fns** | 轻量 |
| 拼音 | **pinyin-pro** | P2 |
| 测试 | Vitest + React Testing Library + Playwright（E2E） | §12 |

### 8.2 Manifest & 权限（修订版）
```jsonc
{
  "manifest_version": 3,
  "name": "Canopy",
  "version": "0.1.0",
  "default_locale": "zh_CN",
  "permissions": [
    "tabs",                  // 读取 / 操作 Tab
    "storage",               // 本地持久化
    "favicon",               // chrome://favicon2/ 新 API（Chrome 115+）
    "bookmarks",             // P2
    "sessions",              // Undo 恢复用
    "alarms",                // SW 心跳兜底
    "contextMenus"           // 右键菜单
  ],
  "optional_permissions": ["history"],   // 使用频率视图可选授权
  "host_permissions": [],                // 默认为空，避免商店敏感
  "optional_host_permissions": ["<all_urls>"],  // P2 全文检索按需申请
  "chrome_url_overrides": { "newtab": "newtab.html" },
  "action": { "default_popup": "popup.html" },
  "background": { "service_worker": "src/sw/index.ts", "type": "module" },
  "icons": { "16": "...", "48": "...", "128": "..." },
  "incognito": "split"   // 无痕窗口独立实例，数据隔离
}
```

> **修订说明**：v0.1 列的 `"favicon"` 权限写法正确，但需搭配 `chrome://favicon2/size/16@2x/https://...` 的新 URL 方案使用，旧的 `chrome://favicon/` 已弃用。

### 8.3 架构分层（细化）
```
┌──────────────────────────────────────────────────┐
│  Pages                                           │
│    newtab/  popup/  options/                     │
├──────────────────────────────────────────────────┤
│  Features (feature-sliced)                       │
│    tabs/  sessions/  search/  kanban/  settings/ │
├──────────────────────────────────────────────────┤
│  Shared UI (design-system)                       │
├──────────────────────────────────────────────────┤
│  Store (Zustand slices + persist middleware)     │
├──────────────────────────────────────────────────┤
│  Services (TabService / SessionService / ...)    │
├──────────────────────────────────────────────────┤
│  Repositories (StorageRepo / QuotaRepo)          │
├──────────────────────────────────────────────────┤
│  Chrome API Wrappers (promisified, mockable)     │
└──────────────────────────────────────────────────┘

Service Worker (src/sw)
  ├── EventBus: tabs events → BroadcastChannel("tabs-events")
  ├── StatsCollector: onActivated → 防抖写 storage
  ├── AlarmHeartbeat: 60s 心跳 + 定时落盘
  └── MessageRouter: chrome.runtime.onMessage
```

### 8.4 MV3 Service Worker 生命周期应对
- SW 会在 30s 空闲后挂起；重启后事件监听恢复。
- **关键事件不能依赖"常驻内存"**：
  - 使用频率计数器每次更新都 `await storage.set`（否则丢）。
  - Undo 队列写入 storage（而非仅内存），关闭新标签页也能撤销。
- **心跳兜底**：`chrome.alarms.create('heartbeat', {periodInMinutes: 1})` 让 SW 至少每分钟醒一次（注意：alarms 最小粒度 1 分钟，1 分钟内的丢事件需接受）。

---

## 9. 数据模型 & 存储策略

### 9.1 核心类型（修订版）
```ts
// ========== Runtime (非持久化) ==========
interface LiveTab {
  id: number;
  windowId: number;
  url: string;
  title: string;
  favIconUrl?: string;
  active: boolean;
  pinned: boolean;
  incognito: boolean;
  audible?: boolean;
  lastAccessed?: number;     // Chrome 116+; 不可用时由 SW 维护
  status?: 'loading' | 'complete' | 'unloaded';
}

// ========== Persistent ==========
interface ArchivedSession {
  id: string;                // nanoid
  name: string;
  createdAt: number;
  updatedAt: number;
  tabs: ArchivedTab[];
  tags?: string[];
  note?: string;
  schemaVersion: number;     // 用于未来迁移
}

interface ArchivedTab {
  url: string;
  title: string;
  favIconUrl?: string;
  archivedAt: number;
  note?: string;
  tags?: string[];
}

interface UrlStat {
  url: string;
  activations: number;
  lastActivatedAt: number;
  sessionBucket: string;     // 'day-20260422' 用于 7 日滚动统计
}

interface KanbanLayout {
  columns: KanbanColumn[];
  updatedAt: number;
}
interface KanbanColumn {
  id: string;
  name: string;
  color?: string;
  items: Array<{ kind: 'url'; url: string; note?: string }>;
}

interface Settings {
  schemaVersion: number;
  theme: 'light' | 'dark' | 'system';
  defaultView: ViewMode;
  overrideNewTab: boolean;
  showThumbnails: boolean;
  dedupeEnabled: boolean;
  dedupeStrict: boolean;
  gradientPreset: 'aurora' | 'sunrise' | 'deepspace' | 'custom';
  customGradient?: [string, string];
  shortcuts: Record<string, string>;
  closeConfirmThreshold: number;    // 默认 20
  undoWindowSeconds: number;        // 默认 5
  locale: 'zh-CN' | 'en-US' | 'auto';
}

type ViewMode = 'domain' | 'timeline' | 'grid' | 'compact' | 'frequency' | 'kanban';
```

### 9.2 Storage Schema 分区
| Key | 内容 | 预估容量 |
| --- | --- | --- |
| `settings` | Settings | < 2 KB |
| `sessions:index` | `{id, name, createdAt, tabCount}[]` | < 200 KB（1K 会话） |
| `sessions:<id>` | 单个会话详情 | 单会话 ≤ 500 KB |
| `stats` | UrlStat[] | ≤ 500 KB |
| `kanban` | KanbanLayout | < 100 KB |
| `tags` | `{url: string[]}` | ≤ 200 KB |
| `notes` | `{url: string}` | ≤ 500 KB |
| `foldState` | 折叠状态 | < 20 KB |
| `undo` | Undo 队列（仅最近 50 条） | < 50 KB |
| `metrics` | 本地埋点计数器 | < 50 KB |

### 9.3 存储容量监控与降级
- `chrome.storage.local` 上限 **10 MiB**。
- 每次写入前估算：`getBytesInUse()` + 预计增量 > 8 MiB → 触发告警。
- **自动降级路径**：容量超 8 MiB → 新的归档写 **IndexedDB**（容量以百 MB 计），索引元数据仍在 `storage.local`。
- 用户可见"存储容量"条（设置 → 数据页面），支持一键清理"超过 N 天的归档"。

### 9.4 数据迁移
- 所有持久化实体带 `schemaVersion`。
- 启动时 `MigrationRunner` 按版本链式升级；每次升级前备份到 `migration_backup_<ts>`（保留最近 3 份）。

---

## 10. 消息协议 & 并发模型

### 10.1 消息协议
使用 **BroadcastChannel** 做新标签页之间广播，`chrome.runtime.sendMessage` 做 SW 通信。

```ts
type Message =
  | { type: 'TABS_CHANGED'; payload: { changedIds: number[] } }
  | { type: 'SESSION_SAVED'; payload: { sessionId: string } }
  | { type: 'STATS_UPDATED' }
  | { type: 'UNDO_PUSH'; payload: UndoItem }
  | { type: 'QUOTA_WARNING'; payload: { usedBytes: number } };
```

- 所有消息**幂等**（多个新标签页收到可安全重复处理）。
- 版本字段 `protocolVersion: 1`，不兼容升级时丢弃旧消息。

### 10.2 并发与竞态
| 场景 | 风险 | 方案 |
| --- | --- | --- |
| 用户同时打开 3 个新标签页 | 3 个页面同时 `chrome.tabs.query`，可接受 | — |
| 3 个页面同时写 storage | 数据覆盖 | **所有写操作经 SW 串行化**（`chrome.runtime.sendMessage` 到 SW → SW 单线程队列处理） |
| 归档流程中用户关了新标签页 | 流程中断 | 归档作为**原子事务**：先写 storage，成功后再 `tabs.remove`；中途失败则回滚（重新打开 Tab） |
| Undo 队列跨页面 | Undo 在 A 页按下，B 页不知道 | Undo 持久化到 storage + BroadcastChannel 广播 |

---

## 11. 可访问性 & 国际化

### 11.1 A11y（WCAG 2.1 AA）
- 完整键盘操作：`Tab`/`Shift+Tab` 遍历，`Enter` 激活，`Delete` 关闭 Tab，`↑/↓` 在列表中移动。
- 所有图标按钮必须 `aria-label`。
- 焦点态清晰可见（见 §7.3）。
- 对比度满足 4.5:1 (正文) / 3:1 (大字)。
- `prefers-reduced-motion` 生效时禁用所有非必要动画。
- 颜色不作为唯一信息载体（如去重提示同时用色 + 图标 + 文字）。

### 11.2 国际化
- **MVP 开始就用 `_locales`**，不硬编码中文。
- 支持语言（v1）：zh-CN、en-US。
- 语言切换优先级：设置 > `chrome.i18n.getUILanguage()` > `en-US` 兜底。
- 日期 / 数字用 `Intl.DateTimeFormat` / `Intl.NumberFormat`。
- 长文本用 ICU MessageFormat 处理复数。

---

## 12. 测试策略 & 质量保证

### 12.1 测试金字塔
| 层 | 工具 | 覆盖目标 |
| --- | --- | --- |
| 单元测试 | Vitest | 纯函数、Services、Repositories ≥ 80% |
| 组件测试 | React Testing Library | 核心组件交互 |
| 集成测试 | Vitest + `@webextension-mock` | SW 行为、storage 流程 |
| E2E | Playwright + Chrome extension loading | MVP 关键路径 10 个用户故事 |

### 12.2 关键 E2E 场景
1. 安装扩展 → 新开 Tab → 看到工作台。
2. 打开 5 个域名的 10 个 Tab → 新标签页按域名分组显示正确。
3. 关闭一个 Tab → Undo 恢复。
4. Save All Tabs → 所有 Tab 关闭 + 归档可见 → Restore All 恢复到新窗口。
5. 搜索关键词 → 高亮匹配结果。
6. 导出 JSON → 清空 → 导入 → 数据一致。
7. 500 Tab 下切换视图帧率 ≥ 55。
8. 存储 8 MiB 时 Quota Warning 显示正确。
9. 快捷键 `Cmd+K` 聚焦搜索。
10. 深色模式切换无 FOUC。

### 12.3 手动回归清单
发布前 Checklist（见仓库 `docs/QA_CHECKLIST.md`）。

---

## 13. 本地埋点 & 度量口径

> 原则：**不上传**，所有数据仅用于用户自己查看（设置 → "关于 / 数据洞察"）。

### 13.1 埋点事件
| 事件 | 字段 | 用途 |
| --- | --- | --- |
| `newtab_open` | `ts` | 日均打开次数 |
| `view_switch` | `from`, `to` | 功能使用偏好 |
| `session_save` | `tabCount` | 归档规模分布 |
| `session_restore` | `tabCount` | — |
| `tab_close` | `count`, `source` | Undo 触发率 |
| `search_query` | `len`（不存内容） | 搜索活跃度 |
| `perf_fcp` | `ms` | 首屏性能 |
| `perf_fps_sample` | `p50`, `p95` | 帧率 |

### 13.2 度量口径
- 首屏时间（FCP）：从 `document.visibilityState === 'visible'` 到第一次非骨架内容 paint。
- 帧率：`requestAnimationFrame` 采样 5s，计算 P50 / P95。
- 达标阈值（§16 成功指标）。

---

## 14. 工程规范

### 14.1 文件结构
```
tabs/
├── manifest.json
├── src/
│   ├── pages/
│   │   ├── newtab/       # 新标签页入口
│   │   ├── popup/        # 工具栏弹窗
│   │   └── options/      # 设置页
│   ├── features/
│   │   ├── tabs/         # 实时 Tab 聚合 + 视图
│   │   ├── sessions/     # 归档会话
│   │   ├── search/       # 搜索与索引
│   │   ├── kanban/       # 看板
│   │   └── settings/
│   ├── shared/
│   │   ├── ui/           # 设计系统组件
│   │   ├── hooks/
│   │   ├── utils/
│   │   └── i18n/
│   ├── store/            # Zustand slices
│   ├── services/         # TabService / SessionService / SearchService / StatsService
│   ├── repositories/     # StorageRepo / QuotaRepo / IndexedDbRepo
│   ├── chrome/           # Chrome API promisified wrappers
│   └── sw/               # Service Worker
│       ├── index.ts
│       ├── event-bus.ts
│       ├── stats-collector.ts
│       └── message-router.ts
├── public/
│   ├── icons/
│   └── _locales/
│       ├── zh_CN/messages.json
│       └── en/messages.json
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── QA_CHECKLIST.md
│   └── CHANGELOG.md
├── scripts/
│   ├── release.mjs       # 打包 + 版本号处理
│   └── check-quota.mjs
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

### 14.2 代码规范
- ESLint（airbnb-base + @typescript-eslint）+ Prettier。
- Commit：Conventional Commits（`feat:` / `fix:` / `perf:` / ...）。
- PR：必须过 CI（type-check + unit + lint）。
- Git 分支：`main`（稳定）/ `dev`（开发）/ `feat/*` / `fix/*`。

### 14.3 版本与发布
- 语义化版本（SemVer）：`MAJOR.MINOR.PATCH`。
- `CHANGELOG.md` 每次发布追加。
- 发布流程：`pnpm release` → 自动 bump 版本 → 生成 `.zip` → 上传 Chrome 商店（半自动，需人工确认商店页文案）。

---

## 15. MVP 推荐与迭代路线

### 15.1 MVP（第 1–2 周，约 10 个工作日）
**目标**：一个"每天都想打开"的最小可用产品。

**功能范围**：F-01 ~ F-07 + 毛玻璃视觉（亮 + 暗）+ 基础快捷键 + i18n 双语基座 + A11y 基线。

**不做**：时间轴 / 网格 / 频率 / 看板 / 标签备注 / 导入导出 / 设置面板（简易版即可）。

**DoD（MVP 完成定义）**：
- [ ] 安装后新标签页正常接管，500ms 内渲染完成
- [ ] 跨窗口 Tab 按域名分组正确
- [ ] 关闭 / 批量关闭 / Undo 全链路通
- [ ] Save All Tabs 能归档并恢复
- [ ] 搜索 / Cmd+K / Esc 工作正常
- [ ] 亮 / 暗主题切换无闪烁
- [ ] 10 个关键 E2E 用例全过
- [ ] 符合 A11y 基线（键盘全可达 + 对比度）

### 15.2 Phase 2（第 3–4 周）
F-10 多视图 + F-11 频率 + F-13 去重 + F-14 会话管理 + F-15 导入导出 + F-16 设置面板。

### 15.3 Phase 3（第 5–6 周）
F-12 标签备注 + F-20 看板 + F-21 书签 + F-22 固定 + 性能压测（500 / 1000 Tab）。

### 15.4 Phase 4（上架前打磨）
F-23 自动快照 + F-24 检索增强 + 商店素材 + Edge 适配 + Firefox 适配评估。

---

## 16. 成功指标

| 指标 | 目标值（3 个月） | 度量方式 |
| --- | --- | --- |
| Chrome 商店安装量 | 1 万+ | 商店后台 |
| 7 日留存 | ≥ 40% | 本地埋点 `newtab_open` 时间分布（不外传） |
| 日均打开新标签次数 | ≥ 10 / 用户 | 同上 |
| 平均评分 | ≥ 4.5 ★ | 商店 |
| 首屏渲染 (FCP P95) | ≤ 200ms | `perf_fcp` |
| 500 Tab 下帧率 P95 | ≥ 55 fps | `perf_fps_sample` |
| Crash Rate | < 0.1% | 本地错误日志比 |

---

## 17. 风险与未决问题

### 17.1 风险登记
| 风险 | 等级 | 影响 | 缓解 |
| --- | --- | --- | --- |
| Chrome 商店对 `tabs` / `<all_urls>` 敏感 | 高 | 上架被拒 | MVP 不申请 `<all_urls>`；清晰隐私政策 |
| 缩略图无法覆盖所有 Tab | 中 | 视觉一致性差 | OG image / favicon / 域名色块 4 级降级 |
| MV3 SW 30s 休眠丢事件 | 中 | 频率统计不准 | 立即落盘 + alarms 心跳 + 启动时校正 |
| Storage 10MiB 上限 | 中 | 重度用户受限 | 容量监控 + IndexedDB 降级 |
| 多新标签页并发竞态 | 低 | 数据不一致 | SW 串行化写入 |
| Firefox MV3 差异 | 低 | 兼容成本 | Phase 4 再评估，非阻塞 |
| Arc 浏览器等小众目标 | 低 | 适配成本 | 只做 Chromium 主力 |

### 17.2 待用户确认
- **品牌名**：✅ 已定为 **Canopy**（树冠，寓意收束 + 视觉柔和）。
- **是否上架 Chrome 商店**：决定隐私政策页、法务文案、开发者账号。
- **Firefox / Edge 支持**：v1 仅 Chromium？
- **v1 是否收集任何匿名遥测**：当前方案是"全本地"，不外发——确认保持。

---

## 18. 术语表

| 术语 | 含义 |
| --- | --- |
| MV3 | Manifest V3，Chrome 扩展新规范 |
| SW | Service Worker，MV3 的后台脚本形态 |
| PSL | Public Suffix List，公共后缀列表（用于识别注册域名） |
| OG | Open Graph，网页元数据协议 |
| FCP | First Contentful Paint，首次内容绘制 |
| WCAG | Web Content Accessibility Guidelines，Web 可访问性标准 |
| Undo Toast | 操作后右下角的可撤销提示条 |
| Live Tab | 运行时的真实 Tab（来自 chrome.tabs） |
| Archived Session | 持久化的归档会话（多个 Tab 的集合） |

---

_文档版本：v0.2 · 持续迭代中_
