# GroveTab Architecture

## Project Overview

**GroveTab** is a Chrome Manifest V3 new tab extension built with modern web technologies. It replaces the browser's default new tab page with a productivity-focused workspace for managing tabs, searching, and organizing browsing sessions.

| Layer | Technology |
|-------|-----------|
| UI Framework | React 19 + TypeScript |
| Build | Vite 8 |
| State | Zustand 5 |
| UI Kit | Ant Design 6 |
| Styling | Less + CSS Modules |
| Testing | Vitest + jsdom + Testing Library |
| Package Manager | pnpm 9 |
| Node | >= 22 |

Version: **1.3.0**

---

## Directory Structure

```
src/
├── pages/          # Entry points — one per Chrome view (newtab, popup, sidebar)
├── features/       # Feature modules — self-contained domains (search, settings, tabs, …)
├── store/          # Zustand state slices — one file per domain slice
├── services/       # Business logic services — orchestration & domain operations
├── repositories/   # Data persistence layer — abstracts storage read/write
├── chrome/         # Chrome API wrappers — safeCall + error normalization
├── shared/         # Shared utilities, hooks, types, UI components, i18n, config
│   ├── config/     # Brand identity, feature flags
│   ├── hooks/      # Reusable React hooks
│   ├── i18n/       # Internationalization (zh-CN / en)
│   ├── styles/     # Global styles & variables
│   ├── theme/      # Ant Design theme tokens
│   ├── types/      # Shared TypeScript type definitions
│   ├── ui/         # Reusable UI components (ErrorBoundary, PanelErrorBoundary, …)
│   └── utils/      # Pure utility functions
├── sw/             # Service Worker — Chrome MV3 background script
├── styles/         # Top-level global style entry
└── types/          # Top-level type augmentations
```

### Feature Modules

| Feature | Purpose |
|---------|---------|
| `arc-sidebar` | Arc-style sidebar navigation |
| `bookmarks` | Bookmark browsing & management |
| `developer-tools` | Dev-only debugging utilities |
| `effects` | Visual effects & animations |
| `history` | Browsing history viewer |
| `insights` | Usage analytics & insights |
| `quick-start` | Quick-access shortcuts |
| `search` | Omnibox / full-text search (MiniSearch) |
| `sessions` | Session save & restore |
| `settings` | User preferences & configuration |
| `tabs` | Tab list, grouping, drag-and-drop |
| `trending` | Trending / suggested content |
| `workspace` | Workspace / kanban board |

---

## Architecture Layers

Dependencies flow strictly **downward**. A layer may only import from layers below it, never above.

```
pages          ← Chrome view entry points (newtab, popup, sidebar)
  ↓
features       ← Feature modules compose store + services + UI
  ↓
store          ← Zustand slices hold reactive state
  ↓
services       ← Business logic orchestrates repositories + chrome APIs
  ↓
repositories   ← Data persistence abstracts chrome.storage
  ↓
chrome         ← Chrome API wrappers (safeCall + error normalization)
```

**Key rule:** No upward imports. `chrome/` never imports from `repositories/`; `store/` never imports from `features/`.

---

## Error Handling

GroveTab uses a **three-layer error handling architecture**:

### 1. `safeCall` — Chrome API Boundary

All `chrome.*` calls go through the `safeCall` wrapper (`src/chrome/tabs.ts`). It provides:

- **Timeout control** — prevents hung Chrome API calls from blocking indefinitely
- **Error normalization** — converts Chrome runtime errors into consistent `Error` objects with a labeled context (`label` parameter)
- **Logging** — every failure is logged with the API label for debugging

```ts
// Example: safeCall wraps every chrome.* invocation
const results = await safeCall('tabs.query', () => chrome.tabs.query(queryInfo));
```

### 2. Store Feedback — State-Level Error Propagation

When a service or repository call fails, the error is caught at the store or feature level and surfaced as user-visible feedback (e.g., toast notifications, inline error states). This keeps the UI reactive to failures without crashing.

### 3. ErrorBoundary / PanelErrorBoundary — React Crash Recovery

