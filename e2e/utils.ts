/**
 * VS Code Playwright Helper
 * 提供 VS Code 扩展测试的辅助功能
 */

import { test as base, type Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

/**
 * 扩展测试 fixture
 * 提供 VS Code 特定的测试功能
 */
export const test = base.extend({
  vscode: async ({ page }, use) => {
    const vscodeHelper = new VSCodeHelper(page);
    await use(vscodeHelper);
  },
});

/**
 * VS Code 辅助类
 */
class VSCodeHelper {
  constructor(private page: Page) {}

  /**
   * 打开文件
   */
  async openFile(filePath: string): Promise<void> {
    // 使用 VS Code 命令打开文件
    await this.page.goto(`vscode://file${filePath}`);
    await this.page.waitForTimeout(2000);
  }

  /**
   * 执行 VS Code 命令
   */
  async executeCommand(command: string): Promise<void> {
    // 通过键盘快捷键或 API 执行命令
    // 注意：在真实 VS Code 环境中，需要使用 vscode.executeCommand
    await this.page.evaluate((cmd) => {
      // 尝试调用 VS Code API
      (window as any).acquireVsCodeApi?.().postMessage({
        type: 'executeCommand',
        command: cmd,
      });
    }, command);
    
    await this.page.waitForTimeout(500);
  }

  /**
   * 获取当前活动编辑器
   */
  async getActiveEditor(): Promise<string> {
    return await this.page.evaluate(() => {
      // 返回当前编辑器类型
      const editor = document.querySelector('.monaco-editor');
      return editor ? 'monaco' : 'unknown';
    });
  }

  /**
   * 等待编辑器加载
   */
  async waitForEditor(timeout: number = 5000): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const hasEditor = await this.page.evaluate(() => {
        return !!(
          document.querySelector('.monaco-editor') ||
          document.querySelector('.milkdown-editor') ||
          document.querySelector('.ProseMirror') ||
          document.querySelector('textarea')
        );
      });
      if (hasEditor) return true;
      await this.page.waitForTimeout(500);
    }
    return false;
  }

  /**
   * 获取 WebView 标题
   */
  async getWebViewTitle(): Promise<string> {
    return await this.page.title();
  }
}

/**
 * 创建测试 Markdown 文件
 */
export function createTestMarkdown(content: string): string {
  const tempDir = process.env.TEMP || '/tmp';
  const filePath = path.join(tempDir, `test-${Date.now()}.md`);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

/**
 * 清理测试文件
 */
export function cleanupTestFile(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * 测试数据生成器
 */
export const testData = {
  /**
   * 生成包含各种 Markdown 元素的测试内容
   */
  fullMarkdown: () => `
# 标题 1

这是第一个段落的文本。

## 标题 2

- 列表项 1
- 列表项 2
- 列表项 3

### 标题 3

\`\`\`javascript
function hello() {
  console.log('Hello World');
}
\`\`\`

| 列1 | 列2 | 列3 |
|-----|-----|-----|
| A   | B   | C   |
| D   | E   | F   |

> 这是一个引用块

[链接文本](https://example.com)

![图片描述](image.png)

$$E = mc^2$$

[^1]: 这是脚注内容

[^1]: 脚注引用
`,

  /**
   * 生成仅包含标题的测试内容（用于大纲测试）
   */
  headingsOnly: () => `
# 标题 1

## 标题 2

### 标题 3

#### 标题 4

##### 标题 5

###### 标题 6
`,

  /**
   * 生成仅包含表格的测试内容
   */
  tablesOnly: () => `
| A | B | C |
|---|---|---|
| 1 | 2 | 3 |

| 甲 | 乙 | 丙 |
|:---|:---:|---:|
| 左 | 中 | 右 |
`,

  /**
   * 生成空文件
   */
  empty: () => '',
};

export { VSCodeHelper };
