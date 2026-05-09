import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildManualFixtureMarkdown } from './manual-fixture-content.mjs';

function mkdirp(p) {
  if (fs.existsSync(p)) return;
  fs.mkdirSync(p, { recursive: true });
}

function writeUtf8(filePath, content) {
  mkdirp(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

function main() {
  const repoRoot = process.cwd();
  const fixtureRoot = path.join(repoRoot, 'e2e', 'ui-suite', 'fixture-workspace');
  const mdPath = path.join(fixtureRoot, 'manual-rich.md');

  writeUtf8(mdPath, buildManualFixtureMarkdown());

  const rel = path.relative(repoRoot, mdPath);
  // eslint-disable-next-line no-console
  console.log(`[Markly] manual fixture written: ${rel}`);

  // Try to open VS Code if `code` exists.
  const which = spawnSync('sh', ['-lc', 'command -v code'], { encoding: 'utf8' });
  const codeBin = String(which.stdout || '').trim();
  if (!codeBin) {
    // eslint-disable-next-line no-console
    console.log('[Markly] VS Code CLI `code` not found. Please open the file manually in VS Code:');
    // eslint-disable-next-line no-console
    console.log(mdPath);
    return;
  }

  // Open the fixture workspace folder, then reveal the file.
  spawnSync(codeBin, ['-n', fixtureRoot, mdPath], { stdio: 'inherit' });
}

main();

