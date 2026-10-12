import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  electronPdfOptions,
  ensureExportExtension,
  exportBaseName,
  exportMarkdownDocument,
  parseExportResult,
  suggestExportPath,
  type ElectronPdfPrintOptions,
} from './exportDocument';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

const dirs: string[] = [];

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markly-export-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const pdfConfig = {
  format: 'A4' as const,
  margin: { top: 25, right: 20, bottom: 25, left: 20 },
  displayHeaderFooter: true,
};

describe('导出路径', () => {
  it('用源文件名做默认名，空白文档叫 Markly', () => {
    expect(exportBaseName('/docs/笔记.md')).toBe('笔记');
    expect(exportBaseName(null)).toBe('Markly');
    expect(suggestExportPath('/docs/笔记.md', 'pdf', '/home/docs')).toBe(path.join('/docs', '笔记.pdf'));
    expect(suggestExportPath('', 'html', '/home/docs')).toBe(path.join('/home/docs', 'Markly.html'));
  });

  it('缺扩展名就补上，html 与 pdf 互相切换时替换', () => {
    expect(ensureExportExtension('/out/a', 'pdf')).toBe('/out/a.pdf');
    expect(ensureExportExtension('/out/a.HTML', 'html')).toBe('/out/a.HTML');
    expect(ensureExportExtension('/out/a.html', 'pdf')).toBe('/out/a.pdf');
    expect(ensureExportExtension('/out/a.pdf', 'html')).toBe('/out/a.html');
    expect(ensureExportExtension('/out/report.v2', 'pdf')).toBe('/out/report.v2.pdf');
  });

  it('毫米页边距换成英寸，非法纸张退回 A4', () => {
    const opts = electronPdfOptions(pdfConfig);
    expect(opts.pageSize).toBe('A4');
    expect(opts.printBackground).toBe(true);
    expect(opts.margins.top).toBeCloseTo(25 / 25.4, 3);
    expect(opts.margins.right).toBeCloseTo(20 / 25.4, 3);
    expect(opts.headerTemplate).toContain('Markly');
    expect(opts.footerTemplate).toContain('pageNumber');

    const fallback = electronPdfOptions({
      format: 'Tabloid',
      margin: { top: -1, right: Number.NaN, bottom: 10, left: 10 },
      displayHeaderFooter: false,
    });
    expect(fallback.pageSize).toBe('A4');
    expect(fallback.displayHeaderFooter).toBe(false);
    expect(fallback.margins.top).toBeCloseTo(25 / 25.4, 3);
  });
});

describe('parseExportResult', () => {
  it('成功、取消、失败三条路径都认', () => {
    expect(parseExportResult({ ok: true, path: '/a.pdf', format: 'pdf' })).toEqual({
      ok: true,
      path: '/a.pdf',
      format: 'pdf',
    });
    expect(parseExportResult({ ok: false, cancelled: true })).toEqual({ ok: false, cancelled: true });
    expect(parseExportResult({ ok: false, error: ' 磁盘满 ' })).toEqual({ ok: false, error: '磁盘满' });
    expect(parseExportResult(null)).toEqual({ ok: false, error: '导出失败' });
  });
});

describe('exportMarkdownDocument', () => {
  it('HTML 写出真实正文，并把文档目录里的图片拷到输出旁', async () => {
    const dir = tempDir();
    fs.writeFileSync(path.join(dir, 'pic.png'), TINY_PNG);
    const out = path.join(dir, 'out', '笔记');
    const written = await exportMarkdownDocument({
      format: 'html',
      markdown: '# 导出标题\n\n一段正文。\n\n![图](pic.png)\n',
      tabKind: 'doc',
      sourcePath: path.join(dir, '笔记.md'),
      outputPath: out,
      documentDir: dir,
      includeToc: true,
      htmlTheme: 'default',
      copyLocalImages: true,
      mermaidScriptBundling: 'embedded',
      pdf: pdfConfig,
      printPdf: vi.fn(),
    });

    expect(written).toBe(`${out}.html`);
    const html = fs.readFileSync(written, 'utf-8');
    expect(html).toContain('导出标题');
    expect(html).toContain('一段正文');
    expect(html).not.toContain('src="pic.png"');
    expect(fs.existsSync(path.join(dir, 'out', 'markly-html-assets', 'pic.png'))).toBe(true);
  });

  it('PDF 把打印向 HTML 和页边距交给 printPdf，本地图片内联进 HTML', async () => {
    const dir = tempDir();
    fs.writeFileSync(path.join(dir, 'pic.png'), TINY_PNG);
    const seen: { html: string; outputPath: string; options: ElectronPdfPrintOptions }[] = [];
    const written = await exportMarkdownDocument({
      format: 'pdf',
      markdown: '# 导出标题\n\n一段正文。\n\n![图](pic.png)\n',
      tabKind: 'doc',
      sourcePath: path.join(dir, '笔记.md'),
      outputPath: path.join(dir, '笔记.html'),
      documentDir: dir,
      includeToc: true,
      htmlTheme: 'default',
      copyLocalImages: false,
      mermaidScriptBundling: 'embedded',
      pdf: pdfConfig,
      printPdf: async (html, outputPath, options) => {
        seen.push({ html, outputPath, options });
      },
    });

    expect(written).toBe(path.join(dir, '笔记.pdf'));
    expect(seen).toHaveLength(1);
    expect(seen[0].outputPath).toBe(written);
    expect(seen[0].html).toContain('导出标题');
    expect(seen[0].html).toContain('一段正文');
    expect(seen[0].html).toContain('markly-export-print-friendly');
    expect(seen[0].html).toContain('data:image/png;base64,');
    expect(seen[0].options.pageSize).toBe('A4');
    expect(seen[0].options.margins.top).toBeCloseTo(25 / 25.4, 3);
  });

  it('设置页拒绝导出，也不会去写文件', async () => {
    const printPdf = vi.fn();
    await expect(
      exportMarkdownDocument({
        format: 'html',
        markdown: '# 设置',
        tabKind: 'settings',
        sourcePath: null,
        outputPath: path.join(tempDir(), 'x.html'),
        documentDir: '',
        includeToc: false,
        htmlTheme: 'default',
        copyLocalImages: false,
        mermaidScriptBundling: 'embedded',
        pdf: pdfConfig,
        printPdf,
      })
    ).rejects.toThrow('设置页不能导出');
    expect(printPdf).not.toHaveBeenCalled();
  });
});
