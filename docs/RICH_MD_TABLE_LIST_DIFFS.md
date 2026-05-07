# Rich ↔ Markdown：表格 / 列表专项差异清单（M287）

> 目的：把“看起来像 bug、但实际是规范化/限制”的点提前写清楚；同时把真正的 bug 边界钉死，便于定位回归。
>
> 关联：`docs/RICH_MD_SERIALIZATION_FREEZE_POLICY.md`（总体口径）、`docs/RICH_TABLE_USER_GUIDE.md`（表格使用）、`webview/src/plugins/__tests__/markly-table-rich.test.ts`（Rich 表格能力门禁）。

## 1. 表格（GFM pipe table）

### 允许的规范化

- **对齐行空格/格式统一**：例如 `| --- | --- |` 的空格、对齐符号写法变化。
- **表格宽度排版变化**：列宽对齐的空白变化（只要列数与单元格内容不变）。

### 必须视为 bug

- **列数变化**：保存后列数与原表不同。
- **单元格内容被拆表**：单元格里的 `` `a|b` `` 之类内容，不能导致表格被错误拆列/拆行。
- **单元格内容丢失或转义错误**：反引号、反斜杠、HTML 实体等被错误改写。

### 证据/门禁

- fixture：`docs/fixtures/m9/17-table-code-cell-pipe.md`（`a|b` 不应破坏表格结构）
- 单测：`webview/src/__tests__/richFixtureRoundTrip.test.ts`（允许个别 fixture 弱等价，但必须补关键断言）
- Rich 表格：`webview/src/plugins/__tests__/markly-table-rich.test.ts`

## 2. 列表（无序/有序/任务）

### 允许的规范化

- **marker 统一**：`-`/`*`/`+` 的统一（语义不变）。
- **有序列表编号重排**：若编辑器选择统一成 `1.` 风格（语义仍为“有序列表”且层级不变），可接受。
- **任务列表空格**：`- [ ]` 与 `- [x]` 的大小写/空格在规范化范围内（但状态必须保持）。

### 必须视为 bug

- **缩进层级变化**：嵌套列表层级被改变（尤其是 Rich 内 Tab/Shift+Tab 之后保存）。
- **任务状态变化**：`[ ]` / `[x]` 被错误翻转或丢失。
- **段落边界破坏**：列表项内的多段内容被错误合并/拆分，导致渲染语义变化。

### 证据/门禁

- `webview/src/__tests__/richListIndentKeymap.test.ts`（缩进与层级语义）
- `docs/RICH_SOURCE_PARITY_CHECKLIST.md`（验收清单）

