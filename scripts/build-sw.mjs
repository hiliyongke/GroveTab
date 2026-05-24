/**
 * Service Worker 独立打包脚本
 *
 * 原因：
 *   Vite 8（rolldown）的多入口构建会把 SW 入口与 newtab 入口共享的代码
 *   （repositories/services/utils）拆到 newtab 的 feat-* chunk 里。这些 chunk
 *   同时也包含 antd / react / DOM 引用 —— SW 在 worker 上下文加载这些 chunk
 *   时立刻报 "document is not defined" 等顶层异常，整个 SW 启动失败，
 *   chrome.tabs.* / chrome.windows.* 监听器全部不会注册。
 *
 *   表象：插件原生历史记录（最近关闭、操作时间线）永远为空。
 *
 * 修复：在 vite build 之后用 esbuild 把 sw/index.ts 单独 bundle 成
 *   一个完全独立、无 import 的 dist/sw.js，避免共享 chunk 污染。
 *
 * 使用：通过 npm run build 自动调用，无需直接手动运行。
 */

import { build } from 'esbuild';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir, readFile, writeFile } from 'node:fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

await build({
  entryPoints: [resolve(ROOT, 'src/sw/index.ts')],
  bundle: true,
  outfile: resolve(ROOT, 'dist/sw.js'),
  format: 'esm',
  target: 'chrome120',
  platform: 'browser',
  // 关键：完全自包含，不允许任何外部 import 残留
  splitting: false,
  treeShaking: true,
  minify: true,
  legalComments: 'none',
  // 兼容 @/ alias（与 vite.config.ts 保持一致）
  alias: {
    '@': resolve(ROOT, 'src'),
  },
  // SW 是 worker 环境，剔除可能存在的 DOM 引用（理论上 SW 代码本就不该用）
  define: {
    'import.meta.env.MODE': '"production"',
    'import.meta.env.DEV': 'false',
    'import.meta.env.PROD': 'true',
  },
  loader: {
    '.ts': 'ts',
    '.tsx': 'tsx',
  },
  logLevel: 'info',
});

console.log('[build-sw] dist/sw.js bundled (standalone, no chunk imports)');

const assetsDir = resolve(ROOT, 'dist/assets');
const popupHtmlFile = resolve(ROOT, 'dist/src/pages/popup/index.html');
const newtabHtmlFile = resolve(ROOT, 'dist/src/pages/newtab/index.html');
const cssFiles = (await readdir(assetsDir)).filter((file) => file.endsWith('.css')).sort();
const popupCssLinks = cssFiles
  .filter((file) => file.startsWith('popup-'))
  .map((file) => `<link rel="stylesheet" href="/assets/${file}" />`)
  .join('\n    ');

const popupHtml = await readFile(popupHtmlFile, 'utf-8');
const normalizedPopupHtml = popupHtml.replace(
  /<head>[\s\S]*?<\/head>/,
  `<head><meta charset="UTF-8" /><title>GroveTab Popup</title>${popupCssLinks}</head>`,
);
await writeFile(popupHtmlFile, normalizedPopupHtml);
console.log('[build-sw] popup HTML CSS links normalized');

// 反向保险：newtab HTML 不应加载任何 popup-*.css，避免 popup 的尺寸约束样式污染整个新标签页
const newtabHtml = await readFile(newtabHtmlFile, 'utf-8');
const normalizedNewtabHtml = newtabHtml.replace(
  /\s*<link\s+rel="stylesheet"[^>]*href="[^"]*\/popup-[^"]*\.css"[^>]*\/?>(\s*)/g,
  '$1',
);
if (normalizedNewtabHtml !== newtabHtml) {
  await writeFile(newtabHtmlFile, normalizedNewtabHtml);
  console.log('[build-sw] newtab HTML stripped popup-*.css links');
}
