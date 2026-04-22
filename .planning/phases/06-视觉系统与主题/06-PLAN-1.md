---
wave: 1
depends_on: []
files_modified:
  - src/pages/newtab/index.css
  - src/pages/newtab/theme-init.js
  - src/pages/newtab/index.html
  - src/pages/newtab/App.tsx
  - src/pages/newtab/main.tsx
  - src/shared/types.ts
  - src/store/settings-slice.ts
autonomous: true
requirements_addressed:
  - VISUAL-01
  - VISUAL-02
  - VISUAL-03
  - VISUAL-05
---

# Plan 06-1: Design Token 体系 + 主题切换 + 渐变背景

**Objective:** 建立完整的 CSS 变量 Design Token 体系，实现亮/暗/系统三档主题切换（无 FOUC），三套渐变预设 + 流动动画 + 自定义渐变选择器。

## Task 1: 扩展 Design Token CSS 变量体系

<read_first>
- src/pages/newtab/index.css
- docs/PRD.md (§7.2 视觉 Token 表)
</read_first>

<action>
在 `src/pages/newtab/index.css` 中重构 `@theme` 块，建立完整的 Design Token 体系：

1. 将现有 `@theme` 块保留基础 radius/font/blur，新增以下 token：
   - `--color-surface`: 卡片背景色（通过 @theme inline 引用 CSS 变量）
   - `--color-surface-hover`: 卡片悬停背景色
   - `--color-text`: 主文本色
   - `--color-text-secondary`: 次要文本色
   - `--color-text-muted`: 弱化文本色
   - `--color-border`: 边框色
   - `--color-badge`: 徽标背景色
   - `--color-focus-ring`: 焦点环色
   - `--elev-1`: `0 1px 2px rgba(0,0,0,.04), 0 2px 8px rgba(0,0,0,.04)`
   - `--elev-2`: `0 4px 16px rgba(0,0,0,.08)`
   - `--space-unit`: `4px`
   - `--duration-fast`: `150ms`
   - `--duration-normal`: `200ms`
   - `--ease-default`: `cubic-bezier(.22,.61,.36,1)`

2. 添加 `@custom-variant dark` 指令：
   ```css
   @custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));
   ```

3. 在 `@theme inline` 块中定义动态主题变量（引用 :root/[data-theme=dark] 中的 CSS 变量）：
   ```css
   :root {
     --canopy-surface: rgba(255, 255, 255, 0.5);
     --canopy-surface-hover: rgba(255, 255, 255, 0.7);
     --canopy-text: rgba(15, 23, 42, 0.9);
     --canopy-text-secondary: rgba(15, 23, 42, 0.65);
     --canopy-text-muted: rgba(15, 23, 42, 0.4);
     --canopy-border: rgba(255, 255, 255, 0.6);
     --canopy-badge: rgba(255, 255, 255, 0.6);
     --canopy-focus-ring: rgba(59, 130, 246, 0.8);
     --canopy-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
   }
   [data-theme=dark] {
     --canopy-surface: rgba(255, 255, 255, 0.15);
     --canopy-surface-hover: rgba(255, 255, 255, 0.25);
     --canopy-text: rgba(255, 255, 255, 0.9);
     --canopy-text-secondary: rgba(255, 255, 255, 0.65);
     --canopy-text-muted: rgba(255, 255, 255, 0.4);
     --canopy-border: rgba(255, 255, 255, 0.2);
     --canopy-badge: rgba(255, 255, 255, 0.15);
     --canopy-focus-ring: rgba(96, 165, 250, 0.8);
     --canopy-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
   }
   @theme inline {
     --color-surface: var(--canopy-surface);
     --color-surface-hover: var(--canopy-surface-hover);
     --color-text: var(--canopy-text);
     --color-text-secondary: var(--canopy-text-secondary);
     --color-text-muted: var(--canopy-text-muted);
     --color-border: var(--canopy-border);
     --color-badge: var(--canopy-badge);
     --color-focus-ring: var(--canopy-focus-ring);
   }
   ```

