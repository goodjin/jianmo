import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('privacy/AI_PRIVACY.md (M78)', () => {
  const resolved = join(process.cwd(), 'privacy', 'AI_PRIVACY.md');

  it('exists and contains retellable summary and data-scope markers', () => {
    expect(existsSync(resolved)).toBe(true);
    const body = readFileSync(resolved, 'utf8');
    expect(body).toContain('三句话');
    expect(body).toContain('SecretStorage');
    expect(body).toContain('mock');
    expect(body.toLowerCase()).toContain('openai-compatible');
    expect(body).toContain('全文');
    expect(body).toContain('选区润色');
  });
});
