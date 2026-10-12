/**
 * 拖拽落点的纯逻辑：从 drop 事件里挑出可打开的文档路径（Markdown / JSON / JSONL）。
 * 不碰 DOM 事件对象本体（只认 `{ path?, name? }` 形状），renderer 单测可直接喂假文件。
 */
import { isOpenableDocumentName } from '../electron/documentKind';

export interface DroppedFileLike {
  path?: string;
  name?: string;
}

/** 只收带真实路径（Electron 注入 `File.path`）的文档；目录与其它类型忽略。 */
export function collectDroppedDocumentPaths(files: ArrayLike<DroppedFileLike | null | undefined>): string[] {
  const paths: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const p = typeof f?.path === 'string' ? f.path.trim() : '';
    if (!p) continue;
    const name = typeof f?.name === 'string' && f.name ? f.name : p.split(/[/\\]/).pop() ?? '';
    if (!isOpenableDocumentName(name)) continue;
    if (paths.includes(p)) continue;
    paths.push(p);
  }
  return paths;
}
