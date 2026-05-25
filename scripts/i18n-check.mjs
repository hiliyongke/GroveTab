/**
 * i18n 翻译完整性检查工具
 *
 * 扫描代码中所有 t() / translate() / translateWithLocale() 调用，
 * 与 i18n/source/ 目录下的翻译字典交叉比对，输出：
 *   1. 未翻译词条：字典中有 key 但英文翻译为空
 *   2. 未使用词条：字典中有 key 但代码中未使用
 *   3. 未登记词条：代码中使用了中文 key 但字典中找不到对应映射
 *
 * 用法：node scripts/i18n-check.mjs [--src dir] [--dict dir] [--fix]
 *
 * 选项：
 *   --src dir    源代码目录（默认 src/）
 *   --dict dir   字典目录（默认 i18n/source/）
 *   --fix        自动修复：将未登记词条写入字典（生成新 key）
 */

import fs from 'node:fs';
import path from 'node:path';

// ─── 配置 ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
const SRC_DIR = args[args.indexOf('--src') + 1] || 'src';
const DICT_DIR = args[args.indexOf('--dict') + 1] || 'i18n/source';
const FIX_MODE = args.includes('--fix');

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(__dirname, '..');

// ─── 加载字典 ──────────────────────────────────────────────────
const zhCNPath = path.resolve(ROOT, DICT_DIR, 'zh-CN.json');
const enPath = path.resolve(ROOT, DICT_DIR, 'en.json');
const mappingPath = path.resolve(ROOT, DICT_DIR, 'key-mapping.json');

if (!fs.existsSync(zhCNPath)) {
  console.error(`❌ 找不到字典文件：${zhCNPath}`);
  console.error('   请先运行 npm run i18n:scan 生成字典文件');
  process.exit(1);
}

const zhCNEntries = JSON.parse(fs.readFileSync(zhCNPath, 'utf-8'));
const enEntries = fs.existsSync(enPath)
  ? JSON.parse(fs.readFileSync(enPath, 'utf-8'))
  : [];
const keyMapping = fs.existsSync(mappingPath)
  ? JSON.parse(fs.readFileSync(mappingPath, 'utf-8'))
  : {};

console.log(`\n📖 加载字典：zh-CN ${zhCNEntries.length} 条，en ${enEntries.length} 条`);

// 构建快速查找索引
/** @type {Map<string, {key: string, 'zh-CN': string, en: string}>} */
const zhByKey = new Map(zhCNEntries.map((e) => [e.key, e]));
/** @type {Map<string, {key: string, 'zh-CN': string, en: string}>} */
const enByKey = new Map(enEntries.map((e) => [e.key, e]));
/** 中文原文 → key 的反向映射 */
const zhTextToKey = new Map(Object.entries(keyMapping));

// ─── 扫描源码 ──────────────────────────────────────────────────
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

/**
 * 递归获取目录下所有指定扩展名的文件
 * @param {string} dir
 * @param {string[]} fileList
 * @returns {string[]}
 */
function getFiles(dir, fileList = []) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (item.name === 'node_modules' || item.name.startsWith('.')) continue;
      getFiles(fullPath, fileList);
    } else if (EXTENSIONS.some((ext) => item.name.endsWith(ext))) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

/**
 * 从文件内容中提取 t() 调用的中文参数
 * @param {string} content
 * @returns {string[]}
 */
function extractChineseKeys(content) {
  const results = new Set();
  const patterns = [
    /\bt\s*\(\s*['"`]([^'"`\)]*[\u4e00-\u9fff][^'"`\)]*)['"`]\s*(?:,|\))/gm,
    /\btranslate\s*\(\s*['"`]([^'"`\)]*[\u4e00-\u9fff][^'"`\)]*)['"`]\s*(?:,|\))/gm,
    /\btranslateWithLocale\s*\([^,]+,\s*['"`]([^'"`\)]*[\u4e00-\u9fff][^'"`\)]*)['"`]\s*(?:,|\))/gm,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const text = match[1].trim();
      if (text) results.add(text);
    }
  }
  return [...results];
}

console.log('\n🔍 扫描源码...');
const srcPath = path.resolve(ROOT, SRC_DIR);
const files = getFiles(srcPath);
console.log(`  找到 ${files.length} 个源文件`);

/** 代码中实际使用的所有中文 key @type {Set<string>} */
const usedChineseKeys = new Set();
/** 中文 key → 出现的文件列表 @type {Map<string, string[]>} */
const keyToFiles = new Map();

