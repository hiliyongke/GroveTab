/**
 * i18n 词条扫描工具
 *
 * 递归扫描 src/ 目录下所有 .ts/.tsx 文件，
 * 提取 t() / translate() / translateWithLocale() 调用中的中文文本参数，
 * 生成或更新 i18n/source/zh-CN.json 和 i18n/source/en.json。
 *
 * 支持 // @i18n-noscan 注释指令跳过特定文件。
 *
 * 用法：node scripts/i18n-scan.mjs [--src dir] [--out dir] [--dry-run]
 *
 * 选项：
 *   --src dir    源代码目录（默认 src/）
 *   --out dir    输出目录（默认 i18n/source/）
 *   --dry-run    仅预检模式，不写入文件
 */

import fs from 'node:fs';
import path from 'node:path';

// ─── 配置 ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
const SRC_DIR = args[args.indexOf('--src') + 1] || 'src';
const OUT_DIR = args[args.indexOf('--out') + 1] || 'i18n/source';
const DRY_RUN = args.includes('--dry-run');

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(__dirname, '..');

// ─── 加载已有映射 ──────────────────────────────────────────────
const mappingPath = path.resolve(ROOT, OUT_DIR, 'key-mapping.json');
const zhCNPath = path.resolve(ROOT, OUT_DIR, 'zh-CN.json');
const enPath = path.resolve(ROOT, OUT_DIR, 'en.json');

let keyMapping = {};
let zhCNEntries = [];
let enEntries = [];

if (fs.existsSync(mappingPath)) {
  keyMapping = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
  console.log(`📖 加载已有 key 映射：${Object.keys(keyMapping).length} 条`);
}

if (fs.existsSync(zhCNPath)) {
  zhCNEntries = JSON.parse(fs.readFileSync(zhCNPath, 'utf-8'));
  console.log(`📖 加载已有 zh-CN.json：${zhCNEntries.length} 条`);
}

if (fs.existsSync(enPath)) {
  enEntries = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
  console.log(`📖 加载已有 en.json：${enEntries.length} 条`);
}

// 构建 key → entry 的映射以便快速查找
const entryByKey = new Map();
for (const entry of zhCNEntries) {
  entryByKey.set(entry.key, entry);
}

// ─── 递归扫描 ──────────────────────────────────────────────────
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

/**
 * 递归获取目录下所有指定扩展名的文件
 */
function getFiles(dir, fileList = []) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      // 跳过 node_modules 和隐藏目录
      if (item.name === 'node_modules' || item.name.startsWith('.')) continue;
      getFiles(fullPath, fileList);
    } else if (EXTENSIONS.some((ext) => item.name.endsWith(ext))) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

/**
 * 检查文件是否包含 @i18n-noscan 指令
 */
function isNoScan(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.includes('@i18n-noscan');
}

/**
 * 从文件中提取 t() 调用中的中文文本
 */
function extractChineseFromT(fileContent) {
  const results = [];

  // 匹配模式：
  // t('中文文本')
  // t("中文文本")
  // t(`中文文本`)
  // t('中文文本', {...})
  // translate('中文文本')
  // translateWithLocale(locale, '中文文本')
  const patterns = [
    // t('...') / t("...") / t(`...`)
    /\bt\s*\(\s*['"`]([^'"`\)]*[\u4e00-\u9fff][^'"`\)]*)['"`]\s*(?:,|\))/gm,
    // translate('...')
    /\btranslate\s*\(\s*['"`]([^'"`\)]*[\u4e00-\u9fff][^'"`\)]*)['"`]\s*(?:,|\))/gm,
    // translateWithLocale(locale, '...')
    /\btranslateWithLocale\s*\([^,]+,\s*['"`]([^'"`\)]*[\u4e00-\u9fff][^'"`\)]*)['"`]\s*(?:,|\))/gm,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(fileContent)) !== null) {
      const text = match[1].trim();
      if (text && !results.includes(text)) {
        results.push(text);
      }
    }
  }

  return results;
}

// ─── 扫描入口 ──────────────────────────────────────────────────
console.log('\n🔍 扫描 src/ 目录...');
const srcPath = path.resolve(ROOT, SRC_DIR);
const files = getFiles(srcPath);
console.log(`  找到 ${files.length} 个源文件`);

