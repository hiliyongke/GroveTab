# CODEBUDDY.md This file provides guidance to CodeBuddy when working with code in this repository.

## 常用命令

```bash
# 开发模式
pnpm dev                        # 启动 Vite 开发服务器（HMR）

# 构建
pnpm build                      # 类型检查 + 测试 + Vite 构建 + SW 构建
pnpm build:fast                 # tsc -b + Vite 构建 + SW 构建（跳过测试）
pnpm build:strict               # lint + 类型检查 + 测试 + 构建（完整 CI）

# 测试
pnpm test                       # 运行全部 425+ 个 Vitest 用例
pnpm test:watch                 # 监听模式
pnpm test:coverage              # 带覆盖率

# 类型检查
pnpm type-check                 # tsc --noEmit

# Lint
pnpm lint                       # ESLint
pnpm lint:fix                   # ESLint auto-fix
pnpm lint:style                 # Stylelint for .less/.css
```

**构建后验证**：提交前必须通过 `pnpm build`（type-check + test + build），禁止提交含类型错误、构建失败或测试失败的代码。

**Chrome 扩展特殊说明**：修改 `manifest.json`（如 CSP、权限）后必须手动重载扩展（`chrome://extensions` → 刷新按钮），HMR 不会触发 manifest 变更。

---

## 项目架构

GroveTab 是一个 Chrome Manifest V3 新标签页扩展，技术栈：React 19 + TypeScript + Vite + Ant Design v6 + Zustand。

### 构建系统

两个独立阶段：
- **Vite** 处理 `newtab` 和 `popup` 两个入口，输出到 `dist/`
- **esbuild** (`scripts/build-sw.mjs`) 单独将 `src/sw/index.ts` 打包为 `dist/sw.js`，单文件自包含（`splitting: false`）。因为 Service Worker 不能加载含 DOM 引用的 chunk

路径别名：`@` → `src/`, `@pages` → `src/pages/`, `@features` → `src/features/`, `@shared` → `src/shared/`, `@store` → `src/store/`, `@services` → `src/services/`, `@repos` → `src/repositories/`, `@chrome` → `src/chrome/`

### 两大入口

| 入口 | 路径 | 用途 |
|------|------|------|
| **Newtab** | `src/pages/newtab/index.html` | 新标签页主界面，60+ 视图 |
| **Popup** | `src/pages/popup/index.html` | 工具栏弹窗（统计 + 快捷操作） |

### 视图系统

页面通过 URL Hash 路由 (`#/workspace=默认工作区/view=tabs/panel=archive`) 驱动：

- **`ViewRegistry`** (`src/shared/config/views.ts`)：注册所有视图，每个视图有 `id`、`permission`（如 `"bookmarks"`）、`lazyComponent`（`React.lazy`）、`panelChildren`（子面板）
- **`App.tsx`** 解析 hash → 加载对应 `ViewRegistry` 的懒加载组件
- 支持的面板：`archive`、`sessions`、`settings`、`bookmarks`（嵌套在 TabsSubView 下）
- **`CommandPalette`**：`⌘P` 全局触发，`command-registry.ts` 注册 19+ 命令，fuse.js 搜索

新建功能按以下步骤：
1. 在 `src/shared/config/views.ts` 注册视图
2. 在 `src/shared/config/storage-keys.ts` 添加存储键（如需要）
3. 在 `src/pages/newtab/App.tsx` 中的视图路由添加懒加载
4. 视需要添加可选的 command-palette 命令

### Chrome API 层

所有 Chrome API 调用**必须**通过 `src/chrome/` 的封装层，禁止直接使用 `chrome.*`：

- **`safe-call.ts`**：核心封装 — 5 秒超时、`lastError` 检查、错误归一化
- **`storage.ts`**：`chrome.storage.local` 封装
- **`tabs.ts`**：Tab 增删改查 + 窗口管理
- **`bookmarks.ts`**：书签 CRUD
- **`fetch.ts`**：`fetch` 的超时封装

### 数据层架构

```
UI Components
  └── Zustand Stores (src/store/)
        └── Repository Layer (src/repositories/)
              └── Chrome API Wrappers (src/chrome/)
```

**Zustand Slices** (`src/store/`)：
- `tabs-slice.ts` — `LiveTab[]` 数组、窗口 Map、广播消息分发（最大切片，~22KB）
- `settings-slice.ts` — 用户设置（主题/搜索/热词源/功能开关）、工作区模板、自动化规则
- `undo-slice.ts` — 撤销记录（TTL 自动过期）
- `selection-slice.ts` — 多选模式（`Set<string>`），Shift 范围选择、ESC 退出
- `metadata-slice.ts` — URL 关键字的标签/备注/置顶

