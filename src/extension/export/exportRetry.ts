const DEFAULT_RETRY_ATTEMPTS = 2;
const DEFAULT_BASE_DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableExportError(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? '').toLowerCase();
  // best-effort：Puppeteer/Chromium 常见瞬断 + 外链资源的短暂错误
  const needles = [
    'econnreset',
    'etimedout',
    'timeout',
    'net::err',
    'protocol error',
    'target closed',
    'navigation timeout',
  ];
  return needles.some((n) => msg.includes(n));
}

/**
 * M291：导出失败自动重试（体验优先：仅对“疑似瞬断”的错误做有限重试）。
 *
 * - attempts=2 表示最多执行 2 次（失败后重试 1 次）
 * - 退避为固定基准 + 轻抖动，避免同时重试
 */
export async function withExportRetry<T>(
  run: (attempt: number) => Promise<T>,
  opts?: { attempts?: number; baseDelayMs?: number }
): Promise<T> {
  const attempts = Math.max(1, Math.floor(opts?.attempts ?? DEFAULT_RETRY_ATTEMPTS));
  const baseDelayMs = Math.max(0, Math.floor(opts?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS));

  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await run(attempt);
    } catch (e) {
      lastErr = e;
      if (attempt >= attempts) break;
      if (!isRetryableExportError(e)) break;
      const jitter = Math.floor(Math.random() * 120);
      const delay = baseDelayMs * attempt + jitter;
      await sleep(delay);
    }
  }
  throw lastErr;
}

