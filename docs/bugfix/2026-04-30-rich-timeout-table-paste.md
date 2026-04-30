# Bug Fix: Rich 启动超时与混合表格粘贴

## 问题描述

- 日期：2026-04-30
- 严重程度：High
- 影响范围：Rich 模式切换、含表格内容粘贴、表格删除

## 根因分析

1. Rich 初次启动已经 ready，但再次从 Source 切回 Rich 时，`switchMode('rich')` 会重新清空 `richReadySuccess` 并启动 watchdog。由于 `MilkdownEditor` 常驻后不会在同一实例里再次发出 `ready`，watchdog 最终误判超时并切回 Source。
2. 表格粘贴插件在光标不在表格内时，只要剪贴板 HTML 能解析到 `<table>`，就用矩阵建表并拦截默认粘贴。若剪贴板同时包含段落和表格，段落会被丢弃，只留下表格。
3. 只有删除行/列，没有删除整张表的 Rich 表格命令。文档只剩一张表时，用户很容易觉得表格删不掉。

## 修复方案

- `webview/src/App.vue`：再次进入 Rich 时，如果已有 Rich 实例曾经 ready，且可编辑 DOM 存在，则将本次切换标记为 `rich:ready:existing` 并清理 watchdog。
- `webview/src/plugins/markly-table-rich.ts`：新增混合 HTML 检测；如果 `<table>` 外还有有意义内容，则不拦截粘贴，交给默认粘贴链路保留完整内容。
- `webview/src/core/richTableCommands.ts`：新增 `deleteTable` 操作。删除唯一表格时保留一个空段落，避免文档变成非法空结构。
- `src/types/*`、`src/extension/commands/index.ts`、`package.json`、`webview/src/App.vue`：补齐 `deleteTable` 命令协议、命令面板与右键菜单入口。

## 验证步骤

- ✅ `npm test -- src/__tests__/richWatchdogFallback.test.ts`（webview）
- ✅ `npm test -- src/plugins/__tests__/markly-table-rich.test.ts`（webview）
- ✅ `npx vitest run src/types/__tests__/messageContract.test.ts`

## 相关测试

- `webview/src/__tests__/richWatchdogFallback.test.ts`
- `webview/src/plugins/__tests__/markly-table-rich.test.ts`
- `src/types/__tests__/messageContract.test.ts`
