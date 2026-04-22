---
wave: 3
depends_on: [06-PLAN-2]
files_modified:
  - src/shared/i18n/index.ts
  - src/shared/i18n/zh-CN.ts
  - src/shared/i18n/en.ts
  - src/shared/ui/Header.tsx
  - src/shared/ui/UndoToast.tsx
  - src/shared/ui/ThemeToggle.tsx
  - src/features/tabs/DomainGroupCard.tsx
  - src/features/search/SearchBox.tsx
  - src/features/sessions/OnboardingCard.tsx
  - src/features/sessions/ArchivePanel.tsx
  - src/pages/newtab/App.tsx
  - src/store/settings-slice.ts
  - public/_locales/zh_CN/messages.json
  - public/_locales/en/messages.json
autonomous: true
requirements_addressed:
  - I18N-01
  - I18N-02
  - VISUAL-06
  - A11Y-01
---

# Plan 06-3: i18n 基座 + 动画系统

**Objective:** 建立轻量级 i18n 运行时（useT hook + 字典），翻译现有核心 UI 文案，集成 motion 动画（Tab 进出场、视图切换），实现 prefers-reduced-motion 检测。

## Task 1: 创建 i18n 基座

<read_first>
- src/store/settings-slice.ts
- src/shared/types.ts
</read_first>

<action>
1. 创建 `src/shared/i18n/zh-CN.ts`：
   ```ts
   const zhCN: Record<string, string> = {
     'app.name': 'Canopy',
     'header.search': '搜索',
     'header.archive': '归档',
     'header.tabCount': '{count} 个标签页',
     'theme.light': '浅色',
     'theme.dark': '深色',
     'theme.system': '跟随系统',
     'theme.toggle': '切换主题',
     'tabs.loading': '加载标签页中...',
     'tabs.close': '关闭标签页',
     'tabs.closeDomain': '关闭此域名所有标签页',
     'tabs.collapse': '展开',
     'tabs.expand': '折叠',
     'search.placeholder': '搜索标签页...',
     'search.shortcut': '⌘K',
     'search.noResults': '未找到匹配的标签页',
     'archive.title': '归档会话',
     'archive.restore': '恢复',
     'archive.delete': '删除',
     'archive.empty': '暂无归档会话',
     'undo.close': '已关闭 {count} 个标签页',
     'undo.action': '撤销',
     'onboarding.title': '欢迎使用 Canopy',
     'onboarding.desc': '你的标签，一目了然',
     'onboarding.dismiss': '开始使用',
     'gradient.aurora': 'Aurora',
     'gradient.sunrise': 'Sunrise',
     'gradient.deepspace': 'Deep Space',
     'gradient.custom': '自定义',
   };
   export default zhCN;
   ```

2. 创建 `src/shared/i18n/en.ts`：
   ```ts
   const en: Record<string, string> = {
     'app.name': 'Canopy',
     'header.search': 'Search',
     'header.archive': 'Archive',
     'header.tabCount': '{count} tabs',
     'theme.light': 'Light',
     'theme.dark': 'Dark',
     'theme.system': 'System',
     'theme.toggle': 'Toggle theme',
     'tabs.loading': 'Loading tabs...',
     'tabs.close': 'Close tab',
     'tabs.closeDomain': 'Close all tabs from this domain',
     'tabs.collapse': 'Expand',
     'tabs.expand': 'Collapse',
     'search.placeholder': 'Search tabs...',
     'search.shortcut': '⌘K',
     'search.noResults': 'No matching tabs found',
     'archive.title': 'Archived Sessions',
     'archive.restore': 'Restore',
     'archive.delete': 'Delete',
     'archive.empty': 'No archived sessions',
     'undo.close': '{count} tab(s) closed',
     'undo.action': 'Undo',
     'onboarding.title': 'Welcome to Canopy',
     'onboarding.desc': 'Your tabs at a glance',
     'onboarding.dismiss': 'Get started',
     'gradient.aurora': 'Aurora',
     'gradient.sunrise': 'Sunrise',
     'gradient.deepspace': 'Deep Space',
     'gradient.custom': 'Custom',
   };
   export default en;
   ```

