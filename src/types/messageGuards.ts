/**
 * Extension ⇄ Webview 消息运行时校验（契约测试与防守式解析用）
 * @module types/messageGuards
 */
import type {
  EditorMode,
  ExtensionConfig,
  ExtensionMessage,
  HostDiagnostics,
  RichTableCommandValue,
  WebViewMessage,
  ImageAssetCommandValue,
} from './index';

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function isString(x: unknown): x is string {
  return typeof x === 'string';
}

function isNumber(x: unknown): x is number {
  return typeof x === 'number' && !Number.isNaN(x);
}

function isProtocolVersionEnvelope(x: Record<string, unknown>): boolean {
  const pv = x.protocolVersion;
  const min = x.minSupportedProtocolVersion;
  if (pv !== undefined && !isNumber(pv)) return false;
  if (min !== undefined && !isNumber(min)) return false;
  return true;
}

function hasNoUnknownTopLevelKeys(
  msg: Record<string, unknown>,
  allowed: ReadonlySet<string>
): boolean {
  for (const k of Object.keys(msg)) {
    if (!allowed.has(k)) return false;
  }
  return true;
}

const EXT_MSG_TOP_LEVEL_KEYS_STRICT: ReadonlySet<string> = new Set([
  'type',
  'payload',
  'requestId',
  'scrollTop',
  'scrollLeft',
  'protocolVersion',
  'minSupportedProtocolVersion',
]);

const WEBVIEW_MSG_TOP_LEVEL_KEYS_STRICT: ReadonlySet<string> = new Set([
  'type',
  'payload',
  'requestId',
  'scrollTop',
  'scrollLeft',
  'protocolVersion',
  'minSupportedProtocolVersion',
]);

const richTableCommandValues: ReadonlySet<RichTableCommandValue> = new Set([
  'addRowBefore',
  'addRowAfter',
  'addColBefore',
  'addColAfter',
  'toggleHeaderRow',
  'alignLeft',
  'alignCenter',
  'alignRight',
  'mergeCells',
  'splitCell',
  'deleteTable',
  'deleteRow',
  'deleteCol',
]);

const imageAssetCommandValues: ReadonlySet<ImageAssetCommandValue> = new Set([
  'copyMissingRefs',
  'copyUnreferencedAssetList',
  'openAssetsDirectory',
  'openImageAssetsPanel',
  'repairFirstMissingRef',
  'repairMissingRefsBatch',
  'normalizeImageRefs',
]);

export function isEditorMode(x: unknown): x is EditorMode {
  return x === 'source' || x === 'rich' || x === 'preview';
}