4. 添加渐变预设 CSS 变量：
   ```css
   :root {
     --gradient-aurora: linear-gradient(135deg, #F5F7FA 0%, #C3CFE2 25%, #E0C3FC 50%, #8EC5FC 75%, #E0C3FC 100%);
     --gradient-sunrise: linear-gradient(135deg, #FEE140 0%, #FA709A 40%, #FDBB6F 70%, #FEE140 100%);
     --gradient-deepspace: linear-gradient(135deg, #0F2027 0%, #203A43 40%, #2C5364 70%, #0F2027 100%);
   }
   ```

5. body 背景改为引用变量：
   ```css
   body {
     font-family: var(--font-family-sans);
     -webkit-font-smoothing: antialiased;
     -moz-osx-font-smoothing: grayscale;
     min-height: 100vh;
     background: var(--gradient-aurora);
     background-size: 400% 400%;
     background-attachment: fixed;
   }
   ```

6. 添加渐变流动动画 keyframes：
   ```css
   @keyframes gradient-shift {
     0% { background-position: 0% 50%; }
     50% { background-position: 100% 50%; }
     100% { background-position: 0% 50%; }
   }
   ```

7. body 上添加动画类：
   ```css
   .gradient-animated {
     animation: gradient-shift 30s ease infinite;
   }
   ```

8. 添加 `@media (prefers-reduced-motion: reduce)` 禁用渐变动画：
   ```css
   @media (prefers-reduced-motion: reduce) {
     .gradient-animated {
       animation: none;
     }
   }
   ```
</action>

<acceptance_criteria>
- `src/pages/newtab/index.css` contains `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *))`
- `src/pages/newtab/index.css` contains `@theme inline` block with `--color-surface`, `--color-text`, `--color-border` etc.
- `src/pages/newtab/index.css` contains `:root` block with `--canopy-surface`, `--canopy-text` etc.
- `src/pages/newtab/index.css` contains `[data-theme=dark]` block with dark theme overrides
- `src/pages/newtab/index.css` contains `--gradient-aurora`, `--gradient-sunrise`, `--gradient-deepspace` in `:root`
- `src/pages/newtab/index.css` contains `@keyframes gradient-shift`
- `src/pages/newtab/index.css` contains `.gradient-animated` class
- `src/pages/newtab/index.css` contains `@media (prefers-reduced-motion: reduce)` with animation: none
</acceptance_criteria>

## Task 2: 创建无 FOUC 主题初始化脚本

<read_first>
- src/pages/newtab/main.tsx
- src/pages/newtab/index.html (if exists, or find the HTML template)
</read_first>

<action>
1. 创建 `src/pages/newtab/theme-init.js`（外部脚本，CSP 允许）：
   ```js
   // theme-init.js — Runs before React to prevent FOUC
   // Chrome Extension MV3 CSP allows extension-bundled scripts, but NOT inline scripts
   (function() {
     // Step 1: Detect system preference immediately (synchronous)
     const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
     // Step 2: Apply system theme as default (no flash)
     const defaultTheme = systemDark ? 'dark' : 'light';
     document.documentElement.setAttribute('data-theme', defaultTheme);
     // Step 3: Async load user preference and correct if needed
     try {
       chrome.storage.local.get('canopy_settings', function(result) {
         if (result.canopy_settings && result.canopy_settings.theme) {
           const userTheme = result.canopy_settings.theme;
           if (userTheme === 'system') {
             // Already applied system preference, no change needed
           } else {
             document.documentElement.setAttribute('data-theme', userTheme);
           }
         }
         // Apply gradient preset
         if (result.canopy_settings && result.canopy_settings.gradientPreset) {
           document.body.setAttribute('data-gradient', result.canopy_settings.gradientPreset);
         }
       });
     } catch(e) {
       // chrome.storage not available (e.g. in dev mode), system theme is fine
     }
   })();
   ```