3. 创建 `src/shared/i18n/index.ts`：
   ```ts
   import { createContext, useContext, useState, useCallback, useEffect } from 'react';
   import zhCN from './zh-CN';
   import en from './en';

   type Locale = 'zh-CN' | 'en';
   const dictionaries: Record<Locale, Record<string, string>> = { 'zh-CN': zhCN, en };

   interface I18nContextValue {
     locale: Locale;
     t: (key: string, params?: Record<string, string | number>) => string;
     setLocale: (locale: Locale) => void;
   }

   const I18nContext = createContext<I18nContextValue | null>(null);

   export function I18nProvider({ children }: { children: React.ReactNode }) {
     const [locale, setLocale] = useState<Locale>(() => {
       // Detect from navigator or settings
       const nav = navigator.language;
       return nav.startsWith('zh') ? 'zh-CN' : 'en';
     });

     const t = useCallback((key: string, params?: Record<string, string | number>) => {
       let text = dictionaries[locale]?.[key] || dictionaries['en']?.[key] || key;
       if (params) {
         Object.entries(params).forEach(([k, v]) => {
           text = text.replace(`{${k}}`, String(v));
         });
       }
       return text;
     }, [locale]);

     return (
       <I18nContext.Provider value={{ locale, t, setLocale }}>
         {children}
       </I18nContext.Provider>
     );
   }

   export function useT() {
     const ctx = useContext(I18nContext);
     if (!ctx) throw new Error('useT must be used within I18nProvider');
     return ctx;
   }

   // Utility: format date with Intl
   export function formatDate(date: Date | number, locale?: string): string {
     return new Intl.DateTimeFormat(locale || 'zh-CN', {
       year: 'numeric', month: 'short', day: 'numeric',
     }).format(date);
   }

   // Utility: format number with Intl
   export function formatNumber(num: number, locale?: string): string {
     return new Intl.NumberFormat(locale || 'zh-CN').format(num);
   }
   ```
</action>

<acceptance_criteria>
- File `src/shared/i18n/index.ts` exists with `I18nProvider`, `useT`, `formatDate`, `formatNumber`
- File `src/shared/i18n/zh-CN.ts` exists with at least 20 key-value pairs
- File `src/shared/i18n/en.ts` exists with at least 20 key-value pairs
- `useT()` hook returns `{ locale, t, setLocale }`
- `t()` function supports `{param}` substitution
</acceptance_criteria>

## Task 2: 集成 I18nProvider 到 App

<read_first>
- src/pages/newtab/App.tsx
- src/store/settings-slice.ts
</read_first>

<action>
1. 更新 `src/pages/newtab/App.tsx`：
   - 导入 `I18nProvider` from `@/shared/i18n`
   - 在 `<ThemeProvider>` 外层包裹 `<I18nProvider>`

2. 更新 I18nProvider 使其读取 settings 中的 language 字段并同步：
   - 在 I18nProvider 中添加 useEffect 监听 useSettingsStore 的 language 变化
   - 当 language 变化时调用 setLocale

3. 更新 settings-slice 的 updateSettings，当 language 变更时也调用 I18n 的 setLocale
</action>

<acceptance_criteria>
- App.tsx imports I18nProvider
- App.tsx wraps content with `<I18nProvider>`
- I18nProvider is between ThemeProvider and the main content
</acceptance_criteria>

## Task 3: 替换硬编码文案为 i18n 调用

<read_first>
- src/shared/ui/Header.tsx
- src/shared/ui/UndoToast.tsx
- src/shared/ui/ThemeToggle.tsx
- src/features/tabs/DomainGroupCard.tsx
- src/features/search/SearchBox.tsx
- src/features/sessions/OnboardingCard.tsx
- src/pages/newtab/App.tsx
</read_first>

<action>
逐个替换以下文件中的硬编码中文文案：

1. `Header.tsx`: "搜索" → t('header.search'), "归档" → t('header.archive'), `{tabCount} 个标签页` → t('header.tabCount', { count: tabCount })
2. `UndoToast.tsx`: `已关闭 ${tabCount} 个标签页` → t('undo.close', { count: tabCount }), "撤销" → t('undo.action')
3. `ThemeToggle.tsx`: aria-label 中的中文 → t('theme.toggle')
4. `DomainGroupCard.tsx`: "关闭此域名所有标签页" → t('tabs.closeDomain'), aria-label → t('tabs.collapse')/t('tabs.expand')
5. `SearchBox.tsx`: placeholder → t('search.placeholder'), 空结果 → t('search.noResults')
6. `OnboardingCard.tsx`: 欢迎文案 → t('onboarding.title'), t('onboarding.desc'), "开始使用" → t('onboarding.dismiss')
7. `App.tsx`: "加载标签页中..." → t('tabs.loading')

每个组件需要：
- 导入 `useT` from `@/shared/i18n`
- 在组件内部调用 `const { t } = useT()`
- 替换硬编码字符串
</action>

