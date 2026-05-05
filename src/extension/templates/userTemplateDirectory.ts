/**
 * M90：解析用户配置的模板目录并枚举其中的 Markdown 模板文件（仅一层目录，不含子文件夹递归）。
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/** 支持绝对路径或以 `~` 表示用户主目录 */
export function expandUserTemplateDirectoryInput(raw: string): string {
  const t = String(raw ?? '').trim();
  if (!t) return '';
  if (t.startsWith('~')) {
    const rest = t.slice(1).replace(/^[\\/]+/, '');
    return rest ? path.join(os.homedir(), rest) : os.homedir();
  }
  return path.normalize(t);
}

export interface ListedUserMarkdownTemplate {
  /** 去掉扩展名，用于展示 */
  labelStem: string;
  fileName: string;
  absolutePath: string;
}

export function listMarkdownTemplatesInUserDirectory(expandedDir: string): ListedUserMarkdownTemplate[] {
  if (!expandedDir) return [];
  let st: fs.Stats;
  try {
    st = fs.statSync(expandedDir);
  } catch {
    return [];
  }
  if (!st.isDirectory()) return [];

  let names: string[];
  try {
    names = fs.readdirSync(expandedDir);
  } catch {
    return [];
  }

  const out: ListedUserMarkdownTemplate[] = [];
  for (const name of names) {
    if (!/\.(md|markdown)$/i.test(name)) continue;
    const absolutePath = path.join(expandedDir, name);
    try {
      if (!fs.statSync(absolutePath).isFile()) continue;
    } catch {
      continue;
    }
    const labelStem = name.replace(/\.(md|markdown)$/i, '');
    out.push({ labelStem, fileName: name, absolutePath });
  }
  out.sort((a, b) => a.fileName.localeCompare(b.fileName, undefined, { sensitivity: 'base' }));
  return out;
}
