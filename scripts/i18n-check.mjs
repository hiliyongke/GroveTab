/**
 * i18n 翻译完整性检查
 * 用法：node scripts/i18n-check.mjs [--src dir] [--dict dir]
 */

import fs from 'node:fs';
import path from 'node:path';
import { extractChineseKeys, collectFiles, isNoScan, findStrayChinese } from './i18n-shared.mjs';

const args = process.argv.slice(2);
const argMap = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const name = args[i].replace(/^--/, '');
    const hasVal = args[i + 1] && !args[i + 1].startsWith('--');
    argMap[name] = hasVal ? args[++i] : true;
  }
}
const SRC_DIR = argMap.src || 'src';
const DICT_DIR = argMap.dict || 'i18n/source';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(__dirname, '..');

// ─── 加载字典 ──────────────────────────────────────────────────
const zhCNPath = path.resolve(ROOT, DICT_DIR, 'zh-CN.json');
const enPath = path.resolve(ROOT, DICT_DIR, 'en.json');
if (!fs.existsSync(zhCNPath)) { console.error(`❌ 找不到 ${zhCNPath}`); process.exit(1); }

const zhDict = JSON.parse(fs.readFileSync(zhCNPath, 'utf-8'));
const enDict = fs.existsSync(enPath) ? JSON.parse(fs.readFileSync(enPath, 'utf-8')) : {};
console.log(`\n📖 加载字典：${Object.keys(zhDict).length} 条`);

// ─── 扫描源码 ──────────────────────────────────────────────────
console.log('\n🔍 扫描源码...');
const files = collectFiles(path.resolve(ROOT, SRC_DIR));
console.log(`  找到 ${files.length} 个源文件`);

const usedKeys = new Set();
for (const file of files) {
  if (isNoScan(file)) continue;
  for (const k of extractChineseKeys(fs.readFileSync(file, 'utf-8'))) usedKeys.add(k);
}
console.log(`  提取 ${usedKeys.size} 个中文词条`);

// ─── 比对 ──────────────────────────────────────────────────────
const missingEn = Object.entries(enDict).filter(([, v]) => !v || !v.trim());
const unused = Object.entries(zhDict).filter(([, v]) => !usedKeys.has(v));
const unregistered = [...usedKeys].filter(k => !Object.values(zhDict).includes(k));

console.log(`\n📈 英文缺失 ${missingEn.length} / 未使用 ${unused.length} / 未登记 ${unregistered.length}`);

if (unused.length > 0) {
  console.log('\n💤 未使用词条：');
  unused.slice(0, 10).forEach(([k, v], i) => console.log(`  ${i + 1}. [${k}] ${v}`));
}

if (unregistered.length > 0) {
  console.log(`\n❌ 未登记词条（需 i18n:scan）：`);
  unregistered.slice(0, 10).forEach((k, i) => console.log(`  ${i + 1}. "${k}"`));
  process.exit(1);
}

if (missingEn.length > 0) console.log(`\n💡 ${missingEn.length} 条英文未翻译 → ${DICT_DIR}/untranslated.json`);

// ─── 裸中文检测 ──────────────────────────────────────────────
const strayHits = [];
for (const file of files) {
  if (isNoScan(file)) continue;
  const hit = findStrayChinese(file);
  if (hit) strayHits.push(hit);
}
if (strayHits.length > 0) {
  console.log(`\n❌ 发现 ${strayHits.length} 个文件存在未包裹 t() 的中文：`);
  for (const { file, lines } of strayHits.slice(0, 15)) {
    console.log(`  ${file} (${lines.length}处): ${lines.slice(0, 2).join(' | ')}`);
  }
  if (strayHits.length > 15) console.log(`  ... 还有 ${strayHits.length - 15} 个文件`);
  console.log('\n💡 所有中文字符串必须被 t() 包裹。修复后重新 i18n:check。');
  process.exit(1);
}

console.log('\n🎉 检查通过！\n');
process.exit(0);
