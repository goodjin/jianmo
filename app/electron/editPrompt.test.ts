import { describe, expect, it, vi } from 'vitest';
import { buttonToConflictChoice, buttonToDirtyChoice, settleDirty } from './editPrompt';

describe('buttonToDirtyChoice', () => {
  it('保存、不保存、取消按按钮顺序', () => {
    expect(buttonToDirtyChoice(0)).toBe('save');
    expect(buttonToDirtyChoice(1)).toBe('discard');
    expect(buttonToDirtyChoice(2)).toBe('cancel');
    expect(buttonToDirtyChoice(-1)).toBe('cancel');
  });
});

describe('buttonToConflictChoice', () => {
  it('重新打开、另存为、取消按按钮顺序', () => {
    expect(buttonToConflictChoice(0)).toBe('reload');
    expect(buttonToConflictChoice(1)).toBe('save-as');
    expect(buttonToConflictChoice(2)).toBe('cancel');
  });
});

describe('settleDirty', () => {
  it('没改过不询问', async () => {
    const ask = vi.fn(async () => 'save' as const);
    expect(await settleDirty({ dirty: false, ask, save: async () => true, discard: () => undefined })).toBe('clean');
    expect(ask).not.toHaveBeenCalled();
  });

  it('选保存且写成功', async () => {
    const discard = vi.fn();
    expect(
      await settleDirty({
        dirty: true,
        ask: async () => 'save',
        save: async () => true,
        discard,
      })
    ).toBe('saved');
    expect(discard).not.toHaveBeenCalled();
  });

  it('选保存但没写成就停住', async () => {
    const discard = vi.fn();
    expect(
      await settleDirty({
        dirty: true,
        ask: async () => 'save',
        save: async () => false,
        discard,
      })
    ).toBe('cancel');
    expect(discard).not.toHaveBeenCalled();
  });

  it('选不保存会丢掉修改', async () => {
    const discard = vi.fn();
    expect(
      await settleDirty({
        dirty: true,
        ask: async () => 'discard',
        save: async () => true,
        discard,
      })
    ).toBe('discarded');
    expect(discard).toHaveBeenCalledTimes(1);
  });

  it('取消则什么都不做', async () => {
    const discard = vi.fn();
    const save = vi.fn(async () => true);
    expect(await settleDirty({ dirty: true, ask: async () => 'cancel', save, discard })).toBe('cancel');
    expect(save).not.toHaveBeenCalled();
    expect(discard).not.toHaveBeenCalled();
  });
});
