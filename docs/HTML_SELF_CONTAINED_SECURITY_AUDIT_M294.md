# HTML 自包含模式安全审计（M294）

## 范围

- 导出 HTML（`src/core/export/htmlExport.ts`）
- Mermaid 导出脚本注入（`src/core/export/mermaidExport.ts`）
- 本地图片打包（`src/core/export/htmlBundleImages.ts`）

## 当前结论（基线）

- **未使用 `iframe`**：导出 HTML 为单文档结构，Mermaid 在同文档内渲染。
- **未使用 `document.write`**：脚本注入为内联 `<script>` 且仅做 `DOMContentLoaded` 初始化与 `mermaid.run()`。
- **Mermaid 安全级别**：初始化时使用 `securityLevel: 'strict'`（降低 HTML 注入风险）。
- **外链策略**：
  - Mermaid 脚本 bundling 可为 `embedded`（离线、自包含）或 `external`（CDN，需联网）。
  - 默认建议离线/企业场景使用 `embedded`。

## 风险点与缓解

- **外链 CDN（`external`）**：
  - 风险：离线不可用；受第三方供应链影响。
  - 缓解：默认用 `embedded`；文档明确；未来如需更强约束可提供“强制内联”策略。

- **Markdown → HTML**：
  - 风险：若允许原始 HTML 直出，可能包含 `script`/事件属性。
  - 缓解：标题/TOC 等关键插入点均做 `escapeHtml`；导出链路应避免信任不受控 HTML（未来如引入 raw HTML，需单独安全评审与 sanitizer）。

- **本地资源打包**：
  - 风险：路径逃逸（`..`）导致复制/引用越界。
  - 缓解：`htmlBundleImages.ts` 已做“必须落在 documentDir 下”的校验（防止 `..` 逃逸）。

## 建议的后续动作

- 若产品明确“导出 HTML 必须无外链”：默认强制 `embedded`，并在 UI 上隐藏 `external`（另立里程碑）。

