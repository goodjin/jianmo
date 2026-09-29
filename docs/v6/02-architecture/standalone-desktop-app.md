# 独立 Markdown 查看编辑器（脱离 VSCode）架构

> 版本：v6 · 状态：已与用户确认（形态/只读/编辑/配置四项决策锁定）
> 范围：在 Markly 仓库内新增一个**脱离 VSCode 的独立桌面应用**，复用现有编辑内核与导出管线，不影响现有 VSCode 扩展。

## 1. 背景与约束

现有 Markly 是 VSCode 扩展：extension host（Node/esbuild CJS）+ webview（Vue3/Vite，Rich=Milkdown/ProseMirror，Source=CodeMirror 6），两者经 `postMessage` 通信，消息类型见 `src/types/index.ts`。文件/图片/PDF/HTML 导出/AI 能力都在 host 侧。

本方案新增独立应用，硬约束：

- **C1** 脱离 VSCode 的独立应用（用户决策）
- **C2** 可读可编辑；**C3** 先实现只读查看；**C4** 编辑通过按钮切换
- **C5** 独立 bundle，**不改 `webview/src` 与 `src/` 源码**
- **C6** 配置持久化：`~/.markly/config.json` + electron-store

## 2. 形态选型：Electron

| 候选 | 复用面 | 代价 | 结论 |
|---|---|---|---|
| **Electron** | 主进程=Node，直接复用 puppeteer/marked/fs；渲染进程复用整个 webview | 体积较大 | **采用** |
| Tauri | 体积小 | host 能力需 Rust 重写；puppeteer 不可用 | 复用面低，弃 |
| 纯 Web | 零安装 | 无 puppeteer；文件访问受限 | 只读够用，编辑/导出受限 |

**体积优化**：Electron 自带 Chromium，**砍掉 puppeteer**，PDF 导出改用 `webContents.printToPDF()`（与 puppeteer 同源 Chromium，渲染一致）。这是最大减重项，且不损失功能。叠加 asar + 单平台单架构 + 重依赖懒加载，P1 只读安装包可压至 ~50–65MB 量级。

## 3. 目录与构建

新增 `app/` 顶层目录，与 `src/`、`webview/` 并列，独立 `package.json` 与产物 `dist/app/`：

```
app/
├── package.json              # 独立依赖；版本独立 SemVer
├── tsconfig.json
├── vite.config.ts             # renderer 构建；alias 指回 ../webview/src 与 ../src/types
├── vitest.config.ts
├── electron/
│   ├── main.ts                # BrowserWindow + IPC + 文件打开
│   ├── preload.ts             # contextBridge 安全暴露 ipc
│   ├── hostBridge.ts          # WebViewMessage → 能力映射
│   └── config.ts              # ~/.markly/config.json → ExtensionConfig
├── renderer/
│   ├── main.ts                # installVsCodeShim + createApp
│   ├── vscodeShim.ts          # 满足 useVSCode 契约的 window.vscode
│   ├── PreviewApp.vue         # P1 精简只读组件
│   └── index.html
└── src/                       # app 专用源码（必要时）
```

**复用方式**：通过 vite alias 直接 import `webview/src` 的纯模块（`composables/useVSCode.ts`、`composables/useEditor.ts`、`core/editor.ts`、`components/MilkdownEditor.vue`、`shared/*`）与 `src/types/index.ts`，**不改它们一行**。`webview/src` 与 `src/` 构建零影响。

**风险约束**：`app/vite.config.ts` 必须照抄 `webview/vite.config.ts` 的 CodeMirror/Lezer `dedupe` 列表，否则运行时 `Transaction` 崩溃（undo/redo 报错）。

## 4. 核心复用机制：`window.vscode` shim

webview 所有 host 依赖收敛在 `useVSCode` 一个 composable（`postMessage(WebViewMessage)` / `onMessage(ExtensionMessage)` / `getState` / `setState`）与 `main.ts:75 acquireVsCodeApi()`。这是一个干净的消息契约边界。