**Store 使用模式**：始终按需订阅（`useStore(s => s.field)`），多字段用 `shallow` 比较。禁止订阅整个 store。

**Repository Layer** (`src/repositories/`)：
- `storage-repo.ts` — 通用存储后端（chrome.storage.session + local 适配器），quota 检测 + 版本迁移
- `trash-repo.ts` — 回收站 CRUD（最近关闭的 Tab/窗口）
- `history-repo.ts` — 历史事件记录（tab_opened/closed、window_closed）
- `focus-time-repo.ts` — 每日聚焦时长统计
- `automation-rule-repo.ts` — 自动化规则持久化
- `workspace-template-repo.ts` — 工作区模板
- `search-preferences-repo.ts` — 搜索偏好
- 归档/草稿/会话数据位于 `src/services/archive/`

Repository 负责数据持久化，Store 负责 UI 状态。

**存储后端**：
- `chrome.storage.local`：主力存储，支持 `storage.StorageArea` 适配器接口
- `chrome.storage.session`：临时数据（操作中状态）
- OPFS (`src/shared/utils/opfs-storage.ts`)：大文件缓存、热榜备份（不与 chrome.storage 争配额）
- IndexedDB：`indexed-db-store.ts` 提供通用键值存储

### Service Worker (`src/sw/index.ts`)

后台任务，通过 `chrome.alarms` 定时触发：
- **`refreshTrendingCache`**：每 30 分钟刷新热榜缓存（仅对已有缓存的平台）
- **`refreshWeather`**：天气数据更新
- **`cleanupUndoRecords`**：过期撤销记录清理
- **`refreshOGImages`**：OG 图片预加载（流控：`ogInFlight` session 计数器限制并发）

SW 使用动态 `import()` 按需加载依赖以减少常驻内存。

### CSP 约束（重要！）

`manifest.json` 中的 `content_security_policy.extension_pages` 限制了 `connect-src`。**所有外部 API 域名必须在 CSP 中注册**，否则 `fetch` 请求会被 Chrome 静默拦截：

```
connect-src 'self' https://api.open-meteo.com https://wttr.in https://github-trending.rexx.cc https://mirror.ghproxy.com https://ungh.cc https://api.xcvts.cn https://dailyhot-api.vercel.app
```

新增外部 API 调用时，必须同步更新 `manifest.json` 的 CSP。

### 热榜模块 (`src/services/trending-service.ts` + `src/features/trending/`)

多源聚合 17+ 平台热榜数据，降级链：`xcvts 主源 → dailyhot 备用源 → chrome.storage 新鲜缓存 → 过期缓存/OPFS`。

关键规则：
- 并发上限 2 worker，请求间 300ms 延迟（防 429 限流）
- 检测到 429 后全局停止网络请求，后续平台直接走缓存
- 缓存新鲜度阈值 30 分钟
- 支持 `onProgress` 渐进加载回调（每平台完成立即渲染）
- SW 后台刷新使用 500ms 延迟 + 顺序请求

### 国际化

`i18n/source/zh-CN.json` 和 `en.json` 为核心翻译文件。构建时 JSON 文件被 MD5 hash 后复制到 `dist/i18n/`，通过 `__I18N_MANIFEST__` 脚本注入 HTML。组件中使用 `useT()` Hook 获取 `t()` 函数。

**重要**：`translate()` 函数（`@/shared/i18n/core`）不应在模块顶层常量中使用（如 `PLATFORMS` 数组），因为模块初始化时 i18n 可能未就绪。`PLATFORMS` 中的 `translate()` 调用是历史遗留问题。

### 样式

CSS Modules（`*.module.less`）强制使用。样式 Token 通过 antd 的 `var(--ant-*)` CSS 变量引用。布局必须使用 antd 组件（`<Flex>`/`<Row>`/`<Col>`/`<Space>`），禁止 CSS `display: flex`/`grid`/`gap`，除非是微调 antd 组件内部样式。

### 类型系统

- 接口用 `interface`，联合类型/交叉类型用 `type`
- 类型导入用 `import type`（值导入分离）
- 全局类型在 `src/shared/types/` 定义，通过 `index.ts` 统一导出

### 测试

Vitest + React Testing Library。`tests/` 目录存放纯逻辑测试，组件测试放在对应 `__tests__/` 或组件同级目录。目标覆盖率 ≥ 80%。

### 文件暂存配置

`lint-staged` + Husky：`*.ts/tsx` 自动 ESLint fix + Prettier；`*.json/md/yml` 和 `*.css/less` 仅 Prettier。
