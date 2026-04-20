# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Markly** is a VSCode extension that provides a WYSIWYG Markdown editor. It uses a Custom Editor Provider to render markdown files in a webview powered by CodeMirror 6 and Vue 3.

## Architecture

The project has two separate build targets with independent `package.json` and `node_modules`:

- **Extension host** (`src/`): Node.js process running in VSCode. Entry point: `src/extension/index.ts`. Bundled with esbuild to `dist/extension/index.js`.
- **Webview** (`webview/`): Browser-based Vue 3 app rendered inside VSCode's webview panel. Entry point: `webview/src/main.ts`. Built with Vite to `dist/webview/`.

Communication between extension and webview uses `postMessage`/`onDidReceiveMessage` with typed messages defined in `src/types/index.ts` (`ExtensionMessage` and `WebViewMessage`).

### Extension Side (`src/`)
- `extension/index.ts` - Activation entry, registers CustomEditorProvider, commands, config listener
- `extension/provider/customEditor.ts` - `MarkdownEditorProvider` implements `CustomEditorProvider`, manages webview lifecycle, handles message routing, document save/export
- `core/documentStore/` - In-memory document state management
- `core/modeController/` - Editor mode (IR/source) state coordination
- `core/export/` - PDF and HTML export (PDF uses puppeteer)

### Webview Side (`webview/src/`)
- `App.vue` - Root component orchestrating toolbar, editor, outline, find-replace
- `core/editor.ts` - Creates CodeMirror 6 EditorState/EditorView with markdown language and decorators
- `core/decorators/` - CM6 ViewPlugins for IR mode: heading, emphasis, link, code, taskList, list
- `composables/useEditor.ts` - Vue composable wrapping CM6: content management, mode switching, format/insert operations, undo/redo
- `composables/` - Other composables: useVSCode (postMessage bridge), useOutline, useFindReplace, useToolbar, useTheme
- `shared/` - Shared configs (toolbar items, theme, outline parsing)

### Shared Types
`src/types/index.ts` is imported by both sides. The webview resolves it via Vite alias `@types -> ../src/types`. The extension uses tsconfig path alias `@types/* -> src/types/*`.

### Editor Modes
- **IR mode** (`'ir'`): Intermediate Representation - markdown source with CM6 decorators that render headings, emphasis, links, etc. visually inline
- **Source mode** (`'source'`): Plain markdown source editing with monospace font

## Build & Dev Commands

```bash
# Install dependencies (both root and webview)
npm install && cd webview && npm install

# Full build
npm run build

# Build individually
npm run build:extension    # esbuild -> dist/extension/
npm run build:webview      # vite -> dist/webview/

# Dev watch mode
npm run dev:extension      # esbuild --watch
npm run dev:webview        # vite dev server (cd webview)

# Unit tests (vitest)
npm test                   # runs all tests (extension + webview)
cd webview && npm test     # webview tests only (jsdom environment)

# Run a single test file
npx vitest run src/extension/__tests__/editorProvider.test.ts
npx vitest run webview/src/composables/__tests__/useEditor.test.ts

# E2E tests
npm run test:vscode        # VSCode extension integration tests
npm run test:vscode:ui:setup  # first run: ExTester downloads VS Code + ChromeDriver into .vscode-test/extest-ui
npm run test:vscode:ui     # ExTester：会先 vsce package + install-vsix 再跑 UI（避免测试实例里仍是陈旧 vsix）；见 e2e/ui-suite/
# 须在 macOS 已登录桌面的本机终端运行；纯 SSH / 无 WindowServer 时常见 Chrome/Electron 立刻退出
# 若报 user-data-dir 被占用：先重跑（脚本会 pkill 残留进程）；仍失败则删 .vscode-test/extest-ui/settings

# Lint
npm run lint

# Package extension
npm run package
```

## 测试规则（强制）

编写或审查测试时，必须遵守以下三条铁律。违反任何一条的测试等于没有测试。

### 禁令一：禁止"假测试" — 断言硬编码常量

```ts
// ❌ 永远通过，什么都没测
it('should render headings', () => {
  const hasDecorator = true;
  expect(hasDecorator).toBe(true);
});

// ✅ 给定输入，断言真实输出
it('should render headings', () => {
  editor.setContent('# Title');
  expect(editor.getContent()).toBe('# Title');
  // 验证装饰器确实被调用
  expect(Decoration.replace).toHaveBeenCalled();
});
```

