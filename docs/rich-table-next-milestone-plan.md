# Rich 表格下一里程碑计划（N1–N4）

> 状态：执行中（2026-04-20）
> 关联代码：`webview/src/plugins/markly-table-rich.ts`、`webview/src/core/richTableCommands.ts`、`webview/src/components/MilkdownEditor.vue`、`webview/src/components/Toolbar.vue`、`webview/src/App.vue`、`e2e/ui-suite/markly-ui.test.js`

## 1. 目标

在 Rich（Milkdown/ProseMirror）模式下，把表格能力推进到“编辑器级体验”：

- **N1**：合并/拆分单元格（结构编辑）
- **N2**：表格外粘贴矩阵 → 自动建表（TSV/CSV/HTML table）
- **N3**：选区填充粘贴（按选区/矩阵维度填充）
- **N4**：E2E/单测回归补齐（稳定可测）

## 2. 约束与约定

- **稳定性优先**：宁可拒绝/降级，也不允许错位破坏表格结构。
- **上限保护**：遵守 `MARKLY_TABLE_PASTE_MAX_ROWS/COLS/CELLS`，超限必须提示（toast）。
- **命令收敛**：结构编辑命令统一走 `webview/src/core/richTableCommands.ts`（工具栏/右键/快捷键同一路径）。
- **测试策略**：
  - 复杂剪贴板（HTML）不强求真实系统剪贴板；允许走 `__marklyE2E` 桥模拟；
  - 必须覆盖：表格外建表、表格内 TSV 粘贴填充、合并/拆分。

## 3. 实现顺序（建议）

先打基础（粘贴与选区），再做结构（合并/拆分），最后补测试。

1) **N2**（表格外矩阵粘贴自动建表）  
2) **N3**（选区填充粘贴）  
3) **N1**（合并/拆分单元格）  
4) **N4**（E2E + 单测完善）  

## 4. 任务拆分（Todo）

### 4.1 N2：表格外矩阵粘贴自动建表

- [ ] **N2-1**：新增“表格外粘贴矩阵”的解析入口（读取 `text/html`/`text/plain`，复用现有 grid 解析），并输出统一的结果/失败原因。
- [ ] **N2-2**：在 Rich 下 selection 不在表格时：若解析到 grid，则在当前位置插入新表格并填充内容。
  - **新建表格 header 规则**：**首行作为 header**（第 1 行用 header cell，后续行用普通 cell）。
- [ ] **N2-3**：行为定义（优先级 / 回退 / 拦截 / 提示）：
  - **html 优先**：同时存在 `text/html` 与 `text/plain` 时，先尝试把 HTML 解析为 table grid（覆盖 Excel/网页复制）。
  - **plain 回退**：HTML 解析失败且不属于超限场景时，再尝试把 plain 解析为 TSV/CSV 矩阵（严格多行 CSV，避免误伤普通段落）。
  - **over_limit 拦截 + toast**：只要解析到矩阵但超过行/列/格子上限，必须 **toast** 并 **return true 拦截**（避免把超大内容原样粘贴导致卡顿）。
  - **候选失败轻 toast 但不拦截**：当剪贴板“看起来像表格”（HTML 像 table 但 invalid，或 plain 像 TSV/多行 CSV 但 not_grid）时，给轻 toast 提示“按普通粘贴处理”，但 **return false 不拦截**（交给默认粘贴）。
- [ ] **N2-4**：补单测（解析层/插入层最小烟测）与文档说明（行为定义）。

### 4.2 N3：选区填充粘贴（表格内）

- [ ] **N3-1**：定义填充规则（矩阵大小 vs 选区大小）：完全匹配、单行/单列扩展、1x1 广播、其他拒绝并 toast。
- [ ] **N3-2**：实现：在表格内且为 CellSelection 时，按规则把 grid 写入选区（不走 `insertCells` 的结构扩展路径，避免错位）。
- [ ] **N3-3**：与 header 语义一致：落点/选区覆盖 header 行时保持 header cell 类型。
- [ ] **N3-4**：补单测 + E2E（走桥模拟粘贴），覆盖 1x1、1xN、Nx1、NxN、拒绝分支。

### 4.3 N1：合并/拆分单元格

- [ ] **N1-1**：命令层：在 `richTableCommands.ts` 新增 `mergeCells` / `splitCell` op（仅在表格内且 selection 合法时启用）。
- [ ] **N1-2**：UI：工具栏/右键菜单增加“合并单元格/拆分单元格”，并根据选区启用/禁用（必要时先放宽为“尝试执行，失败 toast”）。
- [ ] **N1-3**：与 HTML 粘贴展开策略一致：合并后的序列化/再编辑不应错位；不支持的情况明确 toast。
- [ ] **N1-4**：补 E2E：选中 2x2 → 合并 → 拆分；断言 markdown 内容可追溯。

### 4.4 N4：测试与回归门禁

- [ ] **N4-1**：E2E：表格外粘贴 TSV → 自动建表（桥模拟）。
- [ ] **N4-2**：E2E：表格内选区填充（至少 2 条：广播 + 完全匹配）。
- [ ] **N4-3**：E2E：合并/拆分（N1）。
- [ ] **N4-4**：单测：解析/规则函数分支覆盖（拒绝、超限、合并展开）。

## 5. 验收标准（DoD）

- **功能**：N1/N2/N3 都能在 Rich 下稳定工作，失败时有 toast，且不会破坏表格结构。
- **性能**：大表被上限拦截，不会卡死 webview。
- **测试**：`npm test` 全绿；新增 E2E 覆盖 N1/N2/N3 关键路径。

