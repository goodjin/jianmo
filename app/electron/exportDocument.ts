/**
 * 独立应用导出：HTML 复用导出管线写文件；PDF 先生成打印向 HTML，再交给注入的 printPdf
 * （主进程用隐藏窗口 webContents.printToPDF）。本模块不碰 dialog / BrowserWindow，方便单测。
 */
import * as fs from 'fs';
import * as path from 'path';
import { buildExportHtmlString, exportToHtml } from '../../src/core/export/htmlExport';
import type { MermaidScriptBundling } from '../../src/core/export/mermaidExport';
import { previewKindFromName } from './documentKind';
import { isAppExportFormat, type AppExportFormat } from './exportTypes';
import { buildPlainPreviewHtml } from './plainView';
import { inlineLocalPreviewImages } from './previewImages';

export type { AppExportFormat, ExportIpcResult } from './exportTypes';
export { isAppExportFormat, parseExportResult } from './exportTypes';

export interface ElectronPdfPrintOptions {
  pageSize: 'A4' | 'A3' | 'Letter' | 'Legal';
  printBackground: true;
  displayHeaderFooter: boolean;
  headerTemplate: string;
  footerTemplate: string;
  margins: {
    marginType: 'custom';
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

/** 页边距按毫米传入；配置里的品牌数字和普通数字都可以。 */
export interface PdfPageInput {
  format?: string;
  margin?: {
    top?: unknown;
    right?: unknown;
    bottom?: unknown;
    left?: unknown;
  };
  displayHeaderFooter?: boolean;
}

export interface AppExportInput {
  format: AppExportFormat;
  markdown: string;
  tabKind: 'doc' | 'settings';
  sourcePath: string | null;
  outputPath: string;
  documentDir: string;
  includeToc: boolean;
  htmlTheme: 'default' | 'print-friendly';
  copyLocalImages: boolean;
  assetsSubdirectory?: string;
  mermaidScriptBundling: MermaidScriptBundling;
  pdf: PdfPageInput;
  printPdf: (html: string, outputPath: string, options: ElectronPdfPrintOptions) => Promise<void>;
}

const PAGE_SIZES = ['A4', 'A3', 'Letter', 'Legal'] as const;

const PDF_HEADER =
  '<div style="font-size:9px;width:100%;padding:0 8px;color:#666;"><span>Markly</span></div>';
const PDF_FOOTER =
  '<div style="font-size:9px;width:100%;padding:0 8px;color:#666;text-align:center;"><span class="pageNumber"></span></div>';

/** 用源文件名做导出标题与默认文件名；空白标签退回 Markly。扩展名去掉，避免笔记.txt.pdf。 */
export function exportBaseName(sourcePath: string | null | undefined): string {
  if (!sourcePath) return 'Markly';
  const base = path.basename(sourcePath);
  const ext = path.extname(base);
  const stem = (ext ? base.slice(0, -ext.length) : base).trim();
  return stem || 'Markly';
}

export function suggestExportPath(
  sourcePath: string | null | undefined,
  format: AppExportFormat,
  documentsDir: string
): string {
  const dir = sourcePath ? path.dirname(sourcePath) : documentsDir;
  return path.join(dir || documentsDir, `${exportBaseName(sourcePath)}.${format}`);
}

/** 保存对话框有时不补扩展名；已是目标扩展名则不动，html/pdf 互切时替换，否则补上。 */
export function ensureExportExtension(filePath: string, format: AppExportFormat): string {
  const wanted = `.${format}`;
  if (filePath.toLowerCase().endsWith(wanted)) return filePath;
  const swapped = filePath.replace(/\.(html?|pdf)$/i, wanted);
  if (swapped !== filePath) return swapped;
  return `${filePath}${wanted}`;
}

function mmToInches(mm: unknown, fallbackMm: number): number {
  const n = typeof mm === 'number' ? mm : Number(mm);
  const value = Number.isFinite(n) && n >= 0 ? n : fallbackMm;
  return Math.round((value / 25.4) * 1000) / 1000;
}

/** 把配置里的毫米页边距换成 Electron printToPDF 要的英寸。 */
export function electronPdfOptions(pdf: PdfPageInput): ElectronPdfPrintOptions {
  const pageSize = PAGE_SIZES.find((size) => size === pdf.format) ?? 'A4';
  const displayHeaderFooter = pdf.displayHeaderFooter !== false;
  return {
    pageSize,
    printBackground: true,
    displayHeaderFooter,
    headerTemplate: displayHeaderFooter ? PDF_HEADER : '<span></span>',
    footerTemplate: displayHeaderFooter ? PDF_FOOTER : '<span></span>',
    margins: {
      marginType: 'custom',
      top: mmToInches(pdf.margin?.top, 25),
      right: mmToInches(pdf.margin?.right, 20),
      bottom: mmToInches(pdf.margin?.bottom, 25),
      left: mmToInches(pdf.margin?.left, 20),
    },
  };
}

/**
 * 写出 HTML 文件，或生成打印 HTML 并调用 printPdf。
 * 成功时返回最终路径（可能补过扩展名）。
 */
export async function exportMarkdownDocument(input: AppExportInput): Promise<string> {
  if (input.tabKind === 'settings') throw new Error('设置页不能导出');
  if (!isAppExportFormat(input.format)) throw new Error('请选择 PDF 或 HTML');

  const outputPath = ensureExportExtension(input.outputPath, input.format);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const title = exportBaseName(input.sourcePath);
  const bundling: MermaidScriptBundling =
    input.mermaidScriptBundling === 'external' ? 'external' : 'embedded';

  if (previewKindFromName(input.sourcePath ?? '') === 'plain') {
    const html = buildPlainPreviewHtml(input.markdown);
    if (input.format === 'html') {
      fs.writeFileSync(outputPath, html, 'utf8');
      return outputPath;
    }
    await input.printPdf(html, outputPath, electronPdfOptions(input.pdf));
    return outputPath;
  }

  if (input.format === 'html') {
    await exportToHtml(input.markdown, outputPath, {
      includeToc: input.includeToc,
      title,
      htmlTheme: input.htmlTheme === 'print-friendly' ? 'print-friendly' : 'default',
      copyLocalImages: input.copyLocalImages === true && Boolean(input.documentDir),
      documentBaseDir: input.documentDir || undefined,
      assetsSubdirectory: input.assetsSubdirectory || 'markly-html-assets',
      mermaidScriptBundling: bundling,
    });
    return outputPath;
  }

  let html = await buildExportHtmlString(input.markdown, {
    includeToc: input.includeToc,
    title,
    htmlTheme: 'print-friendly',
    mermaidScriptBundling: bundling,
  });
  if (input.documentDir) html = inlineLocalPreviewImages(html, input.documentDir);
  await input.printPdf(html, outputPath, electronPdfOptions(input.pdf));
  return outputPath;
}
