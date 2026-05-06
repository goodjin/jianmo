import { readdir, stat, readFile, mkdir, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const root = process.cwd();
const distWebview = path.join(root, 'dist', 'webview');
const distExtension = path.join(root, 'dist', 'extension', 'index.js');

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

function safeNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

async function readPkgVersion(p) {
  const raw = await readFile(p, 'utf-8');
  const j = JSON.parse(raw);
  return String(j?.version ?? '');
}

async function main() {
  const version = await readPkgVersion(path.join(root, 'package.json'));
  const webviewVersion = await readPkgVersion(path.join(root, 'webview', 'package.json'));

  const webviewFiles = await walk(distWebview);
  let webviewTotalBytes = 0;
  let webviewBiggest = { file: '', bytes: 0, gzipBytes: 0 };
  for (const f of webviewFiles) {
    const s = await stat(f);
    webviewTotalBytes += s.size;
    if (s.size > webviewBiggest.bytes) {
      const buf = await readFile(f);
      webviewBiggest = {
        file: path.relative(root, f),
        bytes: s.size,
        gzipBytes: gzipSync(buf).length,
      };
    }
  }

  const extStat = await stat(distExtension);
  const extGzipBytes = gzipSync(await readFile(distExtension)).length;

  const payload = {
    ts: new Date().toISOString(),
    version,
    webviewVersion,
    node: process.version,
    webview: {
      files: webviewFiles.length,
      totalBytes: webviewTotalBytes,
      biggestFile: webviewBiggest,
    },
    extension: {
      file: path.relative(root, distExtension),
      bytes: safeNumber(extStat.size),
      gzipBytes: safeNumber(extGzipBytes),
    },
  };

  await mkdir(path.join(root, 'tmp'), { recursive: true });
  const outPath = path.join(root, 'tmp', 'bundle-sizes.json');
  await writeFile(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf-8');
  console.log(`[record-bundle-sizes] wrote ${path.relative(root, outPath)}`);

  if (String(process.env.MARKLY_BUNDLE_HISTORY_APPEND || '').trim() === '1') {
    const histPath = path.join(root, 'resources', 'bundle-size-history.jsonl');
    await appendFile(histPath, JSON.stringify(payload) + '\n', 'utf-8');
    console.log(`[record-bundle-sizes] appended ${path.relative(root, histPath)}`);
  }
}

main().catch((err) => {
  console.error('[record-bundle-sizes] failed', err);
  process.exit(1);
});

