# M31：表格 × 行内公式（导出矩阵）

## 范围

- **HTML 导出**（`marked` + `renderMarkdownMath` + KaTeX）：管道表单元格内的 `$...$` 应正确走数学预处理并输出 `katex` 类节点。
- **Rich 内嵌**：是否展示格内公式取决于当前 Milkdown/数学插件链路；与 **Source** 源码编辑无冲突。若 Rich 未启数学节点，以「导出与源码真值」为准。

## 测试

- `src/core/export/__tests__/htmlExport.test.ts`：`M31` 用例锁定「表 + 行内公式」。
