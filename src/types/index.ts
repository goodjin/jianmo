// 编辑器模式
// - ir: Markdown 源码 + decorators 的“所见即所得”视图（仍是 markdown 文本为真源）
// - source: 纯 markdown 源码
// - rich: 真富文本（ProseMirror/Milkdown 节点模型），保存时序列化为 markdown
export type EditorMode = 'ir' | 'source' | 'rich';

export type RichTableCommandValue =
  | 'addRowBefore'
  | 'addRowAfter'
  | 'addColBefore'
  | 'addColAfter'
  | 'toggleHeaderRow'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'
  | 'mergeCells'
  | 'splitCell'
  | 'deleteTable'
  | 'deleteRow'
  | 'deleteCol';

export type ImageAssetCommandValue =
  | 'copyMissingRefs'
  | 'copyUnreferencedAssetList'
  | 'openAssetsDirectory'
  | 'openImageAssetsPanel'
  | 'repairFirstMissingRef'
  | 'repairMissingRefsBatch'
  | 'normalizeImageRefs';

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
  /**
   * M59 Rich：表格列宽拖拽插件。
   * - auto：表体量大（与粘贴「软阈值」对齐）时自动关闭，减轻滚动/选区延迟
   * - on / off：强制开启或关闭（设置项 `markly.editor.richTableColumnResize`）
   */
  richTableColumnResize: 'auto' | 'on' | 'off';
}

export interface ImageConfig {
  saveDirectory: string;
  compressThreshold: CompressThreshold;
  compressQuality: CompressQuality;
  /**
   * M52：assets 下已存在同名文件时的策略（粘贴/拖拽 UPLOAD_IMAGE / SAVE_IMAGE）。
   * - overwrite：覆盖
   * - rename：自动改名为 `base-2.ext`…
   * - prompt：弹窗让用户选覆盖或自动重命名（取消则失败）
   */
  sameNameHandling: 'overwrite' | 'rename' | 'prompt';
}

/** M81：PDF 版式模板（页边距仍由 margin 控制） */
export type PdfExportTemplateId = 'default' | 'academic';

/** M83：导出前预检范围 */
export type ExportPreflightScope = 'off' | 'images' | 'full';

export interface ExportPreflightConfig {
  scope: ExportPreflightScope;
  /** 为 true 时若有任一条问题，弹窗确认后才继续导出 */
  blockOnIssues: boolean;
}

export interface PdfConfig {
  format: 'A4' | 'A3' | 'Letter' | 'Legal';
  margin: {
    top: MarginValue;
    right: MarginValue;
    bottom: MarginValue;
    left: MarginValue;
  };
  includeToc: boolean;
  displayHeaderFooter: boolean;
  /** PDF 版式：`default` 为 GitHub 系浅色；`academic` 为衬线、偏印刷阅读向 */
  template?: PdfExportTemplateId;
}

export interface ExtensionConfig {
  /** M95：可选本地遥测开关（仅 Output；不向第三方发送） */
  telemetry: {
    enabled: boolean;
  };
  editor: EditorConfig;
  image: ImageConfig;
  /** M90：自定义模板目录（工作区 `markly.templates.userDirectory`） */
  templates?: {
    /** 绝对路径或 `~/…`；空字符串表示仅使用内置模板 */
    userDirectory?: string;
  };
  export: {
    pdf: PdfConfig;
    /** HTML 导出主题（工作区 `markly.export.html.theme`） */
    html?: {
      theme: 'default' | 'print-friendly';
      /** M82：导出 HTML 时将文档目录内本地相对图片复制到输出目录旁 */
      copyLocalImages?: boolean;
      /** 资产子目录名（单层目录名，不含路径分隔符或 `..`） */
      assetsSubdirectory?: string;
    };
    /** M83：导出 PDF/HTML 前的静态预检 */
    preflight?: ExportPreflightConfig;
  };
  /** M47：选区「润色」开关（工作区 `markly.ai.rewrite.enabled`） */
  ai?: {
    rewriteSelectionEnabled: boolean;
    /** rewrite provider（none/mock/openai-compatible）。默认 mock（方便离线/测试）。 */
    rewriteProvider?: 'none' | 'mock' | 'openai-compatible';
    /** openai-compatible：HTTP endpoint（例如 `https://api.openai.com/v1/chat/completions` 或自建兼容端点） */
    rewriteEndpoint?: string;
    /** openai-compatible：模型名（默认 `gpt-4o-mini` 之类可由用户自行配置） */
    rewriteModel?: string;
    /** 超时（毫秒） */
    rewriteTimeoutMs?: number;
  };
}

