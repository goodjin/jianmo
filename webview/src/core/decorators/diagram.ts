/**
 * 图表装饰器
 * @module core/decorators/diagram
 * @description IR 模式下将 ```mermaid ... ``` 替换为 Mermaid 渲染预览。
 *
 * 与 math.ts 同理：block replace decoration 只能来自 StateField，
 * 因此本模块使用 StateField + EditorView.decorations 路线。
 */

import { Decoration, DecorationSet, WidgetType, EditorView } from '@codemirror/view';
import { StateField, type Range, type Extension } from '@codemirror/state';
import type { DecoratorOptions } from '../../types/decorator';

function simpleHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

/**
 * Mermaid 兼容性预处理：
 * - subgraph 标题含空格/括号/中文等时，Mermaid 往往要求使用引号包裹
 *   例：subgraph 企业邮箱系统体系 (核心层)  => subgraph "企业邮箱系统体系 (核心层)"
 *
 * 目标：尽量“自动修复”常见语法坑，提高渲染成功率；即使仍失败，后续仍有源码回退展示。
 */
export function preprocessMermaid(code: string): string {
  const lines = code.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];

  for (const line of lines) {
    const m = /^(\s*subgraph\s+)(.+?)\s*$/.exec(line);
    if (!m) {
      out.push(line);
      continue;
    }

    const prefix = m[1];
    const title = m[2];

    // 已经是引号包裹则跳过
    if (
      (title.startsWith('"') && title.endsWith('"')) ||
      (title.startsWith("'") && title.endsWith("'"))
    ) {
      out.push(line);
      continue;
    }

    // 只要包含“非简单 id”的字符，就包一层双引号（括号/空格/中文/斜杠/emoji 等）
    const isSimpleId = /^[A-Za-z0-9_-]+$/.test(title);
    if (isSimpleId) {
      out.push(line);
      continue;
    }

    const escaped = title.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    out.push(`${prefix}"${escaped}"`);
  }

  return out.join('\n');
}

class DiagramWidget extends WidgetType {
  private id: string;

  constructor(
    private code: string,
    private diagramType: string,
    /** 文档中的起始位置，保证同内容不同块 id 唯一且可复现 */
    private anchorPos: number
  ) {
    super();
    this.id = `mermaid-${anchorPos}-${simpleHash(code)}`;
  }

  toDOM(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'cm-diagram';
    container.setAttribute('data-diagram-type', this.diagramType);

    this.render(container);
    return container;
  }

  private async render(container: HTMLElement): Promise<void> {
    try {
      const mermaid = (await import('mermaid')).default;
      const compat = preprocessMermaid(this.code);
      const { svg } = await mermaid.render(this.id, compat);
      container.innerHTML = svg;
    } catch (error) {
      container.classList.add('cm-diagram-error');
      container.innerHTML = '';

      const title = document.createElement('div');
      title.className = 'cm-diagram-error-title';
      title.textContent = 'Mermaid 解析失败（显示源代码作为回退）';
      container.appendChild(title);

      const detail = document.createElement('div');
      detail.className = 'cm-diagram-error-detail';
      const msg = error instanceof Error ? error.message : String(error);
      detail.textContent = msg ? `错误信息：${msg}` : '错误信息：未知';
      container.appendChild(detail);

      const pre = document.createElement('pre');
      pre.className = 'cm-diagram-source';
      pre.textContent = this.code;
      container.appendChild(pre);

      // 兼容旧行为：hover 可快速看错误信息
      container.title = msg || 'Mermaid parse error';
    }
  }

  eq(other: DiagramWidget): boolean {
    return other.code === this.code && other.anchorPos === this.anchorPos;
  }
}

export function computeDiagramDecorations(doc: string): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const pattern = /^```mermaid\n([\s\S]*?)^```/gm;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(doc)) !== null) {
    const code = match[1].trim();
    const diagramType = code.split('\n')[0].trim();
    const deco = Decoration.replace({
      widget: new DiagramWidget(code, diagramType, match.index),
      inclusive: false,
      block: true,
    });
    decorations.push(deco.range(match.index, match.index + match[0].length));
  }

  return Decoration.set(decorations.sort((a, b) => a.from - b.from));
}

const diagramField = StateField.define<DecorationSet>({
  create(state) {
    const t = state.doc.sliceString(0, state.doc.length);
    if (!t.includes('```mermaid')) return Decoration.set([]);
    return computeDiagramDecorations(t);
  },
  update(decos, tr) {
    if (!tr.docChanged) return decos;
    const doc = tr.newDoc;
    const t = doc.sliceString(0, doc.length);
    if (!t.includes('```mermaid')) return Decoration.set([]);
    return computeDiagramDecorations(t);
  },
  provide(field) {
    return EditorView.decorations.from(field);
  },
});

/**
 * 创建图表装饰器（StateField 路线，支持 block replace）
 */
export const diagramDecorator = (_options: DecoratorOptions = {}): Extension => {
  return diagramField;
};

export default diagramDecorator;
