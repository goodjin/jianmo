# M26：大表虚拟化 / 分段渲染 — 阶段性结论

## 现状

Rich 表格由 **Milkdown + prosemirror-tables** 渲染；列宽拖拽可按档位关闭（`markly.editor.richTableColumnResize`）。**未** 做 viewport 级虚拟行。

## 为何不立刻上虚拟化

- PM 表格模型假设连续 DOM，虚拟化需 **行池 + 映射**，与 `CellSelection`、粘贴填充、合并单元格 **强耦合**。
- 性能主矛盾已通过 **关闭列宽插件 / 大文档档位** 缓解（见 `richPerfTier`）。

## 后续实验顺序（供 M95+）

1. 只读视图（导出预览）先行分段渲染。  
2. Rich 编辑侧：测量 **1000 行 × N 列** 下帧时间与交互路径，再决定是否 fork `prosemirror-tables` 抽象层。
