const fs = require('fs');
let content = fs.readFileSync('src/composables/__tests__/useEditor.test.ts', 'utf-8');

if (!content.includes('Range.prototype.getClientRects')) {
  content = content.replace(
    /\/\/ Mock CodeMirror DOM APIs/,
    `// Mock CodeMirror DOM APIs
if (typeof Range !== 'undefined') {
  Range.prototype.getClientRects = () => [] as any;
  Range.prototype.getBoundingClientRect = () => ({ right: 0, bottom: 0, left: 0, top: 0, width: 0, height: 0, x: 0, y: 0 } as any);
}`
  );
}

fs.writeFileSync('src/composables/__tests__/useEditor.test.ts', content);
