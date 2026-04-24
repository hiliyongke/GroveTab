import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface Manifest {
  background?: { service_worker?: string };
  chrome_url_overrides?: { newtab?: string };
  action: { default_popup?: string; default_icon?: Record<string, string> };
  icons: Record<string, string>;
  [key: string]: unknown;
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

      // 查找生成的 CSS 文件
      const assetsDir = resolve(__dirname, 'dist/assets');
      const cssFiles = readdirSync(assetsDir).filter((f) => f.endsWith('.css'));
      const cssLink = cssFiles.length > 0
        ? `<link rel="stylesheet" href="/assets/${cssFiles[0]}" />`
        : '';

      mkdirSync(resolve(__dirname, 'dist/src/pages/newtab'), { recursive: true });
      writeFileSync(
        resolve(__dirname, 'dist/src/pages/newtab/index.html'),
        `<!DOCTYPE html>
<html lang="zh-CN">
  <head><meta charset="UTF-8" /><title>Canopy</title>${cssLink}</head>
  <body><div id="root"></div><script type="module" src="/newtab.js"></script></body>
</html>`,
      );

      mkdirSync(resolve(__dirname, 'dist/src/pages/popup'), { recursive: true });
      writeFileSync(
        resolve(__dirname, 'dist/src/pages/popup/index.html'),
        `<!DOCTYPE html>
<html lang="zh-CN">
  <head><meta charset="UTF-8" /><title>Canopy Popup</title>${cssLink}</head>
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
