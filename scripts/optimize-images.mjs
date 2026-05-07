import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

function fmtBytes(n) {
  if (!Number.isFinite(n)) return String(n);
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function listFilesRec(dir, exts) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listFilesRec(p, exts));
    else if (ent.isFile()) {
      const low = ent.name.toLowerCase();
      const dot = low.lastIndexOf('.');
      if (dot >= 0 && exts.has(low.slice(dot))) out.push(p);
    }
  }
  return out;
}

function copyFileSyncWithDirs(src, dst) {
  ensureDir(path.dirname(dst));
  fs.copyFileSync(src, dst);
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`command failed: ${cmd} ${args.join(' ')}`);
}

function getSize(p) {
  return fs.statSync(p).size;
}

/**
 * M299：批量优化/重压缩（可逆/备份）。
 *
 * 用法：
 * - node scripts/optimize-images.mjs                 # 默认优化 images/ 下的 png/svg
 * - node scripts/optimize-images.mjs <dir1> <dir2>  # 指定目录
 *
 * 原则：
 * - 只做“无损/近无损”的体积优化：PNG 走 oxipng（squoosh wasm），SVG 暂不重写（只计入清单）
 * - 优化前会把原文件备份到 tmp/image-opt-backup-<timestamp>/
 */
function main() {
  const repoRoot = process.cwd();
  const targets = process.argv.slice(2);
  const dirs = targets.length ? targets : ['images'];
  const exts = new Set(['.png', '.svg']);

  const files = [];
  for (const d of dirs) {
    const abs = path.isAbsolute(d) ? d : path.join(repoRoot, d);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) continue;
    files.push(...listFilesRec(abs, exts));
  }
  files.sort((a, b) => a.localeCompare(b));

  if (!files.length) {
    console.log('[image-opt] no files found.');
    return;
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupRoot = path.join(repoRoot, 'tmp', `image-opt-backup-${ts}`);
  ensureDir(backupRoot);

  const pngs = files.filter((p) => p.toLowerCase().endsWith('.png'));
  const svgs = files.filter((p) => p.toLowerCase().endsWith('.svg'));

  let before = 0;
  let after = 0;

  for (const p of files) {
    const rel = path.relative(repoRoot, p);
    const dst = path.join(backupRoot, rel);
    copyFileSyncWithDirs(p, dst);
    before += getSize(p);
  }

  if (pngs.length) {
    // 用 oxipng 做无损压缩（跨平台、稳定；避免 squoosh 在新 Node 上的 wasm URL 问题）
    const oxi = path.join(repoRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'oxipng.cmd' : 'oxipng');
    if (!fs.existsSync(oxi)) {
      throw new Error('[image-opt] oxipng not found. Run: npm install');
    }
    // -o 4：压缩等级（平衡速度/体积）
    // -i 0：不做 interlace 处理
    // --strip safe：移除安全的元数据
    run(oxi, ['-o', '4', '-i', '0', '--strip', 'safe', ...pngs.map((p) => path.relative(repoRoot, p))], {
      cwd: repoRoot,
    });
  }

  // SVG 暂不自动重写（避免格式化导致 diff 噪音/语义差异）；只做统计与备份

  for (const p of files) {
    after += getSize(p);
  }

  console.log(`[image-opt] files: ${files.length} (png: ${pngs.length}, svg: ${svgs.length})`);
  console.log(`[image-opt] backup: ${path.relative(repoRoot, backupRoot)}`);
  console.log(`[image-opt] before: ${fmtBytes(before)}`);
  console.log(`[image-opt] after : ${fmtBytes(after)}`);
  const saved = before - after;
  console.log(`[image-opt] saved : ${fmtBytes(saved)} (${((saved / before) * 100).toFixed(2)}%)`);
}

main();

