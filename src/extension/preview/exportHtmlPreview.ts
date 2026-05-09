/**
 * M88：发布前预览 — 使用与导出 HTML 相同的管线渲染到 Webview，本地相对图片改写为可加载 URI。
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { buildExportHtmlString } from '@core/export/htmlExport';
import { rewriteLocalImgSrcForPreview } from '@core/export/htmlPreviewImgRewrite';

let previewPanel: vscode.WebviewPanel | undefined;

function injectWebviewCsp(html: string, cspSource: string): string {
  const csp = [
    `default-src 'none'`,
    `style-src ${cspSource} 'unsafe-inline'`,
    `script-src ${cspSource} 'unsafe-inline'`,
    `img-src ${cspSource} https: http: data: blob:`,
    `font-src ${cspSource} data:`,
    `connect-src ${cspSource} https: http:`,
  ].join('; ');
  const meta = `<meta http-equiv="Content-Security-Policy" content="${csp.replace(/"/g, '&quot;')}">`;
  if (html.includes('<head>')) {
    return html.replace('<head>', `<head>\n  ${meta}\n`);
  }
  return `<!DOCTYPE html><html><head>${meta}</head><body>${html}</body></html>`;
}

export interface ShowExportHtmlPreviewOptions {
  markdown: string;
  documentUri: vscode.Uri;
  htmlTheme: 'default' | 'print-friendly';
  /** 预览为“离线/自包含优先”，不加载第三方 CDN 脚本（M302）。 */
  mermaidScriptBundling?: 'embedded' | 'external';
}

export function showExportHtmlPreviewPanel(options: ShowExportHtmlPreviewOptions): void {
  const titleBase = path.basename(options.documentUri.fsPath || 'document.md');
  const docDir =
    options.documentUri.scheme === 'file' ? path.dirname(options.documentUri.fsPath) : '';

  previewPanel?.dispose();
  previewPanel = vscode.window.createWebviewPanel(
    'marklyExportHtmlPreview',
    `导出预览 · ${titleBase}`,
    vscode.ViewColumn.Beside,
    { enableScripts: true, retainContextWhenHidden: true }
  );

  const panel = previewPanel;

  void (async () => {
    try {
      let html = await buildExportHtmlString(options.markdown, {
        includeToc: true,
        title: titleBase.replace(/\.\w+$/, '') || '文档',
        htmlTheme: options.htmlTheme,
        darkMode: false,
        // M302：预览不走第三方脚本；始终用 embedded，避免 CSP 与离线环境不一致
        mermaidScriptBundling: 'embedded',
      });
      if (docDir && fs.existsSync(docDir)) {
        html = rewriteLocalImgSrcForPreview(html, docDir, (abs) =>
          panel.webview.asWebviewUri(vscode.Uri.file(abs)).toString()
        );
      }
      html = injectWebviewCsp(html, panel.webview.cspSource);
      panel.webview.html = html;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      panel.webview.html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><pre>${escapeHtmlAttrSafe(
        msg
      )}</pre></body></html>`;
    }
  })();

  panel.onDidDispose(() => {
    if (previewPanel === panel) previewPanel = undefined;
  });
}

function escapeHtmlAttrSafe(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 自定义编辑器主 Webview 内嵌「预览」：与侧栏预览、导出 HTML 同源管线，并把本地图片改为当前 webview URI。
 */
export async function buildInlinePreviewHtmlForCustomWebview(
  markdown: string,
  documentUri: vscode.Uri,
  webview: vscode.Webview,
  htmlTheme: 'default' | 'print-friendly'
): Promise<{ html?: string; error?: string }> {
  try {
    const titleBase = path.basename(documentUri.fsPath || 'document.md');
    let html = await buildExportHtmlString(markdown, {
      includeToc: true,
      title: titleBase.replace(/\.\w+$/, '') || '文档',
      htmlTheme,
      darkMode: false,
      mermaidScriptBundling: 'embedded',
    });
    const docDir = documentUri.scheme === 'file' ? path.dirname(documentUri.fsPath) : '';
    if (docDir && fs.existsSync(docDir)) {
      html = rewriteLocalImgSrcForPreview(html, docDir, (abs) =>
        webview.asWebviewUri(vscode.Uri.file(abs)).toString()
      );
    }
    html = injectWebviewCsp(html, webview.cspSource);
    return { html };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}
