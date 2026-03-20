const fs = require('fs');
let content = fs.readFileSync('src/composables/__tests__/useTheme.test.ts', 'utf-8');

// Replace stubGlobal('document' ...) with manual mocking
content = content.replace(/vi\.stubGlobal\('document'[\s\S]*?\}\);/, `
    // Don't stub whole document, just mock documentElement methods
    const originalSetProperty = document.documentElement.style.setProperty;
    const originalSetAttribute = document.documentElement.setAttribute;
    document.documentElement.style.setProperty = vi.fn();
    document.documentElement.setAttribute = vi.fn();
`);

content = content.replace(/vi\.unstubAllGlobals\(\);/g, `vi.unstubAllGlobals();
    // we should restore document properties actually, wait, we can just do that in afterEach`);

fs.writeFileSync('src/composables/__tests__/useTheme.test.ts', content);
