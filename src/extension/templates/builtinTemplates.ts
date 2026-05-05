/**
 * M89：内置文档模板清单（正文见仓库根目录 `templates/*.md`，打进 VSIX）。
 */
export interface BuiltinDocumentTemplate {
  id: string;
  /** QuickPick 主标题 */
  label: string;
  /** 副标题说明 */
  description: string;
  /** 另存为默认文件名 */
  suggestedFileName: string;
}

export const BUILTIN_DOCUMENT_TEMPLATES: readonly BuiltinDocumentTemplate[] = [
  {
    id: 'meeting-notes',
    label: '会议记录',
    description: '议题、与会人、决议与行动项',
    suggestedFileName: '会议记录.md',
  },
  {
    id: 'weekly-report',
    label: '周报',
    description: '本周进展、下周计划、风险与依赖',
    suggestedFileName: '周报.md',
  },
  {
    id: 'readme-project',
    label: '项目 README',
    description: '简介、安装、使用与贡献说明骨架',
    suggestedFileName: 'README.md',
  },
  {
    id: 'blog-post',
    label: '博客文章',
    description: '标题、摘要与正文结构',
    suggestedFileName: '文章草稿.md',
  },
  {
    id: 'learning-notes',
    label: '学习笔记',
    description: '概念、要点、练习与回顾',
    suggestedFileName: '学习笔记.md',
  },
];
