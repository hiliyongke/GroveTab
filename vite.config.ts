import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, mkdirSync, readFileSync, readdirSync, copyFileSync } from "node:fs";

/**
 * 构建时品牌配置（与 src/shared/config/brand.ts 保持同步）
 *
 * vite.config.ts 受 tsconfig.node.json 约束，无法直接 import src/ 下的模块。
 * 如需切换品牌，请同步修改此处的 BUILD_BRAND 和 brand.ts。
 */
const BUILD_BRAND = {
  name: "GroveTab",
  description: {
    "zh-CN": "GroveTab — 你的标签页，找到归属。按域名自动分组、秒搜、归档、全本地隐私。",
    en: "GroveTab — where your tabs find their place. Auto-grouping, instant search, archive & 100% local.",
  },
} as const;

/**
 * 从多语言字段对象中选取当前语言的字段值
 *
 * 优先匹配当前 locale，未找到则回退到 fallback（默认 'en'），
 * 若仍不存在则取字段对象的第一个值。
 *
 * @param field 多语言字段对象（如 { 'zh-CN': '...', 'en': '...' }）
 * @param locale 当前语言标识
 * @param fallback 回退语言标识，默认 'en'
 * @returns 匹配到的字段值
 */
function pickLocaleField<T>(field: Record<string, T>, locale: string, fallback = "en"): T {
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

/**
 * 将构建时品牌配置写入多语言 messages.json
 *
 * 遍历 zh_CN 和 en 两种语言，
 * 更新 appName、appDescription、context_save_all 等字段，
 * 使构建产物的多语言文案与 BUILD_BRAND 保持同步。
 *
 * @returns 无返回值（同步写入文件）
 */
function writeBrandLocales() {
  const localeMap = [
    { dir: "zh_CN", locale: "zh-CN" },
    { dir: "en", locale: "en" },
  ] as const;

  for (const item of localeMap) {
    const file = resolve(__dirname, "dist/_locales", item.dir, "messages.json");
    const messages = JSON.parse(readFileSync(file, "utf-8")) as Record<
      string,
      { message: string; description?: string }
    >;
    messages.appName.message = BUILD_BRAND.name;
    messages.appDescription.message = pickLocaleField(BUILD_BRAND.description, item.locale);
    messages.context_save_all.message =
      item.locale === "zh-CN"
        ? `保存所有标签到 ${BUILD_BRAND.name}`
        : `Save all tabs to ${BUILD_BRAND.name}`;
    messages.newtab_title.message =
      item.locale === "zh-CN" ? `${BUILD_BRAND.name} — 新标签页` : `${BUILD_BRAND.name} — New Tab`;
    messages.popup_title.message = BUILD_BRAND.name;
    messages.onboarding_title.message =
      item.locale === "zh-CN" ? `欢迎使用 ${BUILD_BRAND.name}` : `Welcome to ${BUILD_BRAND.name}`;
    writeFileSync(file, JSON.stringify(messages, null, 2));
  }
}

/**
 * Vite 插件：Chrome 扩展构建后处理
 *
 * 在 build 完成后执行：
 *   - 修正 manifest.json 中的路径（service_worker、newtab、popup）
 *   - 修正 icons 路径（移除 public/ 前缀）
 *   - 写入多语言 messages.json（品牌名称、描述等）
 *   - 生成 newtab/popup 的 HTML 入口文件并注入所有 CSS
 *
 * @returns Vite 插件对象
 */
function chromeExtensionPlugin() {
  return {
    name: "chrome-extension",
    writeBundle() {
      const manifest = JSON.parse(
        readFileSync(resolve(__dirname, "manifest.json"), "utf-8"),
      ) as Manifest;

      // 修正路径为构建产物路径
      manifest.background!.service_worker = "sw.js";
      manifest.chrome_url_overrides!.newtab = "src/pages/newtab/index.html";
      manifest.action.default_popup = "src/pages/popup/index.html";

      // 修正图标路径
      const iconKeys = ["16", "48", "128"];
      for (const key of iconKeys) {
        manifest.icons[key] = manifest.icons[key].replace("public/", "");
        if (manifest.action?.default_icon?.[key]) {
          manifest.action.default_icon[key] = manifest.action.default_icon[key].replace(
            "public/",
            "",
          );
        }
      }

      writeFileSync(resolve(__dirname, "dist/manifest.json"), JSON.stringify(manifest, null, 2));
      writeBrandLocales();

      // 注入全部构建产物 CSS，避免多入口/懒加载样式因文件顺序不稳定而丢失
      const assetsDir = resolve(__dirname, "dist/assets");
      const cssFiles = readdirSync(assetsDir)
        .filter((f) => f.endsWith(".css"))
        .sort();
      const cssLinks = cssFiles
        .map((file) => `<link rel="stylesheet" href="/assets/${file}" />`)
        .join("\n    ");

      const newtabDir = resolve(__dirname, "dist/src/pages/newtab");
      mkdirSync(newtabDir, { recursive: true });
      copyFileSync(
        resolve(__dirname, "src/pages/newtab/theme-init.js"),
        resolve(newtabDir, "theme-init.js"),
      );
      copyFileSync(
        resolve(__dirname, "src/pages/newtab/prepaint.css"),
        resolve(newtabDir, "prepaint.css"),
      );
      writeFileSync(
        resolve(newtabDir, "index.html"),
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

      mkdirSync(resolve(__dirname, "dist/src/pages/popup"), { recursive: true });
      writeFileSync(
        resolve(__dirname, "dist/src/pages/popup/index.html"),
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
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  plugins: [
    react(),
    chromeExtensionPlugin(),
    // Bundle size visualization (only runs during build)
    visualizer({
      filename: "./dist/stats.html",
      open: false, // Don't auto-open in CI
      gzipSize: true,
      brotliSize: true,
      template: "treemap", // Visual representation
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@pages": resolve(__dirname, "src/pages"),
      "@features": resolve(__dirname, "src/features"),
      "@shared": resolve(__dirname, "src/shared"),
      "@store": resolve(__dirname, "src/store"),
      "@services": resolve(__dirname, "src/services"),
      "@repos": resolve(__dirname, "src/repositories"),
      "@chrome": resolve(__dirname, "src/chrome"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    minify: "esbuild",
    // 懒加载 chunk 合理的体积上限（feat-insights 含 antd 组件 + SVG 图表 ≈ 750KB）
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      input: {
        // 注：SW 不在 vite 入口中。vite 8 (rolldown) 多入口会把 SW 与
        // newtab 共享的代码拆到 feat-* chunk，连带 antd/react/DOM 依赖一起
        // 加载 → SW 启动报 "document is not defined" → listener 不注册 →
        // 插件历史记录永远为空。
        // 改用 scripts/build-sw.mjs 在 vite build 后独立用 esbuild bundle SW，
        // 产出一个完全自包含、无任何 import 的 dist/sw.js。
        newtab: resolve(__dirname, "src/pages/newtab/main.tsx"),
        popup: resolve(__dirname, "src/pages/popup/main.tsx"),
        sidebar: resolve(__dirname, "src/pages/sidebar/main.tsx"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  css: {
    modules: {
      // .module.less 文件自动启用 CSS Modules
      // 生成格式：[name]_[local]_[hash:6]，与项目现有 CSS Modules 命名一致
      generateScopedName: "[name]_[local]_[hash:6]",
    },
  },
});
