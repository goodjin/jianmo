# Rich ↔ Source（CM6）撤销 / 重做语义（M20）

本文描述 **模式切换** 时的历史栈行为，供验收与支持口径统一。

## 两套独立历史

| 上下文 | 实现 | 快捷键入口（典型） |
|--------|------|---------------------|
| **Rich** | Milkdown `plugin-history`（ProseMirror） | 工具栏撤销/重做；宿主命令若路由到 webview |
| **Source / legacy-IR（CM6）** | CodeMirror `@codemirror/commands` **或** `useEditor` 简易栈（视 `__marklyUseNativeHistory`） | 同上 |

二者 **不合并**：在 Rich 中的撤销步 **不会** 在切到 Source 后继续生效，反之亦然。

## 切换模式时发生什么

1. **进入 Rich**（`switchMode('rich')`）  
   - 先用当前 `content`（Markdown 串）调用 `milkdownRef.setContent`。  
   - Milkdown 文档被 **整体替换**；PM 历史是否为「新会话」取决于 Milkdown/ProseMirror 的实现细节——**产品口径**：不要依赖「跨一次 Rich 进出的撤销链」；重要操作请以保存为准。

2. **离开 Rich → CM6**（`'source'` / `'ir'`）  
   - 先把 Rich 侧 `getContent()` 写回 `content`（若变化则向宿主发 `CONTENT_CHANGE`）。  
   - `editor.switchMode(mode)` 会 **销毁并重建** CodeMirror `EditorView`，并按 `useEditor.switchMode` 语义 **清空** 简易历史栈；CM6 原生 history 同样随 view 重建而 **不保留**（见单测）。

## 用户提示（可选增强）

当前 **不** 默认弹窗；若反馈较多，可在首次跨模式编辑后加一次性轻提示（非本文件范围）。

## 验证

- CM6：`webview/src/composables/__tests__/useEditor.test.ts`「M20」用例。  
- Rich：历史隔离属 PM 默认前提；跨模式不合并见上文。
