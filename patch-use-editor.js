const fs = require('fs');
let content = fs.readFileSync('webview/src/composables/useEditor.ts', 'utf-8');

if (!content.includes('updateListener')) {
  content = content.replace(
    /const state = createEditorState\(\s*options\.initialContent \|\| '',\s*mode\.value\s*\);/,
    `const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && options.onChange) {
        options.onChange(update.state.doc.toString());
      }
    });

    const state = createEditorState(
      options.initialContent || '',
      mode.value,
      [updateListener]
    );`
  );
  
  // also need to do it in switchMode
  content = content.replace(
    /const newState = createEditorState\(currentContent, newMode\);/,
    `const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && options.onChange) {
        options.onChange(update.state.doc.toString());
      }
    });
    const newState = createEditorState(currentContent, newMode, [updateListener]);`
  );

  fs.writeFileSync('webview/src/composables/useEditor.ts', content);
}