for (const file of files) {
  if (fs.readFileSync(file, 'utf-8').includes('@i18n-noscan')) continue;
  const content = fs.readFileSync(file, 'utf-8');
  const keys = extractChineseKeys(content);
  for (const key of keys) {
    usedChineseKeys.add(key);
    if (!keyToFiles.has(key)) keyToFiles.set(key, []);
    keyToFiles.get(key).push(path.relative(ROOT, file));
  }
}

console.log(`  提取到 ${usedChineseKeys.size} 个中文词条`);

// ─── 交叉比对 ──────────────────────────────────────────────────

/** 1. 未翻译词条：字典中有 key 但英文翻译为空 */
const missingTranslation = zhCNEntries.filter((e) => {
  const enEntry = enByKey.get(e.key);
  return !enEntry || !enEntry.en || enEntry.en.trim() === '';
});

/** 2. 未使用词条：字典中有 key 但代码中未使用（通过 key-mapping 反查） */
// key-mapping 是 中文原文 -> k_id，所以 key-mapping 中的 value 就是被使用的 k_id
const usedKIds = new Set(Object.values(keyMapping));
const unusedEntries = zhCNEntries.filter((e) => {
  return !usedKIds.has(e.key);
});

/** 3. 未登记词条：代码中使用了中文 key 但字典中找不到对应映射 */
const unregisteredKeys = [...usedChineseKeys].filter((zhText) => {
  return !zhTextToKey.has(zhText);
});

// ─── 输出报告 ──────────────────────────────────────────────────
console.log('\n' + '═'.repeat(60));
console.log('📊 i18n 翻译完整性检查报告');
console.log('═'.repeat(60));

// 1. 未翻译词条
if (missingTranslation.length === 0) {
  console.log('\n✅ 英文翻译完整，无缺失词条');
} else {
  console.log(`\n⚠️  英文翻译缺失：${missingTranslation.length} 条`);
  console.log('─'.repeat(40));
  missingTranslation.slice(0, 20).forEach((e, i) => {
    console.log(`  ${i + 1}. [${e.key}] ${e['zh-CN']}`);
  });
  if (missingTranslation.length > 20) {
    console.log(`  ... 还有 ${missingTranslation.length - 20} 条（仅显示前 20 条）`);
  }
}

// 2. 未使用词条
if (unusedEntries.length === 0) {
  console.log('\n✅ 字典词条全部被使用，无冗余词条');
} else {
  console.log(`\n💤 未使用词条（可考虑清理）：${unusedEntries.length} 条`);
  console.log('─'.repeat(40));
  unusedEntries.slice(0, 10).forEach((e, i) => {
    console.log(`  ${i + 1}. [${e.key}] ${e['zh-CN']}`);
  });
  if (unusedEntries.length > 10) {
    console.log(`  ... 还有 ${unusedEntries.length - 10} 条（仅显示前 10 条）`);
  }
}

// 3. 未登记词条
if (unregisteredKeys.length === 0) {
  console.log('\n✅ 所有中文词条均已登记到字典');
} else {
  console.log(`\n❌ 未登记词条（需运行 i18n:scan 补录）：${unregisteredKeys.length} 条`);
  console.log('─'.repeat(40));
  unregisteredKeys.slice(0, 20).forEach((zhText, i) => {
    const files = keyToFiles.get(zhText) ?? [];
    console.log(`  ${i + 1}. "${zhText}"`);
    files.slice(0, 2).forEach((f) => console.log(`       → ${f}`));
    if (files.length > 2) console.log(`       → ...共 ${files.length} 处`);
  });
  if (unregisteredKeys.length > 20) {
    console.log(`  ... 还有 ${unregisteredKeys.length - 20} 条（仅显示前 20 条）`);
  }
}

// ─── 汇总 ──────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60));
console.log('📈 汇总');
console.log(`  字典总词条：${zhCNEntries.length} 条`);
console.log(`  代码使用词条：${usedChineseKeys.size} 条`);
console.log(`  英文翻译缺失：${missingTranslation.length} 条`);
console.log(`  未使用词条：${unusedEntries.length} 条`);
console.log(`  未登记词条：${unregisteredKeys.length} 条`);

const hasIssues = missingTranslation.length > 0 || unregisteredKeys.length > 0;

if (hasIssues) {
  console.log('\n💡 建议：');
  if (unregisteredKeys.length > 0) {
    console.log('  运行 npm run i18n:scan 自动补录未登记词条');
  }
  if (missingTranslation.length > 0) {
    console.log(`  补充 ${DICT_DIR}/en.json 中缺失的英文翻译`);
  }
  console.log('');
  process.exit(1);
} else {
  console.log('\n🎉 检查通过！\n');
  process.exit(0);
}
