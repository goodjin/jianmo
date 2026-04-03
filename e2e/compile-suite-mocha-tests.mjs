import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const suiteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'suite');
const entries = fs
  .readdirSync(suiteDir)
  .filter((f) => f.endsWith('.test.ts'))
  .map((f) => path.join(suiteDir, f));

if (entries.length === 0) {
  console.log('[compile-suite] No *.test.ts files found:', suiteDir);
  process.exit(0);
}

console.log('[compile-suite] Compiling:');
for (const entry of entries) {
  const outFile = entry.replace(/\.ts$/, '.js');
  console.log(`- ${path.basename(entry)} -> ${path.basename(outFile)}`);
  await esbuild.build({
    entryPoints: [entry],
    outfile: outFile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'es2022',
    sourcemap: false,
    logLevel: 'silent',
    external: [
      // vscode 运行在 VS Code 扩展主机环境，构建脚本本地无法解析它
      'vscode',
    ],
  });
}

console.log('[compile-suite] Done.');

