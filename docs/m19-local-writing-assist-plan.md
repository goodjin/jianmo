# M19: Local Writing Assist

## 目标

在不接入外部 AI 服务的前提下，先提供可离线、可测试、无隐私风险的本地写作辅助。后续如接入大模型，应复用同一套命令入口和内容替换策略。

## 范围

- [x] M19-0：梳理写作辅助入口与 Rich/Source 内容修改能力
- [x] M19-1：新增本地摘要生成
- [x] M19-2：新增标题建议
- [x] M19-3：新增 Markdown 空白修复
- [x] M19-4：新增 Markdown 表格整理
- [x] M19-5：通过 VS Code Command Palette 暴露写作辅助命令
- [x] M19-6：运行验证并同步总路线文档

## 验证记录

- `npx vitest run src/types/__tests__/messageContract.test.ts`
- `cd webview && npx vitest run src/utils/__tests__/writingAssistant.test.ts`

## 验收标准

- 写作辅助不需要外部 API Key。
- 摘要、标题、Markdown 修复、表格整理都有确定性单元测试。
- Rich 和 Source 都通过同一个 `EDITOR_COMMAND` 入口触发。
- 本地辅助不处理用户隐私数据出站。

## 后续可增强

- 选区级润色。
- 接入可配置 AI provider。
- 表格语义清理。
- 长文档结构建议面板。

