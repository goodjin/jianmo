## v5 变更记录（代码健康度改造）

### 背景
- **目标**：让测试“干净绿”（无 stderr 噪音）、减少重复实现、提升可维护性与可测试性。
- **范围**：Webview 侧（Vue + CodeMirror 6）为主；不改变产品功能行为（除测试环境稳定性）。

### 关键改动
- **统一 Vitest / jsdom 的 CodeMirror DOM 补齐**
  - 新增：`webview/src/test/codemirrorDomSetup.ts`
  - 内容：补齐 `document.createRange`、`Range#getClientRects/getBoundingClientRect`、`document.getSelection/window.getSelection`、`window.getComputedStyle` 等。
  - 同时将 `window.prompt` 在测试环境中改为静默返回 `null`，避免 jsdom “Not implemented: window.prompt” 产生 stderr。

- **根目录与 webview 的 Vitest 配置接入 setup**
  - 更新：根 `vitest.config.ts` 增加 `setupFiles`，并纳入 `webview/test/**/*.test.ts`。
  - 更新：`webview/vitest.config.ts` 增加 `setupFiles`。

- **编辑器插入逻辑与 UI 输入解耦（可注入 prompt）**
  - 更新：`webview/src/types/editor.ts` 的 `EditorOptions` 增加 `promptInput?: (message, defaultValue) => string | null`
  - 更新：`webview/src/composables/useEditor.ts` 将 `insertNode('link'|'image')` 中的 `window.prompt` 改为走 `promptInput`（默认仍使用浏览器 `window.prompt`）。

- **装饰器收敛为单一路径**
  - 新增并收敛：`webview/src/core/decorators/{math,diagram,utils}.ts`
  - 更新：`webview/src/core/decorators/index.ts` 统一导出装饰器与工具函数
  - 迁移测试：`webview/src/core/decorators/__tests__/...`
  - 删除旧路径：`webview/src/decorators/**`

### 验证方式
- **根目录单测**：`npm test`（应无 stderr，且全部通过）
- **webview 单测**：`cd webview && npm test`（应全部通过）
- **构建**：`npm run build`（extension + webview 产物构建通过）

### 已知影响
- `docs/v4/**` 中仍引用旧路径 `webview/src/decorators/*`（未在 v5 中修改文档内容）。

