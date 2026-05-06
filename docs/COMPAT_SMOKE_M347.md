# 兼容性 smoke：旧 webview/旧设置/旧工作区自救（M347）

## 目标

用最小手动/自动回归，确认“升级后最差也能编辑（退回 Source）”，并且用户知道如何自救。

## 最小回归清单

- **协议/消息**：跑 `npm test`（含 message contract 与 guards）
- **启动**：打开一个 markdown，确保 Rich 或 Source 能正常显示
- **保存**：编辑 1 行并保存，确认无 silent failure
- **导出**：跑一次导出预检（或导出 HTML/PDF），失败时能进入诊断自救
- **诊断**：在 webview 里复制诊断信息（确认 payload 完整）

## 用户自救口径（升级后异常）

1. **先重载窗口**：`Developer: Reload Window`
2. 若仍异常：打开 **Recovery & Troubleshooting**（自救中心）复制诊断
3. 如遇兼容问题：优先退回 **Source 模式**继续编辑（不阻塞工作）

## 参考

- `docs/PROTOCOL_COMPAT_SMOKE.md`
- `resources/TROUBLESHOOTING.md`

