/**
 * i18n 代码 key 替换脚本
 *
 * 将代码中所有 t('英文语义key') / translate('英文语义key') / translateWithLocale(locale, '英文语义key')
 * 替换为 t('中文原文') 形式，完成向中文直达调用的迁移。
 *
 * 用法：node scripts/i18n-replace-keys.mjs [--dry-run]
 *
 * 选项：
 *   --dry-run   仅预览替换内容，不写入文件
 */

import fs from 'node:fs';
import path from 'node:path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

// ─── 加载映射数据 ──────────────────────────────────────────────
const zhCNPath = path.resolve(ROOT, 'i18n/source/zh-CN.json');
if (!fs.existsSync(zhCNPath)) {
  console.error('❌ 找不到 i18n/source/zh-CN.json，请先运行 node scripts/i18n-migrate.mjs');
  process.exit(1);
}

const entries = JSON.parse(fs.readFileSync(zhCNPath, 'utf-8'));

// 构建：英文语义 key → 中文原文 的映射
// 同时读取 key-mapping.json 获取 semanticKey → k_键名 的映射，再反查 k_键名 → zh-CN
const keyMappingPath = path.resolve(ROOT, 'i18n/source/key-mapping.json');
const keyMapping = JSON.parse(fs.readFileSync(keyMappingPath, 'utf-8'));

// semanticKey → zhCN 原文
const semanticToZh = {};
for (const [semanticKey, kId] of Object.entries(keyMapping)) {
  const entry = entries.find((e) => e.key === kId);
  if (entry && entry['zh-CN']) {
    semanticToZh[semanticKey] = entry['zh-CN'];
  }
}

console.log(`📖 加载映射：${Object.keys(semanticToZh).length} 个英文语义 key → 中文原文`);

// ─── 扫描源文件 ────────────────────────────────────────────────
const EXTENSIONS = ['.ts', '.tsx'];
const SRC_DIR = path.resolve(ROOT, 'src');

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

const files = getFiles(SRC_DIR);
console.log(`🔍 扫描 ${files.length} 个源文件...\n`);

// ─── 替换逻辑 ──────────────────────────────────────────────────
let totalFiles = 0;
let totalReplacements = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  let modified = false;
  let fileReplacements = 0;

  // 跳过 i18n 核心文件本身
  if (file.includes('src/shared/i18n/')) continue;

  for (const [semanticKey, zhText] of Object.entries(semanticToZh)) {
    // 需要转义 semanticKey 中的特殊正则字符（如 . 等）
    const escapedKey = semanticKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 需要转义 zhText 中的特殊字符（用于替换字符串）
    // 同时处理 zhText 中含有单引号的情况（改用双引号包裹）
    const hasDoubleQuote = zhText.includes('"');
    const hasSingleQuote = zhText.includes("'");

    let replacement;
    if (!hasSingleQuote) {
      replacement = `'${zhText}'`;
    } else if (!hasDoubleQuote) {
      replacement = `"${zhText}"`;
    } else {
      // 两种引号都有，用单引号并转义
      replacement = `'${zhText.replace(/'/g, "\\'")}'`;
    }

    // 匹配 t('semanticKey') / t("semanticKey")
    // 以及 translate('semanticKey') / translateWithLocale(locale, 'semanticKey')
    const patterns = [
      // t('key') 或 t("key")
      new RegExp(`(\\bt\\s*\\()(['"\`])${escapedKey}\\2`, 'g'),
      // translate('key') 或 translate("key")
      new RegExp(`(\\btranslate\\s*\\()(['"\`])${escapedKey}\\2`, 'g'),
      // translateWithLocale(locale, 'key') 或 translateWithLocale(locale, "key")
      new RegExp(`(\\btranslateWithLocale\\s*\\([^,]+,\\s*)(['"\`])${escapedKey}\\2`, 'g'),
    ];

    for (const pattern of patterns) {
      const newContent = content.replace(pattern, (match, prefix, _quote) => {
        return `${prefix}${replacement}`;
      });
      if (newContent !== content) {
        content = newContent;
        fileReplacements++;
        modified = true;
      }
    }
  }

  if (modified) {
    totalFiles++;
    totalReplacements += fileReplacements;
    const relPath = path.relative(ROOT, file);
    console.log(`  ✏️  ${relPath}（${fileReplacements} 处替换）`);
    if (!DRY_RUN) {
      fs.writeFileSync(file, content, 'utf-8');
    }
  }
}

console.log(`\n📊 替换结果：`);
console.log(`  修改文件数：${totalFiles}`);
console.log(`  替换次数：${totalReplacements}`);
if (DRY_RUN) {
  console.log(`\n⚠️  --dry-run 模式，未写入文件`);
} else {
  console.log(`\n✅ 替换完成！`);
  console.log(`\n💡 提示：运行 npm run i18n:scan 更新词条统计`);
}
