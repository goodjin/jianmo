# M17: Commands And Shortcuts

## 目标

让 Rich 主编辑体验可以通过 VS Code Command Palette 调用高频操作。M17 首批不重写工具栏，只建立可扩展的命令桥。

## 范围

- [x] M17-0：梳理现有 Toolbar、快捷键和命令体系
- [x] M17-1：新增 Extension -> Webview 的 `EDITOR_COMMAND` 消息
- [x] M17-2：命令面板支持切换大纲、插入表格、插入代码块
- [x] M17-3：命令面板支持一个 Rich 表格操作样板：下方插入行
- [x] M17-4：补充协议与 webview 命令处理测试
- [x] M17-5：运行验证并同步总路线文档

## 验证记录

- `npx vitest run src/types/__tests__/messageContract.test.ts`
- `cd webview && npx vitest run src/__tests__/editorCommand.test.ts`

## 验收标准

- `markly.toggleOutline` 能通过消息桥切换大纲。
- `markly.insert.table` 和 `markly.insert.codeBlock` 复用现有插入逻辑。
- `markly.table.addRowAfter` 复用现有 Rich 表格命令。
- 新消息有类型和运行时 guard 覆盖。

## 后续可增强

- 更多插入命令。
- 更多表格命令。
- 快捷键冲突策略文档化。
- Toolbar 与共享配置合并为单一来源。

