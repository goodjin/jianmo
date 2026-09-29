import { describe, it, expect, vi, afterEach } from 'vitest';

// Node 的 fs.* 不可配置，vi.spyOn 无法 redefine；改用模块级 vi.mock 注入可控 fs。
vi.mock('fs', async (actual) => {
  const real = (await actual()) as Record<string, unknown>;
  return {
    ...real,
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => ''),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

import * as fs from 'fs';
import { loadAppConfig, getConfigPath, saveAppConfigPatch } from './config';

/**
 * 行为测试：mock fs，验证 loadAppConfig 的真实分支（默认 / 合并 / 容错）。
 * 非存在性测试：断言具体字段值，而非"函数不报错"。
 */
describe('loadAppConfig', () => {
  afterEach(() => {
    vi.mocked(fs.existsSync).mockReset();
    vi.mocked(fs.readFileSync).mockReset();
    vi.mocked(fs.mkdirSync).mockReset();
    vi.mocked(fs.writeFileSync).mockReset();
  });

  it('无配置文件 → 返回默认值（各字段具体值）', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const cfg = loadAppConfig();
    expect(cfg.editor.theme).toBe('auto');
    expect(cfg.editor.fontSize).toBe(14);
    expect(cfg.editor.enableMermaid).toBe(true);
    expect(cfg.editor.enableShiki).toBe(false);
    expect(cfg.image.saveDirectory).toBe('./assets');
    expect(cfg.image.sameNameHandling).toBe('rename');
    expect(cfg.export.pdf.format).toBe('A4');
    expect(cfg.export.html?.theme).toBe('default');
    expect(cfg.export.diagram?.mermaidScriptBundling).toBe('embedded');
    expect(cfg.telemetry.enabled).toBe(false);
    expect(cfg.ai?.rewriteProvider).toBe('mock');
  });

  it('用户覆盖项合并进默认（覆盖生效 + 未覆盖项保留默认）', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        editor: { theme: 'dark', fontSize: 18 },
        image: { saveDirectory: './img' },
        export: { html: { theme: 'print-friendly' } },
      })
    );
    const cfg = loadAppConfig();
    expect(cfg.editor.theme).toBe('dark'); // 覆盖
    expect(cfg.editor.fontSize).toBe(18); // 覆盖
    expect(cfg.editor.enableMermaid).toBe(true); // 保留默认
    expect(cfg.image.saveDirectory).toBe('./img'); // 覆盖
    expect(cfg.export.html?.theme).toBe('print-friendly'); // 深层覆盖
    expect(cfg.export.pdf.format).toBe('A4'); // 保留默认
    expect(cfg.editor.wrapPolicy).toBe('autoWrap'); // 保留默认
  });

  it('非法 JSON → 兜底默认（不抛错）', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('{ 不是合法 json');
    const cfg = loadAppConfig();
    expect(cfg.editor.theme).toBe('auto');
    expect(cfg.export.pdf.format).toBe('A4');
  });

  it('getConfigPath 指向 ~/.markly/config.json', () => {
    const p = getConfigPath();
    expect(p).toMatch(/\.markly[\\/]config\.json$/);
  });

  it('saveAppConfigPatch 把 editor.theme 写入 config.json', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    saveAppConfigPatch({ editor: { theme: 'nord' } });
    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalled();
    const written = String(vi.mocked(fs.writeFileSync).mock.calls[0]?.[1] ?? '');
    const parsed = JSON.parse(written) as { editor: { theme: string } };
    expect(parsed.editor.theme).toBe('nord');
  });
});
