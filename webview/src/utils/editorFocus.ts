export function isFormFieldKeyEventTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const el = target as HTMLElement;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return true;
  if (el.isContentEditable) return true;
  if (el.closest('input,textarea,select,button,[contenteditable="true"]')) return true;
  // label 内的事件 target 可能是纯文本/span，但它仍属于“表单 UI 区域”
  const label = el.closest('label');
  return Boolean(label?.querySelector('input,textarea,select,button'));
}

export function isMilkdownProseMirrorFocused(): boolean {
  const active = document.activeElement;
  if (!active || !(active instanceof HTMLElement)) return false;
  const pm = active.closest?.('.milkdown-editor .ProseMirror');
  return pm === active;
}
