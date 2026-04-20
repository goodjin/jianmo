/**
 * Extension ⇄ Webview 消息运行时校验（契约测试与防守式解析用）
 * @module types/messageGuards
 */
import type { EditorMode, ExtensionConfig, ExtensionMessage, WebViewMessage } from './index';

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function isString(x: unknown): x is string {
  return typeof x === 'string';
}

function isNumber(x: unknown): x is number {
  return typeof x === 'number' && !Number.isNaN(x);
}

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

export function isExtensionMessage(msg: unknown): msg is ExtensionMessage {
  if (!isRecord(msg) || !isString(msg.type)) return false;

  switch (msg.type) {
    case 'INIT': {
      const p = msg.payload;
      if (!isRecord(p) || !isString(p.content) || !isExtensionConfig(p.config)) return false;
      if (p.version !== undefined && !isNumber(p.version)) return false;
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
