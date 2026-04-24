#!/usr/bin/env node
/**
 * release.mjs —— Canopy v1.0 发布脚本
 *
 * 步骤：
 *   1. 清 dist / 跑 build
 *   2. 跑 check-quota，违反即 exit(1)
 *   3. 跑 vitest run，失败即 exit(1)
 *   4. 从 package.json 读 version，打包 dist/ → build/canopy-v{version}.zip
 *   5. 打印发布摘要（版本号、包体、sha256）
 */

import { execSync } from 'node:child_process';
import { readFileSync, mkdirSync, readdirSync, statSync, createWriteStream, existsSync, rmSync, createReadStream } from 'node:fs';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';

const ROOT = process.cwd();
const DIST = resolve(ROOT, 'dist');
const OUT = resolve(ROOT, 'build');

function sh(cmd) {
  console.log(`\n› ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

function sha256(path) {
  const h = createHash('sha256');
  h.update(readFileSync(path));
  return h.digest('hex');
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

async function main() {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));
  const version = pkg.version;

  // 1. 清 dist + build
  if (existsSync(DIST)) rmSync(DIST, { recursive: true, force: true });
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

  // 2. 构建
  sh('npm run build');

  // 3. 包体预算
  sh('node scripts/check-quota.mjs');

  // 4. 单元测试
  sh('npm test');

  // 5. 打 zip（使用系统 zip 命令，避免引入 adm-zip 等依赖）
  const zipPath = resolve(OUT, `canopy-v${version}.zip`);
  if (existsSync(zipPath)) rmSync(zipPath);
  sh(`cd dist && zip -r "${zipPath}" . -x "*.map"`);

  // 6. 摘要
  const files = walk(DIST);
  const total = files.reduce((acc, f) => acc + statSync(f).size, 0);
  const zipSize = statSync(zipPath).size;
  const hash = sha256(zipPath);

  console.log('\n────────────── Release Summary ──────────────');
  console.log(`Version:   ${version}`);
  console.log(`Files:     ${files.length}`);
  console.log(`Raw size:  ${(total / 1024).toFixed(2)} KB`);
  console.log(`Zip size:  ${(zipSize / 1024).toFixed(2)} KB`);
  console.log(`SHA-256:   ${hash}`);
  console.log(`Artifact:  ${relative(ROOT, zipPath)}`);
  console.log('─────────────────────────────────────────────\n');
  console.log('✅ Canopy v' + version + ' is ready to upload to Chrome Web Store.');
}

main().catch((err) => {
  console.error('release failed:', err);
  process.exit(1);
});
