import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync, readFileSync, readdirSync, copyFileSync } from 'node:fs';

/**
 * 构建时品牌配置（与 src/shared/config/brand.ts 保持同步）
 *
 * vite.config.ts 受 tsconfig.node.json 约束，无法直接 import src/ 下的模块。
 * 如需切换品牌，请同步修改此处的 BUILD_BRAND 和 brand.ts。
 */
const BUILD_BRAND = {
  name: 'GroveTab',
  description: {
    'zh-CN': 'GroveTab — 你的标签页，找到归属。按域名自动分组、秒搜、归档、全本地隐私。',
    en: 'GroveTab — where your tabs find their place. Auto-grouping, instant search, archive & 100% local.',
  },
} as const;

function pickLocaleField<T>(field: Record<string, T>, locale: string, fallback = 'en'): T {
  if (field[locale] !== undefined) return field[locale];
  if (field[fallback] !== undefined) return field[fallback];
  return Object.values(field)[0];
}

const __dirname = dirname(fileURLToPath(import.meta.url));

interface Manifest {
  background?: { service_worker?: string };
  chrome_url_overrides?: { newtab?: string };
  action: { default_popup?: string; default_icon?: Record<string, string> };
  icons: Record<string, string>;
  [key: string]: unknown;
}

function writeBrandLocales() {
  const localeMap = [
    { dir: 'zh_CN', locale: 'zh-CN' },
    { dir: 'en', locale: 'en' },
  ] as const;

  for (const item of localeMap) {
    const file = resolve(__dirname, 'dist/_locales', item.dir, 'messages.json');
    const messages = JSON.parse(readFileSync(file, 'utf-8')) as Record<string, { message: string; description?: string }>;
    messages.appName.message = BUILD_BRAND.name;
    messages.appDescription.message = pickLocaleField(BUILD_BRAND.description, item.locale);
    messages.context_save_all.message = item.locale === 'zh-CN'
      ? `保存所有标签到 ${BUILD_BRAND.name}`
      : `Save all tabs to ${BUILD_BRAND.name}`;
    messages.newtab_title.message = item.locale === 'zh-CN'
      ? `${BUILD_BRAND.name} — 新标签页`
      : `${BUILD_BRAND.name} — New Tab`;
    messages.popup_title.message = BUILD_BRAND.name;
    messages.onboarding_title.message = item.locale === 'zh-CN'
      ? `欢迎使用 ${BUILD_BRAND.name}`
      : `Welcome to ${BUILD_BRAND.name}`;
    writeFileSync(file, JSON.stringify(messages, null, 2));
  }
}

