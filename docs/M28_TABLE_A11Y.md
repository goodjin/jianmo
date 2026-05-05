# M28：Rich 表格无障碍（a11y）

## 已采取的轻量措施（实现层）

- [`MilkdownEditor.vue`](../webview/src/components/MilkdownEditor.vue)：为表格容器提供 **`:focus-within` 可见轮廓**，便于键盘用户识别当前表格区域（颜色跟随 `focusBorder`）。
- 继续依赖 VS Code 主题变量，保证 **明暗模式** 对比度由宿主承担基线。

## DOM 与语义（ProseMirror 默认）

GFM 表格在 PM 中常为 `table` + `tr` + `th`/`td`；**不一定** 带完整 `role`/`<caption>`（受 Milkdown/Schema 约束）。

## 手动验收建议

1. **仅键盘**：`Tab` / `Shift+Tab` 在表内移动；`Mod+Alt` 结构键是否可达。  
2. **屏幕阅读器**（抽检）：表头行是否被读作表头（随实现升级而变）。  
3. **高对比主题**：聚焦环是否仍可见。

## 后续（非本里程碑必达）

- Schema 级 `caption`、显式 `scope` on `th`（需评估与 Markdown 互转损失）。  
- 与 **导出 HTML** 语义对齐（参见 M29 测试集）。
