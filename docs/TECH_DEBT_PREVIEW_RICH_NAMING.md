# 技术债：`preview` / Rich 命名对齐（M09）

## 现状

| 层级 | 命名 | 含义 |
|------|------|------|
| VS Code Custom Editor | `markly.preview` | 自定义编辑器视图类型 ID |
| Extension `ModeController` | `preview` ↔ `source` | 宿主侧记录的「预览侧」 vs 源码编辑器 |
| Webview `SWITCH_MODE` | `preview` → 映射为 **`rich`** | [`webview/src/App.vue`](../webview/src/App.vue) 内注释：历史命名 |
| 用户心智 | 「Rich」「所见即所得」 | 工具栏与实际产品表述 |

二者 **不等同于** 已冻结的 CodeMirror **`ir`** 模式：`preview` 在协议层主要指向 **Rich（Milkdown）**。

## 风险

- 新贡献者误以为 `preview` = IR。  
- 状态栏、`ModeController`、`postMessage` 与 webview `EditorMode` 交叉阅读时混淆。

## 目标（破坏性变更批次，对齐 M97–M98）

1. Extension 对外状态与常量命名逐步改为 **`rich`** / `source`（或与 UI 完全一致的一套枚举）。
2. 保留 **`markly.preview` customEditor id** 的窗口期：**视图类型字符串**常与用户工作区会话绑定，改名成本高，可作为 **极少数例外** 长期保留别名。
3. 文档与 diagnostics 同时使用 **`editorModeRaw`**（协议值）与 **`editorModeTracked`**（`rich` \| `source` \| `legacy-ir`）。

## 非目标

- 本文件 **不改变运行时行为**；仅登记债务与收口顺序。

## 参考入口

- [`src/core/modeController/index.ts`](../src/core/modeController/index.ts)  
- [`src/extension/commands/index.ts`](../src/extension/commands/index.ts)（`markly.toggleMode`）  
- [`IR_ENTRYPOINT_AUDIT.md`](./IR_ENTRYPOINT_AUDIT.md)
