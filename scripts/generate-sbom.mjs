import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    const err = (r.stderr || '').trim();
    // npm sbom 可能因依赖树不一致（ESBOMPROBLEMS）退出非 0，但 stdout 仍可能包含可用的 SBOM。
    // 我们选择“尽量产出”，并把 stderr 写入旁路文件供审计。
    return { ok: false, stdout: r.stdout || '', stderr: err };
  }
  return { ok: true, stdout: r.stdout || '', stderr: (r.stderr || '').trim() };
}

function tsSlug() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * M301：依赖供应链 SBOM（可选）
 *
 * - 生成 CycloneDX JSON（来自 `npm sbom --json`）
 * - 默认输出到 `tmp/sbom/<timestamp>/`，避免仓库膨胀
 */
function main() {
  const repoRoot = process.cwd();
  const outDir = path.join(repoRoot, 'tmp', 'sbom', tsSlug());
  ensureDir(outDir);

  const targets = [
    { name: 'root', cwd: repoRoot, out: 'sbom-root.cyclonedx.json' },
    { name: 'webview', cwd: path.join(repoRoot, 'webview'), out: 'sbom-webview.cyclonedx.json' },
  ];

  for (const t of targets) {
    const r = run('npm', ['sbom', '--sbom-format', 'cyclonedx', '--json'], t.cwd);
    const outPath = path.join(outDir, t.out);
    if (r.stdout && r.stdout.trim().length > 0) {
      fs.writeFileSync(outPath, r.stdout, 'utf8');
      // eslint-disable-next-line no-console
      console.log(`[sbom] wrote ${t.name}: ${path.relative(repoRoot, outPath)}${r.ok ? '' : ' (with warnings)'}`);
    } else {
      throw new Error(`[sbom] no SBOM output produced for ${t.name}`);
    }
    if (r.stderr) {
      fs.writeFileSync(outPath.replace(/\.json$/, '.errors.txt'), r.stderr + '\n', 'utf8');
    }
  }
}

main();