2. 在 `src/pages/newtab/index.html` 的 `<head>` 中，在所有其他脚本之前引入：
   ```html
   <script src="./theme-init.js"></script>
   ```

3. 确保 `vite.config.ts` 的 rollupOptions.input 包含 theme-init.js 作为入口，或者在 writeBundle 钩子中处理。如果 Vite 不直接处理外部脚本，则在 index.html 中使用 `<script src="./theme-init.js">` 并确保 Vite 复制该文件到输出目录（放在 public/ 下或在 vite plugin 中处理）。

   最佳方案：将 `theme-init.js` 放在 `src/pages/newtab/` 下，在 index.html 中引用，Vite 会自动处理。
</action>

<acceptance_criteria>
- File `src/pages/newtab/theme-init.js` exists
- File contains `document.documentElement.setAttribute('data-theme'`
- File contains `chrome.storage.local.get('canopy_settings'`
- File contains `matchMedia('(prefers-color-scheme: dark)')`
- The HTML file for newtab includes `<script` reference to theme-init.js before other scripts
</acceptance_criteria>

## Task 3: 创建 GradientBackground 组件

<read_first>
- src/pages/newtab/index.css (newly created token system)
- src/shared/types.ts (UserSettings type)
</read_first>

<action>
1. 创建 `src/shared/ui/GradientBackground.tsx`：
   ```tsx
   import { useEffect, useRef } from 'react';
   import { useSettingsStore } from '@/store';

   const GRADIENT_PRESETS: Record<string, string> = {
     aurora: 'linear-gradient(135deg, #F5F7FA 0%, #C3CFE2 25%, #E0C3FC 50%, #8EC5FC 75%, #E0C3FC 100%)',
     sunrise: 'linear-gradient(135deg, #FEE140 0%, #FA709A 40%, #FDBB6F 70%, #FEE140 100%)',
     deepspace: 'linear-gradient(135deg, #0F2027 0%, #203A43 40%, #2C5364 70%, #0F2027 100%)',
   };

   export function GradientBackground({ children }: { children: React.ReactNode }) {
     const gradientPreset = useSettingsStore((s) => s.settings.gradientPreset);
     const customGradient = useSettingsStore((s) => s.settings.customGradient);
     const containerRef = useRef<HTMLDivElement>(null);

     useEffect(() => {
       const el = containerRef.current;
       if (!el) return;

       if (gradientPreset === 'custom' && customGradient) {
         el.style.background = customGradient;
       } else if (GRADIENT_PRESETS[gradientPreset]) {
         el.style.background = GRADIENT_PRESETS[gradientPreset];
       }
       el.style.backgroundSize = '400% 400%';
       el.style.backgroundAttachment = 'fixed';
     }, [gradientPreset, customGradient]);

     return (
       <div ref={containerRef} className="gradient-animated min-h-screen">
         {children}
       </div>
     );
   }
   ```

2. 在 `src/shared/types.ts` 的 `UserSettings` 接口中添加 `customGradient?: string` 字段。

3. 更新 `src/shared/ui/index.ts` 导出 `GradientBackground`。
</action>

<acceptance_criteria>
- File `src/shared/ui/GradientBackground.tsx` exists
- Component uses `useSettingsStore` to read `gradientPreset`
- Component applies gradient as inline style with `backgroundSize: '400% 400%'`
- Component has `gradient-animated` class
- `UserSettings` in types.ts has `customGradient?: string` field
- `src/shared/ui/index.ts` exports `GradientBackground`
</acceptance_criteria>

## Task 4: 创建 ThemeToggle 组件

<read_first>
- src/shared/ui/Header.tsx
- src/store/settings-slice.ts
- src/shared/types.ts
</read_first>

