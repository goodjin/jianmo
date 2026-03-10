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

// 数值范围约束类型
type Range<T extends number, L extends number, H extends number> = T extends L ? T : T extends H ? T : number & { __brand: `Range_${L}_${H}` };

// 配置数值约束
type FontSize = Range<number, 8, 72>; // 8-72px
type CompressThreshold = Range<number, 0, 100>; // 0-100%
type CompressQuality = Range<number, 0, 100>; // 0-100%
type MarginValue = Range<number, 0, 100>; // 0-100mm

// 配置
export interface EditorConfig {
  theme: 'auto' | 'light' | 'dark';
  fontSize: FontSize;
  fontFamily: string;
}

export interface ImageConfig {
  saveDirectory: string;
  compressThreshold: CompressThreshold;
  compressQuality: CompressQuality;
}

export interface PdfConfig {
  format: 'A4' | 'A3' | 'Letter' | 'Legal';
  margin: {
    top: MarginValue;
    right: MarginValue;
    bottom: MarginValue;
    left: MarginValue;
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
  | { type: 'READY'; payload?: undefined };

// 导出结果 - 使用联合类型区分成功/失败
export type ExportResult =
  | { success: true; filePath: string; size: number; error?: undefined }
  | { success: false; error: string; filePath?: undefined; size?: undefined };
