import { describe, expect, it } from 'vitest';
import type { ExtensionConfig, ExtensionMessage, WebViewMessage } from '../index';
import { isExtensionConfig, isExtensionMessage, isWebViewMessage } from '../messageGuards';

const minimalConfig: ExtensionConfig = {
  editor: {
    theme: 'auto',
    fontSize: 14,
    fontFamily: 'system-ui',
  },
  image: {
    saveDirectory: './assets',
    compressThreshold: 512000,
    compressQuality: 0.8,
  },
  export: {
    pdf: {
      format: 'A4',
      margin: { top: 25, right: 20, bottom: 25, left: 20 },
    },
  },
};

describe('messageGuards — Extension → Webview', () => {
  const samples: ExtensionMessage[] = [
    { type: 'INIT', payload: { content: '# x', config: minimalConfig, version: 3 } },
    { type: 'INIT', payload: { content: '# x', config: minimalConfig } },
    {
      type: 'INIT',
      payload: {
        content: '# x',
        config: minimalConfig,
        hostDiagnostics: {
          vscodeVersion: '1.99.0',
          extensionVersion: '1.5.4',
          platform: 'darwin',
          arch: 'arm64',
          configSnapshot: {
            theme: 'auto',
            fontSize: 14,
            wrapPolicy: 'autoWrap',
            tableCellWrap: 'wrap',
            enableMermaid: true,
            enableShiki: false,
          },
        },
      },
    },
    { type: 'CONTENT_UPDATE', payload: { content: 'a', version: 2 } },
    { type: 'CONTENT_UPDATE', payload: { content: 'a' } },
    { type: 'CONFIG_CHANGE', payload: { config: { editor: { theme: 'dark' } } } },
    { type: 'SWITCH_MODE', payload: { mode: 'ir' } },
    { type: 'SWITCH_MODE', payload: { mode: 'source' } },
    { type: 'SWITCH_MODE', payload: { mode: 'preview' } },
    { type: 'SAVE' },
    { type: 'SAVE_SUCCESS', payload: { version: 9 } },
    { type: 'IMAGE_SAVED', payload: { path: 'assets/a.png', filename: 'a.png' } },
    { type: 'THEME_CHANGE', payload: { theme: 'Default Dark Modern' } },
    { type: 'getScrollPosition', requestId: 'rid-1' },
    { type: 'setScrollPosition', scrollTop: 10, scrollLeft: 2 },
  ];

  it('each listed ExtensionMessage is accepted', () => {
    for (const msg of samples) {
      expect(isExtensionMessage(msg)).toBe(true);
    }
  });

  it('rejects wrong shapes (behavioral, not existence-only)', () => {
    expect(isExtensionMessage(null)).toBe(false);
    expect(isExtensionMessage({})).toBe(false);
    expect(isExtensionMessage({ type: 'INIT' })).toBe(false);
    expect(isExtensionMessage({ type: 'INIT', payload: { content: 1, config: minimalConfig } })).toBe(false);
    expect(isExtensionMessage({ type: 'UNKNOWN' })).toBe(false);
    expect(isExtensionMessage({ type: 'SAVE_SUCCESS', payload: { version: 'x' } })).toBe(false);
  });

  it('isExtensionConfig matches minimalConfig', () => {
    expect(isExtensionConfig(minimalConfig)).toBe(true);
    expect(isExtensionConfig({})).toBe(false);
  });
});

describe('messageGuards — Webview → Extension', () => {
  const samples: WebViewMessage[] = [
    { type: 'READY' },
    { type: 'CONTENT_CHANGE', payload: { content: 'x', version: 1 } },
    {
      type: 'CONTENT_CHANGE',
      payload: { content: 'x', cursor: { lineNumber: 0, column: 0 } },
    },
    { type: 'SAVE', payload: { content: 'save-me' } },
    { type: 'SAVE_IMAGE', payload: { data: 'base64', filename: 'a.png' } },
    { type: 'UPLOAD_IMAGE', payload: { base64: 'base64', filename: 'b.png' } },
    {
      type: 'OPEN_IMAGE_PREVIEW',
      payload: { src: 's.png', images: ['s.png'], index: 0 },
    },
    { type: 'OPEN_IMAGE_EDITOR', payload: { src: 's.png' } },
    { type: 'EXPORT', payload: { format: 'pdf' } },
    {
      type: 'scrollPositionResponse',
      requestId: 'uri-1',
      scrollTop: 4,
      scrollLeft: 0,
    },
  ];

  it('each listed WebViewMessage is accepted', () => {
    for (const msg of samples) {
      expect(isWebViewMessage(msg)).toBe(true);
    }
  });

  it('rejects wrong shapes', () => {
    expect(isWebViewMessage({ type: 'CONTENT_CHANGE', payload: { content: 1 } })).toBe(false);
    expect(isWebViewMessage({ type: 'EXPORT', payload: { format: 'doc' } })).toBe(false);
    expect(isWebViewMessage({ type: 'SCROLL', requestId: 'x' })).toBe(false);
  });
});