- **`ErrorBoundary`** (`src/shared/ui/ErrorBoundary.tsx`) — catches render-time crashes in the full page and displays a branded fallback UI.
- **`PanelErrorBoundary`** (`src/shared/ui/PanelErrorBoundary.tsx`) — catches crashes within individual panels/sections, isolating failures so one broken panel doesn't take down the entire page.

---

## State Management

Zustand 5 is used for all reactive state. Each domain has its own **slice** — a standalone store created with `create()`:

| Store | File | Purpose |
|-------|------|---------|
| `useTabsStore` | `tabs-slice.ts` | Tab list, grouping, drag state |
| `useSettingsStore` | `settings-slice.ts` | User preferences |
| `useUndoStore` | `undo-slice.ts` | Undo/redo stack |
| `useMetadataStore` | `metadata-slice.ts` | Tab metadata (favicons, titles) |
| `useSelectionStore` | `selection-slice.ts` | Multi-select state |
| `useStatsStore` | `stats-slice.ts` | Usage statistics |
| `useKanbanStore` | `kanban-slice.ts` | Kanban board state |
| `useSpeedDialStore` | `speed-dial-slice.ts` | Speed dial shortcuts |

All stores are exported from `src/store/index.ts`.

### Cross-Slice Reads

Slices that need data from another slice use `otherStore.getState()` (direct read, no subscription). This avoids circular subscriptions while still allowing cross-slice data access.

---

## Chrome API Pattern

**All `chrome.*` calls must go through `@/chrome` wrappers.** Direct `chrome.*` usage outside this directory is prohibited.

The `src/chrome/` module provides:

| File | Wraps |
|------|-------|
| `tabs.ts` | `chrome.tabs`, `chrome.windows`, `chrome.storage`, `chrome.tabGroups` + `safeCall` |
| `history.ts` | `chrome.history` (requires dynamic permission) |
| `bookmarks.ts` | `chrome.bookmarks` (requires dynamic permission) |
| `utils.ts` | URL classification, hostname extraction (pure logic, no API calls) |
| `index.ts` | Re-exports all modules as a single entry point |

The `safeCall<T>(label, fn, timeout?)` function:
1. Wraps the Chrome API call in a Promise with a configurable timeout (default 5 s)
2. Catches any runtime error, prefixes it with `label` for traceability
3. Returns the typed result or throws a normalized `Error`

---

## Brand Identity

Brand configuration lives in `src/shared/config/brand.js`. The `BRAND` constant is frozen at import time and provides:

- Product name & localized variants (zh-CN / en)
- Slogan & tagline
- Accent colors
- Product URL
- Log tag prefix
- Storage key prefix (`canopy_` — preserved for backward compatibility)

Switching brands is done at build time via `VITE_BRAND=<presetId>`. The active preset defaults to `groveTab`.

---

## Testing

| Tool | Purpose |
|------|---------|
| Vitest | Test runner |
| jsdom | DOM environment |
| @testing-library/react | Component testing utilities |
| @testing-library/jest-dom | DOM matchers |

Tests live in `tests/unit/` at the project root.

```bash
pnpm test            # vitest run — single run
pnpm test:watch      # vitest — watch mode
pnpm test:coverage   # vitest run --coverage
```

---

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `vite` | Start dev server |
| `build` | `tsc --noEmit && vitest run && vite build && build-sw` | Full production build |
| `build:strict` | `… + eslint` | Build with lint check |
| `build:fast` | `tsc -b && vite build && build-sw` | Skip tests & lint |
| `type-check` | `tsc --noEmit` | TypeScript type checking |
| `lint` | `eslint .` | Lint all files |
| `lint:fix` | `eslint . --fix` | Lint & auto-fix |
| `test` | `vitest run` | Run unit tests |
| `format` | `prettier --write …` | Format all files |
| `format:check` | `prettier --check …` | Check formatting |
| `check-quota` | `node scripts/check-quota.mjs` | Extension quota check |
| `release` | `node scripts/release.mjs` | Create a release |
| `knip` | `knip` | Detect unused exports/dependencies |
