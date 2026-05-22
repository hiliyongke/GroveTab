# Canopy

A beautiful Chrome new tab extension that manages all your tabs, sessions, and bookmarks.

## Development

```bash
# Install dependencies
pnpm install

# Start dev server with HMR
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test

# Lint
pnpm lint
```

## Loading in Chrome

1. Run `pnpm dev`
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist` directory

## Architecture

See `docs/PRD.md` for full product requirements and technical architecture.

## Project Structure

```
src/
├── pages/          # Entry points (newtab, popup)
├── features/       # Feature modules (tabs, sessions, search, etc.)
├── shared/         # Shared UI, hooks, utils, i18n, types
├── store/          # Zustand state management
├── services/       # Business logic services
├── repositories/   # Storage abstraction layer
├── chrome/         # Chrome API wrappers
└── sw/             # Service Worker
```

## Technology Stack

- **Framework**: React 19 + React DOM
- **Language**: TypeScript 6
- **Build Tool**: Vite 8
- **UI Library**: Ant Design 6
- **State Management**: Zustand 5
- **Animation**: Motion 12 (formerly Framer Motion)
- **Drag & Drop**: @dnd-kit/core + @dnd-kit/sortable
- **Virtual Scroll**: @tanstack/react-virtual
- **Utilities**: dayjs, date-fns, nanoid, pinyin-pro, tldts, tinykeys, MiniSearch
- **Code Quality**: ESLint 10 + TypeScript ESLint + Prettier 3
- **Testing**: Vitest 4 + jsdom
- **Git Hooks**: Husky + lint-staged

## License

MIT
