# Rich 模式 IME（中日韩）验证说明（M15）

## 自动化覆盖

- `webview/src/__tests__/richImeComposition.test.ts`：在 **jsdom** 上对编辑器根 DOM 触发 `compositionstart` / `compositionupdate` / `compositionend`（若无 `CompositionEvent` 则退化为普通 `Event`），仅验证 **不致崩溃**。
- jsdom **不**仿真真实输入法与选区回填，不可替代真机结论。

## 建议手测矩阵（桌面 VS Code）

1. macOS：**简体拼音 / 日文假名**：在段落中部与 **行内代码、链接、表格单元格** 内分别输入数个音节并确认提交后文本与光标位置。
2. Windows：**微软拼音**：同上；额外测 **列表项行首** 组合键不与 Tab 冲突。

## 失败时收集

- Webview **复制诊断信息**（含 `editorModeTracked`）。
- 录屏 + 系统输入法名称与版本。
