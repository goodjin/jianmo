# M195：权限与隐私复核清单（可审计）

## 出站（网络）

- AI（可选）：仅在用户开启且触发操作时出站（见 `privacy/AI_PRIVACY.md`）
- Mermaid external bundling：导出 HTML 可能引用外链脚本（见 `docs/EXPORT_GUIDE.md`）

## 本地读写

- 读写 Markdown 文件（Custom Editor）
- assets 图片保存/扫描（图片粘贴、缺失修复、未引用检测）
- 导出 PDF/HTML 写入用户选择的路径

## 日志与诊断

- Webview：复制诊断信息（脱敏）
- 导出：复制失败诊断包（脱敏）
- telemetry（本地）：默认关闭，仅本地计数（见 `resources/TROUBLESHOOTING.md`）

## Secrets

- AI API Key：VS Code SecretStorage（不写 settings.json）

