/**
 * 词条迁移脚本
 *
 * 将现有 zh-CN.ts / en.ts 中的英文语义 key 格式（如 "app.name"）
 * 转换为 k_ 键名体系，生成新的 JSON 格式文件：
 *   i18n/source/zh-CN.json  — [{key, zh-CN, en}, ...]
 *   i18n/source/en.json     — [{key, zh-CN, en}, ...]
 *
 * 用法：node scripts/i18n-migrate.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

// ─── 读取现有翻译文件 ────────────────────────────────────────
// 注意：.ts 文件需要动态导入或者直接读取文本后手动解析
// 这里我们直接读取 .ts 文件内容并提取导出对象

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const zhCNPath = path.resolve(__dirname, '../src/shared/i18n/zh-CN.ts');
const enPath = path.resolve(__dirname, '../src/shared/i18n/en.ts');

/**
 * 从 .ts 文件中提取导出的对象
 * 简单的正则解析：匹配 "key": "value" 对
 */
function parseTsExport(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const result = {};

  // 匹配形如 "some.key": "some value" 或 "some.key": 'some value' 的行
  // 同时处理单引号和双引号
  const regex = /^\s*"([^"]+)"\s*:\s*"([^"]*)"\s*,?\s*$/gm;
  const regexSingle = /^\s*'([^']+)'\s*:\s*'([^']*)'\s*,?\s*$/gm;

  let match;
  while ((match = regex.exec(content)) !== null) {
    result[match[1]] = match[2];
  }
  while ((match = regexSingle.exec(content)) !== null) {
    result[match[1]] = match[2];
  }

  // 处理模板字符串值（包含 ${brand} 等）
  // 匹配 "key": `value` 格式
  const regexTemplate = /^\s*"([^"]+)"\s*:\s*`([^`]*)`\s*,?\s*$/gm;
  while ((match = regexTemplate.exec(content)) !== null) {
    result[match[1]] = match[2];
  }

  return result;
}

console.log('📖 读取现有翻译文件...');
const zhCN = parseTsExport(zhCNPath);
const en = parseTsExport(enPath);

console.log(`  zh-CN: ${Object.keys(zhCN).length} 个词条`);
console.log(`  en: ${Object.keys(en).length} 个词条`);

// ─── 生成 k_ 键名映射 ────────────────────────────────────────
/**
 * 为每个英文语义 key 生成唯一 k_ 键名
 * 格式：k_ + 7位随机字母数字
 */
function generateKeyId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = 'k_';
  for (let i = 0; i < 7; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// 建立映射：英文语义 key → k_ 键名
const keyMapping = {};
const allKeys = new Set([...Object.keys(zhCN), ...Object.keys(en)]);

console.log(`\n🔗 生成 k_ 键名映射（共 ${allKeys.size} 个唯一 key）...`);
for (const semanticKey of allKeys) {
  keyMapping[semanticKey] = generateKeyId();
}

// ─── 生成新的 JSON 格式文件 ──────────────────────────────────
const dictionaryEntries = [];

for (const semanticKey of allKeys) {
  const kid = keyMapping[semanticKey];
  const zhCNValue = zhCN[semanticKey] || '';
  const enValue = en[semanticKey] || '';

  dictionaryEntries.push({
    key: kid,
    'zh-CN': zhCNValue,
    en: enValue,
  });
}

// 写入文件
const outputDir = path.resolve(__dirname, '../i18n/source');
fs.mkdirSync(outputDir, { recursive: true });

const zhCNOutput = path.join(outputDir, 'zh-CN.json');
const enOutput = path.join(outputDir, 'en.json');

// 两个文件内容相同（都包含 key、zh-CN、en 三个字段）
// 但分别按 zh-CN 和 en 的值排序，方便各自维护
const byZhCN = [...dictionaryEntries].sort((a, b) =>
  a['zh-CN'].localeCompare(b['zh-CN']),
);
const byEn = [...dictionaryEntries].sort((a, b) =>
  a.en.localeCompare(b.en),
);

fs.writeFileSync(zhCNOutput, JSON.stringify(byZhCN, null, 2), 'utf-8');
fs.writeFileSync(enOutput, JSON.stringify(byEn, null, 2), 'utf-8');

console.log(`\n✅ 生成完成！`);
console.log(`  ${zhCNOutput} (${byZhCN.length} 条)`);
console.log(`  ${enOutput} (${byEn.length} 条)`);

// 输出 key 映射表供参考
const mappingPath = path.join(outputDir, 'key-mapping.json');
fs.writeFileSync(mappingPath, JSON.stringify(keyMapping, null, 2), 'utf-8');
console.log(`  ${mappingPath} (key 映射表)`);

// 统计缺失翻译
const missingZhCN = dictionaryEntries.filter((e) => !e['zh-CN']);
const missingEn = dictionaryEntries.filter((e) => !e.en);
console.log(`\n📊 统计：`);
console.log(`  缺少中文原文：${missingZhCN.length} 条`);
console.log(`  缺少英文翻译：${missingEn.length} 条`);

if (missingEn.length > 0 && missingEn.length <= 20) {
  console.log(`  缺少英文翻译的 key：`);
  missingEn.forEach((e) => console.log(`    ${e.key} ← ${Object.keys(keyMapping).find(k => keyMapping[k] === e.key)}`));
}