**策略**：app 的 `renderer/main.ts` 注入一个满足同契约的 `window.vscode` shim，webview 代码零改动可跑：

```ts
// renderer/vscodeShim.ts（满足 useVSCode 的 VSCodeApi 契约）
(window as any).vscode = {
  postMessage: (msg) => ipcRenderer.send('host:msg', msg),
  getState: () => store.get('webviewState'),
  setState: (s) => store.set('webviewState', s),
};
// 主进程推送 ExtensionMessage → 派发 window message 事件（useVSCode.onMessage 监听它）
ipcRenderer.on('host:push', (_e, msg) =>
  window.dispatchEvent(new MessageEvent('message', { data: msg })));
```

> shim 通过 preload 的 contextBridge 暴露的 `window.electron` 工作，不直接暴露完整 ipcRenderer。

## 5. 宿主能力映射（WebViewMessage → Electron main）

`electron/hostBridge.ts` 把每条 `WebViewMessage` 映射到本地实现。复用的标 ✅ 复用，替代的标 🔁：

| WebViewMessage | 独立应用实现 | 类型 |
|---|---|---|
| `READY` | 回 `INIT`（content+config+initialEditorMode=`preview`） | 🔁 |
| `REQUEST_PREVIEW_HTML` | ✅ 复用 `src/core/export/htmlExport.ts` 的 `buildExportHtmlString` 本地渲染 → 回 `PREVIEW_HTML` | ✅ |
| `OPEN_EXTERNAL_LINK` | `shell.openExternal`（带 http/https scheme 校验） | 🔁 |
| `CONTENT_CHANGE` / `SAVE` | `fs.writeFile` | 🔁 |
| `SAVE_IMAGE` / `UPLOAD_IMAGE` | `fs.writeFile` + dialog 同名处理 | 🔁（P2/P3） |
| `EXPORT` html | ✅ 复用 `exportToHtml` | ✅（P3） |
| `EXPORT` pdf | `webContents.printToPDF`（**不用 puppeteer**） | 🔁（P3） |
| `AI_*_REQUEST` | ✅ 复用 `extension/ai/*.ts`（HTTP）；key 用 electron-store/safeStorage | ✅（P3） |
| `CHECK_LOCAL_IMAGE_REFS` / `LIST_ASSETS_IMAGE_FILES` | `fs.access` / `fs.readdir` | 🔁（P3） |
| `OPEN_IMAGE_DIRECTORY` / `OPEN_IMAGE_EDITOR` | `shell.openPath` / `shell.openExternal` | 🔁（P3） |
| `OPEN_MARKDOWN_DOCUMENT` | 新开 app 窗口 | 🔁（延后） |
| `SET_TOOLBAR_COLLAPSED` / `TRACK_EDITOR_MODE` | electron-store 持久化 | 🔁 |
| `FIND_MARKDOWN_BACKLINKS` / `OPEN_WORKSPACE_SEARCH` / `MARKDOWN_HOVER_PREVIEW` | — | 🚫 不适用（强依赖 VSCode 工作区模型） |

> P1 仅实现 `READY` / `REQUEST_PREVIEW_HTML` / `OPEN_EXTERNAL_LINK` / `getState`·`setState`；其余 case 在 hostBridge 预留位置并标 `TODO(deferred)`。

## 6. 只读 ↔ 编辑模式切换

复用现有 `EditorMode = 'source' | 'rich' | 'preview'`：

- **P1 只读**：`INIT.initialEditorMode = 'preview'`。正文区走 `REQUEST_PREVIEW_HTML` → `PREVIEW_HTML` 渲染，不碰编辑内核。
- **P2 编辑**：顶栏"编辑"按钮 → `SWITCH_MODE {mode:'source'}`（CodeMirror，复用成本最低）；改动 → `SAVE`/`CONTENT_CHANGE` → 写盘 → 切回 `preview` 重新渲染。
- **P3**：上 Rich(Milkdown)、大纲、查找替换、导出、AI、图片。

