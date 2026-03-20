const fs = require('fs');
let content = fs.readFileSync('webview/src/App.vue', 'utf-8');

// replace const vscode = (window as any).vscode; with useVSCode
content = content.replace(
  /const vscode = \(window as any\)\.vscode;/,
  `import { useVSCode } from './composables/useVSCode';
const { postMessage } = useVSCode();`
);

content = content.replace(
  /function sendMessage\(message: any\) \{\n\s+vscode\.postMessage\(message\);\n\}/,
  `function sendMessage(message: any) {
  postMessage(message);
}`
);

fs.writeFileSync('webview/src/App.vue', content);
