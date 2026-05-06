# 编辑可靠性：保存/恢复/崩溃自救加固（M326）

## 目标

把最坏情况（Rich 启动失败、保存写入失败、webview 重载、崩溃恢复）变成“可自救、可诊断、可继续编辑”的体验。

## 当前已具备的关键能力（证据）

- **Rich 启动 watchdog + 自动降级 Source**
  - Webview 侧记录启动事件，并在超时/失败时降级（`webview/src/App.vue`）
- **保存失败显式回传**
  - Extension → Webview：`SAVE_FAILED`（`src/extension/provider/customEditor.ts` / `src/types`）
- **诊断信息可复制**
  - Webview：复制诊断包
  - 导出：复制导出失败诊断包（`src/extension/export/exportFailureUi.ts`）
- **阅读位置恢复**
  - Webview 侧有 reading position 的 restore（`webview/src/App.vue`）

## 统一自救入口（建议）

当用户遇到“打不开/空白/保存失败/导出失败”：

1. 打开 **Help: Open Recovery & Troubleshooting**
2. 优先 **复制诊断信息**
3. 按提示执行：
   - 重试 Rich / 重载 Webview / Reload Window
   - 导出失败复制诊断包

## 后续可加强（不阻塞本里程碑）

- 对 SAVE_FAILED 增加更清晰的用户提示（例如“磁盘只读/权限不足/文件被占用”分类）
- 崩溃/异常聚合（如未来启用遥测）必须走隐私评审（见 M323）

