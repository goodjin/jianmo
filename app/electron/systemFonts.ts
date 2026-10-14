/**
 * 运行时枚举这台电脑能用的字体家族。
 * 不写死名单。失败时不缓存，下次再试，避免把「没查到」当成「一台字体都没装」。
 */

import { execFile } from 'child_process';
import { dedupeFontFamilies } from './appearance';

let cache: string[] | null = null;
let pending: Promise<string[]> | null = null;

function execText(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { timeout: 15000, maxBuffer: 8 * 1024 * 1024, encoding: 'utf8' },
      (err, stdout) => {
        if (err) reject(err);
        else resolve(String(stdout ?? ''));
      }
    );
  });
}

function linesOf(text: string): string[] {
  return text.split(/\r?\n/);
}

async function enumerate(): Promise<string[]> {
  if (process.platform === 'win32') {
    const script =
      'Add-Type -AssemblyName System.Drawing; ' +
      '(New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }';
    const text = await execText('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
    return dedupeFontFamilies(linesOf(text));
  }
  if (process.platform === 'darwin') {
    try {
      const text = await execText('fc-list', ['--format', '%{family[0]}\\n']);
      return dedupeFontFamilies(linesOf(text));
    } catch {
      const script = [
        'ObjC.import("CoreText");',
        'const names = $.CTFontManagerCopyAvailableFontFamilyNames();',
        'const out = [];',
        'for (let i = 0; i < names.count; i++) out.push(String(ObjC.unwrap(names.objectAtIndex(i))));',
        'out.join("\\n");',
      ].join(' ');
      const text = await execText('osascript', ['-l', 'JavaScript', '-e', script]);
      return dedupeFontFamilies(linesOf(text));
    }
  }
  const text = await execText('fc-list', ['--format', '%{family[0]}\\n']);
  return dedupeFontFamilies(linesOf(text));
}

/** 已经枚举过才有值。还没查、或上次失败，返回 undefined。 */
export function getInstalledFontFamilies(): readonly string[] | undefined {
  return cache ?? undefined;
}

/** 这台电脑上的字体家族。同名只留一项，按名称排序，不含打进应用的思源黑体。 */
export async function listInstalledFontFamilies(): Promise<string[]> {
  if (cache) return cache;
  if (!pending) {
    pending = enumerate()
      .then((names) => {
        cache = names;
        return names;
      })
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}