<acceptance_criteria>
- Header.tsx uses `t('header.search')` instead of "搜索"
- UndoToast.tsx uses `t('undo.close', { count: tabCount })` instead of hardcoded Chinese
- OnboardingCard.tsx uses `t('onboarding.title')` instead of "欢迎使用 Canopy"
- App.tsx uses `t('tabs.loading')` instead of "加载标签页中..."
- All components import `useT` from `@/shared/i18n`
</acceptance_criteria>

## Task 4: 集成 motion 动画

<read_first>
- src/pages/newtab/App.tsx
- src/features/tabs/DomainGroupView.tsx
- src/features/tabs/DomainGroupCard.tsx
</read_first>

<action>
1. 创建 `src/shared/hooks/use-reduced-motion.ts`：
   ```ts
   import { useReducedMotion } from 'motion/react';

   // Re-export with a wrapper that also checks CSS media query
   export function useReducedMotionPreference(): boolean {
     const motionReduced = useReducedMotion();
     return motionReduced ?? false;
   }
   ```

2. 更新 `src/features/tabs/DomainGroupCard.tsx`：
   - 导入 `motion` from `motion/react`
   - 将折叠/展开内容用 `<AnimatePresence>` 包裹
   - 折叠内容用 `<motion.div>` 替代 `<div>`：
     ```tsx
     <AnimatePresence initial={false}>
       {!collapsed && (
         <motion.div
           initial={{ height: 0, opacity: 0 }}
           animate={{ height: 'auto', opacity: 1 }}
           exit={{ height: 0, opacity: 0 }}
           transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
           className="overflow-hidden"
         >
           <div className="mt-1.5 ml-6 flex flex-col gap-1.5">
             {group.tabs.map((tab) => (...))}
           </div>
         </motion.div>
       )}
     </AnimatePresence>
     ```

3. 更新 `src/pages/newtab/App.tsx`：
   - 导入 `AnimatePresence` from `motion/react`
   - 搜索和归档面板的显示/隐藏用 `AnimatePresence` 包裹
   - 添加 `motion.div` 的 `initial/animate/exit` 过渡：
     ```tsx
     <AnimatePresence>
       {showSearch && (
         <motion.div
           key="search"
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           exit={{ opacity: 0 }}
           transition={{ duration: 0.15 }}
         >
           <SearchBox onClose={() => setShowSearch(false)} />
         </motion.div>
       )}
     </AnimatePresence>
     ```
</action>

<acceptance_criteria>
- File `src/shared/hooks/use-reduced-motion.ts` exists
- DomainGroupCard.tsx imports `AnimatePresence` and `motion` from `motion/react`
- DomainGroupCard.tsx uses `motion.div` for collapse/expand with `initial/animate/exit`
- App.tsx uses `AnimatePresence` for search panel
- App.tsx uses `motion.div` with opacity transitions for panels
</acceptance_criteria>

## Task 5: 更新 _locales 双语文件

<read_first>
- public/_locales/zh_CN/messages.json
- public/_locales/en/messages.json
</read_first>

<action>
扩展 `_locales` 文件，添加 Phase 1-5 涉及的所有 manifest 和 UI 相关字符串（chrome.i18n 用于 manifest 中的 name/description 等）：

1. 更新 `public/_locales/zh_CN/messages.json`：
   ```json
   {
     "appName": { "message": "Canopy", "description": "Extension name" },
     "appDescription": { "message": "你的标签，一目了然 — 新标签页标签管理器", "description": "Extension description" },
     "context_save_all": { "message": "保存所有标签到 Canopy", "description": "Context menu item" },
     "newtab_title": { "message": "Canopy — 新标签页", "description": "New tab page title" },
     "popup_title": { "message": "Canopy", "description": "Popup page title" },
     "theme_light": { "message": "浅色主题", "description": "Light theme" },
     "theme_dark": { "message": "深色主题", "description": "Dark theme" },
     "theme_system": { "message": "跟随系统", "description": "System theme" }
   }
   ```

2. 同步更新 `public/_locales/en/messages.json`。
</action>

<acceptance_criteria>
- zh_CN/messages.json has at least 8 entries including theme_light, theme_dark, theme_system
- en/messages.json has corresponding English entries
- Both files are valid JSON
</acceptance_criteria>

## must_haves

- i18n 基座可用（useT hook + 字典 + Intl 格式化）
- 核心文案已翻译（中英文）
- 折叠/展开动画平滑
- 搜索面板淡入淡出
- reduced-motion 时动画禁用