export function isExtensionConfig(x: unknown): x is ExtensionConfig {
  if (!isRecord(x)) return false;
  const telemetry = (x as { telemetry?: unknown }).telemetry;
  if (!isRecord(telemetry) || typeof (telemetry as { enabled?: unknown }).enabled !== 'boolean') return false;
  const editor = x.editor;
  const image = x.image;
  const exp = x.export;
  if (!isRecord(editor) || !isRecord(image) || !isRecord(exp)) return false;
  if (!isRecord(exp.pdf)) return false;
  const ddr = (editor as { deferDiagramRenderInRich?: unknown }).deferDiagramRenderInRich;
  if (ddr !== undefined && typeof ddr !== 'boolean') return false;
  const theme = editor.theme;
  if (theme !== 'auto' && theme !== 'light' && theme !== 'dark') return false;
  if (!isNumber(editor.fontSize)) return false;
  if (!isString(editor.fontFamily)) return false;
  if (!isString(image.saveDirectory)) return false;
  if (!isNumber(image.compressThreshold)) return false;
  if (!isNumber(image.compressQuality)) return false;
  const sn = (image as { sameNameHandling?: unknown }).sameNameHandling;
  if (sn !== 'overwrite' && sn !== 'rename' && sn !== 'prompt') return false;
  const ral = (image as { remoteHttpsHostsAllowlist?: unknown }).remoteHttpsHostsAllowlist;
  if (ral !== undefined && (!Array.isArray(ral) || !ral.every(isString))) return false;
  const pip = (image as { pasteImageBasenamePrefix?: unknown }).pasteImageBasenamePrefix;
  if (pip !== undefined && !isString(pip)) return false;
  const pdf = exp.pdf;
  const fmt = pdf.format;
  if (fmt !== 'A4' && fmt !== 'A3' && fmt !== 'Letter' && fmt !== 'Legal') return false;
  const margin = pdf.margin;
  if (!isRecord(margin)) return false;
  if (!(isNumber(margin.top) && isNumber(margin.right) && isNumber(margin.bottom) && isNumber(margin.left))) {
    return false;
  }
  if (typeof (pdf as { includeToc?: unknown }).includeToc !== 'boolean') return false;
  if (typeof (pdf as { displayHeaderFooter?: unknown }).displayHeaderFooter !== 'boolean') return false;
  if (exp.html !== undefined) {
    if (!isRecord(exp.html)) return false;
    const th = exp.html.theme;
    if (th !== 'default' && th !== 'print-friendly') return false;
    const cli = (exp.html as { copyLocalImages?: unknown }).copyLocalImages;
    if (cli !== undefined && typeof cli !== 'boolean') return false;
    const asd = (exp.html as { assetsSubdirectory?: unknown }).assetsSubdirectory;
    if (asd !== undefined && !isString(asd)) return false;
  }
  const pf = (exp as { preflight?: unknown }).preflight;
  if (pf !== undefined) {
    if (!isRecord(pf)) return false;
    const sc = (pf as { scope?: unknown }).scope;
    if (sc !== 'off' && sc !== 'images' && sc !== 'full') return false;
    if (typeof (pf as { blockOnIssues?: unknown }).blockOnIssues !== 'boolean') return false;
  }
  const diag = (exp as { diagram?: unknown }).diagram;
  if (diag !== undefined) {
    if (!isRecord(diag)) return false;
    const bund = (diag as { mermaidScriptBundling?: unknown }).mermaidScriptBundling;
    if (bund !== undefined && bund !== 'embedded' && bund !== 'external') return false;
  }
  const tpl = (x as { templates?: unknown }).templates;
  if (tpl !== undefined) {
    if (!isRecord(tpl)) return false;
    const ud = (tpl as { userDirectory?: unknown }).userDirectory;
    if (ud !== undefined && typeof ud !== 'string') return false;
  }

  if ((x as { ai?: unknown }).ai !== undefined) {
    const ai = (x as { ai?: Record<string, unknown> }).ai;
    if (!isRecord(ai)) return false;
    if (typeof ai.rewriteSelectionEnabled !== 'boolean') return false;
    const provider = ai.rewriteProvider;
    if (
      provider !== undefined &&
      provider !== 'none' &&
      provider !== 'mock' &&
      provider !== 'openai-compatible'
    ) {
      return false;
    }
    if (ai.rewriteEndpoint !== undefined && !isString(ai.rewriteEndpoint)) return false;
    if (ai.rewriteModel !== undefined && !isString(ai.rewriteModel)) return false;
    if (ai.rewriteTimeoutMs !== undefined && !isNumber(ai.rewriteTimeoutMs)) return false;
  }
  return true;
}

function isHostDiagnostics(x: unknown): x is HostDiagnostics {
  if (!isRecord(x)) return false;
  if (!isString(x.vscodeVersion)) return false;
  if (!isString(x.extensionVersion)) return false;
  if (!isString(x.platform)) return false;
  if (!isString(x.arch)) return false;
  const snap = x.configSnapshot;
  if (!isRecord(snap)) return false;
  const wrap = snap.wrapPolicy;
  const cellWrap = snap.tableCellWrap;
  const theme = snap.theme;
  if (wrap !== 'autoWrap' && wrap !== 'preferScroll') return false;
  if (cellWrap !== 'wrap' && cellWrap !== 'nowrap') return false;
  if (theme !== 'auto' && theme !== 'light' && theme !== 'dark') return false;
  if (!isNumber(snap.fontSize)) return false;
  if (typeof snap.enableMermaid !== 'boolean') return false;
  if (typeof snap.enableShiki !== 'boolean') return false;
  return true;
}

