# M10：Rich 诊断入口 + 表格边界回归（建议里程碑）

目标：把 Rich 的“出问题时可自救”做完整，并把最容易回归的表格边界用例补齐，形成发版闭环。

## 交付物

- `docs/m10-rich-diagnostics-and-table-edges-plan.md`（本文件）
- 至少 5 个表格边界回归用例（E2E 或单测，优先单测；必要时 E2E）
- 一个可复制的诊断信息入口（UI 一键复制）

## M10-0：诊断信息契约（extension ↔ webview）

- **范围**：明确“诊断信息”包含哪些字段、如何脱敏、最大长度。
- **验收**：
  - 诊断信息能覆盖：当前模式、Rich 初始化状态、最近错误/重试次数、关键配置（wrap/mermaid/shiki/perf tier）、文档规模指标（chars/lines）、表格/选区诊断（若在 Rich）。
  - 一键复制不会泄露本机路径/个人信息（仅保留必要字段，路径做截断或 hash）。

## M10-1：UI 一键复制诊断入口

- **入口位置**（二选一或都做）：
  - Rich fallback banner 上增加“复制诊断信息”
  - Toolbar / 帮助面板增加“复制诊断信息”
- **验收**：
  - 点击后系统剪贴板拿到一段 JSON（或可读文本），并有 toast 提示“已复制”。
  - 在 Rich 已降级到 Source 的情况下依然可用（至少能提供降级原因与最近错误）。

## M10-2：表格边界回归（至少 5 个 case）

优先补这 5 类（按风险从高到低）：

1. **CellSelection 粘贴维度不匹配**（应拒绝扩表并提示）
2. **表格外 TSV/CSV 粘贴建表**（空行、末尾换行、`\r\n` 混合）
3. **header/body 混合语义**（thead 缺失或 header 落在 tbody 的兼容）
4. **空单元格 + `<br />` 序列化**（不应导致结构丢失/内容漂移）
5. **合并/拆分后粘贴**（内容不丢失，结构不扩表）

- **验收**：
  - 每个 case 都是“给定输入 → 断言真实输出/行为”，不能是存在性测试。
  - 失败时给出清晰错误信息（测试输出可定位原因）。

## M10-3：E2E bridge 最小化与稳定性约束

- **目标**：bridge 只提供“测试需要的最小表面积”，避免把内部实现过度暴露。
- **验收**：
  - bridge API 有明确白名单（例如 `e2eSelectFirstTableBodyCell`、`e2eSetCellSelectionInFirstTable`、`simulateRichTablePaste`、`runRichTableOp` 等）。
  - 新增 bridge API 必须配对应测试用例，否则不合入。

## M10-4：发版（1.5.2）

- **验收**：
  - `npm run test:vscode:ui` 通过
  - `npm test` 通过（若 Node 版本问题仍存在，则记录并提供固定 Node 版本的 CI/本地指引）
  - `npm run package` 输出 `markly-1.5.2.vsix`

