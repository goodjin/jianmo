import { execFileSync } from 'child_process';
import { describe, expect, it } from 'vitest';
import { BUNDLED_FONT_FAMILY } from './appearance';
import { listInstalledFontFamilies } from './systemFonts';

/** 跟产品代码分开写的解析，用来核对枚举结果不是一份写死的短名单。 */
function familiesFromQuery(text: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const name = line.trim();
    if (!name || name.startsWith('.') || name === BUNDLED_FONT_FAMILY) continue;
    if (/[\u0000-\u001f"\\;{}<>]/.test(name) || name.length > 120) continue;
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  names.sort((a, b) => a.localeCompare(b, 'zh-CN', { sensitivity: 'base', numeric: true }));
  return names;
}

function queryInstalledFamilies(): string[] {
  if (process.platform === 'win32') {
    const text = execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Add-Type -AssemblyName System.Drawing; (New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }',
      ],
      { encoding: 'utf8', timeout: 15000, maxBuffer: 8 * 1024 * 1024 }
    );
    return familiesFromQuery(text);
  }
  if (process.platform === 'darwin') {
    try {
      const text = execFileSync('fc-list', ['--format', '%{family[0]}\\n'], {
        encoding: 'utf8',
        timeout: 15000,
      });
      return familiesFromQuery(text);
    } catch {
      const script = [
        'ObjC.import("CoreText");',
        'const names = $.CTFontManagerCopyAvailableFontFamilyNames();',
        'const out = [];',
        'for (let i = 0; i < names.count; i++) out.push(String(ObjC.unwrap(names.objectAtIndex(i))));',
        'out.join("\\n");',
      ].join(' ');
      const text = execFileSync('osascript', ['-l', 'JavaScript', '-e', script], {
        encoding: 'utf8',
        timeout: 15000,
        maxBuffer: 8 * 1024 * 1024,
      });
      return familiesFromQuery(text);
    }
  }
  const text = execFileSync('fc-list', ['--format', '%{family[0]}\\n'], {
    encoding: 'utf8',
    timeout: 15000,
    maxBuffer: 8 * 1024 * 1024,
  });
  return familiesFromQuery(text);
}

describe('系统字体枚举', () => {
  it('列出的是系统查询到的家族，不是写死的两三款', async () => {
    const expected = queryInstalledFamilies();
    const listed = await listInstalledFontFamilies();
    expect(expected.length).toBeGreaterThan(8);
    expect(listed).toEqual(expected);
    expect(listed).not.toContain(BUNDLED_FONT_FAMILY);
    const sorted = [...listed].sort((a, b) => a.localeCompare(b, 'zh-CN', { sensitivity: 'base', numeric: true }));
    expect(listed).toEqual(sorted);
    expect(new Set(listed.map((name) => name.toLocaleLowerCase())).size).toBe(listed.length);
  });
});
