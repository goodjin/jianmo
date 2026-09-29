#!/usr/bin/env node
import { stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const root = process.cwd();

function fmtBytes(n) {
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 2)} ${u[i]}`;
}

async function checkFile(rel, maxBytes, maxGzipBytes) {
  const bundle = path.join(root, rel);
  let info;
  try {
    info = await stat(bundle);
  } catch {
    return [`${rel} 不存在（请先 npm run build:extension）`];
  }
  const gzipBytes = gzipSync(await readFile(bundle)).length;
  console.log(`[bundle-check] ${rel}: size=${fmtBytes(info.size)} gzip≈${fmtBytes(gzipBytes)}`);
  const errors = [];
  if (info.size > maxBytes) errors.push(`${rel} size ${info.size} > ${maxBytes}`);
  if (gzipBytes > maxGzipBytes) errors.push(`${rel} gzip ${gzipBytes} > ${maxGzipBytes}`);
  return errors;
}

const MAX_BYTES = Number(process.env.MARKLY_EXTENSION_MAX_BYTES || 500 * 1024);
const MAX_GZIP_BYTES = Number(process.env.MARKLY_EXTENSION_MAX_GZIP_BYTES || 180 * 1024);
// Shiki 高亮器切片：导出/预览按需加载，不占扩展入口预算（见 resources/BUNDLE_GOVERNANCE.md）
const SHIKI_CHUNK = 'dist/extension/markly-code-highlight.cjs';
const SHIKI_MAX_BYTES = Number(process.env.MARKLY_EXTENSION_SHIKI_MAX_BYTES || 2.2 * 1024 * 1024);
const SHIKI_MAX_GZIP_BYTES = Number(process.env.MARKLY_EXTENSION_SHIKI_MAX_GZIP_BYTES || 300 * 1024);

console.log(
  '[bundle-check] M96: puppeteer 为 esbuild external；mermaid/shiki 为依赖，策略见 resources/BUNDLE_GOVERNANCE.md'
);

const errors = [];
errors.push(...(await checkFile('dist/extension/index.js', MAX_BYTES, MAX_GZIP_BYTES)));
errors.push(...(await checkFile(SHIKI_CHUNK, SHIKI_MAX_BYTES, SHIKI_MAX_GZIP_BYTES)));

if (errors.length) {
  console.error(`[bundle-check] FAIL: ${errors.join(', ')}`);
  process.exit(1);
}

console.log('[bundle-check] extension OK');
