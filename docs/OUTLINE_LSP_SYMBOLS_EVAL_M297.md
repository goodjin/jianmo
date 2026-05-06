# 大纲：与 LSP/符号（可选）评估（M297）

## 结论（本阶段）

**不接入** VS Code LSP `DocumentSymbol` 作为大纲数据源，维持当前“纯 Markdown 解析”的实现。

理由：收益有限、实现与兼容成本高，并且会引入明显的跨端/跨环境不确定性（Remote/WSL、多语言符号提供器差异、性能与权限）。

## 现状

- webview 侧大纲来源：
  - `webview/src/shared/outline.ts`：ATX 标题解析 + slug 规则
  - `webview/src/shared/mermaidOutline.ts`：合并 Mermaid fence（M42）
- 交互：
  - 跳转/重排由 webview 内部完成，不依赖 extension API。

## 若要接入 LSP 的实现路径（仅评估）

由于 webview 无法直接调用 `vscode.commands.executeCommand`，需要走“extension 代理”：

- webview → extension：发消息请求 symbols（含 documentUri）
- extension：调用 `vscode.executeDocumentSymbolProvider`（或 `vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', ...)`）
- extension → webview：回传 symbols（需定义新的 message contract + guards + 单测）

风险点：

- **一致性**：不同语言服务返回的 symbols 结构差异大；Markdown 本身的 symbols 质量依赖用户安装的扩展。
- **性能**：symbols provider 可能较慢/阻塞；大文档容易引入卡顿与超时策略。
- **可用性**：Remote/WSL、受限环境、禁用 LSP 时需回退，回退逻辑会让体验更复杂。

## 建议的替代增强（更稳）

- 继续优化现有解析：
  - 支持 Setext 标题（`===/---`）作为可选增强
  - 更稳的 heading slug 冲突提示与跳转 UX
  - 大文档折叠/筛选性能优化（与 M334 关联）

