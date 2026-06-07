/**
 * i18n 词条扫描 + 源码 pangu 修正
 *
 * 用法：node scripts/i18n-scan.mjs [--src dir] [--out dir] [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import { extractChineseKeys, textToKey, pangu, collectFiles, isNoScan, findStrayChinese } from './i18n-shared.mjs';

// ─── 配置 ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
const argMap = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const name = args[i].replace(/^--/, '');
    const hasVal = args[i + 1] && !args[i + 1].startsWith('--');
    argMap[name] = hasVal ? args[++i] : true;
  }
}
const SRC_DIR = typeof argMap.src === 'string' ? argMap.src : 'src';
const OUT_DIR = typeof argMap.out === 'string' ? argMap.out : 'i18n/source';
const DRY_RUN = 'dry-run' in argMap;

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(__dirname, '..');

// ─── 加载已有字典 ──────────────────────────────────────────────
const zhCNPath = path.resolve(ROOT, OUT_DIR, 'zh-CN.json');
const enPath = path.resolve(ROOT, OUT_DIR, 'en.json');
let zhDict = fs.existsSync(zhCNPath) ? JSON.parse(fs.readFileSync(zhCNPath, 'utf-8')) : {};
let enDict = fs.existsSync(enPath) ? JSON.parse(fs.readFileSync(enPath, 'utf-8')) : {};

console.log(`📖 加载已有字典：${Object.keys(zhDict).length} 条`);

// ─── 源码 pangu 修正 ───────────────────────────────────────────
const { EXTRACT_PATTERNS } = await import('./i18n-shared.mjs');

console.log('\n🔍 扫描 src/ 目录...');
const files = collectFiles(path.resolve(ROOT, SRC_DIR));
console.log(`  找到 ${files.length} 个源文件`);

let panguFixes = 0;
const panguFiles = new Set();

for (const file of files) {
  if (isNoScan(file)) continue;
  let content = fs.readFileSync(file, 'utf-8');
  let modified = false;

  for (const { re: regex, matchIdx } of EXTRACT_PATTERNS) {
    const re = new RegExp(regex.source, regex.flags);
    let match;
    const replacements = [];
    while ((match = re.exec(content)) !== null) {
      const original = match[matchIdx].trim();
      const fixed = pangu(original);
      if (fixed !== original) {
        const quote = match[1];
        const oldFull = quote + original + quote;
        const newFull = quote + fixed + quote;
        replacements.push({ old: match[0], new: match[0].replace(oldFull, newFull) });
      }
    }
    for (const r of replacements) {
      const idx = content.indexOf(r.old);
      if (idx !== -1) {
        content = content.slice(0, idx) + r.new + content.slice(idx + r.old.length);
        panguFixes++;
        panguFiles.add(file);
        modified = true;
      }
    }
  }
  if (modified && !DRY_RUN) fs.writeFileSync(file, content, 'utf-8');
}

// ─── 构建字典 ──────────────────────────────────────────────────
const usedKeys = new Set();
let totalNew = 0, totalExisting = 0;
for (const file of files) {
  if (isNoScan(file)) continue;
  for (const zhText of extractChineseKeys(fs.readFileSync(file, 'utf-8'))) {
    usedKeys.add(zhText);
    textToKey(zhText) in zhDict ? totalExisting++ : totalNew++;
  }
}

const newZhDict = {}, newEnDict = {};
for (const zhText of [...usedKeys].sort((a, b) => a.localeCompare(b, 'zh'))) {
  const kId = textToKey(zhText);
  newZhDict[kId] = zhText;
  newEnDict[kId] = enDict[kId] || '';
  const oldKId = Object.entries(zhDict).find(([, v]) => v === zhText)?.[0];
  if (oldKId && enDict[oldKId] && !newEnDict[kId]) newEnDict[kId] = enDict[oldKId];
}

const obsoleteKeys = Object.keys(zhDict).filter(k => !newZhDict[k]);
const total = Object.keys(newZhDict).length;
const enDone = Object.values(newEnDict).filter(v => v && v.trim()).length;

console.log(`\n📊 扫描结果：`);
console.log(`  新增 ${totalNew} / 已有 ${totalExisting} / 废弃 ${obsoleteKeys.length}`);
if (panguFixes > 0) console.log(`  🔧 pangu 修正 ${panguFixes} 处（${panguFiles.size} 个文件）`);
console.log(`\n📈 ${total} 条，英文 ${enDone}/${total}`);

// ─── 写入 ──────────────────────────────────────────────────────
if (!DRY_RUN) {
  fs.mkdirSync(path.resolve(ROOT, OUT_DIR), { recursive: true });
  const sort = (o) => { const s = {}; Object.keys(o).sort().forEach(k => s[k] = o[k]); return s; };
  fs.writeFileSync(zhCNPath, JSON.stringify(sort(newZhDict), null, 2), 'utf-8');
  fs.writeFileSync(enPath, JSON.stringify(sort(newEnDict), null, 2), 'utf-8');

  const unt = {};
  for (const [k, v] of Object.entries(newEnDict)) if (!v || !v.trim()) unt[k] = newZhDict[k];
  fs.writeFileSync(path.resolve(ROOT, OUT_DIR, 'untranslated.json'), JSON.stringify(sort(unt), null, 2), 'utf-8');

  fs.writeFileSync(path.resolve(ROOT, OUT_DIR, 'stats.json'),
    JSON.stringify({ total, zhCNTranslated: total, enTranslated: enDone, missingEn: total - enDone, scannedAt: new Date().toISOString() }, null, 2), 'utf-8');
  console.log(`✅ zh-CN.json / en.json / untranslated.json / stats.json`);
} else {
  console.log(`⚠️  --dry-run 模式，未写入文件`);
}

// ─── 未 t() 中文检测 ────────────────────────────────────────
console.log('\n🔎 检测未包裹 t() 的中文...');
const strayHits = [];
for (const file of files) {
  if (isNoScan(file)) continue;
  const hit = findStrayChinese(file);
  if (hit) strayHits.push(hit);
}
if (strayHits.length > 0) {
  console.log(`\n⚠️  发现 ${strayHits.length} 个文件存在未包裹 t() 的中文：`);
  for (const { file, lines } of strayHits.slice(0, 10)) {
    console.log(`  ${file} (${lines.length}): ${lines.slice(0, 2).join(' | ')}`);
  }
  if (strayHits.length > 10) console.log(`  ... 还有 ${strayHits.length - 10} 个文件`);
} else {
  console.log('  ✅ 未发现未包裹 t() 的中文');
}
