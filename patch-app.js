const fs = require('fs');
let content = fs.readFileSync('/Users/jin/github/jianmo/webview/src/App.vue', 'utf-8');

// 1. Add createEditor call
content = content.replace(
  /if \(editorContainerRef\.value\) \{\n\s+editorContainerRef\.value\.addEventListener\('click'/g,
  `if (editorContainerRef.value) {
    editor.createEditor(editorContainerRef.value);
    editorContainerRef.value.addEventListener('click'`
);

// 2. Fix editorRef.value to editor
content = content.replace(/editorRef\.value\?/g, 'editor');

fs.writeFileSync('/Users/jin/github/jianmo/webview/src/App.vue', content);