function chromeExtensionPlugin() {
  return {
    name: 'chrome-extension',
    writeBundle() {
      const manifest = JSON.parse(
        readFileSync(resolve(__dirname, 'manifest.json'), 'utf-8'),
      ) as Manifest;

      // 修正路径为构建产物路径
      manifest.background!.service_worker = 'sw.js';
      manifest.chrome_url_overrides!.newtab = 'src/pages/newtab/index.html';
      manifest.action.default_popup = 'src/pages/popup/index.html';

      // 修正图标路径
      const iconKeys = ['16', '48', '128'];
      for (const key of iconKeys) {
        manifest.icons[key] = manifest.icons[key].replace('public/', '');
        if (manifest.action?.default_icon?.[key]) {
          manifest.action.default_icon[key] = manifest.action.default_icon[key].replace('public/', '');
        }
      }

      writeFileSync(
        resolve(__dirname, 'dist/manifest.json'),
        JSON.stringify(manifest, null, 2),
      );
      writeBrandLocales();

      // 注入全部构建产物 CSS，避免多入口/懒加载样式因文件顺序不稳定而丢失
      const assetsDir = resolve(__dirname, 'dist/assets');
      const cssFiles = readdirSync(assetsDir).filter((f) => f.endsWith('.css')).sort();
      const cssLinks = cssFiles
        .map((file) => `<link rel="stylesheet" href="/assets/${file}" />`)
        .join('\n    ');

      const newtabDir = resolve(__dirname, 'dist/src/pages/newtab');
      mkdirSync(newtabDir, { recursive: true });
      copyFileSync(resolve(__dirname, 'src/pages/newtab/theme-init.js'), resolve(newtabDir, 'theme-init.js'));
      copyFileSync(resolve(__dirname, 'src/pages/newtab/prepaint.css'), resolve(newtabDir, 'prepaint.css'));
      writeFileSync(
        resolve(newtabDir, 'index.html'),
        `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${BUILD_BRAND.name}</title>
    <script src="./theme-init.js"></script>
    <link rel="stylesheet" href="./prepaint.css" />
    ${cssLinks}
  </head>
  <body><div id="root"></div><script type="module" src="/newtab.js"></script></body>
</html>`,
      );

      mkdirSync(resolve(__dirname, 'dist/src/pages/popup'), { recursive: true });
      writeFileSync(
        resolve(__dirname, 'dist/src/pages/popup/index.html'),
        `<!DOCTYPE html>
<html lang="zh-CN">
  <head><meta charset="UTF-8" /><title>${BUILD_BRAND.name} Popup</title>${cssLinks}</head>
  <body><div id="root"></div><script type="module" src="/popup.js"></script></body>
</html>`,
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), chromeExtensionPlugin()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@pages': resolve(__dirname, 'src/pages'),
      '@features': resolve(__dirname, 'src/features'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@store': resolve(__dirname, 'src/store'),
      '@services': resolve(__dirname, 'src/services'),
      '@repos': resolve(__dirname, 'src/repositories'),
      '@chrome': resolve(__dirname, 'src/chrome'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'esbuild',
    // 将 chunk 阈值调紧至 300KB，超阈值在 CI 里是 warning 信号
    chunkSizeWarningLimit: 300,
    rollupOptions: {
      input: {
        newtab: resolve(__dirname, 'src/pages/newtab/main.tsx'),
        popup: resolve(__dirname, 'src/pages/popup/main.tsx'),
        sw: resolve(__dirname, 'src/sw/index.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        /**
         * 手动分片策略（v1.0 封板）：把重依赖拆到独立 chunk，
         * 让主入口 newtab.js 保持精简（目标 ≤ 280 KB / 90 KB gz）。
         */
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            // v1.3 评估：zod（~12KB gz）本次不引入——现有手写校验（import-export.ts / storage-repo.ts）
            // 已覆盖 schema 版本号强校验 + 白名单剪裁，zero-cost 满足需求 8。若后续新增复杂 schema 再考虑。

            // react-grid-layout / react-resizable / react-draggable 必须最优先匹配——
            // 因为 pnpm 的存放路径形如 `react-grid-layout@2.2.3_react-dom@19.2.5__react@19.2.5`，
            // 会同时命中后面的 `react-dom` 与 `react` 分支，需要在前面短路。
            if (
              id.includes('react-grid-layout') ||
              id.includes('react-resizable') ||
              id.includes('react-draggable')
            ) {
              return 'vendor-grid';
            }
            if (id.includes('@dnd-kit')) return 'vendor-dnd';
            if (id.includes('lunar-typescript')) return 'vendor-lunar';
            // tinykeys ~1KB gz，随 vendor-react 一起走，避免额外 chunk 开销
            if (id.includes('tinykeys')) return 'vendor-react';
            if (id.includes('react-dom')) return 'vendor-react-dom';
            if (id.includes('react') && !id.includes('react-router')) return 'vendor-react';
            if (id.includes('antd') || id.includes('@ant-design')) return 'vendor-antd';
            if (id.includes('minisearch') || id.includes('pinyin-pro') || id.includes('tldts')) {
              return 'vendor-search';
            }
            if (id.includes('date-fns') || id.includes('dayjs')) return 'vendor-date';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('motion') || id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('zustand')) return 'vendor-zustand';
            return 'vendor-misc';
          }
          // 把"非首屏必需"的特性模块拆到独立 chunk
          if (id.includes('/features/settings/')) return 'feat-settings';
          if (id.includes('/features/sessions/')) return 'feat-sessions';
          if (id.includes('/features/search/')) return 'feat-search';
          if (id.includes('/features/insights/')) return 'feat-insights';
          if (id.includes('/features/workspace/')) return 'feat-workspace';
          if (id.includes('/features/tabs/KanbanView')) return 'feat-kanban';
          if (id.includes('/shared/theme/')) return 'shared-theme';
          if (id.includes('/shared/utils/import-export')) return 'shared-import-export';
          return undefined;
        },
      },
    },
  },
});
