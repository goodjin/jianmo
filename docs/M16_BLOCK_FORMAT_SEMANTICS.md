# M16：Rich 工具栏块级命令语义

## 「当前块」定义

在 **折叠选区**（`empty`）且光标位于 **文本块**（`paragraph`、`heading` 等 `isTextblock`）内时，执行以下命令前会先把选区扩展到 **该文本块全文**（不记入撤销历史，再通过 `addToHistory:false` 与用户可见的格式变更合并为 **一次撤销**）：

- `h1` … `h6`
- `bulletList` / `orderedList`
- `quote`
- `indent` / `outdent`

在 **跨多块** 的选区下，使用 ProseMirror **`blockRange`** 将选区扩展到跨越的块级范围，再执行同上命令。

## 非块级命令

`bold` / `italic` / `strike` / `code` 等 **行内 marks** 不改变选区边界，行为与 ProseMirror 默认 `toggleMark` 一致。

## 与 M19 的关系

多段落 **行内格式**（如对两段同时加粗）依赖选区本身跨段；**一次 `toggleMark`** 在选区合法时应产生 **单一历史步**（见 `richMultiParagraphToggleMark.test.ts`）。块级改写则通过上节扩选区后再 `setBlockType` / `wrapIn`。

## 实现入口

- [`webview/src/components/MilkdownEditor.vue`](../webview/src/components/MilkdownEditor.vue)：`MARKLY_TOOLBAR_BLOCK_FORMAT`、`prepareSelectionForToolbarBlockFormats`
