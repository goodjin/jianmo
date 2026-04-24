import { readdir, stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const root = process.cwd();
const dist = path.join(root, 'dist', 'webview');

async function walk(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

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

const MAX_FILES = Number(process.env.MARKLY_WEBVIEW_MAX_FILES || 140);
const MAX_TOTAL_BYTES = Number(process.env.MARKLY_WEBVIEW_MAX_TOTAL_BYTES || 18 * 1024 * 1024);
const MAX_BIGGEST_FILE_BYTES = Number(process.env.MARKLY_WEBVIEW_MAX_BIGGEST_FILE_BYTES || 11 * 1024 * 1024);
/** 最大单文件 gzip 体积（防止 shiki-vendor 等回归） */
const MAX_BIGGEST_GZIP_BYTES = Number(
  process.env.MARKLY_WEBVIEW_MAX_BIGGEST_GZIP_BYTES || 2.5 * 1024 * 1024
);

const files = await walk(dist);
let total = 0;
let biggest = { file: '', bytes: 0, gzip: 0 };
for (const f of files) {
  const s = await stat(f);
  total += s.size;
  if (s.size > biggest.bytes) {
    const buf = await readFile(f);
    const gz = gzipSync(buf).length;
    biggest = { file: path.relative(root, f), bytes: s.size, gzip: gz };
  }
}

const relDist = path.relative(root, dist);
console.log(
  `[bundle-check] ${relDist}: files=${files.length}, total=${fmtBytes(total)}, biggest=${fmtBytes(
    biggest.bytes
  )} gzip≈${fmtBytes(biggest.gzip)} (${biggest.file})`
);

const errors = [];
if (files.length > MAX_FILES) errors.push(`files ${files.length} > ${MAX_FILES}`);
if (total > MAX_TOTAL_BYTES) errors.push(`total ${total} > ${MAX_TOTAL_BYTES}`);
if (biggest.bytes > MAX_BIGGEST_FILE_BYTES) errors.push(`biggest ${biggest.bytes} > ${MAX_BIGGEST_FILE_BYTES}`);
if (biggest.gzip > MAX_BIGGEST_GZIP_BYTES) errors.push(`biggestGzip ${biggest.gzip} > ${MAX_BIGGEST_GZIP_BYTES}`);

if (errors.length) {
  console.error(`[bundle-check] FAIL: ${errors.join(', ')}`);
  process.exit(1);
}
console.log('[bundle-check] OK');

