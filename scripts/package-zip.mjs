#!/usr/bin/env node
/**
 * package-zip.mjs —— 将 dist/ 打包为 Chrome Web Store 上传包
 *
 * 由 release-it after:bump hook 调用，此时 package.json 版本号已更新。
 * 输出：build/{name}-v{version}.zip
 */

import { readFileSync, mkdirSync, readdirSync, statSync, existsSync, rmSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const DIST = resolve(ROOT, 'dist');
const OUT = resolve(ROOT, 'build');

function sha256(filePath) {
  const h = createHash('sha256');
  h.update(readFileSync(filePath));
  return h.digest('hex');
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));
const version = pkg.version;

if (!existsSync(DIST)) {
  console.error('❌ dist/ 目录不存在，请先执行构建');
  process.exit(1);
}

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const zipPath = resolve(OUT, `${pkg.name}-v${version}.zip`);
if (existsSync(zipPath)) rmSync(zipPath);

execSync(`cd "${DIST}" && zip -r "${zipPath}" . -x "*.map"`, { stdio: 'inherit' });

const files = walk(DIST);
const rawSize = files.reduce((acc, f) => acc + statSync(f).size, 0);
const zipSize = statSync(zipPath).size;
const hash = sha256(zipPath);

console.log('\n────────────── Package Summary ──────────────');
console.log(`Version:   ${version}`);
console.log(`Files:     ${files.length}`);
console.log(`Raw size:  ${(rawSize / 1024).toFixed(2)} KB`);
console.log(`Zip size:  ${(zipSize / 1024).toFixed(2)} KB`);
console.log(`SHA-256:   ${hash}`);
console.log(`Artifact:  ${relative(ROOT, zipPath)}`);
console.log('─────────────────────────────────────────────\n');
console.log(`✅ ${pkg.name}-v${version}.zip is ready to upload to Chrome Web Store.`);
