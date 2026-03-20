const fs = require('fs');
let content = fs.readFileSync('webview/src/composables/useEditor.ts', 'utf-8');

// Fix import
content = content.replace(
  /import type \{ EditorView \} from '@codemirror\/view';/,
  `import { EditorView } from '@codemirror/view';`
);

fs.writeFileSync('webview/src/composables/useEditor.ts', content);
