# M45：命令与快捷键策略（清单）

本文档列出主要 `markly.*` 命令及 Webview 内快捷键语义；精确 contributes 表以仓库根 `package.json` 为准（单一事实来源）。

## Webview（Markly Custom Editor）

| 键位 | Rich / Source |
|------|----------------|
| Mod+S | 保存 + TOC |
| Mod+F | 打开查找面板 |
| Mod+Shift+V | Rich：纯文本粘贴 |
| Mod+K | 插入链接 |
| Mod+Shift+K | 插入代码块 |

## 与 VS Code 冲突说明

专注在编辑器内时，`Ctrl/Cmd+F` 由全局 `keydown` 监听器接管；若 VS Code「保留」查找 widget，请以实际 VS Code / 快捷键自定义为准。

## Rich vs Source

- Rich：格式/粘贴/表格等走 Milkdown ProseMirror；Source：CodeMirror。
- 命令面板中 `pastePlain`、`find.toggle`、`wrapUrlLink`、`rewriteSelection`（mock）等对双模式尽量一致。
