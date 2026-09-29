import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ExtensionConfig } from '../../src/types';

// mock electron：hostBridge 仅用到 shell.openExternal
vi.mock('electron', () => ({
  shell: { openExternal: vi.fn() },
}));

vi.mock('./config', () => ({
  saveAppConfigPatch: vi.fn(),
}));

import { shell } from 'electron';
import { createHostBridge, type HostBridgeOptions } from './hostBridge';
import { saveAppConfigPatch } from './config';
import { getEditorPalette } from '../../webview/src/shared/themeConfig';

function defaultConfig(): ExtensionConfig {
  return {
    telemetry: { enabled: false },
    editor: {
      theme: 'auto', fontSize: 14 as never, fontFamily: '', wrapPolicy: 'autoWrap',
      tableCellWrap: 'wrap', enableMermaid: true, enableShiki: false, richTableColumnResize: 'auto',
    },
    image: {
      saveDirectory: './assets', compressThreshold: 0 as never, compressQuality: 0 as never,
      sameNameHandling: 'rename',
    },
    export: {
      pdf: { format: 'A4', margin: {} as never, includeToc: true, displayHeaderFooter: true, template: 'default' },
      html: { theme: 'default' },
      diagram: { mermaidScriptBundling: 'embedded' },
    },
    ai: { rewriteSelectionEnabled: false, rewriteProvider: 'mock' },
  };
}

function makeBridge(overrides: Partial<HostBridgeOptions> = {}) {
  const sent: { type: string; payload?: unknown }[] = [];
  let content = '# 标题\n\n正文段落。';
  const opts: HostBridgeOptions = {
    config: defaultConfig(),
    store: { get: vi.fn(), set: vi.fn() } as never,
    sendToRenderer: (m) => sent.push(m as { type: string; payload?: unknown }),
    getCurrentContent: () => content,
    getCurrentDocDir: () => '/tmp',
    setCurrentContent: (s) => { content = s; },
    ...overrides,
  };
  return { bridge: createHostBridge(opts), sent, getContent: () => content };
}

/**
 * 行为测试：READY→INIT、REQUEST_PREVIEW_HTML→真实 buildExportHtmlString 渲染、
 * 错误路径、链接 scheme 校验、内容更新、未知消息忽略。覆盖各分支。
 */
describe('createHostBridge.handleMessage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('READY → 发送 INIT，携带 content + initialEditorMode=preview + config', async () => {
    const { bridge, sent } = makeBridge();
    await bridge.handleMessage({ type: 'READY', payload: undefined });
    const init = sent.find((m) => m.type === 'INIT') as
      | { type: string; payload: { content: string; initialEditorMode: string; config: unknown } }
      | undefined;
    expect(init).toBeDefined();
    expect(init!.payload.content).toContain('# 标题');
    expect(init!.payload.initialEditorMode).toBe('preview');
    expect(init!.payload.config).toBeDefined();
  });

  it('REQUEST_PREVIEW_HTML → 真实渲染并发 PREVIEW_HTML，html 含标题与正文', async () => {
    const { bridge, sent } = makeBridge({ getCurrentContent: () => '# 标题\n\n正文段落。' });
    await bridge.handleMessage({ type: 'REQUEST_PREVIEW_HTML', payload: {} });
    const pv = sent.find((m) => m.type === 'PREVIEW_HTML') as
      | { type: string; payload: { html?: string; error?: string } }
      | undefined;
    expect(pv).toBeDefined();
    expect(pv!.payload.html).toBeDefined();
    expect(pv!.payload.html).toContain('<h1');
    expect(pv!.payload.html).toContain('正文段落');
  });

  it('REQUEST_PREVIEW_HTML → 渲染抛错时发 PREVIEW_HTML(error)', async () => {
    const { bridge, sent } = makeBridge({ getCurrentContent: () => { throw new Error('boom'); } });
    await bridge.handleMessage({ type: 'REQUEST_PREVIEW_HTML', payload: {} });
    const pv = sent.find((m) => m.type === 'PREVIEW_HTML') as
      | { type: string; payload: { html?: string; error?: string } }
      | undefined;
    expect(pv).toBeDefined();
    expect(pv!.payload.error).toContain('boom');
    expect(pv!.payload.html).toBeUndefined();
  });

  it('OPEN_EXTERNAL_LINK → 放行 http/https，拒绝 file: 等其他 scheme', async () => {
    const { bridge } = makeBridge();
    await bridge.handleMessage({ type: 'OPEN_EXTERNAL_LINK', payload: { url: 'https://example.com/a' } });
    expect(shell.openExternal).toHaveBeenCalledWith('https://example.com/a');

    await bridge.handleMessage({ type: 'OPEN_EXTERNAL_LINK', payload: { url: 'file:///etc/passwd' } });
    expect(shell.openExternal).not.toHaveBeenCalledWith('file:///etc/passwd');

    await bridge.handleMessage({ type: 'OPEN_EXTERNAL_LINK', payload: { url: 'javascript:alert(1)' } });
    expect(shell.openExternal).not.toHaveBeenCalledWith('javascript:alert(1)');
  });

  it('CONTENT_CHANGE → 更新当前内容', async () => {
    const { bridge, getContent } = makeBridge();
    await bridge.handleMessage({ type: 'CONTENT_CHANGE', payload: { content: 'new body' } });
    expect(getContent()).toBe('new body');
  });

  it('SAVE → 同步内容（P1 不写盘但不丢内容）', async () => {
    const { bridge, getContent } = makeBridge();
    await bridge.handleMessage({ type: 'SAVE', payload: { content: 'saved body' } });
    expect(getContent()).toBe('saved body');
  });

  it('SET_EDITOR_THEME → 记住主题并下发 CONFIG_CHANGE', async () => {
    const { bridge, sent } = makeBridge();
    await bridge.handleMessage({ type: 'SET_EDITOR_THEME', payload: { theme: 'nord' } });
    expect(saveAppConfigPatch).toHaveBeenCalledWith({ editor: { theme: 'nord' } });
    const change = sent.find((m) => m.type === 'CONFIG_CHANGE') as
      | { type: string; payload: { config: { editor: { theme: string } } } }
      | undefined;
    expect(change?.payload.config.editor.theme).toBe('nord');
  });

  it('未实现消息静默忽略（不抛错、不发消息）', async () => {
    const { bridge, sent } = makeBridge();
    await expect(
      bridge.handleMessage({ type: 'FIND_MARKDOWN_BACKLINKS', payload: { requestId: 'r1' } } as never)
    ).resolves.not.toThrow();
    expect(sent.length).toBe(0);
  });

  describe('本地相对图片内联', () => {
    const tmpDirs: string[] = [];

    afterEach(() => {
      for (const dir of tmpDirs.splice(0)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it('REQUEST_PREVIEW_HTML 把文档目录内相对图片改写成 data URL', async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markly-host-img-'));
      tmpDirs.push(dir);
      fs.writeFileSync(path.join(dir, 'pic.png'), 'IMGBYTES');
      const { bridge, sent } = makeBridge({
        getCurrentContent: () => '# 图\n\n![x](./pic.png)\n',
        getCurrentDocDir: () => dir,
      });
      await bridge.handleMessage({ type: 'REQUEST_PREVIEW_HTML', payload: {} });
      const pv = sent.find((m) => m.type === 'PREVIEW_HTML') as
        | { type: string; payload: { html?: string; error?: string } }
        | undefined;
      expect(pv?.payload.html).toBeDefined();
      expect(pv!.payload.html).toContain('data:image/png;base64,');
      expect(pv!.payload.html).not.toContain('src="./pic.png"');
      expect(pv!.payload.html).toContain('alt="x"');
    });

    it('REQUEST_PREVIEW_HTML 不改写 https 图片', async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markly-host-img-'));
      tmpDirs.push(dir);
      const { bridge, sent } = makeBridge({
        getCurrentContent: () => '![r](https://example.com/a.png)\n',
        getCurrentDocDir: () => dir,
      });
      await bridge.handleMessage({ type: 'REQUEST_PREVIEW_HTML', payload: {} });
      const pv = sent.find((m) => m.type === 'PREVIEW_HTML') as
        | { type: string; payload: { html?: string } }
        | undefined;
      expect(pv?.payload.html).toContain('src="https://example.com/a.png"');
    });
  });
});


