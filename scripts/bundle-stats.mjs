/**
 * P2-29: Bundle 体积可视化报告
 *
 * 直接分析 dist 目录下所有 JS/CSS chunk 的体积分布，
 * 生成交互式 HTML treemap 报告到 dist/stats.html。
 *
 * 用法：npm run report  （先 build 再分析）
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, "../dist");

if (!existsSync(distDir)) {
  console.error("dist/ not found. Run `npm run build` first.");
  process.exit(1);
}

/** 递归收集 dir 下所有 JS/CSS 文件及其大小 */
function collect(dir) {
  const result = [];
  if (!existsSync(dir)) return result;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    if (name.isDirectory() && !name.name.startsWith(".")) {
      result.push(...collect(join(dir, name.name)));
    } else if (name.name.endsWith(".js") || name.name.endsWith(".css")) {
      const fp = join(dir, name.name);
      const s = statSync(fp);
      const rel = fp.replace(distDir, "").replace(/^\//, "");
      result.push({ file: rel, size: s.size, ext: name.name.endsWith(".js") ? "js" : "css" });
    }
  }
  return result;
}

const files = collect(distDir).sort((a, b) => b.size - a.size);
if (files.length === 0) {
  console.error("No JS/CSS files found in dist/");
  process.exit(1);
}

const jsFiles = files.filter((f) => f.ext === "js");
const cssFiles = files.filter((f) => f.ext === "css");
const totalSize = files.reduce((s, f) => s + f.size, 0);
const maxSize = jsFiles[0]?.size || 1;
const col = (v) => `#${v.toString(16).padStart(6, "0")}`;
const color = (pct) => {
  // heatmap: green → yellow → red
  const r = Math.min(255, Math.round(pct * 4));
  const g = Math.min(255, Math.round((100 - pct) * 2.5));
  return `rgb(${r},${g},80)`;
};

// ── HTML ──────────────────────────────────────────────────
const now = new Date().toLocaleString("zh-CN");

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>Bundle Stats — GroveTab</title>
<style>
  *{box-sizing:border-box;margin:0}body{font-family:system-ui;background:#f5f5f5;color:#333;padding:32px 24px}
  .wrap{max-width:960px;margin:0 auto}
  h1{font-size:22px;margin-bottom:6px}h1 span{color:#999;font-size:14px;font-weight:400}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0}
  .card{background:#fff;border-radius:10px;padding:14px 16px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
  .card label{font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;display:block}
  .card .v{font-size:28px;font-weight:700;color:#1677ff}
  .treemap{display:flex;flex-wrap:wrap;gap:1px;margin:16px 0;border-radius:8px;overflow:hidden}
  .treemap>div{height:48px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 6px;transition:transform .15s}
  .treemap>div:hover{transform:scale(1.05);z-index:1}
  table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);margin:16px 0}
  th{text-align:left;padding:10px 14px;font-size:11px;color:#999;background:#fafafa;border-bottom:1px solid #eee;font-weight:600}
  td{padding:8px 14px;font-size:13px;border-bottom:1px solid #f0f0f0}
  tr:hover td{background:#fafafa}
  .bar-wrap{display:flex;align-items:center;gap:8px}
  .bar{height:6px;border-radius:2px;min-width:2px}
  .size{font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}
  .tag{display:inline-block;font-size:10px;padding:1px 5px;border-radius:3px;margin-right:4px}
  .tag-js{background:#e6f4ff;color:#1677ff}.tag-css{background:#fff7e6;color:#d48806}
  h2{font-size:16px;margin:24px 0 12px}
  footer{color:#999;font-size:11px;margin-top:32px}
  .pct{color:#999;font-size:12px}
</style></head><body>
<div class="wrap">
<h1>📦 Bundle Size Report <span>— ${now}</span></h1>

<div class="grid">
  <div class="card"><label>Total</label><div class="v">${(totalSize/1024).toFixed(0)} KB</div></div>
  <div class="card"><label>JS Chunks</label><div class="v">${jsFiles.length}</div></div>
  <div class="card"><label>CSS Files</label><div class="v">${cssFiles.length}</div></div>
  <div class="card"><label>Gzip Est.</label><div class="v">${Math.round(totalSize*0.35/1024)} KB</div></div>
</div>

<h2>Treemap</h2>
<div class="treemap">
${jsFiles.map((f) => {
  const pct = (f.size / totalSize * 100);
  const w = Math.max(pct * 5, 2).toFixed(1);
  const short = f.file.replace(/^(chunks\/|assets\/)/, "").replace(/-[a-zA-Z0-9]{8}\.(js|css)$/, "").slice(0, 18);
  return `<div style="flex-basis:${w}%;background:${color(pct)}" title="${f.file}\n${(f.size/1024).toFixed(1)} KB (${pct.toFixed(1)}%)">${short}</div>`;
}).join("\n")}
</div>

<h2>JS Chunks (${jsFiles.length})</h2>
<table>
<tr><th>File</th><th>Size</th><th>Est.Gzip</th><th>%</th><th>Bar</th></tr>
${jsFiles.map((f) => {
  const pct = (f.size / totalSize * 100);
  return `<tr>
    <td><span class="tag tag-js">JS</span>${f.file}</td>
    <td class="size">${(f.size/1024).toFixed(1)} KB</td>
    <td class="size">${(f.size*0.35/1024).toFixed(1)} KB</td>
    <td class="size pct">${pct.toFixed(1)}%</td>
    <td><div class="bar-wrap"><div class="bar" style="width:${(f.size/maxSize*160).toFixed(0)}px;background:${color(pct)}"></div></div></td>
  </tr>`;
}).join("\n")}
</table>

<h2>CSS Files (${cssFiles.length})</h2>
<table>
<tr><th>File</th><th>Size</th></tr>
${cssFiles.map((f) => `<tr><td><span class="tag tag-css">CSS</span>${f.file}</td><td class="size">${(f.size/1024).toFixed(1)} KB</td></tr>`).join("\n")}
</table>

<footer>Generated by <code>npm run report</code> · Based on actual dist/ file analysis</footer>
</div></body></html>`;

writeFileSync(resolve(distDir, "stats.html"), html);
console.log(`✅ report → dist/stats.html  (${files.length} files, ${(totalSize/1024).toFixed(0)} KB total)`);
