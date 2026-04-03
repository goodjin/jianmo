## v6 变更记录（IR 模式直接预览 KaTeX 与 Mermaid）

### 背景
v5 收敛了装饰器目录并导出了 `mathDecorator` / `diagramDecorator`，但 IR 扩展链（`createIRDecorators`）未接入它们。v6 完成接入，让用户在 IR 模式下即可看到数学公式与 Mermaid 图表的渲染预览。

### 关键改动

#### 1. StateField 路线（v6.1 核心）
CodeMirror 6 限制：**ViewPlugin 不能产生 block replace decorations**（会抛 `RangeError: Block decorations may not be specified via plugins`）。

因此 `mathDecorator` 和 `diagramDecorator` 从 `ViewPlugin.fromClass` 重写为 **`StateField.define` + `EditorView.decorations.from(field)`**，使 `Decoration.replace({ block: true, widget })` 合法。

- `webview/src/core/decorators/math.ts`：StateField 路线
  - 块级 `$$...$$`：`Decoration.replace({ block: true, widget: MathWidget })`
  - 行内 `$...$`：`Decoration.replace({ widget: MathWidget })`
- `webview/src/core/decorators/diagram.ts`：StateField 路线
  - ` ```mermaid ... ``` `：`Decoration.replace({ block: true, widget: DiagramWidget })`

#### 2. IR 扩展链接入
- `webview/src/core/editor.ts`：`createIRDecorators()` 加入 `mathDecorator()` 和 `diagramDecorator()`

#### 3. 样式
- `webview/src/main.ts`：引入 `./styles/decorators.css` 和 `./styles/diagram.css`
- 新增 `webview/src/styles/diagram.css`（Mermaid 渲染容器样式）

#### 4. 测试
- `webview/test/ir-mode.test.ts`：
  - 验证 `$$...$$` 触发 `Decoration.replace({ block: true })`
  - 验证 `$x^2$` 触发 `Decoration.replace`
  - 验证 ` ```mermaid``` ` 触发 `Decoration.replace({ block: true })`
- `webview/src/core/decorators/__tests__/{math,diagram,decorators}.test.ts`：
  - mock 改为 `importOriginal` 保留真实 `EditorView`（StateField 需要 `EditorView.decorations`）

### 验证
- `npm test` → 16 files, 206 tests passed
- `npm run build` → extension + webview 构建通过
