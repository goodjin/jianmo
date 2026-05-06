# Rich 与 Source：用户可见差异（M220）

**Rich**（Milkdown / ProseMirror）：主编辑体验，保存时序列化为 Markdown。  
**Source**（CodeMirror）：纯 Markdown 源码，适合精细 diff、与外部工具链对齐或 Rich 降级时兜底。

| 维度 | Rich | Source |
|------|------|--------|
| 编辑模型 | 块/行内 WYSIWYG | 纯文本 + Markdown 语法 |
| 表格 | 格内 Tab/Enter、工具栏表格操作；粘贴 TSV/HTML 有规则与上限（见 `RICH_TABLE_USER_GUIDE.md`） | 直接编辑管道表文本 |
| 图表（Mermaid） | 可渲染（受设置 **`markly.editor.enableMermaid`** / **`deferDiagramRenderInRich`** 与档位影响） | 以围栏源码为主 |
| 数学公式 | 视图渲染与编辑体验依赖 Milkdown；复杂式子建议 Source 核对 | 直接编辑 `$...$` / `$$...$$` |
| 撤销/重做 | ProseMirror 历史 | CodeMirror 历史；与 Rich **不共享**同一栈 |
| 复制到外部 | 可走结构化 HTML/纯文本路径（能力随版本迭代） | 一般为选区纯文本 |
| 大文档 | 有体量档位与性能降级（工具栏提示） | 通常更轻，但仍受单文件体积影响 |

**IR（中间模式）**：已 **冻结**，不向新用户推荐；协议与类型可能仍暂时出现 `ir`，诊断包中记为 **`legacy-ir`**。移除计划见 [`IR_REMOVAL_ROADMAP.md`](IR_REMOVAL_ROADMAP.md)。
