import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function chromeExtensionPlugin() {
  return {
    name: 'chrome-extension',
    writeBundle() {
      const manifest = JSON.parse(
        readFileSync(resolve(__dirname, 'manifest.json'), 'utf-8'),
      );

      // 修正路径为构建产物路径
      manifest.background.service_worker = 'sw.js';
      manifest.chrome_url_overrides.newtab = 'src/pages/newtab/index.html';
      manifest.action.default_popup = 'src/pages/popup/index.html';

      // 修正图标路径
      const iconKeys = ['16', '48', '128'];
      for (const key of iconKeys) {
        manifest.icons[key] = manifest.icons[key].replace('public/', '');
        manifest.action.default_icon[key] = manifest.action.default_icon[key].replace('public/', '');
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
  plugins: [tailwindcss(), react(), chromeExtensionPlugin()],
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
    minify: false,
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
      },
    },
  },
});
