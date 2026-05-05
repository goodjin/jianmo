# M30：表格单元格内多块与 Markdown 等价

## 产品事实（GFM + Milkdown）

- Rich（Milkdown `preset-gfm`）表格单元格 **`table_cell` 内容为 `paragraph+`**：格内是**一个或多个段落节点**，不是任意块级嵌套（列表等仍受 schema 限制，见 `richTableKeyboard` 单测备注）。
- **格内换行**在落盘 Markdown 中通常体现为 **HTML `<br />`**（或硬换行等价物），而不是「第二个 GFM 表格行」。这是 GFM 管道表的常规限制。
- **多段**：若需真正多段语义，往往需依赖 HTML 嵌入或接受序列化将内容规范为单段 + `<br />`。

## 验收 / 测试

- Fixture [`docs/fixtures/m9/14-table-cell-linebreaks.md`](../fixtures/m9/14-table-cell-linebreaks.md)：格内原为 `<br />` 分隔两行；**往返后**序列化可能将软断行吸收为**同段连续文本**（仍以「格内两个语片不丢字」为门禁，见 `richFixtureRoundTrip.test.ts`）。
- 与清单：[`RICH_SOURCE_PARITY_CHECKLIST.md`](./RICH_SOURCE_PARITY_CHECKLIST.md)「管道表格」脚注可链到本页。