<action>
1. 创建 `src/shared/ui/ThemeToggle.tsx`：
   ```tsx
   import { Sun, Moon, Monitor } from 'lucide-react';
   import { useSettingsStore } from '@/store';

   type Theme = 'light' | 'dark' | 'system';
   const THEME_CYCLE: Theme[] = ['light', 'dark', 'system'];
   const THEME_ICONS: Record<Theme, React.ReactNode> = {
     light: <Sun className="w-4 h-4" />,
     dark: <Moon className="w-4 h-4" />,
     system: <Monitor className="w-4 h-4" />,
   };

   export function ThemeToggle() {
     const theme = useSettingsStore((s) => s.settings.theme);
     const updateSettings = useSettingsStore((s) => s.updateSettings);

     const cycleTheme = () => {
       const currentIndex = THEME_CYCLE.indexOf(theme);
       const nextTheme = THEME_CYCLE[(currentIndex + 1) % THEME_CYCLE.length];
       updateSettings({ theme: nextTheme });
       applyTheme(nextTheme);
     };

     const applyTheme = (t: Theme) => {
       if (t === 'system') {
         const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
         document.documentElement.setAttribute('data-theme', systemDark ? 'dark' : 'light');
       } else {
         document.documentElement.setAttribute('data-theme', t);
       }
     };

     return (
       <button
         onClick={cycleTheme}
         className="w-9 h-9 flex items-center justify-center rounded-[var(--radius-md)]
           bg-surface hover:bg-surface-hover border border-border
           text-text-secondary hover:text-text
           transition-colors duration-150 cursor-pointer"
         aria-label={`切换主题，当前: ${theme}`}
         title={`主题: ${theme}`}
       >
         {THEME_ICONS[theme]}
       </button>
     );
   }
   ```

2. 在 `src/shared/ui/Header.tsx` 中添加 ThemeToggle：
   - 导入 ThemeToggle
   - 在归档按钮之后、标签计数之前放置 ThemeToggle
</action>

<acceptance_criteria>
- File `src/shared/ui/ThemeToggle.tsx` exists
- Component cycles through 'light', 'dark', 'system' on click
- Component calls `document.documentElement.setAttribute('data-theme', ...)` on click
- Component uses Sun/Moon/Monitor icons from lucide-react
- Header.tsx imports and renders ThemeToggle
- Header.tsx contains `<ThemeToggle` in JSX
</acceptance_criteria>

## Task 5: 创建 ThemeProvider + 更新 App 集成

<read_first>
- src/pages/newtab/App.tsx
- src/pages/newtab/main.tsx
- src/store/settings-slice.ts
</read_first>

<action>
1. 创建 `src/shared/ui/ThemeProvider.tsx`：
   ```tsx
   import { useEffect } from 'react';
   import { useSettingsStore } from '@/store';

   export function ThemeProvider({ children }: { children: React.ReactNode }) {
     const theme = useSettingsStore((s) => s.settings.theme);
     const loaded = useSettingsStore((s) => s.loaded);

     useEffect(() => {
       if (!loaded) return;
       const applyTheme = (t: string) => {
         if (t === 'system') {
           const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
           document.documentElement.setAttribute('data-theme', systemDark ? 'dark' : 'light');
         } else {
           document.documentElement.setAttribute('data-theme', t);
         }
       };
       applyTheme(theme);

       // Listen for system theme changes when in system mode
       if (theme === 'system') {
         const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
         const handler = (e: MediaQueryListEvent) => {
           document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
         };
         mediaQuery.addEventListener('change', handler);
         return () => mediaQuery.removeEventListener('change', handler);
       }
     }, [theme, loaded]);

     return <>{children}</>;
   }
   ```

2. 更新 `src/pages/newtab/App.tsx`：
   - 导入 GradientBackground, ThemeProvider
   - 用 `<GradientBackground>` 包裹整个应用
   - 在最外层添加 `<ThemeProvider>`
   - 移除原有 `div.min-h-screen` 上的硬编码样式

3. 更新 `src/shared/ui/index.ts` 导出 ThemeProvider
</action>