export function isExtensionMessage(
  msg: unknown,
  opts?: { strict?: boolean }
): msg is ExtensionMessage {
  if (!isRecord(msg) || !isString(msg.type)) return false;
  if (!isProtocolVersionEnvelope(msg)) return false;
  if (opts?.strict && !hasNoUnknownTopLevelKeys(msg, EXT_MSG_TOP_LEVEL_KEYS_STRICT)) return false;

  switch (msg.type) {
    case 'INIT': {
      const p = msg.payload;
      if (!isRecord(p) || !isString(p.content) || !isExtensionConfig(p.config)) return false;
      if (p.version !== undefined && !isNumber(p.version)) return false;
      if (p.hostDiagnostics !== undefined && !isHostDiagnostics(p.hostDiagnostics)) return false;
      if (p.documentFolderWebviewUri !== undefined && !isString(p.documentFolderWebviewUri)) return false;
      if (p.initialEditorMode !== undefined && !isEditorMode(p.initialEditorMode)) return false;
      return true;
    }
    case 'CONTENT_UPDATE': {
      const p = msg.payload;
      if (!isRecord(p) || !isString(p.content)) return false;
      if (p.version !== undefined && !isNumber(p.version)) return false;
      return true;
    }
    case 'CONFIG_CHANGE': {
      const p = msg.payload;
      if (!isRecord(p) || !isRecord(p.config)) return false;
      return true;
    }
    case 'SWITCH_MODE': {
      const p = msg.payload;
      if (!isRecord(p)) return false;
      return isEditorMode(p.mode);
    }
    case 'CYCLE_EDITOR_MODE':
      return msg.payload === undefined || msg.payload === null;
    case 'PREVIEW_HTML': {
      const p = msg.payload;
      if (!isRecord(p)) return false;
      const hk = typeof p.html === 'string';
      const he = typeof p.error === 'string';
      return hk || he;
    }
    case 'SAVE':
      return true;
    case 'SAVE_SUCCESS': {
      const p = msg.payload;
      return isRecord(p) && isNumber(p.version);
    }
    case 'SAVE_FAILED': {
      const p = msg.payload;
      return isRecord(p) && isString(p.error);
    }
    case 'IMAGE_SAVED': {
      const p = msg.payload;
      return (
        isRecord(p) &&
        isString(p.path) &&
        isString(p.filename) &&
        (p.requestId === undefined || isString(p.requestId))
      );
    }
    case 'IMAGE_SAVE_FAILED': {
      const p = msg.payload;
      return (
        isRecord(p) &&
        isString(p.filename) &&
        isString(p.error) &&
        (p.requestId === undefined || isString(p.requestId))
      );
    }
    case 'LOCAL_IMAGE_REFS_RESULT': {
      const p = msg.payload;
      if (!isRecord(p) || !isString(p.requestId) || !Array.isArray(p.results)) return false;
      return p.results.every((x: unknown) => {
        if (!isRecord(x) || !isString(x.ref) || typeof x.exists !== 'boolean') return false;
        if (x.resolvedPath !== undefined && !isString(x.resolvedPath)) return false;
        if (x.error !== undefined && !isString(x.error)) return false;
        return true;
      });
    }
    case 'ASSETS_IMAGE_FILES_RESULT': {
      const p = msg.payload;
      if (!isRecord(p) || !isString(p.requestId) || !Array.isArray(p.relativePaths)) return false;
      if (!p.relativePaths.every((x: unknown) => isString(x))) return false;
      if (p.error !== undefined && !isString(p.error)) return false;
      return true;
    }
    case 'ASSETS_IMAGE_DELETE_RESULT': {
      const p = msg.payload;
      if (!isRecord(p) || !isString(p.requestId)) return false;
      if ((p as { cancelled?: unknown }).cancelled !== undefined && typeof (p as { cancelled?: unknown }).cancelled !== 'boolean')
        return false;
      const deleted = (p as { deletedRelativePaths?: unknown }).deletedRelativePaths;
      const failed = (p as { failed?: unknown }).failed;
      if (!Array.isArray(deleted) || !deleted.every((x: unknown) => isString(x))) return false;
      if (!Array.isArray(failed)) return false;
      return failed.every((x: unknown) => {
        if (!isRecord(x)) return false;
        const xr = x as Record<string, unknown>;
        return isString(xr.relativePath) && isString(xr.error);
      });
    }
    case 'AI_SUMMARY_RESULT': {
      const p = msg.payload;
      if (!isRecord(p) || !isString(p.requestId)) return false;
      if (typeof (p as { ok?: unknown }).ok !== 'boolean') return false;
      if ((p as { ok: boolean }).ok === true) return isString((p as { text?: unknown }).text);
      return isString((p as { error?: unknown }).error);
    }
    case 'AI_SUGGEST_TITLES_RESULT': {
      const p = msg.payload;
      if (!isRecord(p) || !isString(p.requestId) || typeof (p as { ok?: unknown }).ok !== 'boolean') return false;
      if ((p as { ok: boolean }).ok === false) return isString((p as { error?: unknown }).error);
      const items = (p as { items?: unknown }).items;
      if (!Array.isArray(items)) return false;
      return items.every((x: unknown) => {
        if (!isRecord(x)) return false;
        const xr = x as Record<string, unknown>;
        if (!isString(xr.title) || !isString(xr.style)) return false;
        if (xr.reason !== undefined && !isString(xr.reason)) return false;
        return true;
      });
    }
    case 'AI_CONVERT_TEXT_TO_TABLE_RESULT': {
      const p = msg.payload;
      if (!isRecord(p) || !isString(p.requestId) || typeof (p as { ok?: unknown }).ok !== 'boolean') return false;
      if ((p as { ok: boolean }).ok === true) return isString((p as { markdown?: unknown }).markdown);
      return isString((p as { error?: unknown }).error);
    }
    case 'MARKDOWN_BACKLINKS_RESULT': {
      const p = msg.payload;
      if (!isRecord(p) || !isString(p.requestId) || !Array.isArray(p.items)) return false;
      if (
        !p.items.every((row: unknown) => {
          if (!isRecord(row)) return false;
          return isString(row.uri) && isString(row.workspaceRelativePath);
        })
      ) {
        return false;
      }
      const err = (p as { error?: unknown }).error;
      if (err !== undefined && err !== 'no_workspace') return false;
      const trunc = (p as { truncated?: unknown }).truncated;
      if (trunc !== undefined && typeof trunc !== 'boolean') return false;
      return true;
    }
    case 'MARKDOWN_HOVER_PREVIEW_RESULT': {
      const p = msg.payload;
      if (!isRecord(p) || !isString(p.requestId) || typeof (p as { ok?: unknown }).ok !== 'boolean') return false;
      if ((p as { title?: unknown }).title !== undefined && !isString((p as { title?: unknown }).title)) return false;
      if ((p as { excerpt?: unknown }).excerpt !== undefined && !isString((p as { excerpt?: unknown }).excerpt)) return false;
      if ((p as { targetUri?: unknown }).targetUri !== undefined && !isString((p as { targetUri?: unknown }).targetUri))
        return false;
      if ((p as { error?: unknown }).error !== undefined && !isString((p as { error?: unknown }).error)) return false;
      return true;
    }
    case 'IMAGE_REF_REPLACEMENT': {
      const p = msg.payload;
      return isRecord(p) && isString(p.fromRef) && isString(p.toRef);
    }
    case 'IMAGE_REF_REPAIR_OUTCOME': {
      const p = msg.payload;
      const st = (p as { status?: unknown }).status;
      return isRecord(p) && isString(p.fromRef) && (st === 'replaced' || st === 'cancelled');
    }
    case 'EDITOR_COMMAND': {
      const p = msg.payload;
      if (!isRecord(p) || !isString(p.command)) return false;
      if (p.command === 'toggleOutline') return true;
      if (p.command === 'toggleFindReplace') {
        return Object.keys(p).length === 1;
      }
      if (p.command === 'pastePlain') {
        return Object.keys(p).length === 1;
      }
      if (p.command === 'findNavigate') {
        const ks = Object.keys(p);
        return (
          ks.length === 2 &&
          (p as { direction?: unknown }).direction !== undefined &&
          ((p as { direction: string }).direction === 'next' ||
            (p as { direction: string }).direction === 'previous')
        );
      }
      if (p.command === 'documentReplace') {
        const ks = Object.keys(p);
        const from = (p as { from?: unknown }).from;
        const to = (p as { to?: unknown }).to;
        return ks.length === 3 && isString(from) && isString(to) && from.length > 0;
      }
      if (p.command === 'wrapUrlLink') {
        return Object.keys(p).length === 1;
      }
      if (p.command === 'insert') {
        return (
          p.value === 'table' ||
          p.value === 'codeBlock' ||
          p.value === 'image' ||
          p.value === 'link' ||
          p.value === 'math' ||
          p.value === 'hr'
        );
      }
      if (p.command === 'richTable') {
        return isString(p.value) && richTableCommandValues.has(p.value as RichTableCommandValue);
      }
      if (p.command === 'imageAsset') {
        return isString(p.value) && imageAssetCommandValues.has(p.value as ImageAssetCommandValue);
      }
      if (p.command === 'writingAssist') {
        return (
          p.value === 'summarize' ||
          p.value === 'suggestTitle' ||
          p.value === 'fixMarkdown' ||
          p.value === 'tidyTables' ||
          p.value === 'rewriteSelection' ||
          p.value === 'convertTextToGfmTable'
        );
      }
      return false;
    }
    case 'THEME_CHANGE': {
      const p = msg.payload;
      return isRecord(p) && isString(p.theme);
    }
    case 'getScrollPosition':
      return isString(msg.requestId);
    case 'setScrollPosition':
      return isNumber(msg.scrollTop) && isNumber(msg.scrollLeft);
    case 'AI_REWRITE_SELECTION_RESULT': {
      const p = msg.payload;
      if (!isRecord(p) || !isString(p.requestId) || p.requestId.trim().length === 0) return false;
      if (p.ok === true) return isString((p as { text?: unknown }).text);
      if (p.ok === false) return isString((p as { error?: unknown }).error) && String((p as { error: string }).error).trim().length > 0;
      return false;
    }
    default:
      return false;
  }
}

