# M17：ProseMirror gapcursor（行内数学/代码边界）

## 行为

已启用官方 [`prosemirror-gapcursor`](https://github.com/ProseMirror/prosemirror-gapcursor) 插件，并在 webview 中引入其 `style/gapcursor.css`，用于在 **不可放置常规文本光标** 的块边界（如相邻块级节点之间、部分 inline 原子节点旁）提供 **间隙光标**，改善 **方向键穿越** 与点击落点体验。

## 代码位置

- [`webview/src/components/MilkdownEditor.vue`](../webview/src/components/MilkdownEditor.vue)：`b.use($prose(() => gapCursor()))` 与 CSS `import 'prosemirror-gapcursor/style/gapcursor.css'`。

## 测试

间隙光标高度依赖 **真实布局与主题**；当前以手测为主，IME 与 gap 组合场景见 [`RICH_IME_MANUAL.md`](./RICH_IME_MANUAL.md)。
