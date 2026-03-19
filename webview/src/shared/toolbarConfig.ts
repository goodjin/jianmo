/**
 * 工具栏配置
 * @module shared/toolbarConfig
 * @description 定义工具栏按钮配置和分组
 */

/**
 * 工具栏按钮定义
 */
export interface ToolbarButton {
  id: string;
  icon: string;
  title: string;
  shortcut?: string;
}

/**
 * 工具栏分组
 */
export interface ToolbarGroup {
  id: string;
  buttons: ToolbarButton[];
}

/**
 * 标题按钮配置
 */
export const headingButtons: ToolbarButton[] = [
  { id: 'h1', icon: 'H1', title: 'Heading 1', shortcut: 'Ctrl+1' },
  { id: 'h2', icon: 'H2', title: 'Heading 2', shortcut: 'Ctrl+2' },
  { id: 'h3', icon: 'H3', title: 'Heading 3', shortcut: 'Ctrl+3' },
  { id: 'h4', icon: 'H4', title: 'Heading 4' },
  { id: 'h5', icon: 'H5', title: 'Heading 5' },
  { id: 'h6', icon: 'H6', title: 'Heading 6' },
];

/**
 * 格式化按钮配置
 */
export const formatButtons: ToolbarButton[] = [
  { id: 'bold', icon: 'B', title: 'Bold', shortcut: 'Ctrl+B' },
  { id: 'italic', icon: 'I', title: 'Italic', shortcut: 'Ctrl+I' },
  { id: 'strike', icon: 'S', title: 'Strikethrough' },
  { id: 'code', icon: '</>', title: 'Inline Code', shortcut: 'Ctrl+`' },
];

/**
 * 列表按钮配置
 */
export const listButtons: ToolbarButton[] = [
  { id: 'bulletList', icon: '•', title: 'Bullet List' },
  { id: 'orderedList', icon: '1.', title: 'Ordered List' },
  { id: 'taskList', icon: '☐', title: 'Task List' },
  { id: 'quote', icon: '"', title: 'Blockquote' },
];

/**
 * 插入按钮配置
 */
export const insertButtons: ToolbarButton[] = [
  { id: 'link', icon: '🔗', title: 'Link', shortcut: 'Ctrl+K' },
  { id: 'image', icon: '🖼', title: 'Image' },
  { id: 'codeBlock', icon: '{ }', title: 'Code Block' },
  { id: 'table', icon: '⊞', title: 'Table' },
  { id: 'hr', icon: '—', title: 'Horizontal Rule' },
  { id: 'math', icon: '∑', title: 'Math Formula' },
];

/**
 * 完整工具栏分组配置
 */
export const toolbarGroups: ToolbarGroup[] = [
  { id: 'headings', buttons: headingButtons },
  { id: 'format', buttons: formatButtons },
  { id: 'lists', buttons: listButtons },
  { id: 'insert', buttons: insertButtons },
];