export function isWebViewMessage(
  msg: unknown,
  opts?: { strict?: boolean }
): msg is WebViewMessage {
  if (!isRecord(msg) || !isString(msg.type)) return false;
  if (!isProtocolVersionEnvelope(msg)) return false;
  if (opts?.strict && !hasNoUnknownTopLevelKeys(msg, WEBVIEW_MSG_TOP_LEVEL_KEYS_STRICT)) return false;

  switch (msg.type) {
    case 'CONTENT_CHANGE': {
      const p = msg.payload;
      if (!isRecord(p) || !isString(p.content)) return false;
      const c = p.cursor;
      if (c !== undefined) {
        if (!isRecord(c) || !isNumber(c.lineNumber) || !isNumber(c.column)) return false;
      }
      if (p.version !== undefined && !isNumber(p.version)) return false;
      return true;
    }
    case 'SAVE': {
      const p = msg.payload;
      return isRecord(p) && isString(p.content);
    }
    case 'SAVE_IMAGE': {
      const p = msg.payload;
      return (
        isRecord(p) &&
        isString(p.data) &&
        isString(p.filename) &&
        (p.requestId === undefined || isString(p.requestId))
      );
    }
    case 'UPLOAD_IMAGE': {
      const p = msg.payload;
      return (
        isRecord(p) &&
        isString(p.base64) &&
        isString(p.filename) &&
        (p.requestId === undefined || isString(p.requestId))
      );
    }
    case 'CHECK_LOCAL_IMAGE_REFS': {
      const p = msg.payload;
      return isRecord(p) && isString(p.requestId) && Array.isArray(p.refs) && p.refs.every((x) => isString(x));
    }
    case 'LIST_ASSETS_IMAGE_FILES': {
      const p = msg.payload;
      const ks = Object.keys(p);
      return isRecord(p) && isString(p.requestId) && ks.length === 1 && ks[0] === 'requestId';
    }
    case 'DELETE_ASSETS_IMAGE_FILES': {
      const p = msg.payload;
      if (!isRecord(p) || !isString(p.requestId) || !Array.isArray(p.relativePaths)) return false;
      return p.relativePaths.every((x: unknown) => isString(x));
    }
    case 'FIND_MARKDOWN_BACKLINKS': {
      const p = msg.payload;
      return isRecord(p) && isString(p.requestId) && Object.keys(p).length === 1;
    }
    case 'OPEN_MARKDOWN_DOCUMENT': {
      const p = msg.payload;
      return isRecord(p) && isString(p.uri) && p.uri.trim().length > 0;
    }
    case 'MARKDOWN_HOVER_PREVIEW_REQUEST': {
      const p = msg.payload;
      return (
        isRecord(p) &&
        isString(p.requestId) &&
        p.requestId.trim().length > 0 &&
        isString(p.href) &&
        p.href.trim().length > 0
      );
    }
    case 'OPEN_WORKSPACE_SEARCH': {
      const p = msg.payload;
      return isRecord(p) && isString(p.query) && p.query.trim().length > 0;
    }
    case 'OPEN_IMAGE_DIRECTORY': {
      const p = msg.payload;
      if (!isRecord(p)) return false;
      if (p.kind !== 'document' && p.kind !== 'assets' && p.kind !== 'resolved') return false;
      return p.resolvedPath === undefined || isString(p.resolvedPath);
    }
    case 'REPAIR_IMAGE_REF': {
      const p = msg.payload;
      return isRecord(p) && isString(p.ref);
    }
    case 'AI_REWRITE_SELECTION_REQUEST': {
      const p = msg.payload;
      return (
        isRecord(p) &&
        isString(p.requestId) &&
        p.requestId.trim().length > 0 &&
        isString(p.text)
      );
    }
    case 'AI_SUMMARY_REQUEST': {
      const p = msg.payload;
      const sc = (p as { scope?: unknown }).scope;
      return (
        isRecord(p) &&
        isString(p.requestId) &&
        p.requestId.trim().length > 0 &&
        isString(p.text) &&
        (sc === 'document' || sc === 'section')
      );
    }
    case 'AI_SUGGEST_TITLES_REQUEST': {
      const p = msg.payload;
      return (
        isRecord(p) &&
        isString(p.requestId) &&
        p.requestId.trim().length > 0 &&
        isString(p.text) &&
        p.text.trim().length > 0
      );
    }
    case 'AI_CONVERT_TEXT_TO_TABLE_REQUEST': {
      const p = msg.payload;
      return (
        isRecord(p) &&
        isString(p.requestId) &&
        p.requestId.trim().length > 0 &&
        isString(p.text) &&
        p.text.trim().length > 0
      );
    }
    case 'TRACK_EDITOR_MODE': {
      const p = msg.payload;
      const m = (p as { mode?: unknown }).mode;
      // 2.0 起协议不含 `ir`；旧 webview 若仍上报则放行并由宿主规范化为 `source`
      return isRecord(p) && (isEditorMode(m) || m === 'ir');
    }
    case 'REQUEST_PREVIEW_HTML':
      return msg.payload === undefined || msg.payload === null || isRecord(msg.payload);
    case 'OPEN_IMAGE_PREVIEW': {
      const p = msg.payload;
      if (!isRecord(p) || !isString(p.src) || !Array.isArray(p.images) || !isNumber(p.index)) {
        return false;
      }
      return p.images.every((x: unknown) => isString(x));
    }
    case 'OPEN_IMAGE_EDITOR': {
      const p = msg.payload;
      return isRecord(p) && isString(p.src);
    }
    case 'OPEN_EXTERNAL_LINK': {
      const p = msg.payload;
      return isRecord(p) && isString(p.url) && p.url.trim().length > 0;
    }
    case 'EXPORT': {
      const p = msg.payload;
      if (!isRecord(p) || !isString(p.format)) return false;
      return p.format === 'pdf' || p.format === 'html' || p.format === 'image' || p.format === 'preview';
    }
    case 'READY':
      return msg.payload === undefined || msg.payload === null;
    case 'scrollPositionResponse':
      return (
        isString(msg.requestId) && isNumber(msg.scrollTop) && isNumber(msg.scrollLeft)
      );
    default:
      return false;
  }
}
