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

try {
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
  const out = {
    dist: path.relative(root, dist),
    fileCount: files.length,
    totalBytes: total,
    biggestFile: biggest.file,
    biggestFileBytes: biggest.bytes,
    biggestFileGzipBytes: biggest.gzip,
    at: new Date().toISOString(),
  };
  console.log('[m8-baseline]', JSON.stringify(out, null, 2));
  console.log(
    `[m8-baseline] files=${out.fileCount} total=${fmtBytes(out.totalBytes)} biggest=${fmtBytes(
      out.biggestFileBytes
    )} gzip≈${fmtBytes(out.biggestFileGzipBytes)} (${out.biggestFile})`
  );
} catch (e) {
  console.error('[m8-baseline] ERROR: run `npm run build:webview` first. ', e?.message || e);
  process.exit(1);
}
