## M5：Rich 为主，IR 降级为隐藏 fallback（并补 Rich→Source 自动降级）

> 状态：执行中（2026-04-21）

### 目标（DoD）

- **对外主打 Rich**：工具栏不再展示 IR 切换入口（只保留 Rich/Source）。
- **隐藏 fallback 仍可用**：协议与类型仍兼容 `EditorMode = 'ir' | 'source' | 'rich'`，必要时仍可内部切换到 IR/Source。
- **自动降级**：Rich 初始化失败或超时，自动切到 Source，并给出 toast 提示，保证编辑不中断。
- **测试门禁**：`npm test` 全绿；新增至少 1 条单测覆盖“IR 入口隐藏”。

### 任务顺序

- [x] **M5-1**：隐藏 IR 模式入口（UI 不再显示 IR 切换），但保留协议/类型兼容
- [x] **M5-2**：补 Rich 失败/超时自动降级到 Source（toast + 避免循环降级）
- [x] **M5-3**：补测试/回归护栏（新增 Toolbar 模式按钮单测）
- [ ] **M5-4**：跑门禁并记录执行结果

### 关键变更点（速查）

- `webview/src/components/Toolbar.vue`
  - 移除 IR 模式按钮
  - 模式键盘切换只在 Rich/Source 之间循环
- `webview/src/App.vue`
  - 监听 Rich ready=false 时自动切 Source
  - Rich 进入时启动 watchdog（超时未 ready → 自动切 Source）
- `webview/src/components/__tests__/toolbarModes.test.ts`
  - 断言工具栏模式按钮只有 2 个，且不包含 IR

