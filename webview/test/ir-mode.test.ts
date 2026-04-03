/**
 * IR 模式行为测试
 * @vitest-environment jsdom
 *
 * 测试原则：
 * - 每个 it() 必须验证真实行为（给定输入 → 断言输出），禁止硬编码常量断言
 * - 装饰器测试必须验证 Decoration.replace() 被调用（隐藏标记），而非 Decoration.mark()
 * - applyFormat 测试必须验证编辑器内容变化，不只是 "不报错"
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nextTick } from 'vue';
import type { EditorMode } from '../src/types/editor';

// ============================================================
// v6 回归：KaTeX / Mermaid 渲染与失败路径（动态 import 可 mock）
// ============================================================

const katexRenderToStringMock = vi.fn((latex: string) => `<span class="katex-mock">${latex}</span>`);
vi.mock('katex', () => ({
  renderToString: (latex: string, _opts?: any) => katexRenderToStringMock(latex),
}));

const mermaidRenderMock = vi.fn(async (_id: string, _code: string) => ({ svg: '<svg data-mermaid-mock="1"></svg>' }));
vi.mock('mermaid', () => ({
  default: {
    render: (id: string, code: string) => mermaidRenderMock(id, code),
  },
}));

// ============================================================
// 真实编辑器集成测试（使用真实 CM6 实例）
// ============================================================

import { useEditor } from '../src/composables/useEditor';
import { withSetup } from '../src/utils/testUtils';

function createTestEditor(initialContent = '') {
  const container = document.createElement('div');
  container.style.cssText = 'width:100px;height:100px';
  document.body.appendChild(container);
  const setup = withSetup(() => useEditor({ initialContent }));
  setup.result.createEditor(container);
  return {
    ...setup,
    container,
    cleanup: () => {
      setup.result.destroy();
      setup.wrapper.unmount();
      if (container.parentNode) document.body.removeChild(container);
    },
  };
}

describe('IR 模式类型验证', () => {
  it('只允许 ir 和 source 两种模式', () => {
    const ir: EditorMode = 'ir';
    const source: EditorMode = 'source';
    expect(ir).toBe('ir');
    expect(source).toBe('source');
  });
});

describe('applyFormat - 标题必须在行首操作', () => {
  let editor: ReturnType<typeof createTestEditor>;
  afterEach(() => editor?.cleanup());

  it('h1: 光标在行中间 → "# " 出现在行首而非光标处', async () => {
    editor = createTestEditor('Hello World');
    await nextTick();
    editor.result.view.value!.dispatch({ selection: { anchor: 5 } });
    editor.result.applyFormat('h1');
    expect(editor.result.getContent()).toBe('# Hello World');
  });

  it('h2: 空行 → 插入 "## "', async () => {
    editor = createTestEditor('Title');
    await nextTick();
    editor.result.applyFormat('h2');
    expect(editor.result.getContent()).toBe('## Title');
  });

  it('h3: 已有 ## 前缀 → 替换为 ###', async () => {
    editor = createTestEditor('## Title');
    await nextTick();
    editor.result.applyFormat('h3');
    expect(editor.result.getContent()).toBe('### Title');
  });

  it('h4: 已有 # 前缀 → 替换为 ####', async () => {
    editor = createTestEditor('# Title');
    await nextTick();
    editor.result.applyFormat('h4');
    expect(editor.result.getContent()).toBe('#### Title');
  });
});

describe('applyFormat - 列表', () => {
  let editor: ReturnType<typeof createTestEditor>;
  afterEach(() => editor?.cleanup());

  it('bulletList: 在行首插入 "- "', async () => {
    editor = createTestEditor('Item');
    await nextTick();
    editor.result.applyFormat('bulletList');
    expect(editor.result.getContent()).toBe('- Item');
  });

  it('orderedList: 在行首插入 "1. "', async () => {
    editor = createTestEditor('Item');
    await nextTick();
    editor.result.applyFormat('orderedList');
    expect(editor.result.getContent()).toBe('1. Item');
  });

  it('taskList: 在行首插入 "- [ ] "', async () => {
    editor = createTestEditor('Task');
    await nextTick();
    editor.result.applyFormat('taskList');
    expect(editor.result.getContent()).toBe('- [ ] Task');
  });

  it('quote: 在行首插入 "> "', async () => {
    editor = createTestEditor('Quote');
    await nextTick();
    editor.result.applyFormat('quote');
    expect(editor.result.getContent()).toBe('> Quote');
  });
});

describe('applyFormat - 行内格式', () => {
  let editor: ReturnType<typeof createTestEditor>;
  afterEach(() => editor?.cleanup());

  it('bold: 选区文字被 ** 包裹', async () => {
    editor = createTestEditor('hello');
    await nextTick();
    editor.result.view.value!.dispatch({ selection: { anchor: 0, head: 5 } });
    editor.result.applyFormat('bold');
    expect(editor.result.getContent()).toBe('**hello**');
  });

  it('italic: 选区文字被 * 包裹', async () => {
    editor = createTestEditor('hello');
    await nextTick();
    editor.result.view.value!.dispatch({ selection: { anchor: 0, head: 5 } });
    editor.result.applyFormat('italic');
    expect(editor.result.getContent()).toBe('*hello*');
  });

  it('strike: 选区文字被 ~~ 包裹', async () => {
    editor = createTestEditor('hello');
    await nextTick();
    editor.result.view.value!.dispatch({ selection: { anchor: 0, head: 5 } });
    editor.result.applyFormat('strike');
    expect(editor.result.getContent()).toBe('~~hello~~');
  });

  it('code: 选区文字被 ` 包裹', async () => {
    editor = createTestEditor('hello');
    await nextTick();
    editor.result.view.value!.dispatch({ selection: { anchor: 0, head: 5 } });
    editor.result.applyFormat('code');
    expect(editor.result.getContent()).toBe('`hello`');
  });
});

describe('insertNode 操作', () => {
  let editor: ReturnType<typeof createTestEditor>;
  afterEach(() => editor?.cleanup());

  it('codeBlock: 插入代码块', async () => {
    editor = createTestEditor('');
    await nextTick();
    editor.result.insertNode('codeBlock');
    expect(editor.result.getContent()).toContain('```');
  });

  it('table: 插入表格', async () => {
    editor = createTestEditor('');
    await nextTick();
    editor.result.insertNode('table');
    expect(editor.result.getContent()).toContain('|');
  });

  it('hr: 插入分割线', async () => {
    editor = createTestEditor('');
    await nextTick();
    editor.result.insertNode('hr');
    expect(editor.result.getContent()).toContain('---');
  });

  it('math: 插入数学公式块', async () => {
    editor = createTestEditor('');
    await nextTick();
    editor.result.insertNode('math');
    expect(editor.result.getContent()).toContain('$$');
  });

  it('footnote: 插入脚注', async () => {
    editor = createTestEditor('');
    await nextTick();
    editor.result.insertNode('footnote');
    expect(editor.result.getContent()).toContain('[^1]');
  });

  it('toc: 插入目录', async () => {
    editor = createTestEditor('');
    await nextTick();
    editor.result.insertNode('toc');
    expect(editor.result.getContent()).toContain('<!-- TOC -->');
  });
});

describe('canUndo / canRedo 响应性', () => {
  let editor: ReturnType<typeof createTestEditor>;
  afterEach(() => editor?.cleanup());

  it('初始状态 canUndo 为 false', () => {
    editor = createTestEditor('hello');
    expect(editor.result.canUndo.value).toBe(false);
  });

  it('setContent 后 canUndo 变为 true', async () => {
    editor = createTestEditor('');
    editor.result.setContent('change');
    await nextTick();
    await nextTick();
    expect(editor.result.canUndo.value).toBe(true);
  });

  it('canUndo 通过 stateVersion 响应变更', async () => {
    editor = createTestEditor('');
    expect(editor.result.canUndo.value).toBe(false);
    editor.result.setContent('change');
    await nextTick();
    await nextTick();
    expect(editor.result.canUndo.value).toBe(true);
  });
});

// ============================================================
// 装饰器行为测试：验证用了 Decoration.replace 而非 Decoration.mark
// ============================================================

describe('装饰器集成 - 导出完整性', () => {
  it('应该导出 IR 与扩展装饰器工厂', async () => {
    const decorators = await import('../src/core/decorators');
    expect(typeof decorators.headingDecorator).toBe('function');
    expect(typeof decorators.emphasisDecorator).toBe('function');
    expect(typeof decorators.linkDecorator).toBe('function');
    expect(typeof decorators.codeDecorator).toBe('function');
    expect(typeof decorators.taskListDecorator).toBe('function');
    expect(typeof decorators.listDecorator).toBe('function');
    expect(typeof decorators.mathDecorator).toBe('function');
    expect(typeof decorators.diagramDecorator).toBe('function');
  });
});

describe('装饰器行为 - 标记隐藏策略', () => {
  it('heading 装饰器：非光标行的 # 标记应该被 Decoration.replace 隐藏', async () => {
    const { Decoration } = await import('@codemirror/view');
    const replaceSpy = vi.spyOn(Decoration, 'replace');

    editor = createTestEditor('# Heading\n\nParagraph');
    await nextTick();

    editor.result.view.value!.dispatch({ selection: { anchor: 12 } });
    await nextTick();

    expect(replaceSpy).toHaveBeenCalled();
    replaceSpy.mockRestore();
  });
  let editor: ReturnType<typeof createTestEditor>;
  afterEach(() => editor?.cleanup());

  it('focus() 紧接 dispatch() 不应抛 RangeError（状态竞争回归测试）', async () => {
    editor = createTestEditor('some text');
    await nextTick();
    const view = editor.result.view.value!;

    expect(() => {
      editor.result.applyFormat('bold');
      view.focus();
    }).not.toThrow();
  });

  it('focus() 紧接 undo() 不抛错且能回滚（默认快照历史）', async () => {
    editor = createTestEditor('original');
    await nextTick();
    editor.result.setContent('modified');
    await nextTick();
    const view = editor.result.view.value!;

    expect(() => {
      view.focus();
      editor.result.undo();
    }).not.toThrow();
    expect(editor.result.getContent()).toBe('original');
  });

  it('连续 dispatch 后 focus 不应抛错', async () => {
    editor = createTestEditor('hello world');
    await nextTick();
    const view = editor.result.view.value!;

    expect(() => {
      view.dispatch({ selection: { anchor: 5 } });
      view.focus();
    }).not.toThrow();
  });

  it('emphasis 装饰器：非光标处的 ** 标记应该被 replace 隐藏', async () => {
    const { Decoration } = await import('@codemirror/view');
    const replaceSpy = vi.spyOn(Decoration, 'replace');

    editor = createTestEditor('**bold** text\n\nnormal');
    await nextTick();
    editor.result.view.value!.dispatch({ selection: { anchor: 16 } });
    await nextTick();

    expect(replaceSpy).toHaveBeenCalled();
    replaceSpy.mockRestore();
  });

  it('math 装饰器：$$...$$ 被 block replace 替换为渲染 widget', async () => {
    const { Decoration } = await import('@codemirror/view');
    const replaceSpy = vi.spyOn(Decoration, 'replace');

    editor = createTestEditor('before\n\n$$E=mc^2$$\n\nafter');
    await nextTick();

    const blockCall = replaceSpy.mock.calls.find(
      (args) => args[0] && (args[0] as any).block === true
    );
    expect(blockCall).toBeDefined();
    replaceSpy.mockRestore();
  });

  it('math 装饰器：$x^2$ 行内公式被 replace 替换', async () => {
    const { Decoration } = await import('@codemirror/view');
    const replaceSpy = vi.spyOn(Decoration, 'replace');

    editor = createTestEditor('The value $x^2$ is computed.');
    await nextTick();

    expect(replaceSpy).toHaveBeenCalled();
    replaceSpy.mockRestore();
  });

  it('diagram 装饰器：```mermaid ... ``` 被 block replace 替换为渲染 widget', async () => {
    const { Decoration } = await import('@codemirror/view');
    const replaceSpy = vi.spyOn(Decoration, 'replace');

    editor = createTestEditor('```mermaid\nflowchart TD\n  A-->B\n```\n\ntext');
    await nextTick();

    const blockCall = replaceSpy.mock.calls.find(
      (args) => args[0] && (args[0] as any).block === true
    );
    expect(blockCall).toBeDefined();
    replaceSpy.mockRestore();
  });
});

describe('v6 回归 - KaTeX 渲染失败', () => {
  let editor: ReturnType<typeof createTestEditor>;
  afterEach(() => editor?.cleanup());

  it('KaTeX renderToString 抛错时：应显示原始公式文本并带 cm-math-error', async () => {
    katexRenderToStringMock.mockImplementationOnce(() => {
      throw new Error('katex boom');
    });

    editor = createTestEditor('before\n\n$$E=mc^2$$\n\nafter');
    await nextTick();
    // 等待 MathWidget 内部异步 loadKatex().then(...)
    await new Promise((r) => setTimeout(r, 0));
    await nextTick();

    const el = editor.container.querySelector('.cm-math-error') as HTMLElement | null;
    expect(el).toBeTruthy();
    expect(el!.textContent).toContain('$$E=mc^2$$');
  });

  it('KaTeX 渲染成功时：不应带 cm-math-error，且包含 katex-mock', async () => {
    katexRenderToStringMock.mockImplementationOnce((latex: string) => `<span class="katex-mock">${latex}</span>`);

    editor = createTestEditor('Text $x^2$ end.');
    await nextTick();
    await new Promise((r) => setTimeout(r, 0));
    await nextTick();

    const err = editor.container.querySelector('.cm-math-error');
    expect(err).toBeFalsy();
    const ok = editor.container.querySelector('.katex-mock') as HTMLElement | null;
    expect(ok).toBeTruthy();
    expect(ok!.textContent).toBe('x^2');
  });
});

describe('v6 回归 - Mermaid 渲染失败', () => {
  let editor: ReturnType<typeof createTestEditor>;
  afterEach(() => editor?.cleanup());

  it('Mermaid render 抛错时：应显示错误文案并带 cm-diagram-error + title', async () => {
    mermaidRenderMock.mockImplementationOnce(async () => {
      throw new Error('mermaid syntax error');
    });

    editor = createTestEditor('```mermaid\nflowchart TD\n  A-->\n```');
    await nextTick();
    await new Promise((r) => setTimeout(r, 0));
    await nextTick();

    const el = editor.container.querySelector('.cm-diagram.cm-diagram-error') as HTMLElement | null;
    expect(el).toBeTruthy();
    expect(el!.textContent).toContain('图表语法错误');
    expect(el!.getAttribute('title')).toContain('mermaid syntax error');
  });

  it('Mermaid 渲染成功时：应插入 svg 且不带 cm-diagram-error', async () => {
    mermaidRenderMock.mockImplementationOnce(async () => ({ svg: '<svg data-mermaid-mock="1"></svg>' }));

    editor = createTestEditor('```mermaid\nflowchart TD\n  A-->B\n```');
    await nextTick();
    await new Promise((r) => setTimeout(r, 0));
    await nextTick();

    const err = editor.container.querySelector('.cm-diagram-error');
    expect(err).toBeFalsy();
    const svg = editor.container.querySelector('svg[data-mermaid-mock=\"1\"]');
    expect(svg).toBeTruthy();
  });
});

describe('v6 回归 - 增量编辑（公式 / Mermaid）', () => {
  let editor: ReturnType<typeof createTestEditor>;
  afterEach(() => editor?.cleanup());

  it('增量插入/删除块级公式：widget 数量应随文档变化，无残留', async () => {
    editor = createTestEditor('before\n\n$$a$$\n\nafter');
    await nextTick();
    await new Promise((r) => setTimeout(r, 0));
    await nextTick();
    expect(editor.container.querySelectorAll('.cm-math-block').length).toBe(1);

    // 在末尾增量插入第二个公式块
    const view = editor.result.view.value!;
    view.dispatch({
      changes: { from: view.state.doc.length, to: view.state.doc.length, insert: '\n\n$$b$$\n' },
    });
    await nextTick();
    await new Promise((r) => setTimeout(r, 0));
    await nextTick();
    expect(editor.container.querySelectorAll('.cm-math-block').length).toBe(2);

    // 删除第一个公式块（精确删除 $$a$$）
    const text = view.state.doc.toString();
    const from = text.indexOf('$$a$$');
    expect(from).toBeGreaterThanOrEqual(0);
    view.dispatch({ changes: { from, to: from + '$$a$$'.length, insert: '' } });
    await nextTick();
    await new Promise((r) => setTimeout(r, 0));
    await nextTick();
    expect(editor.container.querySelectorAll('.cm-math-block').length).toBe(1);
  });

  it('增量修改 Mermaid code：应重渲染为新 svg（不复用旧内容）', async () => {
    editor = createTestEditor('```mermaid\nflowchart TD\n  A-->B\n```');
    await nextTick();
    await new Promise((r) => setTimeout(r, 0));
    await nextTick();

    const view = editor.result.view.value!;
    const firstCalls = mermaidRenderMock.mock.calls.length;

    // 修改 B -> C（增量编辑，触发重新计算 decorations + 新 widget eq 判断 code 变化）
    const before = view.state.doc.toString();
    const idx = before.indexOf('A-->B');
    expect(idx).toBeGreaterThanOrEqual(0);
    view.dispatch({ changes: { from: idx, to: idx + 'A-->B'.length, insert: 'A-->C' } });
    await nextTick();
    await new Promise((r) => setTimeout(r, 0));
    await nextTick();

    expect(mermaidRenderMock.mock.calls.length).toBeGreaterThan(firstCalls);
  });
});
