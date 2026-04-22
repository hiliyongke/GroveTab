# Canopy 项目长期记忆

## 项目性质
Canopy 是 Chrome/Edge 扩展的新标签页替代（newtab override），核心能力：标签管理、分组、去重、归档、搜索、快捷键。

## 技术栈（2026-04-22 之后）
- React 19 + Vite 8 + TypeScript 6
- **UI 库：Ant Design v6**（替换原 Tailwind + shadcn 风格）
- 主题：antd 默认蓝 + 明暗双套，风格现代轻盈卡片化
- 状态：Zustand 5
- 路由：无（newtab 单页）
- 其他：motion（页面级动画）、lucide-react（与 @ant-design/icons 共存）、minisearch（搜索）、pinyin-pro（中文搜索）

## 项目约定
- 注释：**中文 + 标准 TSDoc**
- 代码最佳实践优先；按 **GSD 规范** 启动开发任务（.planning/phases/ 目录下分阶段管理）
- **禁止裸 div + className 自拼组件**，一律走 `@/shared/ui` 或直接使用 antd 组件
- 一次大改前先出视觉稿和迁移计划，用户审阅后再执行
- **antd 主题 token 定制纪律**：
  - Seed token（`colorPrimary` / `colorTextLightSolid` / `colorBgBase` 等全局色）只能放 `themeConfig.token` 顶层，**禁止**塞进 `components.Xxx` 命名空间
  - 搭配 `cssVar + hashed: false` 时尤其要小心：token 错位会导致难以定位的"首次正常第二次失效"类动画 bug（2026-04-22 Tooltip 事故）
  - 设置类 store action 必须「同步 set + 异步落盘」，不能 `await save` 再 set（同日 updateSettings 事故）
- **Chrome API 容错纪律**（2026-04-22 确立）：
  - 所有 `chrome.*` 必须经 `src/chrome/tabs.ts` 的 `safeCall(label, fn, timeout)` 封装，严禁业务层直触
  - 失败路径必须有用户可感反馈——统一走 `feedback.error()`（`src/shared/ui/feedback.ts`），UI 层不再需要自己 try/catch + message
  - 非 React 代码要 i18n 用 `translate()` 纯函数版，不要拿 `useT`
  - 错误后必须 `loadAllTabs({ silent: true })` 兜底刷新，避免"chrome 已改但 UI 没同步"的幽灵态
- **Undo/恢复默认在当前窗口**：撤销关闭、恢复归档这类\"回退\"操作，默认应**就地**在当前窗口打开，而不是另开新窗口。多 tab 也一样（遍历 createTab+windowId），除非原始快照本身就跨多个窗口。
  - **多卡并排的色彩纪律**（2026-04-22 水彩版 · 三次迭代封板）：
  - 色彩作为"身份索引" —— 位置固定、体量克制、信息密集（贴近 favicon）
  - 禁用渐变融入背景的"假自适应" —— 必须生成 `barLight` / `barDark` 两套色值，`useResolvedTheme()` 挑用
  - **水彩路线 accent 参数**（三次迭代封板，2026-04-22）：
    - 浅色主题 barLight：**S≈0.48, L≈0.68**（中低饱和中偏高亮，柔和可辨）
    - 深色主题 barDark：**S≈0.55, L≈0.62**（中饱和中亮，暗底不闪烁）
    - 通用 bar：S≈0.52, L≈0.60；soft：`barLight + '2e'`（18% 透明，让 favicon 徽章底色更可感）
    - **三次迭代血泪教训**：
      1. 克制版 S=0.42/L=0.45 → 白底对比度不足，看不清
      2. 多巴胺版 S=0.85/L=0.58 → 跟 antd 极简白底风格撕裂，太刺眼
      3. 水彩版 S=0.48/L=0.68 → 柔和但可辨，与 antd 调性协调 ✅
    - **核心洞察**：色彩参数必须服从 **UI 整体调性**——antd 的"白底+细灰线+小圆角"文档风
      不吃多巴胺，高饱和在这种环境下像"贴了荧光便签"。色条饱和度的合理范围由宿主 UI 决定。
  - 色条位置优先考虑：**左侧 2px 竖线**（hover 3px，细克制不抢戏）> favicon 底板 > 顶部条
    - 教训：4px 色条多卡并排会"喧宾夺主"，2px 才是"身份索引"的合适体量
  - 视觉偏好强的纪律（色条位置 / 密度 / 圆角）**优先做成设置项**暴露给用户
  - **色相池用"水彩 20 色"而非 antd 预设**：
    - `PALETTE_HUES` 精选 20 色相（红/玫红/品红/紫红/紫/紫罗兰/靛/宝蓝/天蓝/青/蓝绿/薄荷/草绿/嫩绿/橄榄黄/橙/橘红/朱红 等）
    - 剔除 45°-55°（土黄）和 85°-95°（艳黄绿，白底对比度低）
    - 2026-04-22 从 12 色扩到 20 色：色相池越大，批次内原生"撞色"概率越低
    - antd `presetPrimaryColors` 里的 gold / geekblue 在水彩参数下仍可用，但直接用 HSL 更可控
  - **批次内颜色去重是必须的**（2026-04-22 封板）：仅靠 `stringToAccent`（色相池哈希）或 `useAccent`（各自为政）在多卡并排时**必然撞色**；视图容器层必须调用 `useGroupAccents(inputs)` 做批次贪心分配（**MIN_SEPARATION=35°**，色相圆上找最远空位），再以 `accentOverride` 下发给卡片。`DomainGroupView` / `GridView` 已按此模式落地，后续新增的"多卡并排"视图务必沿用。
  - **N > 色相池容量时的二重保险**（2026-04-22 三次迭代封板）：
    1. **seed 抖动**：`findFarthestHue(used, seed)` 收集所有等距候选 hue，用 `colorKey` 的 `hashDeg` 稳定挑位置，打破"后续卡都撞同一 hue"
    2. **明度抖动**（水彩版新增）：`useGroupAccents` 用 `hueCount` 追踪同 hue 出现次数，
       按 occurrence 摆动 lShift（±0.05、±0.10），经 `buildAccentFromHue(h, lShift)` 生成不同亮度的同色相 Accent
    3. 两层叠加：色相不够 → 明度接力；同一 colorKey 永远映射到同一最终色（稳定性）
    - 教训：单靠色相维度容量必然饱和（20 色 × MIN_SEPARATION=20° 已逼近上限），
      必须引入"第二维度"（亮度）作为逃生通道
