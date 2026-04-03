/**
 * 共享导出入口（协议以 `src/types/index.ts` 为准）。
 * @module shared/types
 */

export type {
  EditorMode,
  ExtensionConfig,
  ExtensionMessage,
  WebViewMessage,
  SourceCursorPosition,
  DocumentState,
  ModeState,
  ExportResult,
} from '../types';

declare global {
  interface Window {
    acquireVsCodeApi?: () => {
      postMessage: (message: unknown) => void;
      getState: () => unknown;
      setState: (state: unknown) => void;
    };
    vscode?: {
      postMessage: (message: unknown) => void;
      getState: () => unknown;
      setState: (state: unknown) => void;
    };
  }
}

export {};