let totalNew = 0;
let totalExisting = 0;
let totalSkipped = 0;
let noScanFiles = 0;

for (const file of files) {
  // 跳过 @i18n-noscan 文件
  if (isNoScan(file)) {
    noScanFiles++;
    continue;
  }

  const content = fs.readFileSync(file, 'utf-8');
  const chineseTexts = extractChineseFromT(content);

  for (const zhText of chineseTexts) {
    // 检查是否已存在
    const existingEntry = zhCNEntries.find((e) => e['zh-CN'] === zhText);
    if (existingEntry) {
      totalExisting++;
      continue;
    }

    // 生成新的 k_ 键名（检查是否已有映射）
    let keyId;
    if (keyMapping[zhText]) {
      keyId = keyMapping[zhText];
    } else {
      // 使用已有的 key-mapping 反查
      const existingKey = Object.entries(keyMapping).find(
        ([_k, v]) => v === keyId,
      );
      if (!existingKey) {
        keyId = generateKeyId();
        keyMapping[zhText] = keyId;
      }
    }

    // 添加新条目
    const newEntry = {
      key: keyId,
      'zh-CN': zhText,
      en: '', // 英文翻译暂时留空
    };

    zhCNEntries.push(newEntry);
    enEntries.push(newEntry);
    entryByKey.set(keyId, newEntry);
    totalNew++;
  }
}

console.log(`\n📊 扫描结果：`);
console.log(`  新增词条：${totalNew} 条`);
console.log(`  已有词条：${totalExisting} 条`);
console.log(`  跳过文件（@i18n-noscan）：${noScanFiles} 个`);

// ─── 统计信息 ──────────────────────────────────────────────────
const totalEntries = zhCNEntries.length;
const missingEn = zhCNEntries.filter((e) => !e.en).length;
const missingZhCN = zhCNEntries.filter((e) => !e['zh-CN']).length;

const stats = {
  total: totalEntries,
  zhCNTranslated: totalEntries - missingZhCN,
  enTranslated: totalEntries - missingEn,
  missingZhCN,
  missingEn,
  scannedAt: new Date().toISOString(),
};

console.log(`\n📈 翻译统计：`);
console.log(`  总词条数：${stats.total}`);
console.log(`  中文已填：${stats.zhCNTranslated} / 缺失：${stats.missingZhCN}`);
console.log(`  英文已译：${stats.enTranslated} / 缺失：${stats.missingEn}`);

// ─── 写入文件 ──────────────────────────────────────────────────
if (!DRY_RUN) {
  fs.mkdirSync(path.resolve(ROOT, OUT_DIR), { recursive: true });

  // 按 zh-CN 排序写入
  const sortedZhCN = [...zhCNEntries].sort((a, b) =>
    a['zh-CN'].localeCompare(b['zh-CN']),
  );
  const sortedEn = [...enEntries].sort((a, b) => a.en.localeCompare(b.en));

  fs.writeFileSync(
    path.resolve(ROOT, OUT_DIR, 'zh-CN.json'),
    JSON.stringify(sortedZhCN, null, 2),
    'utf-8',
  );
  fs.writeFileSync(
    path.resolve(ROOT, OUT_DIR, 'en.json'),
    JSON.stringify(sortedEn, null, 2),
    'utf-8',
  );
  fs.writeFileSync(
    path.resolve(ROOT, OUT_DIR, 'key-mapping.json'),
    JSON.stringify(keyMapping, null, 2),
    'utf-8',
  );
  fs.writeFileSync(
    path.resolve(ROOT, OUT_DIR, 'stats.json'),
    JSON.stringify(stats, null, 2),
    'utf-8',
  );

  console.log(`\n✅ 文件已写入 ${OUT_DIR}/ 目录`);
  console.log(`  zh-CN.json (${sortedZhCN.length} 条)`);
  console.log(`  en.json (${sortedEn.length} 条)`);
  console.log(`  key-mapping.json (${Object.keys(keyMapping).length} 条映射)`);
  console.log(`  stats.json`);
} else {
  console.log(`\n⚠️  --dry-run 模式，未写入文件`);
}

// ─── 辅助函数 ──────────────────────────────────────────────────

function generateKeyId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = 'k_';
  for (let i = 0; i < 7; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}
