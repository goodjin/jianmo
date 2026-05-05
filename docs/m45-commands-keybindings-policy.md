# M45：命令与快捷键策略（清单）

本文档列出主要 `markly.*` 命令及 Webview 内快捷键语义；精确 contributes 表以仓库根 `package.json` 为准（单一事实来源）。

## Webview（Markly Custom Editor）

| 键位 | Rich / Source |
|------|----------------|
| Mod+S | 保存 + TOC |
| Mod+F | 打开查找面板 |
| Mod+Shift+V | Rich：纯文本粘贴 |
| Mod+K | 插入链接 |
| Mod+Shift+K | 插入代码块 |

## 与 VS Code 冲突说明

专注在编辑器内时，`Ctrl/Cmd+F` 由全局 `keydown` 监听器接管；若 VS Code「保留」查找 widget，请以实际 VS Code / 快捷键自定义为准。

## M111–M120：编辑一致性（Rich ↔ Source）补充

- **光标/滚动保留（M111）**：从 Rich 切到 Source（或反向）时，会尽量恢复上一次 Rich 内的光标与滚动位置；若 Rich 尚未 ready 或 DOM 尚未绘制完成，则以 best-effort 跳过，不阻塞编辑。
- **撤销栈（M112）**：Source/IR（CodeMirror）切模式会重建 `EditorView`，并清空简易撤销栈，避免跨 state 的撤销语义混乱；Rich（Milkdown）撤销在其自身 history 内生效。
- **Tab/Enter（M113/M114）**：Rich 表格与列表有定制键位链（Tab 缩进/格内导航、Enter 优先格内换行、`Mod+Enter` 退出表格）；Source 为纯 Markdown 文本编辑，行为以 CM6 为准。
- **Backspace/Delete（M115）**：表格结构删除使用 Rich 专用快捷键（见 `docs/RICH_TABLE_USER_GUIDE.md`），避免与系统/VS Code 默认冲突。

## Rich vs Source（M₄₆ 对照）

| 能力 | Rich（Milkdown / ProseMirror） | Source（CodeMirror 6） |
|------|-------------------------------|-------------------------|
| 粗体 / 斜体 等 | 工具栏与 `Mod+B` / `Mod+I` 等走 Rich schema | 走 CM Markdown 快捷键或源码字面量 |
| 查找 / 替换 | `Mod+F` 打开 Webview 面板；`findNavigate` 命令与面板联动 | 同左：共用 `FindReplacePanel` 与 `findPattern` |
| 纯文本粘贴 | `Mod+Shift+V` → `pastePlainAtSelection` | 同左 |
| 插入链接 / 代码块 | `Mod+K` / `Mod+Shift+K` → `handleInsert` | 同左 |
| 表格结构编辑 | Rich 专用 `richTable` / 右键菜单 / Tab 在格内导航 | Source 下为 Markdown 文本编辑，无格内 UI |
| 图片粘贴 | 走 `useImageHandler` → `UPLOAD_IMAGE` | 同左 |
| 选区润色 | 读 Milkdown 选区纯文本 → `AI_REWRITE_SELECTION_REQUEST` | 读 CM `sliceDoc(from,to)` 同协议 |
| 大纲跳转 | `scrollToHeading` / ProseMirror 选区 | `editorView.dispatch` + `scrollDOM` |
| 焦点恢复 | `queueRichFocus`（双 `requestAnimationFrame`） | `focusEditor`（`setTimeout` 包裹 `view.focus`） |

- 命令面板中 `pastePlain`、`find.toggle`、`wrapUrlLink`、`rewriteSelection` 等对双模式尽量一致；差异集中在 **表格 UI** 与 **Rich 独有装饰**。
