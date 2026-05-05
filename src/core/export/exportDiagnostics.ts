/**
 * 导出失败时可复制的诊断包（路径脱敏，便于提交 issue）。
 */

export function redactSensitivePaths(text: string): string {
  let s = String(text ?? '');

  // macOS/Linux: /Users/... /home/...
  s = s.replace(/(?:\/Users\/|\/home\/)[^ \n\r\t"'<>]+/g, '<redacted-path>');

  // Windows: C:\... 或 \\server\share\...
  s = s.replace(/[A-Za-z]:\\[^ \n\r\t"'<>]+/g, '<redacted-path>');
  s = s.replace(/\\\\[^ \n\r\t"'<>]+/g, '<redacted-path>');

  return s;
}

function serializeError(err: unknown): { name: string; message: string; stack?: string } {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: redactSensitivePaths(err.message),
      stack: err.stack ? redactSensitivePaths(err.stack) : undefined,
    };
  }
  return {
    name: 'NonError',
    message: redactSensitivePaths(String(err)),
  };
}

export function buildExportFailureDiagnosticsMarkdown(args: {
  format: 'pdf' | 'html';
  error: unknown;
  documentBasename?: string;
  outputBasename?: string;
  vscodeVersion: string;
  extensionVersion: string;
  platform: string;
  arch: string;
}): string {
  const payload = {
    schemaVersion: 1 as const,
    ts: new Date().toISOString(),
    format: args.format,
    error: serializeError(args.error),
    documentBasename: args.documentBasename,
    outputBasename: args.outputBasename,
    host: {
      kind: 'vscode' as const,
      vscode: args.vscodeVersion,
      markly: args.extensionVersion,
      platform: args.platform,
      arch: args.arch,
    },
  };

  const json = JSON.stringify(payload, null, 2);

  return [
    '## Markly 导出失败诊断包',
    '',
    '以下为脱敏后的 JSON，可直接粘贴到 issue。',
    '',
    '```json',
    json,
    '```',
    '',
  ].join('\n');
}
