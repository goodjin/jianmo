/**
 * 未保存时的三选一，和外面改过文件时的三选一。
 * 只认按钮序号，不弹窗。
 */

export type DirtyChoice = 'save' | 'discard' | 'cancel';
export type ConflictChoice = 'reload' | 'save-as' | 'cancel';
export type SettleResult = 'clean' | 'saved' | 'discarded' | 'cancel';

export function buttonToDirtyChoice(index: number): DirtyChoice {
  if (index === 0) return 'save';
  if (index === 1) return 'discard';
  return 'cancel';
}

export function buttonToConflictChoice(index: number): ConflictChoice {
  if (index === 0) return 'reload';
  if (index === 1) return 'save-as';
  return 'cancel';
}

/**
 * 离开编辑、关标签、刷新、退出时：没改过直接过；
 * 选保存但没存成，就停住；选不保存则丢掉修改。
 */
export async function settleDirty(args: {
  dirty: boolean;
  ask: () => Promise<DirtyChoice>;
  save: () => Promise<boolean>;
  discard: () => void;
}): Promise<SettleResult> {
  if (!args.dirty) return 'clean';
  const choice = await args.ask();
  if (choice === 'cancel') return 'cancel';
  if (choice === 'discard') {
    args.discard();
    return 'discarded';
  }
  const wrote = await args.save();
  return wrote ? 'saved' : 'cancel';
}
