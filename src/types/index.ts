// 编辑器模式
export type EditorMode = 'source' | 'preview';

// 光标位置
export interface SourceCursorPosition {
  lineNumber: number;
  column: number;
}

export interface PreviewScrollPosition {
  scrollTop: number;
  scrollLeft: number;
}

// 文档状态
export interface DocumentState {
  uri: string;
  content: string;
  version: number;
  isDirty: boolean;
}

// 模式状态
export interface ModeState {
  currentMode: EditorMode;
  sourceCursor?: SourceCursorPosition;
  previewScroll?: PreviewScrollPosition;
}

// 配置
export interface EditorConfig {
  theme: 'auto' | 'light' | 'dark';
  fontSize: number;
  fontFamily: string;
}

export interface ImageConfig {
  saveDirectory: string;
  compressThreshold: number;
  compressQuality: number;
}

export interface PdfConfig {
  format: 'A4' | 'A3' | 'Letter' | 'Legal';
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export interface ExtensionConfig {
  editor: EditorConfig;
  image: ImageConfig;
  export: {
    pdf: PdfConfig;
  };
}

// 消息类型
export type ExtensionMessage =
  | { type: 'INIT'; payload: { content: string; config: ExtensionConfig } }
  | { type: 'CONTENT_UPDATE'; payload: { content: string; version?: number } }
  | { type: 'CONFIG_CHANGE'; payload: { config: Partial<ExtensionConfig> } }
  | { type: 'SWITCH_MODE'; payload: { mode: EditorMode } };

export type WebViewMessage =
  | { type: 'CONTENT_CHANGE'; payload: { content: string; cursor?: SourceCursorPosition; version?: number } }
  | { type: 'SAVE_IMAGE'; payload: { data: string; filename: string } }
  | { type: 'OPEN_IMAGE_PREVIEW'; payload: { src: string; images: string[]; index: number } }
  | { type: 'OPEN_IMAGE_EDITOR'; payload: { src: string } }
  | { type: 'EXPORT'; payload: { format: 'pdf' | 'html' | 'image' } }
  | { type: 'READY' };

// 导出结果
export interface ExportResult {
  success: boolean;
  filePath?: string;
  error?: string;
  size?: number;
}