**检测方法**：如果删除被测代码后测试仍然通过，就是假测试。

### 禁令二：禁止只测"存在性"，必须测"行为正确性"

```ts
// ❌ 方法存在 + 不报错 ≠ 功能正确
it('undo works', () => {
  expect(typeof undo).toBe('function');
  expect(() => undo()).not.toThrow();
});

// ✅ 验证 undo 真的能撤回变更
it('undo reverts content change', () => {
  setContent('modified');
  expect(undoDepth(view.state)).toBeGreaterThan(0);
  undo();
  expect(getContent()).toBe('original');
});
```

**检测方法**：如果把函数实现改成空函数 `() => {}` 后测试仍然通过，就是存在性测试。

### 禁令三：禁止只测一个分支，必须覆盖所有行为路径

```ts
// ❌ 只测了 bold，h1-h4、列表、删除线全部遗漏
it('applyFormat works', () => {
  applyFormat('bold');
  expect(getContent()).toContain('**');
});

// ✅ 每种格式类型单独一个 it，验证具体行为
it('h2 inserts ## at line start', () => { ... });
it('bulletList inserts - at line start', () => { ... });
it('strike wraps with ~~', () => { ... });
```

**检测方法**：被测函数有 N 种输入类型/分支，测试必须覆盖 ≥ N 个 case。

## Key Conventions

- Path aliases: `@core`, `@types`, `@extension`, `@editor`, `@plugins`, `@image`, `@services` (configured in tsconfig.json and esbuild)
- Webview path aliases: `@` -> `webview/src/`, `@types` -> `src/types/` (configured in vite.config.ts)
- Root vitest config (`vitest.config.ts`) runs tests from both `src/extension/__tests__/` and `webview/src/**/__tests__/` with node environment
- Webview vitest config (`webview/vitest.config.ts`) uses jsdom environment with coverage thresholds (80% statements/functions/lines, 75% branches)
- TypeScript strict mode, target ES2022
- Extension is bundled as CJS (`--format=cjs`) for VSCode compatibility; `vscode` and `puppeteer` are external

## 版本号规则（强制）

使用语义化版本（SemVer）：`MAJOR.MINOR.PATCH`

- **默认策略**：只要有改动并重新打包，至少做一次版本递增；若不确定，优先 `PATCH + 1`。

### PATCH（修复/小改动）何时 +1

满足任一项就用 `PATCH + 1`（例如 `1.0.0 -> 1.0.1`）：

- **修 bug / 稳定性**：修 UI 测、修崩溃、修边界条件、减少偶发错误
- **不改变对外行为的内部调整**：重构、性能优化、日志/诊断增强、构建/打包流程调整
- **UI 细节**：样式微调、不影响用户使用习惯/快捷键/配置语义的改动

### MINOR（新增功能/增强且兼容）何时 +1

满足任一项就用 `MINOR + 1`（例如 `1.0.1 -> 1.1.0`）：

- **新增功能**：新增命令、面板、装饰器、导出能力、编辑能力（且旧用法仍可用）
- **可选增强**：新增配置项（默认值不改变旧行为）或新增 UI 开关（默认不影响现有用户）
- **兼容性增强**：支持更多 Markdown 语法/更多平台差异处理，但不破坏旧输入输出

### MAJOR（破坏兼容/需要适配）何时 +1

满足任一项就用 `MAJOR + 1`（例如 `1.x.x -> 2.0.0`）：

- **破坏兼容**：现有用户的使用方式会“直接坏掉”或必须改习惯/改配置才能继续用
- **核心行为改变**：默认模式/默认快捷键/默认格式化规则/内容序列化结果发生显著变化
- **协议/类型破坏**：extension ↔ webview 消息结构（`src/types`）不兼容旧版本
- **重大架构迁移**：编辑器内核替换、持久化格式迁移、导出链路大改且不提供兼容路径

### 具体操作（打包前必须完成）

- **更新版本号**：根 `package.json` 与 `webview/package.json` 的 `version` 保持一致
- **打包产物核对**：`vsce package` 产出的 VSIX 文件名应匹配版本号（例如 `markly-1.0.1.vsix`）

