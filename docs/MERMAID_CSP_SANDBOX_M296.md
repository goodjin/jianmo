# Mermaid：沙箱与 CSP（M296）

## 目标

在不牺牲核心功能的前提下，减少 webview 的攻击面：

- **CSP 尽量严格**：只允许扩展自身打包脚本执行。
- Mermaid 渲染不依赖外链脚本（默认离线可用）。

## 当前实现（基线）

- webview HTML 入口：`src/extension/provider/customEditor.ts`
  - CSP 已收紧为：
    - `default-src 'none'`
    - `script-src ${webview.cspSource}`（不允许 https 外链脚本，不允许 `unsafe-eval`）
    - `style-src ${webview.cspSource} 'unsafe-inline'`（Vite/CSS 注入需要；后续如要更严格可引入 nonce）
    - `img-src` 允许 `https: data: blob:`（图片/粘贴/导出预览需要）
    - `connect-src` 允许 `https:`（仅用于必要的远端请求；可在后续里程碑进一步收敛）
    - `base-uri 'none'`、`frame-ancestors 'none'`

## Mermaid 相关注意点

- 编辑器内 Mermaid（webview）是 **本地依赖包**，不走 CDN。
- 导出 HTML 的 Mermaid bundling 仍支持 `embedded|external`（见 M294/M302），但这不影响 webview CSP。

## 后续（可选增强）

- 将 `style-src 'unsafe-inline'` 改为 nonce（需要配套构建与运行时注入 nonce）。
- 将 `connect-src https:` 收敛为仅允许必要域名（结合图片 allowlist / AI provider 等统一策略）。

