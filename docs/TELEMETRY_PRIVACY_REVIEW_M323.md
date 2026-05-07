# 遥测：字段与隐私口径复审（M323）

## 结论（当前仓库口径）

- **默认关闭**：`markly.telemetry.enabled=false`
- **仅本地**：开启后只在 **Output → Markly Telemetry (local)** 写匿名计数，不上传第三方
- **不采集内容**：不记录用户文档内容、路径、图片、AI 输入等敏感信息

## 对外统一表述（建议）

一句话：

> Markly 默认不启用遥测；即使开启也只在本地 Output 记录匿名计数，不向第三方发送。

相关入口：

- 设置项 `markly.telemetry.enabled` 的说明
- `resources/TROUBLESHOOTING.md`
- Marketplace FAQ：`docs/marketplace/FAQ.md`

## 后续若要接入“真正上报”的前置条件

必须先完成：

- 新的隐私说明与用户同意流程
- 字段清单与保留期限
- 退出/禁用机制
- 安全审计（见中期安全里程碑）

