import { describe, expect, it } from 'vitest';
import { bufferLooksLikeText, isKnownBinaryName, shouldOpenTextDocument } from './textSniff';

describe('bufferLooksLikeText', () => {
  it('空文件和公钥算文本，空字节和 Publisher 文件头不算', () => {
    expect(bufferLooksLikeText(Buffer.alloc(0))).toBe(true);
    expect(bufferLooksLikeText(Buffer.from('ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIExample'))).toBe(true);
    expect(bufferLooksLikeText(Buffer.from('hello\0world'))).toBe(false);
    expect(bufferLooksLikeText(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1]))).toBe(false);
    expect(bufferLooksLikeText(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))).toBe(false);
  });
});

describe('shouldOpenTextDocument', () => {
  it('文本扩展名、没登记的扩展名可以开；图片和二进制公钥不行', () => {
    expect(shouldOpenTextDocument('id_ed25519.pub', Buffer.from('ssh-ed25519 AAAA'))).toBe(true);
    expect(shouldOpenTextDocument('notes.txt', Buffer.from('你好'))).toBe(true);
    expect(shouldOpenTextDocument('custom.xyz', Buffer.from('plain'))).toBe(true);
    expect(shouldOpenTextDocument('README', Buffer.from('# hi'))).toBe(true);
    expect(shouldOpenTextDocument('id.pub', Buffer.from([0xd0, 0xcf, 0x11, 0xe0]))).toBe(false);
    expect(shouldOpenTextDocument('pic.png', Buffer.from('not really a png'))).toBe(false);
    expect(isKnownBinaryName('pic.PNG')).toBe(true);
    expect(isKnownBinaryName('secret.key')).toBe(false);
  });
});
