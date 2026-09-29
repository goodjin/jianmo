import type { InjectionKey, Ref } from 'vue';
import type { FileTreeEntry } from '../electron/fileTreeModel';

/** 递归节点共用的树状态。展开表和缓存都是响应式对象，子节点直接改。 */
export interface FileTreeContext {
  activePath: Ref<string>;
  expanded: Record<string, boolean>;
  cache: Record<string, FileTreeEntry[] | undefined>;
  loading: Record<string, boolean>;
  errors: Record<string, string>;
  toggleDir: (dir: string) => void;
  openFile: (file: string) => void;
}

export const FileTreeKey: InjectionKey<FileTreeContext> = Symbol('fileTree');
