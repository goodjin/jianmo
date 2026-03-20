const fs = require('fs');
let content = fs.readFileSync('e2e/webview.e2e.spec.ts', 'utf-8');

content = content.replace(
  /expect\(content\)\.toContain\('\[\]\(https:\/\/\)'\);/,
  `expect(content).toContain('[链接文字](https://example.com)');`
);

content = content.replace(
  /expect\(content\)\.toContain\('\| Header 1 \|'\);\n\s*expect\(content\)\.toContain\('\| -------- \|'\);/,
  `expect(content).toContain('| 列1 | 列2 | 列3 |');
      expect(content).toContain('|-----|-----|-----|');`
);

// fix word count expectations
// 'Hello world! 测试字数' has "Hello" (1) "world" (1) "测试字数" (4) = 6 words.
// Length is "Hello world! 测试字数".length => 5+1+5+1+4 = 16? 
// Wait: "Hello world! 测试字数"
// H e l l o (5) + ' ' (1) + w o r l d ! (6) + ' ' (1) + 测 试 字 数 (4) = 17 characters!
content = content.replace(
  /expect\(wordCountText\)\.toContain\('字符: 18'\); \/\/ 'Hello world! 测试字数'\.length is 18/,
  `expect(wordCountText).toContain('字符: 17');`
);

// Fix outline toggle 
// outline only shows when mode is 'preview'
content = content.replace(
  /test\('should toggle outline panel', async \(\{ page \}\) => \{/,
  `test('should toggle outline panel', async ({ page }) => {
      // Switch to preview mode to see outline
      await page.locator('.toolbar-btn[title="Preview Mode"]').click();`
);

fs.writeFileSync('e2e/webview.e2e.spec.ts', content);
