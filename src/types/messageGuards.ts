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
  'openAssetsDirectory',
  'repairFirstMissingRef',
  'normalizeImageRefs',
]);

export function isEditorMode(x: unknown): x is EditorMode {
  return x === 'ir' || x === 'source' || x === 'rich';
}

export function isExtensionConfig(x: unknown): x is ExtensionConfig {
  if (!isRecord(x)) return false;
  const editor = x.editor;
  const image = x.image;
  const exp = x.export;
  if (!isRecord(editor) || !isRecord(image) || !isRecord(exp)) return false;
  if (!isRecord(exp.pdf)) return false;
  const theme = editor.theme;
  if (theme !== 'auto' && theme !== 'light' && theme !== 'dark') return false;
  if (!isNumber(editor.fontSize)) return false;
  if (!isString(editor.fontFamily)) return false;
  if (!isString(image.saveDirectory)) return false;
  if (!isNumber(image.compressThreshold)) return false;
  if (!isNumber(image.compressQuality)) return false;
  const pdf = exp.pdf;
  const fmt = pdf.format;
  if (fmt !== 'A4' && fmt !== 'A3' && fmt !== 'Letter' && fmt !== 'Legal') return false;
  const margin = pdf.margin;
  if (!isRecord(margin)) return false;
  return (
    isNumber(margin.top) &&
    isNumber(margin.right) &&
    isNumber(margin.bottom) &&
    isNumber(margin.left)
  );
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

export function isExtensionMessage(msg: unknown): msg is ExtensionMessage {
  if (!isRecord(msg) || !isString(msg.type)) return false;

  switch (msg.type) {
    case 'INIT': {
      const p = msg.payload;
      if (!isRecord(p) || !isString(p.content) || !isExtensionConfig(p.config)) return false;
      if (p.version !== undefined && !isNumber(p.version)) return false;
      if (p.hostDiagnostics !== undefined && !isHostDiagnostics(p.hostDiagnostics)) return false;
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
      const mode = p.mode;
      return mode === 'preview' || isEditorMode(mode);
    }
    case 'SAVE':
      return true;
    case 'SAVE_SUCCESS': {
      const p = msg.payload;
      return isRecord(p) && isNumber(p.version);
    }
    case 'IMAGE_SAVED': {
      const p = msg.payload;
      return isRecord(p) && isString(p.path) && isString(p.filename);
    }
    case 'IMAGE_SAVE_FAILED': {
      const p = msg.payload;
      return isRecord(p) && isString(p.filename) && isString(p.error);
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
    case 'IMAGE_REF_REPLACEMENT': {
      const p = msg.payload;
      return isRecord(p) && isString(p.fromRef) && isString(p.toRef);
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
          p.value === 'tidyTables'
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
    default:
      return false;
  }
}

export function isWebViewMessage(msg: unknown): msg is WebViewMessage {
  if (!isRecord(msg) || !isString(msg.type)) return false;

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
      return isRecord(p) && isString(p.data) && isString(p.filename);
    }
    case 'UPLOAD_IMAGE': {
      const p = msg.payload;
      return isRecord(p) && isString(p.base64) && isString(p.filename);
    }
    case 'CHECK_LOCAL_IMAGE_REFS': {
      const p = msg.payload;
      return isRecord(p) && isString(p.requestId) && Array.isArray(p.refs) && p.refs.every((x) => isString(x));
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
    case 'EXPORT': {
      const p = msg.payload;
      if (!isRecord(p) || !isString(p.format)) return false;
      return p.format === 'pdf' || p.format === 'html' || p.format === 'image';
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
