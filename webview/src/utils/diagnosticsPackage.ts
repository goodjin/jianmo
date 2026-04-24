export const DIAGNOSTICS_MAX_CHARS_DEFAULT = 32 * 1024;

type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [k: string]: Json };

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object' && (x as any).constructor === Object;
}

function redactString(input: string): string {
  let s = String(input ?? '');

  // macOS/Linux: /Users/... or /home/... (reduce the chance of leaking real username/path)
  s = s.replace(/(?:\/Users\/|\/home\/)[^ \n\r\t"'<>]+/g, '<redacted-path>');

  // Windows: C:\... 或 \\server\share\...
  s = s.replace(/[A-Za-z]:\\[^ \n\r\t"'<>]+/g, '<redacted-path>');
  s = s.replace(/\\\\[^ \n\r\t"'<>]+/g, '<redacted-path>');

  return s;
}

export function redactDiagnosticsJson(value: unknown, depthLimit = 10): Json {
  if (depthLimit <= 0) return '<truncated-depth>';
  if (value == null) return null;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (Array.isArray(value)) {
    return value.slice(0, 200).map((v) => redactDiagnosticsJson(v, depthLimit - 1));
  }

  if (isPlainObject(value)) {
    const out: Record<string, Json> = {};
    const keys = Object.keys(value).slice(0, 200);
    for (const k of keys) {
      out[k] = redactDiagnosticsJson((value as any)[k], depthLimit - 1);
    }
    return out;
  }

  // 非 JSON 结构（Error/Function/DOM 等）：转字符串并脱敏
  return redactString(String(value));
}

function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    try {
      return JSON.stringify(redactDiagnosticsJson(obj), null, 2);
    } catch {
      return '{"error":"failed to stringify diagnostics"}';
    }
  }
}

function shallowCloneObj<T extends Record<string, any>>(o: T): T {
  return { ...(o as any) };
}

export function buildDiagnosticsPackageText(args: {
  base: unknown;
  extra?: Record<string, unknown>;
  maxChars?: number;
}): { payload: Json; text: string; truncated: boolean } {
  const maxChars = Math.max(1024, Number(args.maxChars ?? DIAGNOSTICS_MAX_CHARS_DEFAULT) || DIAGNOSTICS_MAX_CHARS_DEFAULT);

  const raw = {
    ts: new Date().toISOString(),
    ...(args.extra ?? {}),
    base: args.base ?? null,
  };

  // 先整体脱敏成 JSON 形态
  const payload = redactDiagnosticsJson(raw);

  // 首次尝试：完整输出
  let text = safeStringify(payload);
  if (text.length <= maxChars) return { payload, text, truncated: false };

  // 超长：逐步裁剪重内容字段（保持顶层结构稳定）
  let truncated = true;
  let p: any = payload;
  if (p && typeof p === 'object' && !Array.isArray(p)) {
    p = shallowCloneObj(p);
    if (p.base && typeof p.base === 'object' && !Array.isArray(p.base)) {
      p.base = shallowCloneObj(p.base);
      // 常见肥字段
      for (const k of ['consoleRecent', 'headingTextSample', 'milkdownTextHasSectionB']) {
        if (k in p.base) delete p.base[k];
      }
      // recent errors: 只留前 3 条
      if (Array.isArray(p.base.consoleRecent)) {
        p.base.consoleRecent = p.base.consoleRecent.slice(0, 3);
      }
    }
  }

  text = safeStringify(p);
  if (text.length <= maxChars) return { payload: p, text, truncated };

  // 仍超：硬截断，保证 copy 始终可用
  text = text.slice(0, maxChars - 32) + '\n"__truncated__": true\n';
  return { payload: p, text, truncated };
}