- **React 19 副作用纪律**（2026-04-22 封板时确立）：
  - `react-hooks/set-state-in-effect` 是硬规则。旧 `useEffect(() => { if (x) setY() }, [x])` 模式**一律要改**
  - 三种合法出路：
    1. 订阅外部系统 API → `useSyncExternalStore`（参见 `use-resolved-theme.ts`）
    2. 根据 prop/state 派生 → 渲染期 `setState` 或 `useMemo`（参见 `useAccent.ts` 的 key+value 合并 state 模式）
    3. 真·用户事件 → 改走事件回调（antd Modal/Drawer 的 `afterOpenChange`、Input 的 `onChange`）
  - `ref.current = x` 在渲染期也会被 `react-hooks/refs` 拦，想用 ref 绕这条规则是死路
- **i18n 文件组织纪律**：
  - 字典、纯函数（`translate` / `translateWithLocale` / `formatDate` / `formatNumber`）放 `src/shared/i18n/core.ts`
  - Provider / Hook 放 `src/shared/i18n/index.tsx`，只允许 re-export 类型（`export type { Locale }`）
  - 非 React 环境（store action、chrome 回调）一律 `import { translate } from '@/shared/i18n/core'`
  - React 环境用 `useT` from `@/shared/i18n`
  - 原因：`react-refresh/only-export-components` 规则禁止同文件同时导出组件和纯函数 value
- **Favicon 控制台静默纪律**（2026-04-22 封板后补丁确立）：
  - MV3 唯一合法入口是 `chrome-extension://<chrome.runtime.id>/_favicon/?pageUrl=...&size=...`（manifest 已声明 `favicon` permission）
  - **禁用** `chrome://favicon2/...`（会打红控制台）
  - 所有来自 chrome API 的 favicon URL（`tab.favIconUrl`、归档快照）**必须**在进入 store / 持久化之前被 `getFaviconUrl(url)` 改写成扩展同源入口，否则远程 favicon 加载失败会产生 JS 抓不住的 `net::ERR_*` / CORS 浏览器级红字
  - `favicon-color.ts` 取色**只处理同源 URL**，跨源直接 resolve(null) 走哈希兜底；同源图片**不要**设置 `crossOrigin="anonymous"`

## 用户偏好
- 沟通风格：简短、结构化、中文
- 文档风格：严谨，无 AI 腔调
- 工作要求：UI 效果不佳时倾向简化设计
- 预览习惯：喜欢能直接打开看效果（HTML 预览、`pnpm dev` 等）
- 交付习惯：以列表形式汇报修复/改动点

## 当前活动
- **Phase 04：antd v6 全量重构 —— 2026-04-22 封板** ✅
  - tsc 0 错误 / build 510ms / lint 0 error 3 warning（均为规则与第三方库的局限，非业务问题）
  - 域名分组色条位置支持左/顶/隐藏三档，色彩作为身份索引
  - Chrome API 全链条 safeCall + feedback 反馈，UI 层不再写 try/catch
  - React 19 副作用纪律贯彻完毕
- **竞品调研 + UX 修复 —— 2026-04-23** ✅
  - 搜索支持 URL 字段 + 状态栏 i18n 修复
  - 归档会话重命名 UI 补齐（后端已有，前端缺入口）
  - SW 上下文菜单 save-all 从空操作升级为完整归档流程
  - 清理 kanban 悬空类型 + Popup 升级为可用快捷操作页
- **主题体系升级 —— 2026-04-23** ✅
  - 预设从 3 种扩到 9 种（default/slate/warm/ocean/forest/sunset/deepspace/midnight/custom）
  - 每个预设含 light+dark 双套渐变，resolveGradient() 统一消费
  - 设置面板渐变选择器重做：3×3 grid 大色卡 + 模式角标
  - App.tsx layoutBackground 消灭硬编码
  - 旧 aurora→slate / sunrise→warm 自动迁移

- **竞品差距（2026-04-23 调研）**
  - **已实现的高优特性**：全局快捷键（manifest commands + SW 监听 + 设置面板展示）、域名分组内拖拽排序（motion Reorder.Group/Item）、标签休眠/冻结（chrome.tabs.discard + 右键菜单 + 整组休眠）
  - **仍未实现的中优特性**：分组间拖拽（CSS multi-column 冲突）、Chrome 原生 Tab Groups 集成、多窗口管理面板、历史记录集成
  - **低优/暂不落地**：云同步、AI 功能、团队协作工作区
