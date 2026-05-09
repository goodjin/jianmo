import fs from 'fs';
import path from 'path';

function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyFile(src, dest) {
  const buf = fs.readFileSync(src);
  fs.writeFileSync(dest, buf);
}

function main() {
  const root = process.cwd();
  const outDir = path.join(root, 'resources');
  const outFile = path.join(outDir, 'mermaid.min.js');

  const candidates = [
    path.join(root, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js'),
    path.join(root, 'node_modules', 'mermaid', 'dist', 'mermaid.js'),
  ];

  const src = candidates.find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
  if (!src) {
    console.error('[Markly] prepare-mermaid-runtime: mermaid dist file not found. Did you run npm ci?');
    process.exit(1);
  }

  mkdirp(outDir);
  copyFile(src, outFile);

  const size = fs.statSync(outFile).size;
  // eslint-disable-next-line no-console
  console.log(`[Markly] prepare-mermaid-runtime: wrote ${path.relative(root, outFile)} (${size} bytes) from ${path.relative(root, src)}`);
}

main();

