import { describe, expect, it } from 'vitest';
import { formatExportFailure } from '../exportErrors';

describe('formatExportFailure', () => {
  it('classifies puppeteer launch failures for pdf', () => {
    const msg = formatExportFailure('pdf', new Error('Failed to launch the browser process'));
    expect(msg).toContain('Chromium');
    expect(msg).toContain('Puppeteer');
  });

  it('classifies timeout for pdf', () => {
    const msg = formatExportFailure('pdf', new Error('Navigation timeout of 30000 ms exceeded'));
    expect(msg).toContain('超时');
  });

  it('falls back to raw message for html', () => {
    expect(formatExportFailure('html', new Error('write failed'))).toContain('HTML 导出失败');
  });
});
