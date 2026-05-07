# Markly：表格使用说明（Rich 为主）

一页速查：**插入表格**、**删表 / 删行 / 删列**、**粘贴**与 **VS Code 命令**。另见快捷键总览：`docs/m45-commands-keybindings-policy.md`。

---

## 适用范围

| 场景 | 说明 |
|------|------|
| **Rich 模式** | 可视化表格：工具栏结构按钮、右键菜单、`Tab` / `Shift+Tab` 切格、`Mod+Alt` 结构快捷键、`markly.table.*` 命令。 |
| **Source（含 legacy-IR 输入的兼容降级）** | 按普通 Markdown **源码**编辑管道表格（`|` 与对齐行）；无「格内 UI」，可用命令 **`Insert Table`** 插入骨架表（若宿主支持当前模式）。 |
| **`Mod`** | macOS 为 ⌘，Windows / Linux 为 Ctrl。 |

---

## 插入表格

1. **命令面板**：`Insert Table`（`markly.insert.table`）。
2. **工具栏**：Rich 下「插入」类入口中的表格按钮（与命令等价）。
3. **粘贴建表**（Rich，光标在**表格外**）：从 Excel、Numbers、网页等复制后粘贴，若剪贴板能解析为矩阵（`text/html` 表格或 `text/plain` 制表分隔等），可在当前位置**插入新表**并重排内容。粘贴路径有**行 / 列 / 总格子数上限**（硬上限：**80** 行、**40** 列、**800** 格；超出会拒绝或截断并提示）。**M27**：若 `text/html` 单段体积超过约 **200 万字符**，会**跳过 HTML 表格解析**并提示，避免 webview 卡死；仍可能仅按 **纯文本矩阵**建表（若剪贴板同时带 TSV/CSV 等）。
4. **大表预览**（Rich）：粘贴矩阵较大或 HTML 混杂时可能出现 **确认对话框**（节选预览）；取消后按场景可能交给默认粘贴或不插入矩阵。

合并、拆分仅在 **Rich 表格内** 有意义；保存为 Markdown 时以 **GFM 序列化规则**为准（复杂合并可能等价为 HTML 或与预期不同，请以实际导出为准）。

---

## 结构调整与删除（Rich）

光标在表格单元格内时可用：

### 工具栏与右键菜单

- 光标进入表格后，工具栏中与表格结构相关的按钮会**启用**（上方/下方插行，左/右侧插列，删行，删列，表头切换，对齐，合并/拆分，删除整张表）。
- **右键菜单**：在表格内右键，与上述**同一套**结构操作。

### 快捷键（需在单元格内）

| 快捷键 | 作用 |
|--------|------|
| `Mod + Alt + ↑` | 上方插入行 |
| `Mod + Alt + ↓` | 下方插入行 |
| `Mod + Alt + ←` | 左侧插入列 |
| `Mod + Alt + →` | 右侧插入列 |
| `Mod + Alt + Backspace` | 删除当前行 |
| `Mod + Alt + Shift + Backspace` | 删除当前列 |
| `Tab` / `Shift+Tab` | 在单元格间移动 |

**删除整张表**：工具栏 **「表格：删除当前表格」**，或命令面板 **Table: Delete Table**（`markly.table.deleteTable`）。

**单元格内换行与退出**：表格单元格内 **普通 Enter** 会走 Rich 定制的链优先在格内产生换行语义（如 hard break），**避免**一上来就整块「退出表格」；若在格内需要从表格下方写出段落，可使用 **`Mod+Enter`**（macOS：`⌘+Enter`，Windows / Linux：`Ctrl+Enter`）走 GFM **ExitTable**。若与本地快捷键自定义冲突，以实际 VS Code / 编辑器为准。

---

## 粘贴要点（Rich）

| 情况 | 行为摘要 |
|------|----------|
| 表格外 | 能解析则**新建表**；否则走 Markdown 默认粘贴。 |
| 表格内 | 优先尝试 **`text/html` 表格**；失败再尝试 **纯文本 TSV / 有限 CSV**；可能按选区填充或扩展结构（以实际解析结果为准）。 |
| **`Mod+Shift+V`** | **纯文本粘贴**（不写 HTML 表格 slice）；需在格内对齐内容时很好用。参见 `Paste as Plain Text`（`markly.edit.pastePlain`）。 |

软确认阈值（与「是否弹确认」等相关，与自动性能策略对齐）：大约 **≥18** 行、**≥10** 列或 **≥200** 格量级会更容易触发预览/拦截逻辑（具体以版本内实现为准）。

---

## 命令面板名称与 ID（表格相关）

在 VS Code 命令面板中搜索 **Table:** 或 **Insert Table**。

| 命令 ID | 标题（package 内） |
|---------|-------------------|
| `markly.insert.table` | Insert Table |
| `markly.table.addRowBefore` | Table: Add Row Above |
| `markly.table.addRowAfter` | Table: Add Row Below |
| `markly.table.addColBefore` | Table: Add Column Left |
| `markly.table.addColAfter` | Table: Add Column Right |
| `markly.table.toggleHeaderRow` | Table: Toggle Header Row |
| `markly.table.alignLeft` | Table: Align Left |
| `markly.table.alignCenter` | Table: Align Center |
| `markly.table.alignRight` | Table: Align Right |
| `markly.table.mergeCells` | Table: Merge Cells |
| `markly.table.splitCell` | Table: Split Cell |
| `markly.table.deleteTable` | Table: Delete Table |
| `markly.table.deleteRow` | Table: Delete Row |
| `markly.table.deleteCol` | Table: Delete Column |

**写作辅助（全稿 / 选区依实现）**：`Writing: Tidy Markdown Tables`（`markly.assist.tidyTables`）——整理 Markdown 表格文本，不替代 Rich 内编辑。

---

## 性能与设置

| 设置项 | 作用 |
|--------|------|
| `markly.editor.richTableColumnResize` | **`auto`**（默认）：大表自动**关闭**列宽拖拽插件，减轻滚动与选区延迟；**`on`** / **`off`** 强制开/关。阈值与粘贴「软限制」同量级。 |
| `markly.editor.tableCellWrap` | 单元格内 **换行** 或 **不换行 + 横向滚动**。 |

大表格在编辑区内有 **最大高度 + 内部滚动**（见 `webview/src/style.css`），避免整篇文档被单张宽表拖死。

---

## Webview 内帮助

在 Markly 编辑器的工具栏中打开 **表格帮助**（与「Rich 表格快捷键」弹层一致），可快速查看 **Mod+Alt** 组合键与删整表入口；本页为更完整的**命令与粘贴**说明。

---

## 相关文档

- `docs/m45-commands-keybindings-policy.md` — Webview 通用快捷键与 Rich / Source 差异  
- `docs/rich-table-optimization-plan.md` — 工程计划与附录（粘贴策略、限制）  
- `docs/MARKDOWN_CAPABILITIES.md` — GFM 表格语法与渲染边界  
