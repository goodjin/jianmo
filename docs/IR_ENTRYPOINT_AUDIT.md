# IR 模式入口盘点（M02）

> **说明**：凡可令 webview 进入 `EditorMode 'ir'` 或 CodeMirror 使用 `createEditorState(..., 'ir', ...)` 的路径，均列为 **可达**；仅供内部维护与冻结期 review。  
> **状态**：IR 已冻结，见 [`IR_FREEZE_POLICY.md`](./IR_FREEZE_POLICY.md)。

## 1. 协议与类型

| 路径 | 说明 |
|------|------|
| [`src/types/index.ts`](../src/types/index.ts) | `EditorMode` 含 `'ir'` |
| [`src/types/messageGuards.ts`](../src/types/messageGuards.ts) | `isEditorMode()` 接受 `'ir'` |

## 2. Webview 消息

| 路径 | 说明 |
|------|------|
| [`webview/src/App.vue`](../webview/src/App.vue) | `SWITCH_MODE`：`preview` 映射为 `rich`；`ir` / `source` 走 `switchMode` → CM6 |
| [`src/types/__tests__/messageContract.test.ts`](../src/types/__tests__/messageContract.test.ts) | 契约样例含 `mode: 'ir'` |

## 3. UI 与交互

| 路径 | 说明 |
|------|------|
| [`webview/src/components/Toolbar.vue`](../webview/src/components/Toolbar.vue) | **无** IR 按钮（仅 Rich/Source）；IR 非主入口 |
| [`webview/src/utils/richTabPolicy.ts`](../webview/src/utils/richTabPolicy.ts) | Tab 缩进：`'ir'` 与 `source` 分支 |

## 4. CodeMirror / 组合式

| 路径 | 说明 |
|------|------|
| [`webview/src/composables/useEditor.ts`](../webview/src/composables/useEditor.ts) | 默认 `initialMode \|\| 'ir'`（CM6 内部默认，与 App 外层 `rich` 并存需注意） |
| [`webview/src/types/editor.ts`](../webview/src/types/editor.ts) | webview 本地类型仅 `ir \| source` |
| [`webview/src/core/editor.ts`](../webview/src/core/editor.ts) | `mode === 'ir'` 挂载装饰器、`richClipboard` 等 |

## 5. 装饰器实现（IR 核心）

| 路径 | 说明 |
|------|------|
| [`webview/src/core/decorators/`](../webview/src/core/decorators/) | `index.ts` 聚合；各 `*.ts` 为 IR 视觉装饰（冻结期 **禁止新增模块**，见 `npm run check:ir-freeze`） |

## 6. 测试与 E2E

| 路径 | 说明 |
|------|------|
| [`webview/test/ir-mode.test.ts`](../webview/test/ir-mode.test.ts) | IR 行为单测 |
| [`webview/src/composables/__tests__/useEditor.test.ts`](../webview/src/composables/__tests__/useEditor.test.ts) | IR ↔ Source 切换 |
| [`webview/src/core/__tests__/editorInteraction.test.ts`](../webview/src/core/__tests__/editorInteraction.test.ts) | `createEditorState(..., 'ir')` |
| [`webview/src/utils/__tests__/richTabPolicy.test.ts`](../webview/src/utils/__tests__/richTabPolicy.test.ts) | `'ir'` Tab 策略 |
| [`e2e/ui-suite/markly-ui.test.js`](../e2e/ui-suite/markly-ui.test.js) | `bridgeSwitchMode(driver, 'ir')` |

## 7. Extension 宿主（不直接等于 `ir`，但影响模式名）

| 路径 | 说明 |
|------|------|
| [`src/extension/commands/index.ts`](../src/extension/commands/index.ts) | `markly.toggleMode`：`source` ↔ `preview`（发往 webview 后 **preview → rich**） |
| [`src/core/modeController/index.ts`](../src/core/modeController/index.ts) | 宿主侧 `source` / `preview`，与 webview `EditorMode` 命名不完全一致 → 见 [`TECH_DEBT_PREVIEW_RICH_NAMING.md`](./TECH_DEBT_PREVIEW_RICH_NAMING.md) |

## 8. 死代码 / 低优先

- 历史文档 [`docs/v4/**`](../docs/v4/) 中「即时渲染 / IR / Split」描述与当前产品不一致，**不作为运行入口**；以本文件与 `CLAUDE.md` 为准。
