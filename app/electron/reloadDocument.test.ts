import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { readDocumentForReload } from './reloadDocument';
import { contentAfterReload, parseReloadResult } from './reloadResult';

const tmpDirs: string[] = [];

function tmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markly-reload-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('readDocumentForReload', () => {
  it('没有路径时不算文件丢失', () => {
    expect(readDocumentForReload('')).toEqual({ ok: false, reason: 'no-file' });
    expect(readDocumentForReload('   ')).toEqual({ ok: false, reason: 'no-file' });
  });

  it('文件不在时返回 missing，不编一份空正文', () => {
    const missing = path.join(tmpDir(), 'gone.md');
    expect(readDocumentForReload(missing)).toEqual({ ok: false, reason: 'missing' });
  });

  it('读到磁盘上的新内容，中文和换行都留着', () => {
    const file = path.join(tmpDir(), 'a.md');
    fs.writeFileSync(file, '# 新的\n\n正文');
    expect(readDocumentForReload(file)).toEqual({ ok: true, content: '# 新的\n\n正文' });
  });

  it('路径是文件夹时不算成功，也不当成文件不在', () => {
    const dir = tmpDir();
    expect(readDocumentForReload(dir)).toEqual({ ok: false, reason: 'unreadable' });
  });
});

describe('contentAfterReload', () => {
  it('读成功才换成新正文', () => {
    expect(contentAfterReload('旧的', { ok: true, content: '新的' })).toBe('新的');
    expect(contentAfterReload('旧的', { ok: true, content: '' })).toBe('');
  });

  it('文件不在或读失败时留下旧正文', () => {
    expect(contentAfterReload('旧的', { ok: false, reason: 'missing' })).toBe('旧的');
    expect(contentAfterReload('旧的', { ok: false, reason: 'unreadable' })).toBe('旧的');
    expect(contentAfterReload('旧的', { ok: false, reason: 'no-file' })).toBe('旧的');
  });
});

describe('parseReloadResult', () => {
  it('只接受约定好的结果，别的都当成没读成', () => {
    expect(parseReloadResult({ ok: true, content: '很大的正文' })).toEqual({ ok: true });
    expect(parseReloadResult({ ok: false, reason: 'missing' })).toEqual({ ok: false, reason: 'missing' });
    expect(parseReloadResult({ ok: false, reason: 'no-file' })).toEqual({ ok: false, reason: 'no-file' });
    expect(parseReloadResult({ ok: false, reason: 'unreadable' })).toEqual({ ok: false, reason: 'unreadable' });
    expect(parseReloadResult({ ok: false, reason: 'other' })).toEqual({ ok: false, reason: 'unreadable' });
    expect(parseReloadResult(null)).toEqual({ ok: false, reason: 'unreadable' });
    expect(parseReloadResult('ok')).toEqual({ ok: false, reason: 'unreadable' });
  });
});