describe('预览 HTML 的主题与字体', () => {
  it('按 editor.theme 注入所选配色', async () => {
    const config = defaultConfig();
    config.editor.theme = 'dracula';
    const { bridge, sent } = makeBridge({ config });
    await bridge.handleMessage({ type: 'REQUEST_PREVIEW_HTML', payload: {} } as never);
    const html = String((sent.find((m) => m.type === 'PREVIEW_HTML')?.payload as { html: string }).html);
    const dracula = getEditorPalette('dracula');
    expect(html).toContain('data-markly-preview-theme');
    expect(html).toContain(`--bg-color: ${dracula.colors.background}`);
    expect(html).not.toContain(`--bg-color: ${getEditorPalette('github-light').colors.background};\n      --text-color: ${getEditorPalette('github-light').colors.text}`);
  });

  it('auto 跟随系统：prefersDark 决定明暗配色', async () => {
    const dark = makeBridge({ config: defaultConfig(), getPrefersDark: () => true });
    await dark.bridge.handleMessage({ type: 'REQUEST_PREVIEW_HTML', payload: {} } as never);
    const darkHtml = String((dark.sent.find((m) => m.type === 'PREVIEW_HTML')?.payload as { html: string }).html);
    expect(darkHtml).toContain(`--bg-color: ${getEditorPalette('github-dark').colors.background}`);

    const light = makeBridge({ config: defaultConfig(), getPrefersDark: () => false });
    await light.bridge.handleMessage({ type: 'REQUEST_PREVIEW_HTML', payload: {} } as never);
    const lightHtml = String((light.sent.find((m) => m.type === 'PREVIEW_HTML')?.payload as { html: string }).html);
    expect(lightHtml).toContain(`--bg-color: ${getEditorPalette('github-light').colors.background}`);
  });

  it('字体与字号一并注入正文', async () => {
    const config = defaultConfig();
    config.editor.fontFamily = 'Georgia, serif';
    config.editor.fontSize = 21 as never;
    const { bridge, sent } = makeBridge({ config });
    await bridge.handleMessage({ type: 'REQUEST_PREVIEW_HTML', payload: {} } as never);
    const html = String((sent.find((m) => m.type === 'PREVIEW_HTML')?.payload as { html: string }).html);
    expect(html).toContain('font-family: Georgia, serif;');
    expect(html).toContain('font-size: 21px;');
  });

  it('改主题后重新出图会换成新配色', async () => {
    const config = defaultConfig();
    config.editor.theme = 'github-light';
    const { bridge, sent } = makeBridge({ config });
    await bridge.handleMessage({ type: 'REQUEST_PREVIEW_HTML', payload: {} } as never);
    config.editor.theme = 'nord';
    await bridge.handleMessage({ type: 'REQUEST_PREVIEW_HTML', payload: {} } as never);
    const htmls = sent
      .filter((m) => m.type === 'PREVIEW_HTML')
      .map((m) => String((m.payload as { html: string }).html));
    expect(htmls[0]).toContain(`--bg-color: ${getEditorPalette('github-light').colors.background}`);
    expect(htmls[1]).toContain(`--bg-color: ${getEditorPalette('nord').colors.background}`);
  });
});
