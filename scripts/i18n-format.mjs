/**
 * i18n 翻译文本格式化 —— pangu 间距
 * 用法：node scripts/i18n-format.mjs [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import { pangu } from './i18n-shared.mjs';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const DICT_DIR = args.includes('--dict') ? args[args.indexOf('--dict') + 1] : 'i18n/source';
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(__dirname, '..');

const enPath = path.resolve(ROOT, DICT_DIR, 'en.json');
if (!fs.existsSync(enPath)) { console.error(`❌ en.json not found: ${enPath}`); process.exit(1); }

const enDict = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
let count = 0;

console.log('\n🔧 pangu 间距格式化...');

for (const [key, value] of Object.entries(enDict)) {
  if (value && typeof value === 'string') {
    const formatted = pangu(value);
    if (formatted !== value) {
      if (DRY_RUN) console.log(`  "${value}" → "${formatted}"`);
      enDict[key] = formatted;
      count++;
    }
  }
}

if (!DRY_RUN) {
  fs.writeFileSync(enPath, JSON.stringify(enDict, null, 2), 'utf-8');
  console.log(`\n✅ 已格式化 ${count} 条 → ${DICT_DIR}/en.json`);
} else {
  console.log(`\n⚠️  --dry-run：将格式化 ${count} 条`);
}
