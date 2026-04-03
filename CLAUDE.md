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
npm run test:e2e:install   # first run: install Chromium into project (required before test:e2e)
npm run test:e2e           # Playwright tests (webview dev server; see playwright.config.ts)

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
