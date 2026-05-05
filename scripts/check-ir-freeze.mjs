#!/usr/bin/env node
/**
 * IR freeze gate: forbid silent changes to CM6 decorator modules under webview/src/core/decorators.
 * See docs/IR_FREEZE_POLICY.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const decoratorsDir = path.join(repoRoot, 'webview/src/core/decorators');
const baselinePath = path.join(__dirname, 'ir-freeze-decorators-baseline.json');

function main() {
  if (!fs.existsSync(decoratorsDir)) {
    console.error('IR freeze check: decorators directory missing:', decoratorsDir);
    process.exit(1);
  }
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const expected = Number(baseline.decoratorTsCount);
  if (!Number.isFinite(expected)) {
    console.error('IR freeze check: invalid decoratorTsCount in baseline');
    process.exit(1);
  }

  const files = fs.readdirSync(decoratorsDir).filter((name) => name.endsWith('.ts')).sort();

  const count = files.length;
  if (count !== expected) {
    console.error(`IR freeze: decorator *.ts count is ${count}, baseline expects ${expected}.`);
    console.error('Files:', files.join(', ') || '(none)');
    console.error('If intentional, update scripts/ir-freeze-decorators-baseline.json with maintainer sign-off.');
    process.exit(1);
  }

  console.log(`IR freeze check OK (decorators: ${count} modules)`);
}

main();