**P1 策略修正（最小完整改动）**：不 re-export `webview/src/App.vue`（5349 行，READY 后发 `CHECK_LOCAL_IMAGE_REFS`/`LIST_ASSETS`/`FIND_BACKLINKS`/`AI_*` 等并初始化 Milkdown/CM6，需 shim 满足全部契约）。改用精简 `PreviewApp.vue`，走 `useVSCode`（验证 shim）→ `READY` → `INIT` → `REQUEST_PREVIEW_HTML` → `PREVIEW_HTML` → `<iframe :srcdoc>` 渲染（iframe srcdoc 可执行 mermaid bootstrap script，且样式隔离；Vue `v-html` 不执行 script 故不适用）。这是最小但完整的只读闭环，验证 shim 契约 + 消息链路 + types 复用。P2 再增量集成完整 App.vue。

## 7. 阶段计划

| 阶段 | 范围 | 复用 | 交付 |
|---|---|---|---|
| **P1 只读查看** | Electron 壳 + shim + INIT/READY + preview 渲染 + openExternal + getState/setState + config | `buildExportHtmlString`、`useVSCode`、`src/types` | 可打开本地 md、只读渲染、点链接 |
| **P2 可编辑** | SAVE/CONTENT_CHANGE + Source(CM6) 工具栏 + switchMode | `useEditor`/`editor.ts`/`useToolbar` | 编辑、保存、格式化、撤销 |
| **P3 全能力** | 图片落盘、PDF(printToPDF)/HTML 导出、AI、大纲/查找替换、Rich(Milkdown) | `ai/*`、`MilkdownEditor`、各 composables | 功能对齐扩展 |

## 8. 假设、风险与验证

- **假设**：`editor.ts`/`useEditor.ts`/`MilkdownEditor.vue`/`shared/*` 为纯模块、无 `vscode` import —— 已由读取证实。`htmlExport.ts` 纯 Node（仅依赖 fs/path/katex/marked），主进程可直接复用 —— 已证实。
- **风险 1（高）**：CodeMirror/Lezer 多实例崩 —— `app/vite.config.ts` 必须照抄 `dedupe`。
- **风险 2（中）**：`useVSCode.getState/setState` 用于状态记忆，shim 必须真实现（electron-store），否则模式记忆丢失。
- **风险 3（中）**：`webview.asWebviewUri`（解析 `./assets/x.png`）在独立应用换 `file://` 直链；CSP 换 Electron 的。
- **风险 4（低）**：app ↔ webview 源码 import 单向（app→webview），防循环依赖。
- **验证**：app 层加 vitest（复用模块测试已存在）；P1 单测覆盖 shim 契约、hostBridge 路由、buildExportHtmlString 渲染 fixture md；构建（renderer vite + main esbuild）成功；Electron GUI 启动由用户本地跑（提供 npm script）。

## 9. 版本

`app/package.json` 独立版本，遵循仓库 CLAUDE.md 的 SemVer 规则。P1 为新增功能起步版本 `0.1.0`（独立包 alpha），随阶段演进至 `1.0.0`。与根 `package.json`（扩展，当前 2.0.3）解耦。

## 10. 覆盖映射

| 需求 | 状态 | 处置 |
|---|---|---|
| C1 脱离 VSCode 独立应用 | ✅ | Electron，独立 `app/` 产物 |
| C2 可读可编辑 | ✅ | preview(只读) + source/rich(编辑)，按钮切换 |
| C3 先实现只读 | ✅ | P1 走 preview 模式，复用导出管线 |
| C4 按钮切编辑 | ✅ | `SWITCH_MODE` + `switchMode`（P2） |
| C5 独立 bundle 不影响现有 | ✅ | `app/` 独立 package/build，import 纯模块不改源 |
| C6 配置持久化 | ✅ | `~/.markly/config.json` + electron-store |
| 导出/AI/图片 等扩展能力 | 🕒 | P3 |
| 工作区反向链接/搜索/hover | 🚫 | 强依赖 VSCode 工作区模型，范围外 |
