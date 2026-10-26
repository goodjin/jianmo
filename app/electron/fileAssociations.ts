/** 安装包向系统登记的一种文件类型。和 electron-builder 的 fileAssociations 同一形状。 */
export interface OsFileAssociation {
  ext: string[];
  name: string;
  description: string;
  role: 'Editor';
  rank: 'Owner' | 'Default' | 'Alternate';
}
