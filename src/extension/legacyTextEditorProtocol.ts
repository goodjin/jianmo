/**
 * `markly.editor` CustomTextEditorProvider（旧 Text Editor 路径）专用协议。
 * 与现行 `markly.preview` / `src/types/index.ts` 的 ExtensionMessage 不同。
 * @module extension/legacyTextEditorProtocol
 */

export interface LegacyTextEditorConfig {
  theme: 'light' | 'dark' | 'auto';
  tabSize: number;
  enableGFM: boolean;
  enableMath: boolean;
  assetsPath: string;
}

/** Extension → Webview（旧路径） */
export type LegacyTextEditorToWebview =
  | { type: 'INIT'; payload: { content: string; config: LegacyTextEditorConfig } }
  | { type: 'DOCUMENT_CHANGE'; payload: { content: string } }
  | { type: 'IMAGE_SAVED'; payload: { path: string; filename: string } }
  | { type: 'THEME_CHANGE'; payload: { theme: string } };

/** Webview → Extension（旧路径） */
export type LegacyWebviewToExtension =
  | { type: 'CONTENT_CHANGE'; payload: { content: string } }
  | { type: 'UPLOAD_IMAGE'; payload: { base64: string; filename: string } }
  | { type: 'GET_THEME' };

/** 旧路径命令面板注入 */
export type LegacyCommandToWebview = {
  type: 'COMMAND';
  payload: { command: string; args?: unknown[] };
};

export type LegacyEditorOutboundMessage =
  | LegacyTextEditorToWebview
  | LegacyCommandToWebview;
