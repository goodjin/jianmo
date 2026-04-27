# M14：Rich 日常编辑一致性收口

目标：把 Rich 模式从“专项能力稳定”推进到“日常编辑可靠”，优先收口工具栏、保存同步、常见插入和真实用户编辑流。

> 建议版本：`1.5.6`

## 交付物

- Rich 常用格式工具栏回归
- Rich 保存/同步/撤销路径回归
- Rich 链接、图片、代码块、数学块插入回归
- 真实用户编辑流 E2E
- `markly-1.5.6.vsix`

---

## M14-0：范围锁定与基线

- [x] 新建本计划文档
- [x] 明确本阶段不做大功能，只补 Rich 日常编辑一致性
- [x] 发版目标锁定为 `1.5.6`
- **验收**：
  - checklist、验收标准和测试范围明确

---

## M14-1：Toolbar / 快捷键一致性

- [x] Rich 下常用格式按钮有真实行为回归：
  - Bold
  - Inline Code
  - Heading
  - Blockquote / List
- [x] 避免只测按钮存在，必须断言 Markdown 或 DOM 行为
- **验收**：
  - Rich 常用格式至少 1 条 E2E 覆盖核心链路

---

## M14-2：保存 / 同步 / Undo Redo 稳定性

- [x] Rich 保存使用 Rich 当前内容作为真源，避免旧 CM6 文本回写
- [x] Rich / Source 来回切换不丢内容
- [x] Rich undo/redo 入口保持走 Milkdown，不触发 CM6 双 undo
- **验收**：
  - 单测或 E2E 覆盖 Rich 保存真源

---

## M14-3：链接、图片、代码块、数学块边界

- [x] Rich 下 Link/Image/Code Block/Math Formula 插入行为有回归
- [x] 覆盖空文档或小文档里的插入
- [x] 明确 Rich 链接/图片当前使用固定占位，不走 Source prompt
- **验收**：
  - Rich 插入至少 1 条 E2E 覆盖常见块和行内插入

---

## M14-4：真实用户编辑流 E2E

- [x] 从小文档开始完成日常编辑流
- [x] 包含标题、段落、格式、插入与表格相关覆盖
- [x] Source/Rich 往返后内容仍可识别
- **验收**：
  - 用例纳入 `test:vscode:ui:stable`

---

## M14-5：发版 `1.5.6`

- [x] 版本号同步到 `1.5.6`
- [x] `npm test`
- [x] `npm run test:vscode:ui:stable`
- [x] `npm run package`
- **验收**：
  - 产物文件名：`markly-1.5.6.vsix`

