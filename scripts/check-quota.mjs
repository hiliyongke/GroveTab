#!/usr/bin/env node
/**
 * check-quota.mjs —— Canopy v1.0 封板包体约束检查
 *
 * 读取 dist/ 产物，对以下阈值做硬校验：
 *   · 主 newtab entry ≤ 280 KB（未压缩），90 KB（gzip）
 *   · dist/sw.js ≤ 60 KB
 *   · 主 CSS ≤ 80 KB
 *   · 非首屏 chunk 单体 ≤ 750 KB（给 feat-insights/feat-search 容差）
 *
 * 超阈值时 process.exit(1)，用于 CI 阻断。
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = resolve(process.cwd(), 'dist');

const HARD_LIMITS = {
  newtabJsRaw: 280 * 1024,
  newtabJsGz: 90 * 1024,
  swJsRaw: 60 * 1024,
  cssRaw: 80 * 1024,
  chunkRaw: 750 * 1024,
};

function fmtKB(n) {
  return `${(n / 1024).toFixed(2)} KB`;
}

function readSize(path) {
  const buf = readFileSync(path);
  return { raw: buf.byteLength, gz: gzipSync(buf).byteLength };
}

const violations = [];

function check(label, actual, limit, unit = 'raw') {
  const ok = actual <= limit;
  console.log(`${ok ? '✅' : '❌'} ${label.padEnd(40)} ${fmtKB(actual)} ${unit === 'gz' ? '(gz)' : ''} / ${fmtKB(limit)}`);
  if (!ok) violations.push(`${label} exceeded: ${fmtKB(actual)} > ${fmtKB(limit)}`);
}

try {
  // newtab entry
  const newtab = readSize(resolve(DIST, 'newtab.js'));
  check('newtab.js (raw)', newtab.raw, HARD_LIMITS.newtabJsRaw);
  check('newtab.js (gz)', newtab.gz, HARD_LIMITS.newtabJsGz, 'gz');

  // sw
  const sw = readSize(resolve(DIST, 'sw.js'));
  check('sw.js (raw)', sw.raw, HARD_LIMITS.swJsRaw);

  // css (取第一个 css)
  const assetsDir = resolve(DIST, 'assets');
  const cssFiles = readdirSync(assetsDir).filter((f) => f.endsWith('.css'));
  if (cssFiles.length > 0) {
    const css = readSize(resolve(assetsDir, cssFiles[0]));
    check(`main css (${cssFiles[0]})`, css.raw, HARD_LIMITS.cssRaw);
  }

  // chunks
  const chunksDir = resolve(DIST, 'chunks');
  const chunks = readdirSync(chunksDir).filter((f) => f.endsWith('.js'));
  for (const f of chunks) {
    const s = statSync(resolve(chunksDir, f));
    if (s.size > HARD_LIMITS.chunkRaw) {
      violations.push(`chunk ${f} ${fmtKB(s.size)} > ${fmtKB(HARD_LIMITS.chunkRaw)}`);
      console.log(`❌ chunk oversize: ${f} ${fmtKB(s.size)}`);
    }
  }
} catch (err) {
  console.error('check-quota failed:', err);
  process.exit(1);
}

if (violations.length > 0) {
  console.log('\n❌ Budget violations:');
  for (const v of violations) console.log('  - ' + v);
  process.exit(1);
} else {
  console.log('\n✅ All size budgets OK');
}
