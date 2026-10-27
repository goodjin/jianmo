/**
 * 打开对话框里，文件和文件夹要分开处理。
 * 选了文件夹就只换左侧文件树，不把文件夹当成一篇文档打开。
 */

export interface OpenSelection {
  /** 要打开的文件。选中了文件夹时这里是空的。 */
  files: string[];
  /** 要在左侧显示的文件夹。一次只留一个。 */
  directory: string | null;
}

export type OpenDialogProperty = 'openFile' | 'openDirectory' | 'multiSelections';

/**
 * macOS 的打开面板可以同时选文件和文件夹。
 * Windows 和 Linux 上两项一起会变成只能选文件夹，文件就打不开了。
 */
export function openDialogProperties(platform: string): OpenDialogProperty[] {
  if (platform === 'darwin') return ['openFile', 'openDirectory', 'multiSelections'];
  return ['openFile', 'multiSelections'];
}

/**
 * 有文件夹时只留下第一个，同一次选中的文件也不打开。
 * 没有文件夹时，路径都当文件，顺序保持不变。
 * 判断文件夹若抛错，这条路径仍当文件，交给后面的打开流程说明原因。
 */
export function splitOpenSelection(
  paths: readonly string[],
  isDirectory: (filePath: string) => boolean
): OpenSelection {
  const files: string[] = [];
  let directory: string | null = null;
  for (const raw of paths) {
    const filePath = typeof raw === 'string' ? raw.trim() : '';
    if (!filePath) continue;
    let directoryPath = false;
    try {
      directoryPath = isDirectory(filePath) === true;
    } catch {
      directoryPath = false;
    }
    if (directoryPath) {
      if (!directory) directory = filePath;
      continue;
    }
    files.push(filePath);
  }
  if (directory) return { files: [], directory };
  return { files, directory: null };
}
