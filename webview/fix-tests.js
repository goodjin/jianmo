const fs = require('fs');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');

  // Add import if missing
  if (!content.includes('withSetup')) {
    content = content.replace(
      /import \{.*\} from '\.\.\/use\w+';/,
      match => `${match}\nimport { withSetup } from '../../utils/testUtils';`
    );
  }

  // Replace one-line hook calls
  content = content.replace(/const (\{[^}]+\}) = (use\w+\([^)]*\));/g, 'const { result: $1, wrapper } = withSetup(() => $2);');

  // Replace multi-line hook calls (like useTheme({ ... }))
  // We can just match use\w+\([\s\S]*?\) that are assigned to const
  content = content.replace(/const (\{[^}]+\}) = (use\w+\(\{[\s\S]*?\}\));/g, 'const { result: $1, wrapper } = withSetup(() => $2);');

  // For useEditor that doesn't have args or has simple args, the first regex covers it.
  
  // also for calls where we didn't extract const
  // eg. useTheme({ defaultTheme: 'auto' });
  content = content.replace(/^( {4,6})(use\w+\([^)]*\));$/gm, '$1withSetup(() => $2);');

  fs.writeFileSync(filePath, content);
}

processFile('src/composables/__tests__/useEditor.test.ts');
processFile('src/composables/__tests__/useTheme.test.ts');
processFile('src/composables/__tests__/useVSCode.test.ts');

console.log("Done");
