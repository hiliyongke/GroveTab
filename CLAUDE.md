<!-- GSD:project-start source:PROJECT.md -->
## Project:

**GroveTab（林栖标签页）**

GroveTab（原名 Canopy）是一款替换 Chrome 新标签页的标签管理器扩展。每次新开 Tab 时，用户进入一个美观（毛玻璃+渐变风格）、高效（多视图切换）、可检索的"标签工作台"，统一管理当前所有已打开的 Tab、历史归档会话和书签。面向 50+ Tab 并发的重度网页工作者，以及追求美学的 Chrome/Edge 用户。

**Core Value:** 每次新开 Tab，3 秒内找到并跳转到目标页面——新标签页就是你的标签工作台。

### Constraints:

- **扩展规范**: Must use Manifest V3 — Chrome/Edge 唯一支持的新规范
- **性能**: 500+ Tab 场景 ≥ 55 fps，首屏 ≤ 200ms (P95)
- **隐私**: 零外部请求，所有数据 chrome.storage.local，不上传任何服务器
- **存储**: chrome.storage.local 上限 10 MiB，需容量监控 + IndexedDB 降级
- **SW 生命周期**: MV3 Service Worker 30s 休眠，关键数据必须立即落盘
- **权限敏感度**: Chrome 商店对 `tabs`/`<all_urls>` 审核敏感，MVP 不申请 `<all_urls>`
- **技术栈**: React 19 + TypeScript + Vite + Ant Design + Zustand + Motion
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack:

- **框架**: React 19 (with React DOM)
- **语言**: TypeScript 6
- **构建工具**: Vite 8
- **UI 组件库**: Ant Design 6
- **状态管理**: Zustand 5
- **动画**: Motion 12 (原 Framer Motion)
- **拖拽**: @dnd-kit/core + @dnd-kit/sortable
- **虚拟滚动**: @tanstack/react-virtual
- **工具库**: dayjs, date-fns, nanoid, pinyin-pro, tldts, tinykeys, MiniSearch
- **代码规范**: ESLint 10 + TypeScript ESLint + Prettier 3
- **测试**: Vitest 4 + jsdom
- **Git Hooks**: Husky + lint-staged
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions:

- **代码风格**: 使用 Prettier 自动格式化，`lint-staged` 在提交前自动修复
- **提交规范**: 使用 Husky 进行 pre-commit 检查
- **类型安全**: 启用 TypeScript 严格模式，禁止 `any` 类型（ESLint 规则 `@typescript-eslint/no-explicit-any`）
- **注释语言**: 所有注释使用标准 TSDoc 模式，且必须为中文
- **导入顺序**: 使用 `@typescript-eslint/consistent-type-imports` 强制类型导入使用 `import type` 语法
- **命名规范**: 组件使用 PascalCase，工具函数使用 camelCase，常量使用 UPPER_SNAKE_CASE
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture:

采用 Feature-based 架构，按功能模块拆分代码：

```
src/
├── pages/          # 入口页面（newtab, popup）
├── features/       # 功能模块（tabs, sessions, search, settings, etc.）
├── shared/         # 共享代码（hooks, utils, types, i18n, ui, theme, config）
├── store/          # Zustand 状态管理（按 slice 拆分）
├── services/       # 业务逻辑服务层
├── repositories/   # 存储抽象层（chrome.storage.local）
├── chrome/         # Chrome API 封装
├── types/          # 全局类型定义（barrel export）
└── sw/             # Service Worker
```

**关键约定**：
- UI 层只读 store，不直接调用 chrome.* API
- 所有副作用通过 service / repo 层处理
- Store slices 自持 selector 稳定引用，避免无限重渲染
- SW 与 UI 通过 BroadcastChannel 双向同步
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills:

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement:

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile:

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
