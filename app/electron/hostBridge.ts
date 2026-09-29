import { shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type Store from 'electron-store';
import type { ExtensionConfig, ExtensionMessage, WebViewMessage } from '../../src/types';
import { buildExportHtmlString } from '../../src/core/export/htmlExport';
import { inlineLocalPreviewImages } from './previewImages';
import { applyPreviewTheme } from './previewTheme';
import { resolveEditorPalette } from '../../webview/src/shared/themeConfig';
import { saveAppConfigPatch } from './config';

/**
 * 宿主能力映射：把 webview 侧的 WebViewMessage 路由到 Electron main 的本地实现，
 * 复用现有 host 逻辑（导出 HTML 管线、AI、图片等），替代 vscode.* API。
 *
 * P1 范围：READY / REQUEST_PREVIEW_HTML / OPEN_EXTERNAL_LINK / SAVE / CONTENT_CHANGE。
 * 其余 case 预留位置标 TODO(deferred)，P2/P3 接入。
 */
export interface HostBridgeOptions {
  config: ExtensionConfig;
  store: Store;
  sendToRenderer: (msg: ExtensionMessage) => void;
  getCurrentContent: () => string;
  getCurrentDocDir: () => string;
  setCurrentContent: (s: string) => void;
  /** 主题设为 auto 时据此挑明/暗配色；由 main 从 nativeTheme 提供，便于单测注入。 */
  getPrefersDark?: () => boolean;
}

export function createHostBridge(opts: HostBridgeOptions) {
  async function handleMessage(msg: WebViewMessage): Promise<void> {
    switch (msg.type) {
      case 'READY': {
        // 握手：回 INIT，P1 固定 preview 模式
        opts.sendToRenderer({
          type: 'INIT',
          payload: {
            content: opts.getCurrentContent(),
            config: opts.config,
            version: 1,
            initialEditorMode: 'preview',
            toolbarCollapsed: false,
          },
        });
        break;
      }

      case 'REQUEST_PREVIEW_HTML': {
        try {
          let html = await buildExportHtmlString(opts.getCurrentContent(), {
            includeToc: true,
            title: 'Markly',
            htmlTheme: opts.config.export.html?.theme ?? 'default',
            mermaidScriptBundling: opts.config.export.diagram?.mermaidScriptBundling ?? 'embedded',
          });
          const docDir = opts.getCurrentDocDir();
          if (docDir && fs.existsSync(docDir)) {
            html = inlineLocalPreviewImages(html, docDir);
          }
          const palette = resolveEditorPalette(
            opts.config.editor.theme,
            opts.getPrefersDark?.() ?? false
          );
          html = applyPreviewTheme(html, palette, {
            fontFamily: opts.config.editor.fontFamily,
            fontSize: opts.config.editor.fontSize,
          });
          opts.sendToRenderer({ type: 'PREVIEW_HTML', payload: { html } });
        } catch (e) {
          opts.sendToRenderer({
            type: 'PREVIEW_HTML',
            payload: { error: String((e as Error)?.message ?? e) },
          });
        }
        break;
      }

      case 'OPEN_EXTERNAL_LINK': {
        const url = String(msg.payload?.url ?? '').trim();
        if (/^https?:\/\//i.test(url)) {
          await shell.openExternal(url);
        }
        break;
      }

      case 'SAVE': {
        // P1 只读 UI 不触发；P2 接入写盘 + SAVE_SUCCESS/SAVE_FAILED
        opts.setCurrentContent(msg.payload.content);
        // TODO(P2): fs.writeFile(currentFilePath, content)
        break;
      }

      case 'CONTENT_CHANGE': {
        opts.setCurrentContent(msg.payload.content);
        break;
      }

      case 'TRACK_EDITOR_MODE':
      case 'SET_TOOLBAR_COLLAPSED':
        break; // P1 no-op；P2 经 store 持久化

      case 'SET_EDITOR_THEME': {
        const theme = msg.payload.theme;
        opts.config.editor.theme = theme;
        saveAppConfigPatch({ editor: { theme } });
        opts.sendToRenderer({ type: 'CONFIG_CHANGE', payload: { config: opts.config } });
        break;
      }

      // TODO(P3): EXPORT(pdf via webContents.printToPDF / html via exportToHtml),
      //   SAVE_IMAGE/UPLOAD_IMAGE, AI_*_REQUEST, CHECK_LOCAL_IMAGE_REFS,
      //   LIST_ASSETS_IMAGE_FILES, DELETE_ASSETS_IMAGE_FILES, OPEN_IMAGE_DIRECTORY,
      //   OPEN_IMAGE_PREVIEW, OPEN_IMAGE_EDITOR, REPAIR_IMAGE_REF, OPEN_MARKDOWN_DOCUMENT(new window)
      // 不适用（强依赖 VSCode 工作区模型）：FIND_MARKDOWN_BACKLINKS,
      //   OPEN_WORKSPACE_SEARCH, MARKDOWN_HOVER_PREVIEW_REQUEST

      default:
        break; // 静默忽略未实现消息，避免阻塞 webview
    }
  }

  return { handleMessage };
}

/** 仅供测试：暴露未导出的 path 用法以断言。 */
export const __test = { docDir: path };
