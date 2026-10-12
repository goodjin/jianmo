/**
 * 用隐藏窗口把导出 HTML 打成 PDF。图片应已内联成 data URL，页面本身不依赖工程外的文件。
 */
import { BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { ElectronPdfPrintOptions } from './exportDocument';

/** 等 Mermaid 画完再打印；没有图表或超时则照常导出。 */
const WAIT_FOR_MERMAID = `
new Promise((resolve) => {
  const start = Date.now();
  const tick = () => {
    const pending = document.querySelectorAll('.markly-mermaid-await');
    const ready = pending.length === 0 || Array.from(pending).every((el) => el.querySelector('svg'));
    if (ready || Date.now() - start > 20000) resolve(true);
    else setTimeout(tick, 120);
  };
  tick();
});
`;

export async function printHtmlToPdfFile(
  html: string,
  outputPath: string,
  options: ElectronPdfPrintOptions
): Promise<void> {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'markly-pdf-'));
  const htmlPath = path.join(dir, 'export.html');
  const win = new BrowserWindow({
    show: false,
    paintWhenInitiallyHidden: true,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  try {
    await fs.promises.writeFile(htmlPath, html, 'utf-8');
    await win.loadFile(htmlPath);
    await win.webContents.executeJavaScript(WAIT_FOR_MERMAID, true);
    const data = await win.webContents.printToPDF({
      pageSize: options.pageSize,
      printBackground: options.printBackground,
      displayHeaderFooter: options.displayHeaderFooter,
      headerTemplate: options.headerTemplate,
      footerTemplate: options.footerTemplate,
      margins: options.margins,
    });
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.promises.writeFile(outputPath, data);
  } finally {
    if (!win.isDestroyed()) win.destroy();
    await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
