import { describe, it, expect } from 'vitest';
import { headingSlug, headingAnchor, markdownToHtml } from '../htmlExport';
import {
  generateHeadingId,
  headingNodeId,
  parseHeadings,
} from '../../../../webview/src/shared/outline';

/**
 * 跨侧锚点契约：导出/预览的 heading.id（htmlExport）与 webview 大纲（shared/outline）
 * 必须逐字一致，否则「点大纲跳预览」会指不到目标。本文件是防止两侧规则再次漂移的守卫。
 */

const SLUG_BATTERY = [
  'Hello World',
  '标题 Title',
  '**快速开始**',
  'Use `code` here',
  'See [docs](https://example.com)',
  '安装 & 配置',
  'Hello---World',
  '-Hello-',
  'Hello @ World!',
  '~~删除线~~ 标题',
  '  spaced  out  ',
];

describe('slug 规则一致性（webview generateHeadingId ↔ 导出 headingSlug）', () => {
  it('同一标题文本产出相同 slug', () => {
    for (const text of SLUG_BATTERY) {
      expect(generateHeadingId(text), text).toBe(headingSlug(text));
    }
  });
});

describe('锚点 id 一致性（大纲条目 ↔ 导出 HTML heading.id）', () => {
  it('同一份文档的大纲 id 与渲染 HTML 的 heading id 逐条相等', async () => {
    const md = [
      '# Markly 样例',
      '## **快速开始** {#quick}',
      '### 标题 Title',
      '#### See [docs](https://example.com)',
      '## 中文标题 & 符号',
      '### !!!',
      '###### 最小标题',
    ].join('\n');

    const html = await markdownToHtml(md);
    const renderedIds = [...html.matchAll(/<h[1-6] id="([^"]*)"/g)].map((m) => m[1]);
    const outlineIds = parseHeadings(md).map((h, i) => headingNodeId(h, i + 1));

    expect(renderedIds.length).toBe(7);
    expect(outlineIds).toEqual(renderedIds);
  });

  it('自定义锚点与序号兜底两侧一致', () => {
    expect(headingAnchor('快速开始 {#quick}', 1)).toBe('quick');
    const hs = parseHeadings('## 快速开始 {#quick}\n## !!!\n');
    expect(headingNodeId(hs[0], 1)).toBe('quick');
    expect(headingNodeId(hs[1], 2)).toBe('markly-h-2');
  });
});

describe('可见文本一致性（{#custom-id} 不进标题文案，两侧同规则）', () => {
  it('渲染后的标题文本与大纲条目文本都剥掉 {#custom-id}', async () => {
    const md = '## **快速开始** {#quick}\n### 围栏后\n\n```sh\n# 注释\n```\n';
    const html = await markdownToHtml(md);

    // 导出/预览侧：id 保留、标记不外漏
    expect(html).toContain('<h2 id="quick"><strong>快速开始</strong></h2>');
    expect(html).not.toContain('{#quick}');

    // 大纲侧：{#quick} 同样不外漏（行内标记保留原文是既有行为），且围栏注释不误入
    const outline = parseHeadings(md);
    expect(outline.map((h) => h.text)).toEqual(['**快速开始**', '围栏后']);
    expect(outline.every((h) => !h.text.includes('{#'))).toBe(true);
  });
});