<acceptance_criteria>
- File `src/shared/ui/ThemeProvider.tsx` exists
- Component listens for system theme changes with `matchMedia('(prefers-color-scheme: dark)')`
- Component sets `data-theme` attribute on `document.documentElement`
- App.tsx wraps content with `<GradientBackground>` and `<ThemeProvider>`
- App.tsx does NOT have hardcoded `min-h-screen` on its own div (moved to GradientBackground)
</acceptance_criteria>

## Task 6: 创建渐变选择器组件

<read_first>
- src/shared/ui/GradientBackground.tsx
- src/store/settings-slice.ts
</read_first>

<action>
1. 创建 `src/shared/ui/GradientPicker.tsx`：
   ```tsx
   import { useSettingsStore } from '@/store';

   const PRESETS = [
     { id: 'aurora', label: 'Aurora', colors: ['#F5F7FA', '#E0C3FC', '#8EC5FC'] },
     { id: 'sunrise', label: 'Sunrise', colors: ['#FEE140', '#FA709A'] },
     { id: 'deepspace', label: 'Deep Space', colors: ['#0F2027', '#203A43', '#2C5364'] },
   ];

   export function GradientPicker() {
     const gradientPreset = useSettingsStore((s) => s.settings.gradientPreset);
     const updateSettings = useSettingsStore((s) => s.updateSettings);

     return (
       <div className="flex flex-col gap-3 p-4">
         <h3 className="text-sm font-medium text-text">渐变主题</h3>
         <div className="flex gap-3">
           {PRESETS.map((preset) => (
             <button
               key={preset.id}
               onClick={() => updateSettings({ gradientPreset: preset.id as any })}
               className={`w-16 h-16 rounded-[var(--radius-md)] border-2 transition-all duration-150 cursor-pointer ${
                 gradientPreset === preset.id ? 'border-focus-ring scale-105' : 'border-border hover:border-text-muted'
               }`}
               style={{
                 background: `linear-gradient(135deg, ${preset.colors.join(', ')})`,
               }}
               aria-label={`选择${preset.label}渐变`}
               title={preset.label}
             />
           ))}
         </div>
         <div className="flex items-center gap-2">
           <span className="text-xs text-text-muted">自定义</span>
           <input
             type="color"
             className="w-8 h-8 rounded cursor-pointer border-0"
             onChange={(e) => {
               const color1 = e.target.value;
               const current = useSettingsStore.getState().settings.customGradient;
               // Simple: two color pickers, store as linear-gradient
               updateSettings({
                 gradientPreset: 'custom',
                 customGradient: current
                   ? current.replace(/^linear-gradient\([^,]+,\s*[^,]+/, `linear-gradient(135deg, ${color1}`)
                   : `linear-gradient(135deg, ${color1}, #8EC5FC)`,
               });
             }}
           />
           <input
             type="color"
             className="w-8 h-8 rounded cursor-pointer border-0"
             defaultValue="#8EC5FC"
             onChange={(e) => {
               const color2 = e.target.value;
               const current = useSettingsStore.getState().settings.customGradient;
               updateSettings({
                 gradientPreset: 'custom',
                 customGradient: current
                   ? current.replace(/,\s*[^)]+\)/, `, ${color2})`)
                   : `linear-gradient(135deg, #F5F7FA, ${color2})`,
               });
             }}
           />
         </div>
       </div>
     );
   }
   ```

2. 更新 `src/shared/ui/index.ts` 导出 GradientPicker
</action>

<acceptance_criteria>
- File `src/shared/ui/GradientPicker.tsx` exists
- Component renders 3 preset buttons (aurora, sunrise, deepspace)
- Component calls `updateSettings({ gradientPreset: ... })` on click
- Component has two `<input type="color">` for custom gradient
- Custom gradient calls `updateSettings({ gradientPreset: 'custom', customGradient: ... })`
- `src/shared/ui/index.ts` exports GradientPicker
</acceptance_criteria>

## must_haves

- 三套渐变预设可切换
- 亮/暗/系统三档切换无 FOUC
- 渐变背景流动动画（30s cycle）
- reduced-motion 禁用动画
- 所有主题颜色通过 CSS 变量控制（不硬编码）
