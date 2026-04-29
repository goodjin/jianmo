#!/usr/bin/env node
import { stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const root = process.cwd();
const bundle = path.join(root, 'dist', 'extension', 'index.js');

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

const MAX_BYTES = Number(process.env.MARKLY_EXTENSION_MAX_BYTES || 500 * 1024);
const MAX_GZIP_BYTES = Number(process.env.MARKLY_EXTENSION_MAX_GZIP_BYTES || 180 * 1024);

const info = await stat(bundle);
const gzipBytes = gzipSync(await readFile(bundle)).length;
const rel = path.relative(root, bundle);

console.log(`[bundle-check] ${rel}: size=${fmtBytes(info.size)} gzip≈${fmtBytes(gzipBytes)}`);

const errors = [];
if (info.size > MAX_BYTES) errors.push(`size ${info.size} > ${MAX_BYTES}`);
if (gzipBytes > MAX_GZIP_BYTES) errors.push(`gzip ${gzipBytes} > ${MAX_GZIP_BYTES}`);

if (errors.length) {
  console.error(`[bundle-check] FAIL: ${errors.join(', ')}`);
  process.exit(1);
}

console.log('[bundle-check] extension OK');

