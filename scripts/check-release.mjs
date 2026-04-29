#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const rootPkgPath = path.join(root, 'package.json');
const webviewPkgPath = path.join(root, 'webview', 'package.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

const rootPkg = readJson(rootPkgPath);
const webviewPkg = readJson(webviewPkgPath);
const errors = [];

if (rootPkg.version !== webviewPkg.version) {
  errors.push(`root package.json version (${rootPkg.version}) must match webview/package.json version (${webviewPkg.version})`);
}

if (!/^\d+\.\d+\.\d+$/.test(rootPkg.version)) {
  errors.push(`package version must be SemVer MAJOR.MINOR.PATCH, got ${rootPkg.version}`);
}

if (!rootPkg.repository || typeof rootPkg.repository.url !== 'string' || !rootPkg.repository.url.trim()) {
  errors.push('package.json repository.url is required for release metadata');
}

if (!rootPkg.bugs || typeof rootPkg.bugs.url !== 'string' || !rootPkg.bugs.url.trim()) {
  errors.push('package.json bugs.url is required for feedback routing');
}

if (!rootPkg.engines || typeof rootPkg.engines.vscode !== 'string' || !rootPkg.engines.vscode.trim()) {
  errors.push('package.json engines.vscode is required');
}

const expectedVsix = `${rootPkg.name}-${rootPkg.version}.vsix`;
const vsixFiles = fs.readdirSync(root).filter((name) => name.endsWith('.vsix'));
if (vsixFiles.length > 0 && !vsixFiles.includes(expectedVsix)) {
  errors.push(`expected ${expectedVsix} when VSIX files exist; found ${vsixFiles.join(', ')}`);
}

if (errors.length) {
  console.error('[check-release] failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`[check-release] ok: version ${rootPkg.version}`);

