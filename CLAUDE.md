<!-- GSD:project-start source:PROJECT.md -->
## Project

**Canopy**

Canopy 是一款替换 Chrome 新标签页的标签管理器扩展。每次新开 Tab 时，用户进入一个美观（毛玻璃+渐变风格）、高效（多视图切换）、可检索的"标签工作台"，统一管理当前所有已打开的 Tab、历史归档会话和书签。面向 50+ Tab 并发的重度网页工作者，以及追求美学的 Chrome/Edge 用户。

**Core Value:** 每次新开 Tab，3 秒内找到并跳转到目标页面——新标签页就是你的标签工作台。

### Constraints

- **扩展规范**: Must use Manifest V3 — Chrome/Edge 唯一支持的新规范
- **性能**: 500+ Tab 场景 ≥ 55 fps，首屏 ≤ 200ms (P95)
- **隐私**: 零外部请求，所有数据 chrome.storage.local，不上传任何服务器
- **存储**: chrome.storage.local 上限 10 MiB，需容量监控 + IndexedDB 降级
- **SW 生命周期**: MV3 Service Worker 30s 休眠，关键数据必须立即落盘
- **权限敏感度**: Chrome 商店对 `tabs`/`<all_urls>` 审核敏感，MVP 不申请 `<all_urls>`
- **技术栈**: React 18 + TypeScript + Vite + CRXJS + Tailwind + Zustand + Framer Motion
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
