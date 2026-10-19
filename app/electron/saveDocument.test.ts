import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseSaveResult, planSave, readDiskSnapshot, writeFileAtomic } from './saveDocument';

const dirs: string[] = [];

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markly-save-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('planSave', () => {
  it('新文件、磁盘还没有，可以直接写', () => {
    expect(
      planSave({
        expectedMtimeMs: null,
        savedContent: '',
        disk: { exists: false, mtimeMs: null, content: null },
      })
    ).toEqual({ action: 'write' });
  });

  it('磁盘内容和上次保存的一样，可以写，哪怕修改时间变了', () => {
    expect(
      planSave({
        expectedMtimeMs: 10,
        savedContent: '{"a":1}\n',
        disk: { exists: true, mtimeMs: 99, content: '{"a":1}\n' },
      })
    ).toEqual({ action: 'write' });
  });

  it('磁盘被人改过，不覆盖', () => {
    expect(
      planSave({
        expectedMtimeMs: 10,
        savedContent: '{"a":1}',
        disk: { exists: true, mtimeMs: 11, content: '{"a":2}' },
      })
    ).toEqual({ action: 'conflict', reason: 'changed' });
  });

  it('打开过的文件不见了，不悄悄再建一份', () => {
    expect(
      planSave({
        expectedMtimeMs: 10,
        savedContent: 'old',
        disk: { exists: false, mtimeMs: null, content: null },
      })
    ).toEqual({ action: 'conflict', reason: 'missing' });
  });

  it('另存为已经确认覆盖时，直接写', () => {
    expect(
      planSave({
        expectedMtimeMs: null,
        savedContent: '',
        disk: { exists: true, mtimeMs: 1, content: '别人的' },
        force: true,
      })
    ).toEqual({ action: 'write' });
  });
});

describe('writeFileAtomic', () => {
  it('原文原样落盘，包括回车换行，不重新排版', () => {
    const dir = tempDir();
    const file = path.join(dir, 'rows.jsonl');
    const raw = '{"a":1}\r\n{"b":2}\r\n';
    const wrote = writeFileAtomic(file, raw);
    expect(wrote.ok).toBe(true);
    expect(fs.readFileSync(file, 'utf8')).toBe(raw);
    expect(readDiskSnapshot(file).content).toBe(raw);
    const again = writeFileAtomic(file, raw);
    expect(again.ok).toBe(true);
    expect(fs.readdirSync(dir).filter((name) => name.includes('markly-tmp'))).toEqual([]);
  });

  it('目录不存在时会建出来', () => {
    const dir = tempDir();
    const file = path.join(dir, 'nested', 'note.md');
    const wrote = writeFileAtomic(file, '# 标题\n');
    expect(wrote.ok).toBe(true);
    expect(fs.readFileSync(file, 'utf8')).toBe('# 标题\n');
  });

  it('目标是已有目录时写失败，旁边的文件不动', () => {
    const dir = tempDir();
    const neighbor = path.join(dir, 'keep.md');
    fs.writeFileSync(neighbor, '留着');
    const wrote = writeFileAtomic(dir, '不能把目录当文件');
    expect(wrote.ok).toBe(false);
    if (!wrote.ok) expect(wrote.error.length).toBeGreaterThan(0);
    expect(fs.readFileSync(neighbor, 'utf8')).toBe('留着');
  });

  it('空路径不写', () => {
    expect(writeFileAtomic('  ', 'x')).toEqual({ ok: false, error: '没有文件路径' });
  });
});

describe('parseSaveResult', () => {
  it('成功要带路径，失败保留原因', () => {
    expect(parseSaveResult({ ok: true, path: '/a.md' })).toEqual({ ok: true, path: '/a.md' });
    expect(parseSaveResult({ ok: false, reason: 'cancelled', message: '' })).toEqual({
      ok: false,
      reason: 'cancelled',
      message: '',
    });
    expect(parseSaveResult({ ok: false, reason: 'reloaded', message: '已重新打开磁盘上的版本' }).ok).toBe(false);
    expect(parseSaveResult(null)).toEqual({ ok: false, reason: 'failed', message: '没有保存结果' });
    expect(parseSaveResult({ ok: false, reason: 'nope' })).toEqual({ ok: false, reason: 'failed', message: '' });
  });
});

describe('readDiskSnapshot', () => {
  it('没有这个文件时 exists 为 false', () => {
    const missing = path.join(tempDir(), 'gone.md');
    expect(readDiskSnapshot(missing)).toEqual({ exists: false, mtimeMs: null, content: null });
  });
});
