/**
 * M47：无网络时的本地「润色」占位，便于链路联调与测试。
 */
export function mockRewriteSelection(input: string): string {
  const t = input.trim();
  if (!t) return '';
  const first = t[0]?.toLocaleUpperCase() ?? '';
  const rest = t.slice(1);
  const hasEnd = /[.!?。？！…]$/.test(t);
  const suffix = hasEnd ? '' : '。';
  return `${first}${rest}${suffix}`;
}
