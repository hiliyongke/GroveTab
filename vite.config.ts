import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function chromeExtensionPlugin() {
  return {
    name: 'chrome-extension',
    writeBundle() {
      // Copy manifest.json to dist
      copyFileSync(resolve(__dirname, 'manifest.json'), resolve(__dirname, 'dist/manifest.json'));

      // Write newtab HTML
      mkdirSync(resolve(__dirname, 'dist/src/pages/newtab'), { recursive: true });
      writeFileSync(
        resolve(__dirname, 'dist/src/pages/newtab/index.html'),
        `<!DOCTYPE html>
<html lang="zh-CN">
  <head><meta charset="UTF-8" /><title>Canopy</title></head>
  <body><div id="root"></div><script type="module" src="../../newtab.js"></script></body>
</html>`,
      );

      // Write popup HTML
      mkdirSync(resolve(__dirname, 'dist/src/pages/popup'), { recursive: true });
      writeFileSync(
        resolve(__dirname, 'dist/src/pages/popup/index.html'),
        `<!DOCTYPE html>
<html lang="zh-CN">
  <head><meta charset="UTF-8" /><title>Canopy Popup</title></head>
  <body><div id="root"></div><script type="module" src="../../popup.js"></script></body>
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
