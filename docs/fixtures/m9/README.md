# M9 Fixtures：Rich 正确性与一致性

> 目的：作为 **round-trip 单测** 与 **Rich/Source 切换 E2E** 的统一输入集。  
> 规则：每个 fixture 都要写清 **覆盖点** 与 **允许差异（若有）**。

## fixture 清单

### 1) `01-basic.md`

- 覆盖点：标题、段落、强调、链接
- 期望：P→S 完全一致

### 2) `02-lists-and-tasks.md`

- 覆盖点：嵌套列表、任务列表、混合缩进
- 期望：P→S 完全一致（若缩进规范化，需在白名单说明）

### 3) `03-blockquote-and-code.md`

- 覆盖点：多层引用、代码块、长行
- 期望：P→S 完全一致

### 4) `04-tables-gfm.md`

- 覆盖点：表头、对齐、空单元格、长内容
- 期望：P→S 完全一致（对齐分隔行经 Milkdown 序列化会变为 `:----:` / `----:` 等形式；空单元格可能为 `<br />`，由 `richFixtureRoundTrip` 断言规范化后的稳定子串）

### 5) `05-footnotes.md`

- 覆盖点：脚注定义与引用、重复引用
- 期望：P→S 完全一致

### 6) `06-math.md`

- 覆盖点：行内/块级数学
- 期望：P→S 完全一致

### 7) `07-mermaid.md`

- 覆盖点：mermaid 代码块、多个图、长图
- 期望：P→S 完全一致（渲染不影响保存）

### 8) `08-images-and-links.md`

- 覆盖点：图片、相对路径、带查询参数的链接
- 期望：P→S 完全一致

### 9) `09-html-compat.md`

- 覆盖点：少量内联 HTML（若支持）
- 期望：若被规范化，需写入白名单；否则要求完全一致

### 10) `10-super-long-line.md`

- 覆盖点：超长行（wrap/scroll 不应影响内容）
- 期望：P→S 完全一致

### 11) `11-tables-stacked.md`

- 覆盖点：同文档多表、表前后段落、列数不同的第二张表
- 期望：P→S 完全一致（`richFixtureRoundTrip` 双次序列化稳定）

### 12) `12-table-rich-cells.md`

- 覆盖点：单元格内强调、链接、行内码
- 期望：P→S 完全一致

### 13) `13-table-wide-grid.md`

- 覆盖点：五列表格、行间空单元格（序列化后可能为 `<br />`）、多行数据
- 期望：P→S 完全一致；对齐/空格以 Milkdown serializer 规范化为准

