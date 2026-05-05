import { describe, expect, it } from 'vitest';
import type { ExtensionConfig, ExtensionMessage, WebViewMessage } from '../index';
import { isExtensionConfig, isExtensionMessage, isWebViewMessage } from '../messageGuards';

const minimalConfig: ExtensionConfig = {
  telemetry: { enabled: false },
  editor: {
    theme: 'auto',
    fontSize: 14,
    fontFamily: 'system-ui',
    wrapPolicy: 'autoWrap',
    tableCellWrap: 'wrap',
    enableMermaid: true,
    enableShiki: false,
    richTableColumnResize: 'auto',
  },
  image: {
    saveDirectory: './assets',
    compressThreshold: 512000,
    compressQuality: 0.8,
    sameNameHandling: 'rename',
  },
  export: {
    pdf: {
      format: 'A4',
      margin: { top: 25, right: 20, bottom: 25, left: 20 },
      includeToc: true,
      displayHeaderFooter: true,
    },
    html: { theme: 'default' },
    preflight: { scope: 'full', blockOnIssues: false },
  },
  ai: { rewriteSelectionEnabled: false },
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
    { type: 'IMAGE_SAVED', payload: { path: 'assets/a.png', filename: 'a-2.png', requestId: 'u1' } },
    { type: 'IMAGE_SAVE_FAILED', payload: { filename: 'a.png', error: 'disk full' } },
    { type: 'IMAGE_SAVE_FAILED', payload: { filename: 'a.png', error: 'x', requestId: 'u2' } },
    {
      type: 'LOCAL_IMAGE_REFS_RESULT',
      payload: {
        requestId: 'img-1',
        results: [
          { ref: './assets/a.png', exists: true, resolvedPath: '/repo/assets/a.png' },
          { ref: './assets/missing.png', exists: false, resolvedPath: '/repo/assets/missing.png', error: 'FileNotFound' },
        ],
      },
    },
    { type: 'ASSETS_IMAGE_FILES_RESULT', payload: { requestId: 'ast-1', relativePaths: ['assets/a.png'] } },
    { type: 'ASSETS_IMAGE_FILES_RESULT', payload: { requestId: 'ast-2', relativePaths: [], error: 'ENOENT' } },
    {
      type: 'MARKDOWN_BACKLINKS_RESULT',
      payload: {
        requestId: 'bl-r1',
        items: [{ uri: 'file:///repo/notes/from.md', workspaceRelativePath: 'notes/from.md' }],
      },
    },
    { type: 'MARKDOWN_BACKLINKS_RESULT', payload: { requestId: 'bl-r2', items: [], error: 'no_workspace' } },
    { type: 'MARKDOWN_BACKLINKS_RESULT', payload: { requestId: 'bl-r3', items: [{ uri: 'file:///x/a.md', workspaceRelativePath: 'a.md' }], truncated: true } },
    { type: 'MARKDOWN_HOVER_PREVIEW_RESULT', payload: { requestId: 'hp-1', ok: true, title: 'T', excerpt: 'x', targetUri: 'file:///repo/t.md' } },
    { type: 'MARKDOWN_HOVER_PREVIEW_RESULT', payload: { requestId: 'hp-2', ok: false, error: 'no_workspace' } },
    { type: 'IMAGE_REF_REPLACEMENT', payload: { fromRef: './missing.png', toRef: './assets/fixed.png' } },
    { type: 'IMAGE_REF_REPAIR_OUTCOME', payload: { fromRef: './missing.png', status: 'cancelled' } },
    { type: 'IMAGE_REF_REPAIR_OUTCOME', payload: { fromRef: './missing.png', status: 'replaced' } },
    { type: 'EDITOR_COMMAND', payload: { command: 'insert', value: 'table' } },
    { type: 'EDITOR_COMMAND', payload: { command: 'insert', value: 'hr' } },
    { type: 'EDITOR_COMMAND', payload: { command: 'toggleOutline' } },
    { type: 'EDITOR_COMMAND', payload: { command: 'toggleFindReplace' } },
    { type: 'EDITOR_COMMAND', payload: { command: 'pastePlain' } },
    { type: 'EDITOR_COMMAND', payload: { command: 'findNavigate', direction: 'next' } },
    { type: 'EDITOR_COMMAND', payload: { command: 'findNavigate', direction: 'previous' } },
    { type: 'EDITOR_COMMAND', payload: { command: 'documentReplace', from: './old.png', to: './new.png' } },
    { type: 'EDITOR_COMMAND', payload: { command: 'wrapUrlLink' } },
    { type: 'EDITOR_COMMAND', payload: { command: 'writingAssist', value: 'rewriteSelection' } },
    { type: 'EDITOR_COMMAND', payload: { command: 'richTable', value: 'addRowAfter' } },
    { type: 'EDITOR_COMMAND', payload: { command: 'richTable', value: 'deleteTable' } },
    { type: 'EDITOR_COMMAND', payload: { command: 'richTable', value: 'deleteCol' } },
    { type: 'EDITOR_COMMAND', payload: { command: 'imageAsset', value: 'repairFirstMissingRef' } },
    { type: 'EDITOR_COMMAND', payload: { command: 'imageAsset', value: 'copyUnreferencedAssetList' } },
    { type: 'EDITOR_COMMAND', payload: { command: 'imageAsset', value: 'openImageAssetsPanel' } },
    { type: 'EDITOR_COMMAND', payload: { command: 'writingAssist', value: 'summarize' } },
    { type: 'EDITOR_COMMAND', payload: { command: 'writingAssist', value: 'convertTextToGfmTable' } },
    { type: 'THEME_CHANGE', payload: { theme: 'Default Dark Modern' } },
    { type: 'getScrollPosition', requestId: 'rid-1' },
    { type: 'setScrollPosition', scrollTop: 10, scrollLeft: 2 },
    { type: 'AI_REWRITE_SELECTION_RESULT', payload: { requestId: 'rw-1', ok: true, text: 'Hello.' } },
    { type: 'AI_REWRITE_SELECTION_RESULT', payload: { requestId: 'rw-2', ok: false, error: 'No key' } },
    { type: 'AI_SUMMARY_RESULT', payload: { requestId: 'sum-1', ok: true, text: '- 摘要' } },
    { type: 'AI_SUMMARY_RESULT', payload: { requestId: 'sum-2', ok: false, error: 'x' } },
    {
      type: 'AI_SUGGEST_TITLES_RESULT',
      payload: { requestId: 't-1', ok: true, items: [{ title: '标题', style: '简洁', reason: '更短' }] },
    },
    { type: 'AI_SUGGEST_TITLES_RESULT', payload: { requestId: 't-2', ok: false, error: 'x' } },
    {
      type: 'AI_CONVERT_TEXT_TO_TABLE_RESULT',
      payload: { requestId: 'ct-1', ok: true, markdown: '| a | b |\n| --- | --- |\n| 1 | 2 |\n' },
    },
    { type: 'AI_CONVERT_TEXT_TO_TABLE_RESULT', payload: { requestId: 'ct-2', ok: false, error: 'x' } },
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
    expect(isExtensionMessage({ type: 'IMAGE_SAVE_FAILED', payload: { filename: 'a.png' } })).toBe(false);
    expect(isExtensionMessage({ type: 'LOCAL_IMAGE_REFS_RESULT', payload: { requestId: 'x', results: [{ ref: 'a.png' }] } })).toBe(false);
    expect(isExtensionMessage({ type: 'IMAGE_REF_REPLACEMENT', payload: { fromRef: './a.png' } })).toBe(false);
    expect(isExtensionMessage({ type: 'EDITOR_COMMAND', payload: { command: 'insert', value: 'unknown' } })).toBe(false);
    expect(isExtensionMessage({ type: 'EDITOR_COMMAND', payload: { command: 'richTable', value: 'unknown' } })).toBe(false);
    expect(isExtensionMessage({ type: 'EDITOR_COMMAND', payload: { command: 'imageAsset', value: 'unknown' } })).toBe(false);
    expect(isExtensionMessage({ type: 'EDITOR_COMMAND', payload: { command: 'toggleFindReplace', value: 'x' } })).toBe(false);
    expect(
      isExtensionMessage({ type: 'EDITOR_COMMAND', payload: { command: 'documentReplace', from: '', to: 'z' } })
    ).toBe(false);
    expect(
      isExtensionMessage({
        type: 'EDITOR_COMMAND',
        payload: { command: 'findNavigate', direction: 'next', extra: true },
      })
    ).toBe(false);
    expect(
      isExtensionMessage({
        type: 'ASSETS_IMAGE_FILES_RESULT',
        payload: { requestId: 'x', relativePaths: [1 as unknown as string] },
      })
    ).toBe(false);
    expect(
      isExtensionMessage({
        type: 'AI_SUGGEST_TITLES_RESULT',
        payload: { requestId: 'x', ok: true, items: [{ title: 't', style: 1 }] },
      })
    ).toBe(false);
    expect(
      isExtensionMessage({
        type: 'AI_CONVERT_TEXT_TO_TABLE_RESULT',
        payload: { requestId: 'x', ok: true, markdown: 1 },
      } as unknown)
    ).toBe(false);
    expect(
      isExtensionMessage({
        type: 'IMAGE_REF_REPAIR_OUTCOME',
        payload: { fromRef: './a.png', status: 'pending' },
      })
    ).toBe(false);
  });

  it('isExtensionConfig matches minimalConfig', () => {
    expect(isExtensionConfig(minimalConfig)).toBe(true);
    expect(isExtensionConfig({})).toBe(false);
  });

  it('isExtensionConfig rejects missing telemetry (M95)', () => {
    const bad: Record<string, unknown> = { ...minimalConfig };
    delete bad.telemetry;
    expect(isExtensionConfig(bad)).toBe(false);
  });

  it('isExtensionConfig accepts M82 export.html optional fields', () => {
    const cfg: ExtensionConfig = {
      ...minimalConfig,
      export: {
        ...minimalConfig.export,
        html: {
          ...minimalConfig.export.html!,
          copyLocalImages: true,
          assetsSubdirectory: 'my-pack',
        },
      },
    };
    expect(isExtensionConfig(cfg)).toBe(true);
  });

  it('isExtensionConfig accepts optional templates.userDirectory (M90)', () => {
    const cfg: ExtensionConfig = {
      ...minimalConfig,
      templates: { userDirectory: '/tmp/my-templates' },
    };
    expect(isExtensionConfig(cfg)).toBe(true);
  });

  it('isExtensionConfig rejects non-string templates.userDirectory (M90)', () => {
    const cfg: any = { ...minimalConfig, templates: { userDirectory: 1 } };
    expect(isExtensionConfig(cfg)).toBe(false);
  });

  it('isExtensionConfig rejects non-boolean export.html.copyLocalImages', () => {
    const cfg = {
      ...minimalConfig,
      export: {
        ...minimalConfig.export,
        html: { ...minimalConfig.export.html!, copyLocalImages: 'yes' },
      },
    };
    expect(isExtensionConfig(cfg)).toBe(false);
  });

  it('isExtensionConfig rejects invalid export.preflight.scope (M83)', () => {
    const cfg = {
      ...minimalConfig,
      export: {
        ...minimalConfig.export,
        preflight: { scope: 'lite' as any, blockOnIssues: false },
      },
    };
    expect(isExtensionConfig(cfg)).toBe(false);
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
    { type: 'SAVE_IMAGE', payload: { data: 'base64', filename: 'a.png', requestId: 'rid-9' } },
    { type: 'UPLOAD_IMAGE', payload: { base64: 'base64', filename: 'b.png' } },
    { type: 'UPLOAD_IMAGE', payload: { base64: 'base64', filename: 'b.png', requestId: 'rid-8' } },
    { type: 'CHECK_LOCAL_IMAGE_REFS', payload: { requestId: 'img-1', refs: ['./a.png', '../b.png'] } },
    { type: 'LIST_ASSETS_IMAGE_FILES', payload: { requestId: 'ast-req-1' } },
    { type: 'FIND_MARKDOWN_BACKLINKS', payload: { requestId: 'bl-find-1' } },
    { type: 'OPEN_MARKDOWN_DOCUMENT', payload: { uri: 'file:///work/a.md' } },
    { type: 'MARKDOWN_HOVER_PREVIEW_REQUEST', payload: { requestId: 'hp-req-1', href: './a.md#t' } },
    { type: 'OPEN_WORKSPACE_SEARCH', payload: { query: 'hello' } },
    { type: 'OPEN_IMAGE_DIRECTORY', payload: { kind: 'assets' } },
    { type: 'OPEN_IMAGE_DIRECTORY', payload: { kind: 'resolved', resolvedPath: '/repo/assets/missing.png' } },
    { type: 'REPAIR_IMAGE_REF', payload: { ref: './assets/missing.png' } },
    {
      type: 'OPEN_IMAGE_PREVIEW',
      payload: { src: 's.png', images: ['s.png'], index: 0 },
    },
    { type: 'OPEN_IMAGE_EDITOR', payload: { src: 's.png' } },
    { type: 'OPEN_EXTERNAL_LINK', payload: { url: 'https://example.com' } },
    { type: 'EXPORT', payload: { format: 'pdf' } },
    { type: 'EXPORT', payload: { format: 'preview' } },
    { type: 'AI_REWRITE_SELECTION_REQUEST', payload: { requestId: 'rw-1', text: 'hello' } },
    { type: 'AI_SUMMARY_REQUEST', payload: { requestId: 'sum-req-1', text: '# a', scope: 'document' } },
    { type: 'AI_SUGGEST_TITLES_REQUEST', payload: { requestId: 't-req-1', text: '# a\n\nb' } },
    { type: 'AI_CONVERT_TEXT_TO_TABLE_REQUEST', payload: { requestId: 'ct-req-1', text: 'H1\tH2\n1\t2' } },
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
    expect(isWebViewMessage({ type: 'CHECK_LOCAL_IMAGE_REFS', payload: { requestId: 'x', refs: [1] } })).toBe(false);
    expect(
      isWebViewMessage({
        type: 'LIST_ASSETS_IMAGE_FILES',
        payload: { requestId: 'x', extra: 1 },
      })
    ).toBe(false);
    expect(isWebViewMessage({ type: 'OPEN_IMAGE_DIRECTORY', payload: { kind: 'unknown' } })).toBe(false);
    expect(isWebViewMessage({ type: 'REPAIR_IMAGE_REF', payload: { ref: 1 } })).toBe(false);
    expect(isWebViewMessage({ type: 'OPEN_EXTERNAL_LINK', payload: { url: '' } })).toBe(false);
    expect(isWebViewMessage({ type: 'OPEN_MARKDOWN_DOCUMENT', payload: { uri: '' } })).toBe(false);
    expect(isWebViewMessage({ type: 'FIND_MARKDOWN_BACKLINKS', payload: { requestId: 'x', extra: 1 } })).toBe(false);
    expect(isWebViewMessage({ type: 'OPEN_WORKSPACE_SEARCH', payload: { query: '   ' } })).toBe(false);
    expect(isWebViewMessage({ type: 'AI_SUGGEST_TITLES_REQUEST', payload: { requestId: 'x', text: '   ' } })).toBe(
      false
    );
    expect(isWebViewMessage({ type: 'AI_CONVERT_TEXT_TO_TABLE_REQUEST', payload: { requestId: 'x', text: '   ' } })).toBe(
      false
    );
    expect(isWebViewMessage({ type: 'SCROLL', requestId: 'x' })).toBe(false);
  });
});
