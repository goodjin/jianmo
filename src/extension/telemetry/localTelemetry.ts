import * as vscode from 'vscode';

let channel: vscode.OutputChannel | undefined;

/**
 * M95：可选本地匿名计数（默认关闭）。不向第三方发送；仅在 Output「Markly Telemetry (local)」追加行。
 */
export function recordMarklyEvent(name: string, props?: Record<string, string>): void {
  const enabled = vscode.workspace.getConfiguration('markly').get<boolean>('telemetry.enabled', false);
  if (!enabled) return;
  if (!channel) {
    channel = vscode.window.createOutputChannel('Markly Telemetry (local)');
  }
  const tail = props && Object.keys(props).length ? ` ${JSON.stringify(props)}` : '';
  channel.appendLine(`[${new Date().toISOString()}] ${name}${tail}`);
}
