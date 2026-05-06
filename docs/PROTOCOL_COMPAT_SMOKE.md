# 协议兼容性冒烟（M261）

在**不改变** Extension ↔ Webview 消息形状的迭代中，用这个清单做一次快速回归：

1. **类型与守卫**：运行根目录 `npm test`，确保 `src/types/__tests__/messageContract.test.ts` 与 guards 覆盖仍通过。
2. **宿主侧**：在 VS Code 中打开 Markdown 自定义编辑器，切换 Rich/Source、保存、`复制诊断`，确认 webview 无持久红屏。
3. **旧二进制组合（按需）**：若需验证「新版本扩展 + 仍缓存的旧 webview 资源」，在发版说明中提醒用户重载窗口；开发侧可在更新 `dist/webview` 后执行一次 `Developer: Reload Window`。

更完整的集成覆盖见 `npm run test:vscode` 与 `docs/REGRESSION_PLAYBOOK.md`。
