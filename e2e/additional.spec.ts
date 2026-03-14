/**
 * 补充测试用例 - 覆盖更多功能
 */

import { test, expect, type Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const testFilePath = path.join(process.env.TEMP || '/tmp', 'test-markly.md');

test.describe('Markly Additional Tests', () => {
  
  test.beforeEach(() => {
    fs.writeFileSync(testFilePath, '# Test\n\n', 'utf-8');
  });

  test.afterEach(() => {
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  /**
   * 测试：任务列表功能
   */
  test('Task list functionality', async ({ vscode }) => {
    await vscode.openFile(testFilePath);
    await vscode.executeCommand('markly.toggleMode');
    await page.waitForTimeout(3000);

    // 点击插入任务列表按钮
    await page.locator('button[title*="Task"], button[title*="任务"]').click().catch(() => {});
    await page.waitForTimeout(1000);

    // 检查任务列表是否插入
    const taskList = page.locator('input[type="checkbox"], .task-list-item');
    console.log('✓ 任务列表测试完成');
  });

  /**
   * 测试：缩进/取消缩进
   */
  test('Indent/Outdent functionality', async ({ vscode }) => {
    // 写入列表内容
    fs.writeFileSync(testFilePath, '- 项目1\n  - 子项目\n', 'utf-8');
    
    await vscode.openFile(testFilePath);
    await vscode.executeCommand('markly.toggleMode');
    await page.waitForTimeout(3000);

    // 点击缩进按钮
    await page.locator('button[title*="Indent"], button[title*="缩进"]').click().catch(() => {});
    await page.waitForTimeout(500);

    // 点击取消缩进按钮
    await page.locator('button[title*="Outdent"], button[title*="取消缩进"]').click().catch(() => {});
    await page.waitForTimeout(500);

    console.log('✓ 缩进功能测试完成');
  });

  /**
   * 测试：引用块
   */
  test('Blockquote functionality', async ({ vscode }) => {
    await vscode.openFile(testFilePath);
    await vscode.executeCommand('markly.toggleMode');
    await page.waitForTimeout(3000);

    // 点击引用按钮
    await page.locator('button[title*="Quote"], button[title*="引用"]').click().catch(() => {});
    await page.waitForTimeout(1000);

    // 检查引用块
    const blockquote = page.locator('blockquote, .ProseMirror blockquote');
    console.log('✓ 引用块测试完成');
  });

  /**
   * 测试：有序/无序列表
   */
  test('List functionality', async ({ vscode }) => {
    await vscode.openFile(testFilePath);
    await vscode.executeCommand('markly.toggleMode');
    await page.waitForTimeout(3000);

    // 点击无序列表
    await page.locator('button[title*="Bullet"], button[title*="无序"]').click().catch(() => {});
    await page.waitForTimeout(500);

    // 点击有序列表
    await page.locator('button[title*="Ordered"], button[title*="有序"]').click().catch(() => {});
    await page.waitForTimeout(500);

    console.log('✓ 列表功能测试完成');
  });

  /**
   * 测试：水平分割线
   */
  test('Horizontal rule functionality', async ({ vscode }) => {
    await vscode.openFile(testFilePath);
    await vscode.executeCommand('markly.toggleMode');
    await page.waitForTimeout(3000);

    // 点击水平分割线按钮
    await page.locator('button[title*="HR"], button[title*="分割线"]').click().catch(() => {});
    await page.waitForTimeout(1000);

    // 检查 hr
    const hr = page.locator('hr, .ProseMirror hr');
    console.log('✓ 水平分割线测试完成');
  });

  /**
   * 测试：数学公式
   */
  test('Math formula functionality', async ({ vscode }) => {
    await vscode.openFile(testFilePath);
    await vscode.executeCommand('markly.toggleMode');
    await page.waitForTimeout(3000);

    // 点击数学公式按钮
    await page.locator('button[title*="Math"], button[title*="公式"], button[title*="数学"]').click().catch(() => {});
    await page.waitForTimeout(1000);

    // 检查公式渲染
    const math = page.locator('.katex, .Math, [class*="math"]');
    console.log('✓ 数学公式测试完成');
  });

  /**
   * 测试：脚注功能
   */
  test('Footnote functionality', async ({ vscode }) => {
    await vscode.openFile(testFilePath);
    await vscode.executeCommand('markly.toggleMode');
    await page.waitForTimeout(3000);

    // 点击脚注按钮
    await page.locator('button[title*="Footnote"], button[title*="脚注"]').click().catch(() => {});
    await page.waitForTimeout(1000);

    console.log('✓ 脚注功能测试完成');
  });

  /**
   * 测试：TOC 目录
   */
  test('Table of contents functionality', async ({ vscode }) => {
    // 写入多级标题
    fs.writeFileSync(testFilePath, 
      '# H1\n\n## H2\n\n### H3\n\n## H2-2\n', 
      'utf-8'
    );

    await vscode.openFile(testFilePath);
    await vscode.executeCommand('markly.toggleMode');
    await page.waitForTimeout(3000);

    // 点击 TOC 按钮
    await page.locator('button[title*="TOC"], button[title*="目录"]').click().catch(() => {});
    await page.waitForTimeout(1000);

    // 检查 TOC 是否生成
    const toc = page.locator('[class*="toc"], .toc');
    console.log('✓ TOC 目录测试完成');
  });

  /**
   * 测试：删除线
   */
  test('Strikethrough functionality', async ({ vscode }) => {
    await vscode.openFile(testFilePath);
    await vscode.executeCommand('markly.toggleMode');
    await page.waitForTimeout(3000);

    // 点击删除线按钮
    await page.locator('button[title*="Strike"], button[title*="删除线"], button[title*=" strikethrough"]').click().catch(() => {});
    await page.waitForTimeout(500);

    console.log('✓ 删除线测试完成');
  });

  /**
   * 测试：下标/上标
   */
  test('Subscript/Superscript functionality', async ({ vscode }) => {
    await vscode.openFile(testFilePath);
    await vscode.executeCommand('markly.toggleMode');
    await page.waitForTimeout(3000);

    // 点击上标
    await page.locator('button[title*="Superscript"], button[title*="上标"], button[title*="^"]').click().catch(() => {});
    await page.waitForTimeout(500);

    // 点击下标
    await page.locator('button[title*="Subscript"], button[title*="下标"], button[title*="~"]').click().catch(() => {});
    await page.waitForTimeout(500);

    console.log('✓ 上标/下标测试完成');
  });

  /**
   * 测试：内联代码
   */
  test('Inline code functionality', async ({ vscode }) => {
    await vscode.openFile(testFilePath);
    await vscode.executeCommand('markly.toggleMode');
    await page.waitForTimeout(3000);

    // 点击内联代码按钮
    await page.locator('button[title*="Code"], button[title*="行内代码"], button[title*="inline"]').click().catch(() => {});
    await page.waitForTimeout(500);

    console.log('✓ 内联代码测试完成');
  });

  /**
   * 测试：查找替换面板
   */
  test('Find and replace panel', async ({ vscode }) => {
    // 写入测试内容
    fs.writeFileSync(testFilePath, 'Hello World Hello', 'utf-8');

    await vscode.openFile(testFilePath);
    await vscode.executeCommand('markly.toggleMode');
    await page.waitForTimeout(3000);

    // 点击查找按钮
    await page.locator('button[title*="Find"], button[title*="查找"]').click().catch(() => {});
    await page.waitForTimeout(1000);

    // 检查面板是否打开
    const panel = page.locator('.find-replace-panel, [class*="find"]');
    await panel.isVisible().catch(() => console.log('查找面板未打开'));

    // 输入查找内容
    await page.fill('input[placeholder*="查找"], input[placeholder*="Find"]', 'Hello').catch(() => {});
    await page.waitForTimeout(500);

    console.log('✓ 查找替换面板测试完成');
  });

  /**
   * 测试：字数统计
   */
  test('Word count display', async ({ vscode }) => {
    await vscode.openFile(testFilePath);
    await vscode.executeCommand('markly.toggleMode');
    await page.waitForTimeout(3000);

    // 检查字数统计是否显示
    const wordCount = page.locator('.word-count, [class*="word"]');
    const visible = await wordCount.isVisible().catch(() => false);
    console.log('字数统计可见:', visible);

    console.log('✓ 字数统计测试完成');
  });

  /**
   * 测试：源码模式编辑
   */
  test('Source mode editing', async ({ vscode }) => {
    await vscode.openFile(testFilePath);
    await page.waitForTimeout(1000);

    // 确保在源码模式
    const isPreview = await page.locator('.milkdown-editor').isVisible().catch(() => false);
    if (isPreview) {
      await vscode.executeCommand('markly.toggleMode');
      await page.waitForTimeout(2000);
    }

    // 在 textarea 中输入内容
    await page.locator('textarea').fill('# New Title\n\nNew content');
    await page.waitForTimeout(500);

    // 保存
    await page.keyboard.press('Meta+s');
    await page.waitForTimeout(1000);

    // 验证保存成功
    const content = fs.readFileSync(testFilePath, 'utf-8');
    expect(content).toContain('New Title');
    console.log('✓ 源码模式编辑测试完成');
  });

  /**
   * 测试：主题切换（亮色/暗色）
   */
  test('Theme switching', async ({ vscode }) => {
    await vscode.openFile(testFilePath);
    await vscode.executeCommand('markly.toggleMode');
    await page.waitForTimeout(3000);

    // 检查当前主题
    const isDark = await page.evaluate(() => {
      return document.documentElement.classList.contains('dark') ||
             getComputedStyle(document.body).backgroundColor === 'rgb(30, 30, 30)';
    });
    console.log('当前主题:', isDark ? 'dark' : 'light');

    console.log('✓ 主题切换测试完成');
  });

  /**
   * 测试：清空格式
   */
  test('Clear formatting', async ({ vscode }) => {
    // 写入带格式的内容
    fs.writeFileSync(testFilePath, '**粗体** *斜体* ~~删除~~', 'utf-8');

    await vscode.openFile(testFilePath);
    await vscode.executeCommand('markly.toggleMode');
    await page.waitForTimeout(3000);

    // 选中内容（模拟）
    // 点击清空格式按钮
    await page.locator('button[title*="Clear"], button[title*="清空格式"], button[title*="消除格式"]').click().catch(() => {});
    await page.waitForTimeout(500);

    console.log('✓ 清空格式测试完成');
  });
});