export interface HostDiagnostics {
  vscodeVersion: string;
  extensionVersion: string;
  platform: string;
  arch: string;
  configSnapshot: Pick<
    ExtensionConfig['editor'],
    'wrapPolicy' | 'tableCellWrap' | 'enableMermaid' | 'enableShiki' | 'theme' | 'fontSize'
  >;
}

export interface LocalImageRefCheckResult {
  ref: string;
  exists: boolean;
  resolvedPath?: string;
  error?: string;
}

// 消息类型（Extension ⇄ Webview 自定义编辑器协议）
//
// Extension → Webview：INIT / CONTENT_UPDATE / CONFIG_CHANGE / SWITCH_MODE / SAVE / SAVE_SUCCESS /
//   IMAGE_SAVED / IMAGE_SAVE_FAILED / LOCAL_IMAGE_REFS_RESULT / EDITOR_COMMAND / THEME_CHANGE（兼容 hook）/ getScrollPosition / setScrollPosition
// Webview → Extension：READY / CONTENT_CHANGE / SAVE / SAVE_IMAGE / OPEN_* / EXPORT /
//   UPLOAD_IMAGE / CHECK_LOCAL_IMAGE_REFS / FIND_MARKDOWN_BACKLINKS /
//   OPEN_MARKDOWN_DOCUMENT / MARKDOWN_BACKLINKS_RESULT / scrollPositionResponse
//
// 注：`markly.toggleMode` 仍可能下发 `preview`（历史命名），Webview 侧与 `ir` 同义入口。
export type ExtensionMessage =
  | { type: 'INIT'; payload: { content: string; config: ExtensionConfig; version?: number; hostDiagnostics?: HostDiagnostics } }
  | { type: 'CONTENT_UPDATE'; payload: { content: string; version?: number } }
  | { type: 'CONFIG_CHANGE'; payload: { config: Partial<ExtensionConfig> } }
  | { type: 'SWITCH_MODE'; payload: { mode: EditorMode | 'preview' } }
  /** 宿主侧保存（如 workbench 保存）触发 Webview 同步 TOC 等 */
  | { type: 'SAVE' }
  | { type: 'SAVE_SUCCESS'; payload: { version: number } }
  | { type: 'IMAGE_SAVED'; payload: { path: string; filename: string; requestId?: string } }
  | { type: 'IMAGE_SAVE_FAILED'; payload: { filename: string; error: string; requestId?: string } }
  | {
      type: 'LOCAL_IMAGE_REFS_RESULT';
      payload: { requestId: string; results: LocalImageRefCheckResult[] };
    }
  /** M53：文档「保存目录」根下一层内的图片文件名（相对文档所在目录 posix 路径） */
  | {
      type: 'ASSETS_IMAGE_FILES_RESULT';
      payload: { requestId: string; relativePaths: string[]; error?: string };
    }
  /** M64：工作区内反向链接扫描结果（相对工作区根的 posix 路径 + file URI） */
  | {
      type: 'MARKDOWN_BACKLINKS_RESULT';
      payload: {
        requestId: string;
        items: Array<{ uri: string; workspaceRelativePath: string }>;
        error?: 'no_workspace';
        truncated?: boolean;
      };
    }
  /** M65：内部链接悬停预览结果 */
  | {
      type: 'MARKDOWN_HOVER_PREVIEW_RESULT';
      payload: {
        requestId: string;
        ok: boolean;
        title?: string;
        excerpt?: string;
        targetUri?: string;
        error?: string;
      };
    }
  | {
      type: 'IMAGE_REF_REPLACEMENT';
      payload: { fromRef: string; toRef: string };
    }
  /** M54：宿主侧「替换缺失引用」文件框结束（替换已下发或未选文件用户取消）；用于批量修复顺序等待 */
  | { type: 'IMAGE_REF_REPAIR_OUTCOME'; payload: { fromRef: string; status: 'replaced' | 'cancelled' } }
  | {
      type: 'EDITOR_COMMAND';
      payload:
        | { command: 'insert'; value: 'table' | 'codeBlock' | 'image' | 'link' | 'math' | 'hr' }
        | { command: 'toggleOutline' }
        | { command: 'toggleFindReplace' }
        | { command: 'pastePlain' }
        | { command: 'findNavigate'; direction: 'next' | 'previous' }
        | { command: 'documentReplace'; from: string; to: string }
        | { command: 'wrapUrlLink' }
        | { command: 'richTable'; value: RichTableCommandValue }
        | { command: 'imageAsset'; value: ImageAssetCommandValue }
        | {
            command: 'writingAssist';
            value:
              | 'summarize'
              | 'suggestTitle'
              | 'fixMarkdown'
              | 'tidyTables'
              | 'rewriteSelection'
              | 'convertTextToGfmTable';
          }
    }
  /** 旧 Text Editor 路径曾下发；预览模式可不使用 */
  | { type: 'THEME_CHANGE'; payload: { theme: string } }
  | { type: 'getScrollPosition'; requestId: string }
  | { type: 'setScrollPosition'; scrollTop: number; scrollLeft: number }
  /** M47：rewriteSelection 结果回填 */
  | { type: 'AI_REWRITE_SELECTION_RESULT'; payload: { requestId: string; ok: true; text: string } }
  | { type: 'AI_REWRITE_SELECTION_RESULT'; payload: { requestId: string; ok: false; error: string } }
  /** M73：AI 摘要结果回传 */
  | {
      type: 'AI_SUMMARY_RESULT';
      payload:
        | { requestId: string; ok: true; text: string }
        | { requestId: string; ok: false; error: string }
    }
  /** M74：AI 标题建议（多候选） */
  | {
      type: 'AI_SUGGEST_TITLES_RESULT';
      payload:
        | {
            requestId: string;
            ok: true;
            items: Array<{ title: string; style: string; reason?: string }>;
          }
        | { requestId: string; ok: false; error: string };
    }
  /** M76：AI 将非表格文本转为 GFM 表格 */
  | {
      type: 'AI_CONVERT_TEXT_TO_TABLE_RESULT';
      payload:
        | { requestId: string; ok: true; markdown: string }
        | { requestId: string; ok: false; error: string };
    };

