import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  ALTERNATE_TEXT_EXTENSIONS,
  IN_APP_ONLY_EXTENSIONS,
  OS_FILE_ASSOCIATIONS,
  UNCLAIMED_TEXT_EXTENSIONS,
  isMarkdownFileName,
  isOpenableDocumentName,
  previewKindFromName,
  structuredKindFromName,
  userLaunchArgs,
} from './documentKind';

describe('structuredKindFromName', () => {
  it('认 json / jsonl，大小写不敏感，jsonl 不会被当成 json', () => {
    expect(structuredKindFromName('data.json')).toBe('json');
    expect(structuredKindFromName('DATA.JSON')).toBe('json');
    expect(structuredKindFromName('C:\\docs\\rows.JSONL')).toBe('jsonl');
    expect(structuredKindFromName('/docs/rows.jsonl')).toBe('jsonl');
    expect(structuredKindFromName('notes.json.jsonl')).toBe('jsonl');
    expect(structuredKindFromName('notes.jsonl.json')).toBe('json');
  });

  it('Markdown 和其它类型不是结构化文档', () => {
    expect(structuredKindFromName('a.md')).toBeNull();
    expect(structuredKindFromName('a.markdown')).toBeNull();
    expect(structuredKindFromName('a.txt')).toBeNull();
    expect(structuredKindFromName('')).toBeNull();
    expect(structuredKindFromName('json')).toBeNull();
  });
});

describe('isOpenableDocumentName', () => {
  it('Markdown、JSON、JSONL 可打开，其它不行', () => {
    expect(isOpenableDocumentName('a.md')).toBe(true);
    expect(isOpenableDocumentName('A.MDX')).toBe(true);
    expect(isOpenableDocumentName('note.markdown')).toBe(true);
    expect(isOpenableDocumentName('/tmp/data.json')).toBe(true);
    expect(isOpenableDocumentName('rows.jsonl')).toBe(true);
    expect(isOpenableDocumentName('pic.png')).toBe(false);
    expect(isOpenableDocumentName('readme.txt')).toBe(true);
    expect(isOpenableDocumentName('id_ed25519.pub')).toBe(true);
    expect(isOpenableDocumentName('notes.toml')).toBe(true);
    expect(isOpenableDocumentName('Makefile')).toBe(true);
    expect(isOpenableDocumentName('.gitignore')).toBe(true);
    expect(isOpenableDocumentName('.env.local')).toBe(true);
    expect(isOpenableDocumentName('run.bat')).toBe(true);
    expect(isOpenableDocumentName('photo.png')).toBe(false);
    expect(isOpenableDocumentName('app.exe')).toBe(false);
    expect(isOpenableDocumentName('')).toBe(false);
  });
});

describe('previewKindFromName', () => {
  it('Markdown 仍排版，JSON 走树，其它文本保持原文', () => {
    expect(previewKindFromName('')).toBe('markdown');
    expect(previewKindFromName('a.md')).toBe('markdown');
    expect(previewKindFromName('a.mkd')).toBe('markdown');
    expect(isMarkdownFileName('a.mkd')).toBe(true);
    expect(previewKindFromName('data.json')).toBe('json');
    expect(previewKindFromName('map.geojson')).toBe('json');
    expect(previewKindFromName('rows.ndjson')).toBe('jsonl');
    expect(previewKindFromName('id_ed25519.pub')).toBe('plain');
    expect(previewKindFromName('readme.txt')).toBe('plain');
    expect(previewKindFromName('page.html')).toBe('plain');
  });
});

describe('userLaunchArgs', () => {
  it('开发时丢掉可执行文件和脚本，打包后只丢掉应用自己', () => {
    expect(userLaunchArgs(['electron', 'main.cjs', 'notes.txt', '--inspect'], false)).toEqual(['notes.txt']);
    expect(userLaunchArgs(['/Applications/Markly.app/Contents/MacOS/Markly', 'id.pub'], true)).toEqual(['id.pub']);
    expect(userLaunchArgs(['electron', 'main.cjs'], false)).toEqual([]);
  });
});

describe('系统文件关联', () => {
  it('没有默认程序的类型设为默认打开，已有程序的只进打开方式，可执行的不登记', () => {
    const seen = new Map<string, string>();
    for (const group of OS_FILE_ASSOCIATIONS) {
      for (const ext of group.ext) {
        expect(seen.has(ext), ext).toBe(false);
        seen.set(ext, group.rank);
        expect(isOpenableDocumentName(`a.${ext}`)).toBe(true);
      }
    }
    expect(seen.get('pub')).toBe('Default');
    expect(seen.get('pem')).toBe('Default');
    expect(seen.get('toml')).toBe('Default');
    expect(seen.get('srt')).toBe('Default');
    expect(seen.get('md')).toBe('Owner');
    expect(seen.get('txt')).toBe('Alternate');
    expect(seen.get('json')).toBe('Alternate');
    expect(seen.get('html')).toBe('Alternate');
    for (const ext of ['bat', 'cmd', 'ps1', 'reg', 'command', 'exe', 'png', 'pdf']) {
      expect(seen.has(ext), ext).toBe(false);
    }
    expect(UNCLAIMED_TEXT_EXTENSIONS).toContain('pub');
    expect(ALTERNATE_TEXT_EXTENSIONS).toContain('txt');
    expect(IN_APP_ONLY_EXTENSIONS).toContain('ps1');
  });

  it('安装配置和代码里的名单一致', () => {
    const pkg = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as {
      build: { fileAssociations: unknown };
    };
    expect(pkg.build.fileAssociations).toEqual(OS_FILE_ASSOCIATIONS);
  });
});
