// 编辑器模式
// - ir: Markdown 源码 + decorators 的“所见即所得”视图（仍是 markdown 文本为真源）
// - source: 纯 markdown 源码
// - rich: 真富文本（ProseMirror/Milkdown 节点模型），保存时序列化为 markdown
export type EditorMode = 'ir' | 'source' | 'rich';

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
  /** 超宽内容策略：自动换行优先 / 横向滚动优先 */
  wrapPolicy: 'autoWrap' | 'preferScroll';
  /** 表格单元格：允许换行 / 强制不换行（横向滚动） */
  tableCellWrap: 'wrap' | 'nowrap';
  /** Rich：是否启用 Mermaid 渲染（重渲染，可按需关闭） */
  enableMermaid: boolean;
  /** Rich：是否启用 Shiki 高亮（可能影响启动稳定性，默认关闭） */
  enableShiki: boolean;
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

// 消息类型（Extension ⇄ Webview 自定义编辑器协议）
//
// Extension → Webview：INIT / CONTENT_UPDATE / CONFIG_CHANGE / SWITCH_MODE / SAVE / SAVE_SUCCESS /
//   IMAGE_SAVED / THEME_CHANGE（兼容 hook）/ getScrollPosition / setScrollPosition
// Webview → Extension：READY / CONTENT_CHANGE / SAVE / SAVE_IMAGE / OPEN_* / EXPORT /
//   UPLOAD_IMAGE / scrollPositionResponse
//
// 注：`markly.toggleMode` 仍可能下发 `preview`（历史命名），Webview 侧与 `ir` 同义入口。
export type ExtensionMessage =
  | { type: 'INIT'; payload: { content: string; config: ExtensionConfig; version?: number } }
  | { type: 'CONTENT_UPDATE'; payload: { content: string; version?: number } }
  | { type: 'CONFIG_CHANGE'; payload: { config: Partial<ExtensionConfig> } }
  | { type: 'SWITCH_MODE'; payload: { mode: EditorMode | 'preview' } }
  /** 宿主侧保存（如 workbench 保存）触发 Webview 同步 TOC 等 */
  | { type: 'SAVE' }
  | { type: 'SAVE_SUCCESS'; payload: { version: number } }
  | { type: 'IMAGE_SAVED'; payload: { path: string; filename: string } }
  /** 旧 Text Editor 路径曾下发；预览模式可不使用 */
  | { type: 'THEME_CHANGE'; payload: { theme: string } }
  | { type: 'getScrollPosition'; requestId: string }
  | { type: 'setScrollPosition'; scrollTop: number; scrollLeft: number };

export type WebViewMessage =
  | { type: 'CONTENT_CHANGE'; payload: { content: string; cursor?: SourceCursorPosition; version?: number } }
  | { type: 'SAVE'; payload: { content: string } }
  | { type: 'SAVE_IMAGE'; payload: { data: string; filename: string } }
  | { type: 'OPEN_IMAGE_PREVIEW'; payload: { src: string; images: string[]; index: number } }
  | { type: 'OPEN_IMAGE_EDITOR'; payload: { src: string } }
  | { type: 'EXPORT'; payload: { format: 'pdf' | 'html' | 'image' } }
  | { type: 'READY'; payload?: undefined }
  | { type: 'UPLOAD_IMAGE'; payload: { base64: string; filename: string } }
  | { type: 'scrollPositionResponse'; requestId: string; scrollTop: number; scrollLeft: number };

// 导出结果 - 使用联合类型区分成功/失败
export type ExportResult =
  | { success: true; filePath: string; size: number; error?: undefined }
  | { success: false; error: string; filePath?: undefined; size?: undefined };