export type WebViewMessage =
  | { type: 'CONTENT_CHANGE'; payload: { content: string; cursor?: SourceCursorPosition; version?: number } }
  | { type: 'SAVE'; payload: { content: string } }
  | { type: 'SAVE_IMAGE'; payload: { data: string; filename: string; requestId?: string } }
  | { type: 'OPEN_IMAGE_PREVIEW'; payload: { src: string; images: string[]; index: number } }
  | { type: 'OPEN_IMAGE_EDITOR'; payload: { src: string } }
  | { type: 'OPEN_EXTERNAL_LINK'; payload: { url: string } }
  | { type: 'EXPORT'; payload: { format: 'pdf' | 'html' | 'image' | 'preview' } }
  | { type: 'READY'; payload?: undefined }
  | { type: 'UPLOAD_IMAGE'; payload: { base64: string; filename: string; requestId?: string } }
  | { type: 'CHECK_LOCAL_IMAGE_REFS'; payload: { requestId: string; refs: string[] } }
  | { type: 'LIST_ASSETS_IMAGE_FILES'; payload: { requestId: string } }
  /** M64：请求扫描「链入当前文档」的工作区 Markdown 列表 */
  | { type: 'FIND_MARKDOWN_BACKLINKS'; payload: { requestId: string } }
  /** M64：在宿主中打开指定 file:// 文档（须位于当前工作区内） */
  | { type: 'OPEN_MARKDOWN_DOCUMENT'; payload: { uri: string } }
  /** M65：请求内部链接悬停预览（href 为 `#id` 或相对 `.md#id`） */
  | { type: 'MARKDOWN_HOVER_PREVIEW_REQUEST'; payload: { requestId: string; href: string } }
  /** M68：调起 VS Code 工作区搜索（Find in Files） */
  | { type: 'OPEN_WORKSPACE_SEARCH'; payload: { query: string } }
  | { type: 'OPEN_IMAGE_DIRECTORY'; payload: { kind: 'document' | 'assets' | 'resolved'; resolvedPath?: string } }
  | { type: 'REPAIR_IMAGE_REF'; payload: { ref: string } }
  /** M47：请求宿主执行 rewriteSelection（provider 可控、SecretStorage 存 key） */
  | { type: 'AI_REWRITE_SELECTION_REQUEST'; payload: { requestId: string; text: string } }
  /** M73：请求宿主执行摘要（provider 与 key 复用 rewriteSelection 配置） */
  | { type: 'AI_SUMMARY_REQUEST'; payload: { requestId: string; text: string; scope: 'document' | 'section' } }
  /** M74：请求 AI 生成多条标题建议 */
  | { type: 'AI_SUGGEST_TITLES_REQUEST'; payload: { requestId: string; text: string } }
  /** M76：请求将选区转为 GFM 表格 */
  | { type: 'AI_CONVERT_TEXT_TO_TABLE_REQUEST'; payload: { requestId: string; text: string } }
  | { type: 'scrollPositionResponse'; requestId: string; scrollTop: number; scrollLeft: number };

// 导出结果 - 使用联合类型区分成功/失败
export type ExportResult =
  | { success: true; filePath: string; size: number; error?: undefined }
  | { success: false; error: string; filePath?: undefined; size?: undefined };
