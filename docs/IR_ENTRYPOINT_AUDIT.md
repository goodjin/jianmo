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
| [`webview/src/core/editor.ts`](../webview/src/core/editor.ts) | **M278** 起不再为 `ir` 挂载 decorators（IR decorators 已移除）；`ir` 输入会在 Webview 侧 **降级为 Source**（见下文）。 |

## 6. 测试与 E2E

| 路径 | 说明 |
|------|------|
| [`webview/src/composables/__tests__/useEditor.test.ts`](../webview/src/composables/__tests__/useEditor.test.ts) | 历史上含 IR ↔ Source 切换（后续会随 IR 退场继续收缩） |
| [`webview/src/utils/__tests__/richTabPolicy.test.ts`](../webview/src/utils/__tests__/richTabPolicy.test.ts) | `'ir'` Tab 策略（兼容保留；后续可随类型收缩一并移除） |
| [`e2e/ui-suite/markly-ui.test.js`](../e2e/ui-suite/markly-ui.test.js) | 历史上可能触发 `bridgeSwitchMode(driver, 'ir')`（后续会收敛到 Rich/Source） |

## 7. 兼容降级（现状）

- **M279**：Webview 收到 `SWITCH_MODE: { mode: 'ir' }` 时，会 **自动降级为 `source`**，避免落入已删除的 IR 实现层。

## 8. Extension 宿主（不直接等于 `ir`，但影响模式名）

| 路径 | 说明 |
|------|------|
| [`src/extension/commands/index.ts`](../src/extension/commands/index.ts) | `markly.toggleMode`：`source` ↔ `preview`（发往 webview 后 **preview → rich**） |
| [`src/core/modeController/index.ts`](../src/core/modeController/index.ts) | 宿主侧 `source` / `preview`，与 webview `EditorMode` 命名不完全一致 → 见 [`TECH_DEBT_PREVIEW_RICH_NAMING.md`](./TECH_DEBT_PREVIEW_RICH_NAMING.md) |

## 9. 死代码 / 低优先

- 历史文档 [`docs/v4/**`](../docs/v4/) 中「即时渲染 / IR / Split」描述与当前产品不一致，**不作为运行入口**；以本文件与 `CLAUDE.md` 为准。
