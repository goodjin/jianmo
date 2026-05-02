export function normalizeUrl(raw: string): string {
  const s = String(raw ?? '').trim().replace(/^<|>$/g, '');
  if (!s) return '';
  // Already absolute
  if (/^https?:\/\//i.test(s)) return s;
  // Avoid dangerous schemes even if user typed them
  if (/^(javascript|data|vbscript):/i.test(s)) return '';
  // mailto / vscode / file 等一律不自动放行（后续如需要再白名单）
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return '';

  // Common paste: www.example.com
  if (/^www\./i.test(s)) return `https://${s}`;
  // Looks like a domain/path
  if (/^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(s)) return `https://${s}`;
  return s;
}

export function isSafeExternalHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

