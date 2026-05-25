# GroveTab 开发规范文档

> 版本：v1.0 · 基于本次重构优化沉淀  
> 适用范围：人工开发、AI 辅助开发、代码 Review

---

## 目录

1. [技术栈总览](#1-技术栈总览)
2. [项目目录结构](#2-项目目录结构)
3. [环境与工具链要求](#3-环境与工具链要求)
4. [TypeScript 规范](#4-typescript-规范)
5. [React 组件规范](#5-react-组件规范)
6. [状态管理规范（Zustand）](#6-状态管理规范zustand)
7. [样式规范（Less + CSS Modules + Antd Token）](#7-样式规范less--css-modules--antd-token)
8. [UI 组件规范（Antd v6）](#8-ui-组件规范antd-v6)
9. [主题与皮肤系统](#9-主题与皮肤系统)
10. [国际化规范（i18n）](#10-国际化规范i18n)
11. [路径别名规范](#11-路径别名规范)
12. [测试规范（Vitest）](#12-测试规范vitest)
13. [Git 提交规范](#13-git-提交规范)
14. [代码质量工具链](#14-代码质量工具链)
15. [构建与发布流程](#15-构建与发布流程)
16. [Chrome 扩展开发规范](#16-chrome-扩展开发规范)
17. [性能规范](#17-性能规范)
18. [React 极致性能最佳实践](#18-react-极致性能最佳实践)
19. [Review 检查清单](#19-review-检查清单)

---

## 1. 技术栈总览

| 分类       | 技术                    | 版本   | 说明                               |
| ---------- | ----------------------- | ------ | ---------------------------------- |
| 运行时     | React                   | ^19    | 函数组件 + Hooks，禁止 Class 组件  |
| 语言       | TypeScript              | ^6     | 严格模式，全量类型覆盖             |
| 构建       | Vite                    | ^8     | 开发服务器 + 生产构建              |
| UI 组件库  | Ant Design              | ^6     | 唯一 UI 组件库，禁止混用其他组件库 |
| 状态管理   | Zustand                 | ^5     | 按 slice 拆分，禁止 Redux/MobX     |
| 样式       | Less + CSS Modules      | ^4     | 组件级样式隔离                     |
| 图标       | lucide-react            | ^1     | 唯一图标库，禁止混用               |
| 动画       | motion                  | ^12    | Framer Motion 继任者               |
| 拖拽       | @dnd-kit                | ^6/^10 | 无障碍拖拽                         |
| 虚拟列表   | @tanstack/react-virtual | ^3     | 长列表性能优化                     |
| 搜索       | minisearch              | ^7     | 本地全文搜索                       |
| 日期       | dayjs                   | ^1     | 禁止使用 moment.js                 |
| 拼音       | pinyin-pro              | ^3     | 中文拼音搜索支持                   |
| 快捷键     | tinykeys                | ^3     | 键盘快捷键绑定                     |
| 域名解析   | tldts                   | ^7     | URL/域名解析                       |
| ID 生成    | nanoid                  | ^5     | 唯一 ID 生成                       |
| 包管理     | pnpm                    | ^9     | 禁止使用 npm/yarn                  |
| 测试       | Vitest                  | ^4     | 单元测试框架                       |
| Lint       | ESLint                  | ^10    | Flat Config 模式                   |
| 格式化     | Prettier                | ^3     | 统一代码格式                       |
| 样式 Lint  | Stylelint               | ^17    | Less/CSS 规范检查                  |
| 提交规范   | commitlint              | ^19    | Conventional Commits               |
| 发布       | release-it              | ^20    | 自动化版本发布                     |
| 死代码检测 | knip                    | ^6     | 未使用文件/导出检测                |

### 核心原则

- **能用权威开源库就不自己造轮子**
- **能用 Antd 组件就不写原生 HTML 标签**
- **能用 CSS Token 就不硬编码颜色/间距**
- **能用 TypeScript 类型就不用 `any`**

---

## 2. 项目目录结构

```
src/
├── chrome/          # Chrome Extension API 封装层（bookmarks、tabs、history、tabGroups）
├── features/        # 业务功能模块（按功能域划分）
│   ├── bookmarks/   # 书签管理
│   ├── developer-tools/  # 开发者工具
│   ├── effects/     # 视觉特效（点击效果、视频背景）
│   ├── history/     # 历史记录
│   ├── insights/    # 数据洞察
│   ├── quick-start/ # 快速启动（Speed Dial）
│   ├── search/      # 搜索功能
│   ├── sessions/    # 会话归档
│   ├── settings/    # 设置面板
│   ├── tabs/        # 标签页管理（核心功能）
│   ├── trending/    # 热门趋势
│   └── workspace/   # 工作区布局（Header、Sidebar、Dock）
├── pages/
│   ├── newtab/      # 新标签页入口
│   └── popup/       # 弹出窗口入口
├── repositories/    # 数据持久化层（Chrome Storage 封装）
├── services/        # 业务服务层（archive、history、trending）
├── shared/
│   ├── config/      # 全局配置（搜索引擎、快捷键、视图注册、z-index）
│   ├── hooks/       # 共享 Hooks
│   ├── i18n/        # 国际化（core.ts + index.tsx）
│   ├── styles/      # 全局 Less 变量（_variables.less）
│   ├── theme/       # 主题系统（skin-presets、theme-customization）
│   ├── types/       # 共享类型定义
│   └── ui/          # 共享 UI 组件（AntdThemeProvider、ErrorBoundary 等）
├── store/           # Zustand 状态切片
├── sw/              # Service Worker（Chrome 扩展后台）
└── types/           # 全局类型声明（.d.ts）
```

### 目录命名规则

| 类型             | 命名规则                 | 示例                                 |
| ---------------- | ------------------------ | ------------------------------------ |
| 功能目录         | `kebab-case`             | `quick-start/`, `developer-tools/`   |
| React 组件文件   | `PascalCase.tsx`         | `TabItem.tsx`, `SearchBox.tsx`       |
| CSS Modules 文件 | `PascalCase.module.less` | `SearchBox.module.less`              |
| Hook 文件        | `use-kebab-case.ts`      | `use-search-results.ts`              |
| 工具/服务文件    | `kebab-case.ts`          | `archive-operations.ts`              |
| 类型文件         | `kebab-case.ts`          | `settings.ts`, `tab.ts`              |
| 配置文件         | `kebab-case.ts`          | `search-engines.ts`, `z-index.ts`    |
| Store 切片       | `kebab-case-slice.ts`    | `tabs-slice.ts`, `settings-slice.ts` |

### Feature 模块内部结构

每个 `features/xxx/` 模块应遵循以下结构：

```
features/xxx/
├── XxxPage.tsx          # 主页面/入口组件（PascalCase）
├── XxxPage.module.less  # 主组件样式
├── components/          # 子组件（仅本模块使用）
├── hooks/               # 本模块专用 Hooks
├── utils/               # 本模块工具函数（可选）
├── styles/              # 额外样式文件（可选）
└── index.ts             # 公开导出（仅导出外部需要的内容）
```

---

## 3. 环境与工具链要求

### 版本要求

```
Node.js >= 22.0.0（见 .node-version 文件）
pnpm   >= 9.0.0
```

### 常用命令

```bash
# 开发
pnpm dev                  # 启动开发服务器

# 构建
pnpm build                # 完整构建（type-check + test + build）
pnpm build:strict         # 严格构建（额外包含 lint 检查）
pnpm build:fast           # 快速构建（仅 tsc + vite build，跳过测试）

# 代码质量
pnpm type-check           # TypeScript 类型检查
pnpm lint                 # ESLint 检查
pnpm lint:fix             # ESLint 自动修复
pnpm lint:style           # Stylelint 检查
pnpm lint:style:fix       # Stylelint 自动修复
pnpm format               # Prettier 格式化
pnpm format:check         # Prettier 格式检查

# 测试
pnpm test                 # 运行所有测试
pnpm test:watch           # 监听模式
pnpm test:coverage        # 生成覆盖率报告

# 死代码检测
pnpm knip                 # 检测未使用的文件/导出/依赖

# 国际化
pnpm i18n:scan            # 扫描代码中的中文字符串，自动补录到字典
pnpm i18n:check           # 检查翻译完整性（缺失/冗余/未登记）

# 发布
pnpm release              # 交互式发布
pnpm release:dry          # 模拟发布（不实际执行）
```

---

## 4. TypeScript 规范

### 严格模式配置

项目启用了 TypeScript 最高严格级别，以下选项均为 `true`：

```json
{
  "strict": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noFallthroughCasesInSwitch": true,
  "noImplicitOverride": true,
  "noImplicitReturns": true,
  "noUncheckedIndexedAccess": true,
  "forceConsistentCasingInFileNames": true
}
```

### 类型定义规范

```typescript
// ✅ 正确：使用 interface 定义对象类型
interface TabItem {
  id: number;
  title: string;
  url: string;
}

// ❌ 错误：使用 type 定义对象类型（ESLint 会警告）
type TabItem = {
  id: number;
  title: string;
};

// ✅ 正确：使用 type 定义联合类型/工具类型
type ViewMode = "list" | "grid" | "kanban";
type TabId = number;

// ✅ 正确：使用 import type 导入纯类型
import type { TabItem } from "@/shared/types";

// ❌ 错误：使用 any
const data: any = fetchData();

// ✅ 正确：使用 unknown + 类型守卫
const data: unknown = fetchData();
if (isTabItem(data)) {
  /* ... */
}
```

### 数组类型规范

```typescript
// ✅ 正确：简单类型用 T[]
const tabs: TabItem[] = [];
const ids: number[] = [];

// ✅ 正确：复杂泛型用 Array<T>
const nested: Array<Array<TabItem>> = [];
const callbacks: Array<() => void> = [];
```

### 空值处理规范

```typescript
// ✅ 优先使用可选链
const title = tab?.title ?? "无标题";

// ✅ 使用空值合并而非 ||（避免 0/false 被误判）
const count = settings.count ?? 10;

// ❌ 避免非空断言（!），除非有充分理由
const el = document.getElementById("root")!; // 需要注释说明原因
```

### 函数类型规范

```typescript
// ✅ 正确：使用函数类型而非接口方法签名
type Handler = (event: MouseEvent) => void;

// ✅ 正确：异步函数明确返回类型
async function fetchTabs(): Promise<TabItem[]> {
  /* ... */
}

// ✅ 正确：事件处理函数命名以 handle 开头
const handleClick = (e: React.MouseEvent) => {
  /* ... */
};
```

---

## 5. React 组件规范

### 组件定义规范

```tsx
// ✅ 正确：具名函数组件（支持 Fast Refresh）
export function TabItem({ tab, onClose }: TabItemProps) {
  return <div>{tab.title}</div>;
}

// ✅ 正确：Props 接口定义在组件上方
interface TabItemProps {
  tab: Tab;
  onClose: (id: number) => void;
  className?: string;
}

// ❌ 错误：匿名箭头函数组件（影响 Fast Refresh 和调试）
export default () => <div />;

// ❌ 错误：Class 组件（项目不使用）
class TabItem extends React.Component {
  /* ... */
}
```

### 禁止使用的原生 HTML 标签

以下原生标签被 ESLint 规则强制禁止，必须使用 Antd 对应组件：

| 禁止            | 替代方案                                        |
| --------------- | ----------------------------------------------- |
| `<button>`      | `<Button>` from antd                            |
| `<h1>` ~ `<h6>` | `<Typography.Title level={1~6}>`                |
| `<p>`           | `<Typography.Paragraph>` 或 `<Typography.Text>` |
| `<input>`       | `<Input>` / `<InputNumber>` / `<Checkbox>` 等   |

### 禁止内联样式

```tsx
// ❌ 错误：内联 style 对象字面量（ESLint 会报错）
<div style={{ color: 'red', padding: 16 }}>...</div>

// ✅ 正确：使用 CSS Modules
<div className={styles.container}>...</div>

// ✅ 正确：使用 Antd Design Token（通过 CSS 变量）
<div className={styles.container}>...</div>
// 在 .module.less 中：.container { color: var(--ant-color-primary); }

// ✅ 例外：动态 CSS 变量（非对象字面量）
const cssVars = { '--custom-color': accentColor };
<div style={cssVars}>...</div>
```

### Hooks 使用规范

```tsx
// ✅ 正确：自定义 Hook 以 use 开头，放在 hooks/ 目录
// features/search/hooks/use-search-results.ts
export function useSearchResults(query: string) {
  /* ... */
}

// ✅ 正确：useEffect 依赖项完整声明
useEffect(() => {
  doSomething(value);
}, [value]); // 不遗漏依赖

// ✅ 正确：清理副作用
useEffect(() => {
  const timer = setInterval(tick, 1000);
  return () => clearInterval(timer);
}, []);

// ✅ 正确：使用 useCallback 稳定化回调
const handleClose = useCallback(
  (id: number) => {
    closeTab(id);
  },
  [closeTab],
);

// ✅ 正确：使用 useMemo 缓存昂贵计算
const filteredTabs = useMemo(() => tabs.filter((t) => t.title.includes(query)), [tabs, query]);
```

### 组件文件大小限制

- 单个组件文件建议不超过 **400 行**
- 超过时应拆分为子组件或提取 Hook
- 复杂逻辑优先提取到 `hooks/` 目录

---

## 6. 状态管理规范（Zustand）

### Store 切片结构

每个 Store 切片独立文件，统一从 `@/store` 导出：

```typescript
// store/xxx-slice.ts
import { create } from "zustand";

interface XxxState {
  // 状态字段
  items: Item[];
  loading: boolean;
}

interface XxxActions {
  // 操作方法
  addItem: (item: Item) => void;
  removeItem: (id: string) => void;
}

export const useXxxStore = create<XxxState & XxxActions>((set, get) => ({
  // 初始状态
  items: [],
  loading: false,

  // 操作实现
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  removeItem: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
}));
```

### Store 使用规范

```tsx
// ✅ 正确：选择器精确订阅，避免不必要的重渲染
const tabs = useTabsStore((s) => s.tabs);
const addTab = useTabsStore((s) => s.addTab);

// ❌ 错误：订阅整个 store（任何字段变化都会触发重渲染）
const store = useTabsStore();

// ✅ 正确：多个字段时使用 shallow 比较
import { useShallow } from "zustand/react/shallow";
const { tabs, loading } = useTabsStore(useShallow((s) => ({ tabs: s.tabs, loading: s.loading })));
```

### 现有 Store 切片

| 切片文件              | Hook                | 职责                        |
| --------------------- | ------------------- | --------------------------- |
| `tabs-slice.ts`       | `useTabsStore`      | 标签页数据与操作            |
| `settings-slice.ts`   | `useSettingsStore`  | 用户设置                    |
| `undo-slice.ts`       | `useUndoStore`      | 撤销/重做历史               |
| `metadata-slice.ts`   | `useMetadataStore`  | 标签页元数据（OG、favicon） |
| `selection-slice.ts`  | `useSelectionStore` | 多选状态                    |
| `stats-slice.ts`      | `useStatsStore`     | 使用统计                    |
| `kanban-slice.ts`     | `useKanbanStore`    | 看板视图状态                |
| `speed-dial-slice.ts` | `useSpeedDialStore` | 快速拨号数据                |

---

## 7. 样式规范（Less + CSS Modules + Antd Token）

### 样式文件命名

- 组件样式：`ComponentName.module.less`（CSS Modules，自动作用域隔离）
- 全局样式：`kebab-case.less`（无 `.module` 后缀，谨慎使用）
- 全局变量：`shared/styles/_variables.less`（以 `_` 开头表示仅供 import）

### CSS Modules 使用规范

```tsx
// ✅ 正确：导入 CSS Modules
import styles from './SearchBox.module.less';

// ✅ 正确：使用 className
<div className={styles.container}>
  <span className={styles.title}>...</span>
</div>

// ✅ 正确：条件类名
<div className={`${styles.item} ${isActive ? styles.active : ''}`}>

// ✅ 正确：使用 clsx（如已引入）
<div className={clsx(styles.item, { [styles.active]: isActive })}>
```

### Less 变量使用规范

```less
// ✅ 正确：引入全局变量（reference 模式，不重复输出 CSS）
@import (reference) "~@/shared/styles/_variables.less";

.container {
  padding: @app-space-4; // 16px
  border-radius: @app-radius-md; // 6px
  gap: @app-card-gap; // 16px
}
```

### 颜色使用规范（强制）

```less
// ❌ 错误：硬编码十六进制颜色（Stylelint 会报错）
.title {
  color: #1677ff;
}
.bg {
  background: #f5f5f5;
}

// ✅ 正确：使用 Antd CSS Token 变量
.title {
  color: var(--ant-color-primary);
}
.text {
  color: var(--ant-color-text);
}
.bg {
  background: var(--ant-color-bg-container);
}

// ✅ 正确：使用业务语义变量（--app-* 前缀）
.card {
  background: var(--app-card-bg);
}
.hover:hover {
  background: var(--app-bg-hover);
}
.selected {
  background: var(--app-bg-selected);
}
```

### 布局规范（强制）

```less
// ❌ 错误：在 Less 中手写 flex/grid 布局（Stylelint 会报错）
.container {
  display: flex; // 禁止
  display: grid; // 禁止
  display: inline-flex; // 禁止
}

// ✅ 正确：使用 Antd <Flex> 组件替代 flex 布局
// ✅ 正确：使用 Antd <Space> 组件替代间距
// ✅ 正确：确实需要 flex 时，在全局样式或特殊场景中使用
```

### 其他样式禁止项

```less
// ❌ 禁止使用 !important（Stylelint 会报错）
.title {
  color: red !important;
}

// ❌ 禁止空块
.empty {
}

// ❌ 禁止重复属性
.item {
  color: red;
  color: blue; // 重复
}
```

### CSS 属性排序

遵循 `stylelint-config-recess-order` 规范（位置 → 盒模型 → 视觉 → 字体 → 其他）：

```less
.item {
  // 1. 定位
  position: relative;
  top: 0;
  z-index: 1;

  // 2. 盒模型
  display: block;
  width: 100%;
  padding: @app-space-3;
  margin: 0;

  // 3. 视觉
  background: var(--app-card-bg);
  border: 1px solid var(--ant-color-border);
  border-radius: @app-radius-md;

  // 4. 字体
  font-size: @app-font-size;
  color: var(--ant-color-text);

  // 5. 其他
  cursor: pointer;
  transition: all @app-motion-duration;
}
```

---

## 8. UI 组件规范（Antd v6）

### 组件使用原则

1. **优先使用 Antd 组件**，不重复造轮子
2. **通过 ConfigProvider 统一配置**，不在组件内单独覆盖主题
3. **使用 `AntdApp.useApp()`** 获取 message/notification/modal，不直接调用静态方法

### 常用组件对应关系

| 场景           | 使用组件                                                              |
| -------------- | --------------------------------------------------------------------- |
| 按钮           | `<Button>`                                                            |
| 文字/标题/段落 | `<Typography.Text>` / `<Typography.Title>` / `<Typography.Paragraph>` |
| 输入框         | `<Input>` / `<Input.Search>` / `<InputNumber>`                        |
| 选择器         | `<Select>` / `<Segmented>`                                            |
| 开关           | `<Switch>`                                                            |
| 复选框         | `<Checkbox>`                                                          |
| 单选框         | `<Radio>` / `<Radio.Group>`                                           |
| 弹窗           | `<Modal>`                                                             |
| 抽屉           | `<Drawer>`                                                            |
| 提示           | `<Tooltip>` / `<Popover>`                                             |
| 标签           | `<Tag>`                                                               |
| 徽标           | `<Badge>`                                                             |
| 列表           | `<List>`                                                              |
| 卡片           | `<Card>`                                                              |
| 分割线         | `<Divider>`                                                           |
| 水平排列       | `<Flex>`                                                              |
| 间距           | `<Space>`                                                             |
| 空状态         | `<Empty>` 或 `<FeatureEmptyState>`（项目封装）                        |
| 加载           | `<Spin>`                                                              |
| 进度           | `<Progress>`                                                          |
| 菜单           | `<Menu>` / `<Dropdown>`                                               |
| 面包屑         | `<Breadcrumb>`                                                        |
| 标签页         | `<Tabs>`                                                              |
| 折叠           | `<Collapse>`                                                          |
| 树形           | `<Tree>`                                                              |
| 表格           | `<Table>`                                                             |
| 表单           | `<Form>`                                                              |
| 消息提示       | `feedback.message.*`（项目封装，见 `shared/ui/feedback.ts`）          |
| 通知           | `feedback.notification.*`                                             |
| 确认弹窗       | `feedback.modal.confirm(...)`                                         |

### 反馈 API 使用规范

```typescript
// ✅ 正确：使用项目封装的 feedback 模块（支持在非组件上下文中调用）
import { feedback } from "@/shared/ui/feedback";

feedback.message.success("操作成功");
feedback.message.error("操作失败");
feedback.notification.info({ message: "提示", description: "详情" });
feedback.modal.confirm({ title: "确认删除？", onOk: handleDelete });

// ❌ 错误：直接使用 antd 静态方法（不支持主题）
import { message } from "antd";
message.success("操作成功");
```

---

## 9. 主题与皮肤系统

### 主题架构

```
shared/theme/
├── skin-presets.ts        # 皮肤预设（glassmorphism、solid 等）
├── theme-customization.ts # Antd ConfigProvider 主题配置生成
└── gradient-presets.ts    # 渐变预设
```

### CSS 变量层级

```
Antd Token（--ant-*）
    ↓ 由 ConfigProvider 注入
业务语义变量（--app-*）
    ↓ 由 AntdThemeProvider 注入到 :root
组件 Less 变量（@app-*）
    ↓ 编译时常量，来自 _variables.less
```

### 颜色变量使用优先级

1. **首选** `var(--ant-color-*)` — Antd 官方 Token
2. **次选** `var(--app-bg-*)` / `var(--app-color-*)` — 业务语义变量
3. **禁止** 硬编码十六进制颜色

### 主题相关 HTML 属性

```html
<!-- 由 AntdThemeProvider 自动管理，开发者不需要手动设置 -->
<html data-theme="light|dark" data-skin="glassmorphism|solid|..." data-texture-noise></html>
```

### 新增皮肤规范

1. 在 `skin-presets.ts` 中添加皮肤配置
2. 在 `theme-customization.ts` 中添加对应的 Antd Token 映射
3. 在 `_variables.less` 中添加必要的 Less 变量（如有）
4. 在设置面板中注册皮肤选项

---

## 10. 国际化规范（i18n）

### 核心原则

**所有面向用户的文字必须通过 i18n 系统**，禁止硬编码中文（ESLint 会警告）。

本项目采用「**中文直达**」开发模式：开发时直接以中文原文作为翻译 key，运行时自动反查标准键名并输出对应语言的翻译，无需手动维护 key 字符串。

### 架构概览

```
src/shared/i18n/
├── core.ts          # 纯函数核心（translate / translateWithLocale / loadDictionary 等）
└── index.tsx        # React 侧（I18nProvider / useT / Trans）

i18n/source/         # 翻译字典（构建时复制到 dist/i18n/）
├── zh-CN.json       # 中文字典（主字典，含 key + zh-CN + en 三字段）
├── en.json          # 英文字典（key + zh-CN + en）
└── key-mapping.json # 中文原文 → 标准键名的反向映射索引
```

**字典条目格式：**

```json
[
  { "key": "k_0a3b7x2", "zh-CN": "设置", "en": "Settings" },
  { "key": "k_z9y8c4d", "zh-CN": "共 {count} 个标签页", "en": "{count} tabs" }
]
```

### 使用方式

```tsx
// ✅ 正确：在组件中使用 useT() Hook，直接传中文原文
import { useT } from '@/shared/i18n';

function MyComponent() {
  const { t } = useT();
  return <Typography.Text>{t('设置')}</Typography.Text>;
}

// ✅ 正确：带占位符的翻译（{参数名} 格式）
t('共 {count} 个标签页', { count: tabs.length })

// ✅ 正确：在非组件上下文中使用 translate()（store action、Chrome 回调等）
import { translate } from '@/shared/i18n/core';
const label = translate('确认删除');

// ✅ 正确：富文本翻译使用 <Trans> 组件（支持 JSX 内嵌标签）
import { Trans } from '@/shared/i18n';
<Trans>共 <b>{count}</b> 个标签页</Trans>

// ❌ 错误：JSX 中硬编码中文（ESLint i18n-zh 规则会警告）
<Button>确认</Button>

// ❌ 错误：JS 字符串中硬编码中文（ESLint i18n-zh 规则会警告）
const msg = '操作成功';
```

### 翻译函数说明

| 函数/组件                                   | 适用场景                          | 来源                 |
| ------------------------------------------- | --------------------------------- | -------------------- |
| `useT()` → `t(key, params?)`                | React 组件内                      | `@/shared/i18n`      |
| `translate(key, params?)`                   | Store、Chrome 回调、非 React 环境 | `@/shared/i18n/core` |
| `translateWithLocale(locale, key, params?)` | 需要指定语言的场景                | `@/shared/i18n/core` |
| `<Trans>`                                   | JSX 中含嵌套标签的富文本          | `@/shared/i18n`      |

### 新增翻译词条

1. **直接在代码中写中文**，无需提前注册 key
2. 运行 `pnpm i18n:scan` 自动扫描代码中的中文字符串，生成新 key 并写入字典
3. 在 `i18n/source/en.json` 中补充对应英文翻译
4. 运行 `pnpm i18n:check` 验证翻译完整性（无缺失、无冗余）

```bash
# 扫描代码中的中文字符串，自动补录到字典
pnpm i18n:scan

# 检查翻译完整性（英文缺失 / 未使用词条 / 未登记词条）
pnpm i18n:check
```

### 翻译完整性检查

`pnpm i18n:check` 会输出三类问题：

| 问题类型     | 说明                           | 修复方式                   |
| ------------ | ------------------------------ | -------------------------- |
| 英文翻译缺失 | `en.json` 中 `en` 字段为空     | 补充 `i18n/source/en.json` |
| 未使用词条   | 字典中有 key 但代码中未使用    | 可安全删除                 |
| 未登记词条   | 代码中有中文但字典中无对应 key | 运行 `pnpm i18n:scan` 补录 |

### 调试工具

开发模式下，`t()` 函数挂载了 `debug` 方法，可在控制台查看翻译解析详情：

```typescript
const { t } = useT();

// 返回完整调试信息：inputKey / resolvedKey / zh-CN / en / result / isMissing
const info = t.debug("设置");
console.log(info);
// {
//   inputKey: '设置',
//   resolvedKey: 'k_0a3b7x2',
//   locale: 'zh-CN',
//   zhCN: '设置',
//   en: 'Settings',
//   result: '设置',
//   isMissing: false
// }
```

翻译缺失时，开发模式会在控制台输出 `[i18n] 翻译缺失 (en): "xxx"` 警告，生产模式静默回退到中文原文。

### 语言切换

```typescript
const { setLocale } = useT();

// 切换到英文
setLocale("en");

// 切换到中文
setLocale("zh-CN");
```

语言切换时会自动加载目标语言的翻译文件（仅加载目标语言，避免不必要的网络请求）。

### 日期格式化

```typescript
// 使用 dayjs（已配置语言）
import dayjs from "dayjs";
dayjs(date).format("YYYY年MM月DD日");
```

---

## 11. 路径别名规范

项目配置了以下路径别名，**必须使用别名而非相对路径**（跨目录引用时）：

| 别名          | 对应路径             | 使用场景        |
| ------------- | -------------------- | --------------- |
| `@/*`         | `src/*`              | 通用，最常用    |
| `@pages/*`    | `src/pages/*`        | 页面入口        |
| `@features/*` | `src/features/*`     | 功能模块        |
| `@shared/*`   | `src/shared/*`       | 共享资源        |
| `@store/*`    | `src/store/*`        | 状态管理        |
| `@services/*` | `src/services/*`     | 业务服务        |
| `@repos/*`    | `src/repositories/*` | 数据仓库        |
| `@chrome/*`   | `src/chrome/*`       | Chrome API 封装 |

```typescript
// ✅ 正确：使用路径别名
import { useTabsStore } from "@/store";
import type { TabItem } from "@/shared/types";
import { translate } from "@/shared/i18n/core";

// ❌ 错误：跨目录使用相对路径
import { useTabsStore } from "../../../store";
import type { TabItem } from "../../shared/types";
```

**例外**：同一目录内的文件可以使用相对路径：

```typescript
// ✅ 同目录内可以使用相对路径
import { helper } from "./utils";
import styles from "./Component.module.less";
```

---

## 12. 测试规范（Vitest）

### 测试文件位置

```
tests/
└── unit/
    ├── utils/           # 工具函数测试
    ├── hooks/           # Hook 测试
    └── services/        # 服务层测试
```

### 测试覆盖率要求

| 指标       | 最低要求 |
| ---------- | -------- |
| Lines      | 80%      |
| Functions  | 80%      |
| Branches   | 70%      |
| Statements | 80%      |

### 测试编写规范

```typescript
// ✅ 正确：测试文件命名
// tests/unit/utils/tab-utils.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";

describe("tabUtils", () => {
  describe("groupByDomain", () => {
    it("should group tabs by domain", () => {
      const tabs = [
        { id: 1, url: "https://github.com/a" },
        { id: 2, url: "https://github.com/b" },
        { id: 3, url: "https://google.com" },
      ];
      const result = groupByDomain(tabs);
      expect(result["github.com"]).toHaveLength(2);
      expect(result["google.com"]).toHaveLength(1);
    });

    it("should handle empty array", () => {
      expect(groupByDomain([])).toEqual({});
    });
  });
});
```

### 测试原则

- **纯函数优先测试**：工具函数、服务层逻辑
- **不测试实现细节**：测试行为，不测试内部状态
- **Mock Chrome API**：Chrome Extension API 需要 Mock
- **避免测试 UI 细节**：不测试 CSS 类名、DOM 结构

---

## 13. Git 提交规范

### Conventional Commits 格式

```
<type>(<scope>): <subject>

[可选 body]

[可选 footer]
```

### 提交类型（type）

| 类型       | 说明                   | 出现在 CHANGELOG    |
| ---------- | ---------------------- | ------------------- |
| `feat`     | 新功能                 | ✅ ✨ Features      |
| `fix`      | Bug 修复               | ✅ 🐛 Bug Fixes     |
| `perf`     | 性能优化               | ✅ ⚡ Performance   |
| `refactor` | 重构（不影响功能）     | ✅ ♻️ Refactoring   |
| `docs`     | 文档更新               | ✅ 📝 Documentation |
| `build`    | 构建系统变更           | ✅ 🏗️ Build System  |
| `ci`       | CI/CD 配置变更         | ✅ 👷 CI/CD         |
| `revert`   | 回滚提交               | ✅ ⏪ Reverts       |
| `style`    | 代码格式（不影响逻辑） | ❌ 隐藏             |
| `test`     | 测试相关               | ❌ 隐藏             |
| `chore`    | 杂项（依赖更新等）     | ❌ 隐藏             |

### 提交示例

```bash
# ✅ 正确示例
git commit -m "feat(search): 添加拼音搜索支持"
git commit -m "fix(tabs): 修复关闭标签页后选中状态异常"
git commit -m "perf(virtual-list): 使用 @tanstack/react-virtual 优化长列表渲染"
git commit -m "refactor(settings): 将设置面板拆分为独立 Panel 组件"
git commit -m "style: 统一代码格式，运行 prettier"
git commit -m "chore(deps): 升级 antd 到 v6.3.6"

# ❌ 错误示例
git commit -m "修复bug"           # 缺少 type
git commit -m "update"            # 无意义描述
git commit -m "feat: 新增很多功能，修复了一些问题，优化了性能"  # 一次提交做了太多事
```

### 提交规则

- **subject 最大长度**：100 字符
- **header 最大长度**：120 字符
- **一次提交只做一件事**，不混合多种类型的变更
- **提交前自动执行** lint-staged（ESLint + Prettier）

### 分支命名规范

```
main          # 主分支，保护分支，只接受 PR
develop       # 开发分支
feature/xxx   # 功能分支（如 feature/pinyin-search）
fix/xxx       # 修复分支（如 fix/tab-close-crash）
refactor/xxx  # 重构分支
chore/xxx     # 杂项分支
```

---

## 14. 代码质量工具链

### ESLint 关键规则

| 规则                                          | 级别  | 说明                                                 |
| --------------------------------------------- | ----- | ---------------------------------------------------- |
| `@typescript-eslint/no-unused-vars`           | error | 未使用变量（`_` 前缀除外）                           |
| `@typescript-eslint/no-floating-promises`     | error | 未处理的 Promise                                     |
| `@typescript-eslint/no-misused-promises`      | error | Promise 误用                                         |
| `react-hooks/exhaustive-deps`                 | warn  | Hook 依赖项完整性                                    |
| `i18n-zh/no-bare-zh-in-jsx`                   | warn  | JSX 中硬编码中文                                     |
| `i18n-zh/no-bare-zh-in-js`                    | warn  | JS 中硬编码中文                                      |
| `i18n-zh/no-explicit-any`                     | error | 禁止使用 TypeScript `any` 类型                       |
| `tab/no-whole-store-subscription`             | error | 禁止订阅整个 Zustand Store                           |
| `tab/no-relative-cross-dir-import`            | error | 跨目录引用必须使用路径别名                           |
| `tab/no-direct-chrome-api`                    | warn  | 禁止业务代码直接调用 `chrome.*`                      |
| `tab/no-direct-storage-api`                   | error | 禁止非 repos 层调用 `chrome.storage.*`               |
| `tab/no-direct-feedback-api`                  | warn  | 禁止直接使用 antd 静态 message/notification/modal    |
| `tab/prefer-named-function-component`         | warn  | 禁止匿名箭头函数组件                                 |
| `tab/no-default-export-anonymous-component`   | warn  | 禁止 export default 匿名组件                         |
| `tab/no-large-component`                      | warn  | 组件文件超过 400 行时警告                            |
| `tab/no-direct-web-storage-api`               | error | 禁止业务代码直接使用 `localStorage`/`sessionStorage` |
| `tab/no-direct-window-api`                    | warn  | 禁止业务代码直接调用 `window.*` API                  |
| `tab/no-direct-navigator-api`                 | warn  | 禁止业务代码直接调用 `navigator.*` Web API           |
| `tab/no-direct-fetch`                         | error | 禁止业务层直接使用 `fetch`，应通过 services 层       |
| `no-restricted-syntax` (button/h1~h6/p/input) | error | 禁止原生 HTML 标签                                   |
| `no-restricted-syntax` (inline style)         | error | 禁止内联 style 对象                                  |
| `css-modules/no-unused-class`                 | warn  | CSS Modules 未使用的 class                           |
| `css-modules/no-undef-class`                  | warn  | CSS Modules 未定义的 class                           |

### Stylelint 关键规则

| 规则                                         | 说明                      |
| -------------------------------------------- | ------------------------- |
| `declaration-property-value-disallowed-list` | 禁止 `display: flex/grid` |
| `color-no-hex`                               | 禁止十六进制颜色          |
| `declaration-no-important`                   | 禁止 `!important`         |
| `declaration-block-no-duplicate-properties`  | 禁止重复属性              |
| `block-no-empty`                             | 禁止空块                  |

### Prettier 配置

```json
{
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### Knip 死代码检测

定期运行 `pnpm knip` 检测：

- 未使用的文件
- 未使用的导出
- 未使用的依赖

### 依赖检查

运行 `pnpm depcheck` 检测：

- 未使用的 npm 依赖
- 缺少的 npm 依赖

---

## 15. 构建与发布流程

### 构建流程

```
pnpm build
  ├── pnpm type-check     # TypeScript 类型检查
  ├── pnpm test           # 运行单元测试
  ├── vite build          # 构建 newtab + popup
  └── node scripts/build-sw.mjs  # 独立构建 Service Worker
```

> **注意**：Service Worker 使用独立的 esbuild 构建，不走 Vite 多入口，
> 原因是 Vite 多入口会将 SW 与 newtab 共享代码拆分到 chunk，
> 导致 SW 中出现 `document is not defined` 错误。

### 发布流程

```bash
# 本地发布（交互式）
pnpm release

# 模拟发布（不实际执行）
pnpm release:dry

# CI 自动发布（通过 GitHub Actions workflow_dispatch）
# 在 GitHub Actions 页面手动触发 Release workflow，选择版本类型
```

### release-it 发布步骤

1. 执行 `pnpm type-check` + `pnpm test`（前置检查）
2. 版本号 bump（patch/minor/major）
3. 执行 `vite build` + `build-sw.mjs`
4. 执行 `check-quota.mjs`（检查 Chrome 存储配额）
5. 执行 `package-zip.mjs`（打包 zip 文件）
6. 生成/更新 `CHANGELOG.md`
7. Git commit + tag + push
8. 创建 GitHub Release（附带 zip 包）

### 版本号规范（Semantic Versioning）

```
MAJOR.MINOR.PATCH

MAJOR：不兼容的 API 变更（用户数据迁移、重大功能重构）
MINOR：向后兼容的新功能
PATCH：向后兼容的 Bug 修复
```

---

## 16. Chrome 扩展开发规范

### Chrome API 封装原则

所有 Chrome API 调用必须通过 `src/chrome/` 封装层，不在业务代码中直接调用：

```typescript
// ✅ 正确：通过封装层调用
import { getTabs, closeTab } from "@chrome/tabs";
const tabs = await getTabs({ currentWindow: true });

// ❌ 错误：直接调用 Chrome API
const tabs = await chrome.tabs.query({ currentWindow: true });
```

### Service Worker 规范

- SW 代码位于 `src/sw/index.ts`
- SW 使用独立 esbuild 构建，产出完全自包含的 `dist/sw.js`
- SW 中**禁止**使用任何 DOM API（`document`、`window` 等）
- SW 中**禁止** import 任何包含 DOM 依赖的模块

### 存储规范

- 所有持久化数据通过 `src/repositories/` 层操作
- 使用 `shared/config/storage-keys.ts` 中定义的常量作为 key
- 禁止在业务代码中直接调用 `chrome.storage.*`

### 权限最小化原则

- 只申请必要的 Chrome 权限
- 新增权限需要在 `manifest.json` 中声明并在 PR 中说明原因

---

## 17. 性能规范

> 本章为宏观性能策略（代码分割、存储配额、动画）。
> React 组件级极致性能规范见 [第 18 章](#18-react-极致性能最佳实践)。

### 渲染性能

```tsx
// ✅ 长列表必须使用虚拟滚动
import { useVirtualizer } from "@tanstack/react-virtual";

// ✅ 昂贵计算使用 useMemo
const sortedTabs = useMemo(() => [...tabs].sort(compareFn), [tabs]);

// ✅ 回调函数使用 useCallback 稳定化
const handleClose = useCallback((id: number) => closeTab(id), [closeTab]);

// ✅ 纯展示组件使用 React.memo
export const TabCard = React.memo(function TabCard({ tab }: Props) {
  return <div>{tab.title}</div>;
});
```

### 动画性能

```tsx
// ✅ 使用 motion 库（GPU 加速）
import { motion } from "motion/react";
<motion.div animate={{ opacity: 1 }} initial={{ opacity: 0 }} />;

// ✅ 尊重用户的减少动画偏好
import { useReducedMotion } from "@/shared/hooks";
const prefersReduced = useReducedMotion();
const duration = prefersReduced ? 0 : 0.3;
```

### 代码分割

- 大型功能模块使用 `React.lazy` + `Suspense` 懒加载
- 单个 chunk 体积警告阈值：800KB

### Chrome 存储配额

- 定期运行 `pnpm check-quota` 检查存储使用情况
- `chrome.storage.local` 限制：10MB
- `chrome.storage.sync` 限制：100KB

---

---

## 18. React 极致性能最佳实践

> 本章是对第 5 章（React 组件规范）和第 17 章（性能规范）的深度补充，
> 聚焦于「写出来就是高性能」的编码习惯，而非事后优化。

### 18.1 渲染优化三原则

| 原则               | 含义                   | 工具                               |
| ------------------ | ---------------------- | ---------------------------------- |
| **减少渲染次数**   | 只在真正需要时重新渲染 | `React.memo` / 精确 Zustand 选择器 |
| **减少渲染工作量** | 每次渲染尽可能少做计算 | `useMemo` / `useCallback`          |
| **减少渲染范围**   | 状态变化只影响最小子树 | 状态下移 / 组件拆分                |

### 18.2 React.memo 使用规范

```tsx
// ✅ 正确：纯展示组件（Props 不变则不重渲染）
export const TabCard = React.memo(function TabCard({ tab, onClose }: TabCardProps) {
  return (
    <div className={styles.card}>
      <Typography.Text>{tab.title}</Typography.Text>
      <Button onClick={() => onClose(tab.id)} />
    </div>
  );
});

// ✅ 正确：自定义比较函数（仅比较关键字段，避免深比较开销）
export const TabCard = React.memo(
  function TabCard({ tab, onClose }: TabCardProps) { /* ... */ },
  (prev, next) => prev.tab.id === next.tab.id && prev.tab.title === next.tab.title,
);

// ❌ 错误：memo 包裹后仍传入每次渲染都新建的对象/函数（memo 失效）
<TabCard tab={tab} onClose={(id) => closeTab(id)} />  // 箭头函数每次新建
<TabCard tab={tab} style={{ padding: 8 }} />           // 对象字面量每次新建

// ✅ 正确：配合 useCallback 稳定化回调，确保 memo 真正生效
const handleClose = useCallback((id: number) => closeTab(id), [closeTab]);
<TabCard tab={tab} onClose={handleClose} />
```

**何时不需要 memo：**

- 组件本身渲染极快（< 0.1ms），memo 的比较开销可能更大
- 组件的 Props 几乎每次都变化（memo 永远不命中）
- 组件是顶层页面组件（渲染频率低）

### 18.3 useMemo / useCallback 使用规范

```tsx
// ✅ 必须 useMemo：昂贵计算（排序、过滤、搜索大数组）
const sortedTabs = useMemo(() => [...tabs].sort((a, b) => a.title.localeCompare(b.title)), [tabs]);

// ✅ 必须 useMemo：作为其他 memo 组件的 Props 传入的对象
const tabStyle = useMemo(() => ({ "--accent": tab.color }), [tab.color]);

// ✅ 必须 useCallback：作为 memo 组件 Props 传入的函数
const handleClose = useCallback(
  (id: number) => {
    closeTab(id);
  },
  [closeTab],
);

// ✅ 必须 useCallback：作为 useEffect 依赖项的函数
const fetchData = useCallback(async () => {
  const data = await loadTabs();
  setTabs(data);
}, [loadTabs]);

useEffect(() => {
  void fetchData();
}, [fetchData]);

// ❌ 不必要的 useMemo（简单计算，memo 开销 > 计算开销）
const count = useMemo(() => tabs.length, [tabs]); // 直接写 tabs.length
const title = useMemo(() => `共 ${count} 个`, [count]); // 直接写模板字符串

// ❌ 不必要的 useCallback（不传给子组件、不作为 effect 依赖）
const handleInternalClick = useCallback(() => {
  setOpen(true);
}, []); // 仅在组件内部使用，无需 useCallback
```

**黄金法则：useMemo/useCallback 只在以下场景使用：**

1. 计算结果作为另一个 `useMemo`/`useEffect` 的依赖
2. 值/函数传给 `React.memo` 包裹的子组件
3. 计算本身确实昂贵（可用 `console.time` 验证 > 1ms）

### 18.4 状态设计规范（避免无效重渲染）

```tsx
// ❌ 错误：将无关状态合并到同一个 useState
const [state, setState] = useState({ count: 0, name: "", isOpen: false });
// count 变化会导致依赖 name/isOpen 的子组件也重渲染

// ✅ 正确：拆分独立状态
const [count, setCount] = useState(0);
const [name, setName] = useState("");
const [isOpen, setIsOpen] = useState(false);

// ❌ 错误：在父组件存储可以下移的状态
function TabList() {
  const [tooltipVisible, setTooltipVisible] = useState(false); // 只有 TabCard 用
  return <TabCard onTooltipChange={setTooltipVisible} />;
}

// ✅ 正确：状态下移到真正使用它的组件
function TabCard() {
  const [tooltipVisible, setTooltipVisible] = useState(false); // 状态内聚
  return <Tooltip open={tooltipVisible}>...</Tooltip>;
}

// ❌ 错误：派生状态存入 state（导致双重渲染）
const [tabs, setTabs] = useState<Tab[]>([]);
const [filteredTabs, setFilteredTabs] = useState<Tab[]>([]); // 派生值
useEffect(() => {
  setFilteredTabs(tabs.filter((t) => t.pinned)); // 多一次渲染
}, [tabs]);

// ✅ 正确：派生值用 useMemo 计算
const [tabs, setTabs] = useState<Tab[]>([]);
const filteredTabs = useMemo(() => tabs.filter((t) => t.pinned), [tabs]);
```

### 18.5 useEffect 精细化规范

```tsx
// ❌ 错误：effect 依赖粒度过粗（整个对象作为依赖）
useEffect(() => {
  document.title = settings.title;
}, [settings]); // settings 任意字段变化都触发

// ✅ 正确：只依赖真正用到的字段
useEffect(() => {
  document.title = settings.title;
}, [settings.title]);

// ❌ 错误：在 effect 内部定义函数（每次渲染都是新函数引用）
useEffect(() => {
  async function load() {
    const data = await fetchTabs();
    setTabs(data);
  }
  void load();
}, [fetchTabs]); // fetchTabs 若不稳定则死循环

// ✅ 正确：用 useCallback 稳定化，或直接内联不提取
useEffect(() => {
  let cancelled = false;
  void fetchTabs().then((data) => {
    if (!cancelled) setTabs(data);
  });
  return () => {
    cancelled = true;
  }; // 清理：避免竞态条件
}, [fetchTabs]);

// ✅ 正确：竞态条件处理（异步 effect 必须处理取消）
useEffect(() => {
  const controller = new AbortController();
  void loadData(controller.signal).then(setData);
  return () => controller.abort();
}, [id]);

// ❌ 错误：不必要的 effect（可以在事件处理中直接计算）
useEffect(() => {
  setFullName(`${firstName} ${lastName}`);
}, [firstName, lastName]);

// ✅ 正确：事件驱动的派生值直接计算，无需 effect
const fullName = `${firstName} ${lastName}`; // 或 useMemo
```

### 18.6 列表渲染规范

```tsx
// ❌ 错误：使用数组下标作为 key（列表重排时导致状态错乱）
{
  tabs.map((tab, index) => <TabCard key={index} tab={tab} />);
}

// ✅ 正确：使用稳定唯一 ID 作为 key
{
  tabs.map((tab) => <TabCard key={tab.id} tab={tab} />);
}

// ❌ 错误：超过 50 条数据不使用虚拟滚动
{
  allTabs.map((tab) => <TabCard key={tab.id} tab={tab} />);
} // 500 条 = 500 个 DOM

// ✅ 正确：长列表必须使用虚拟滚动
import { useVirtualizer } from "@tanstack/react-virtual";

function TabList({ tabs }: { tabs: Tab[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: tabs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48, // 预估行高
    overscan: 5, // 预渲染屏外条数
  });

  return (
    <div ref={parentRef} className={styles.scrollContainer}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div key={virtualItem.key} style={{ transform: `translateY(${virtualItem.start}px)` }}>
            <TabCard tab={tabs[virtualItem.index]!} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ✅ 正确：列表项组件用 React.memo 包裹，避免兄弟节点更新时全量重渲染
const TabCard = React.memo(function TabCard({ tab }: { tab: Tab }) {
  return <div>{tab.title}</div>;
});
```

### 18.7 Context 性能规范

```tsx
// ❌ 错误：Context value 是每次渲染都新建的对象（所有消费者都重渲染）
function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState("light");
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {" "}
      {/* 每次新对象 */}
      {children}
    </ThemeContext.Provider>
  );
}

// ✅ 正确：用 useMemo 稳定化 Context value
function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState("light");
  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// ✅ 更优：读写分离，订阅读的组件不因写函数变化而重渲染
const ThemeStateContext = React.createContext<string>("light");
const ThemeDispatchContext = React.createContext<React.Dispatch<React.SetStateAction<string>>>(
  () => {},
);

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState("light");
  return (
    <ThemeDispatchContext.Provider value={setTheme}>
      <ThemeStateContext.Provider value={theme}>{children}</ThemeStateContext.Provider>
    </ThemeDispatchContext.Provider>
  );
}
```

> **注意**：本项目全局状态优先使用 Zustand（精确订阅，天然避免 Context 性能问题）。
> Context 仅用于主题注入等低频变化的场景。

### 18.8 图片与资源懒加载

```tsx
// ✅ 正确：图片懒加载（视口外不加载）
<img src={tab.favicon} loading="lazy" alt="" />;

// ✅ 正确：大型功能模块代码分割
const SettingsPanel = React.lazy(() => import("@features/settings/SettingsPanel"));

function App() {
  return (
    <Suspense fallback={<Spin />}>
      <SettingsPanel />
    </Suspense>
  );
}

// ✅ 正确：预加载即将需要的模块（hover 时触发）
const preloadSettings = () => import("@features/settings/SettingsPanel");

<Button
  onMouseEnter={preloadSettings} // hover 时预加载
  onClick={openSettings}
>
  设置
</Button>;
```

### 18.9 事件处理性能规范

```tsx
// ❌ 错误：在 JSX 中直接写箭头函数（每次渲染新建函数，破坏 memo）
<Button onClick={() => handleClose(tab.id)}>关闭</Button>;

// ✅ 正确：提前绑定参数，配合 useCallback
const handleClose = useCallback(() => {
  closeTab(tab.id);
}, [closeTab, tab.id]);
<Button onClick={handleClose}>关闭</Button>;

// ✅ 正确：列表场景使用事件委托（单个监听器处理所有子项）
function TabList({ tabs }: { tabs: Tab[] }) {
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const tabId = (e.target as HTMLElement).closest("[data-tab-id]")?.getAttribute("data-tab-id");
      if (tabId) activateTab(Number(tabId));
    },
    [activateTab],
  );

  return (
    <div onClick={handleClick}>
      {" "}
      {/* 委托到父容器 */}
      {tabs.map((tab) => (
        <div key={tab.id} data-tab-id={tab.id}>
          {tab.title}
        </div>
      ))}
    </div>
  );
}

// ✅ 正确：高频事件（scroll/resize/input）必须节流或防抖
import { useDebouncedCallback } from "use-debounce"; // 或手写

const handleSearch = useDebouncedCallback((value: string) => {
  setQuery(value);
}, 200);

<Input onChange={(e) => handleSearch(e.target.value)} />;
```

### 18.10 Ref 使用规范

```tsx
// ✅ 正确：DOM 引用使用 useRef
const inputRef = useRef<HTMLInputElement>(null);
useEffect(() => {
  inputRef.current?.focus();
}, []);

// ✅ 正确：存储不触发重渲染的可变值（如定时器 ID、上一次的值）
const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const prevValueRef = useRef(value);

// ✅ 正确：用 useRef 缓存最新回调（解决闭包陈旧值问题）
function useLatestCallback<T extends (...args: never[]) => unknown>(fn: T): T {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args) => ref.current(...args), []) as T;
}

// ❌ 错误：用 ref 替代 state 存储需要触发渲染的值
const countRef = useRef(0);
countRef.current += 1; // 不会触发重渲染，UI 不更新
```

### 18.11 性能测量与调试

```tsx
// ✅ 开发阶段：使用 React DevTools Profiler 录制渲染
// 1. 打开 React DevTools → Profiler 标签
// 2. 点击录制，执行操作，停止录制
// 3. 查看 Flamegraph，找出渲染耗时 > 16ms 的组件

// ✅ 代码中标记性能测量点
const startTime = performance.now();
const result = expensiveComputation(data);
console.log(`计算耗时: ${performance.now() - startTime}ms`);

// ✅ 使用 React 内置的 Profiler 组件（生产环境也可用）
import { Profiler } from "react";

<Profiler
  id="TabList"
  onRender={(id, phase, actualDuration) => {
    if (actualDuration > 16) {
      console.warn(`[Perf] ${id} ${phase} 渲染耗时 ${actualDuration.toFixed(2)}ms`);
    }
  }}
>
  <TabList tabs={tabs} />
</Profiler>;

// ✅ 使用 why-did-you-render 检测意外重渲染（仅开发环境）
// 在 src/pages/newtab/main.tsx 顶部引入（已配置则跳过）
import "@/shared/utils/why-did-you-render"; // 开发环境专用
```

### 18.12 React 19 新特性使用规范

```tsx
// ✅ 使用 use() Hook 读取 Promise（替代 useEffect + useState 的异步模式）
import { use, Suspense } from "react";

function TabDetails({ tabPromise }: { tabPromise: Promise<Tab> }) {
  const tab = use(tabPromise); // 自动 Suspense
  return <Typography.Text>{tab.title}</Typography.Text>;
}

// 父组件用 Suspense 包裹
<Suspense fallback={<Spin />}>
  <TabDetails tabPromise={fetchTab(id)} />
</Suspense>;

// ✅ 使用 useTransition 标记非紧急更新（保持 UI 响应）
import { useTransition } from "react";

function SearchBox() {
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value); // 紧急：立即更新输入框
    startTransition(() => {
      setSearchResults(search(e.target.value)); // 非紧急：可被打断
    });
  };

  return (
    <>
      <Input value={query} onChange={handleChange} />
      {isPending ? <Spin size="small" /> : <ResultList />}
    </>
  );
}

// ✅ 使用 useDeferredValue 延迟非紧急值（替代手动防抖）
import { useDeferredValue } from "react";

function TabList({ query }: { query: string }) {
  const deferredQuery = useDeferredValue(query); // 输入时不阻塞
  const filtered = useMemo(
    () => tabs.filter((t) => t.title.includes(deferredQuery)),
    [tabs, deferredQuery],
  );
  return <VirtualList items={filtered} />;
}

// ✅ 使用 useOptimistic 实现乐观更新（操作即时反馈）
import { useOptimistic } from "react";

function TabItem({ tab }: { tab: Tab }) {
  const [optimisticTab, setOptimisticTab] = useOptimistic(tab);

  const handlePin = async () => {
    setOptimisticTab({ ...tab, pinned: true }); // 立即更新 UI
    await pinTab(tab.id); // 异步持久化
  };

  return (
    <div>
      {optimisticTab.pinned ? "📌" : ""}
      {optimisticTab.title}
    </div>
  );
}
```

### 18.13 性能检查清单（编码时自检）

在提交代码前，对每个新增/修改的组件执行以下自检：

| 检查项                                                         | 说明                                       |
| -------------------------------------------------------------- | ------------------------------------------ |
| Props 中有无每次新建的对象/数组/函数？                         | 若有，用 `useMemo`/`useCallback` 稳定化    |
| 子组件是否应该用 `React.memo` 包裹？                           | 纯展示组件、列表项组件必须包裹             |
| `useEffect` 依赖是否最小化？                                   | 只依赖真正用到的字段，不依赖整个对象       |
| 列表超过 50 条是否使用虚拟滚动？                               | 使用 `@tanstack/react-virtual`             |
| 高频事件是否有防抖/节流？                                      | `input`/`scroll`/`resize` 必须处理         |
| 状态是否可以下移？                                             | 状态只在最近的公共祖先存储                 |
| 派生值是否用 `useMemo` 而非 `useEffect + setState`？           | 避免双重渲染                               |
| 异步 effect 是否处理了竞态条件？                               | 使用 `AbortController` 或 `cancelled` 标志 |
| 是否使用了 `useTransition`/`useDeferredValue` 处理非紧急更新？ | 搜索、过滤等场景                           |

---

## 19. Review 检查清单

### 代码质量

- [ ] TypeScript 编译无错误（`pnpm type-check`）
- [ ] ESLint 无错误（`pnpm lint`）
- [ ] Stylelint 无错误（`pnpm lint:style`）
- [ ] Prettier 格式正确（`pnpm format:check`）
- [ ] 所有测试通过（`pnpm test`）
- [ ] 无新增的 `any` 类型
- [ ] 无未处理的 Promise（`no-floating-promises`）

### UI 规范

- [ ] 未使用原生 `<button>`、`<h1~h6>`、`<p>`、`<input>` 标签
- [ ] 未使用内联 `style={{...}}` 对象字面量
- [ ] 颜色使用 CSS Token 变量，未硬编码十六进制
- [ ] 布局未在 Less 中手写 `display: flex/grid`（应使用 Antd `<Flex>`）
- [ ] 样式未使用 `!important`

### 国际化

- [ ] 所有面向用户的文字使用 `t()` 或 `<Trans>` 包裹
- [ ] 运行 `pnpm i18n:scan` 已补录新增中文词条到字典
- [ ] 运行 `pnpm i18n:check` 通过（无缺失、无冗余、无未登记词条）
- [ ] 新增词条已在 `i18n/source/en.json` 补充英文翻译
- [ ] 无硬编码中文字符串（ESLint i18n-zh 规则）

### 架构规范

- [ ] Chrome API 通过 `@chrome/*` 封装层调用（`tab/no-direct-chrome-api`）
- [ ] 持久化操作通过 `@repos/*` 层进行（`tab/no-direct-storage-api`）
- [ ] 跨目录引用使用路径别名（`@/`、`@features/` 等）（`tab/no-relative-cross-dir-import`）
- [ ] 业务层不直接使用 `fetch`，通过 services 层发起请求（`tab/no-direct-fetch`）
- [ ] 业务代码不直接使用 `window.*` API，通过 `@chrome/*` 封装层（`tab/no-direct-window-api`）
- [ ] 业务代码不直接使用 `navigator.*` Web API，通过 `@chrome/*` 封装层（`tab/no-direct-navigator-api`）
- [ ] 业务代码不直接使用 `localStorage`/`sessionStorage`，通过 `@repos/*` 层（`tab/no-direct-web-storage-api`）
- [ ] 未使用 `any` 类型（`i18n-zh/no-explicit-any`）
- [ ] 未订阅整个 Zustand Store（`tab/no-whole-store-subscription`）
- [ ] 新增 Store 切片已在 `store/index.ts` 导出
- [ ] 组件文件不超过 400 行（超过需拆分）

### 性能

- [ ] 长列表（> 50 条）使用虚拟滚动（`@tanstack/react-virtual`）
- [ ] 昂贵计算使用 `useMemo`（> 1ms 的计算）
- [ ] 传给 `memo` 子组件的回调使用 `useCallback` 稳定化
- [ ] 动画尊重 `prefers-reduced-motion`
- [ ] 纯展示组件和列表项组件使用 `React.memo` 包裹
- [ ] Props 中无每次渲染都新建的对象/数组字面量
- [ ] 派生值用 `useMemo` 计算，而非 `useEffect + setState`
- [ ] 高频事件（input/scroll/resize）有防抖或节流处理
- [ ] 异步 `useEffect` 处理了竞态条件（`AbortController` 或 `cancelled` 标志）
- [ ] 搜索/过滤等非紧急更新使用 `useTransition` 或 `useDeferredValue`
- [ ] `useEffect` 依赖项精确到字段，未依赖整个对象
- [ ] 状态已下移到最近的使用方，未在父组件存储子组件私有状态
- [ ] Context value 已用 `useMemo` 稳定化（或使用 Zustand 替代）

### Git 规范

- [ ] 提交信息符合 Conventional Commits 格式
- [ ] 一次 PR 只做一件事
- [ ] PR 描述清晰说明变更内容和原因

### 安全与隐私

- [ ] 无用户数据上传到外部服务器
- [ ] 新增 Chrome 权限有充分理由
- [ ] 无敏感信息（密钥、Token）提交到代码库

---

## 附录：常见错误与修复

### ESLint 错误速查

| 错误信息                     | 原因                   | 修复方式                    |
| ---------------------------- | ---------------------- | --------------------------- |
| `禁止使用原生 <button>`      | 使用了原生 button 标签 | 替换为 `<Button>` from antd |
| `JSX 中发现硬编码中文`       | 未使用 i18n            | 用 `{t('...')}` 包裹        |
| `字符串中发现硬编码中文`     | 未使用 i18n            | 用 `translate('...')` 包裹  |
| `禁止使用内联 style={{...}}` | 内联样式               | 移到 CSS Modules            |
| `no-floating-promises`       | 未 await 的 Promise    | 添加 `void` 或 `await`      |
| `no-unused-vars`             | 未使用的变量           | 删除或加 `_` 前缀           |

### Stylelint 错误速查

| 错误信息                                         | 原因              | 修复方式                 |
| ------------------------------------------------ | ----------------- | ------------------------ |
| `Unexpected value "flex" for property "display"` | 手写 flex 布局    | 使用 `<Flex>` 组件       |
| `Unexpected hex color`                           | 硬编码颜色        | 使用 `var(--ant-*)` 变量 |
| `Unexpected invalid option "!important"`         | 使用了 !important | 移除，通过 Token 覆盖    |

### TypeScript 错误速查

| 错误信息                                       | 原因                     | 修复方式                   |
| ---------------------------------------------- | ------------------------ | -------------------------- |
| `Object is possibly 'undefined'`               | noUncheckedIndexedAccess | 添加可选链或类型守卫       |
| `Parameter 'xxx' implicitly has an 'any' type` | 缺少类型注解             | 添加明确类型               |
| `Property 'xxx' does not exist`                | 类型不匹配               | 检查类型定义或添加类型守卫 |

---

_本文档随项目演进持续更新。如有疑问或建议，请提交 Issue 或 PR。_
