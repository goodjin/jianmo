# M12：Rich 问题闭环与发布工程化

目标：把“用户报问题 → 开发者复现 → 修复发版”的链路压缩到最短，同时让发版前的质量门禁更稳定、更一致。

> 建议版本：`1.5.4`

## 交付物

- `docs/m12-rich-supportability-closure-plan.md`（本文件）
- “可直接粘贴到 Issue 的诊断模板”（Markdown）
- extension ↔ webview 诊断信息整合（host + webview）
- 发布门禁命令收敛（本地/CI 一致）

---

## M12-0：范围与 DoD（Definition of Done）

- **范围锁定**：
  - 只增强“诊断/自救/测试门禁/发布流程”，不引入新编辑能力
  - 不新增重型依赖（保持包体与启动稳定）
- **DoD**：
  - `npm test` 全绿
  - `MARKLY_UI_REPEAT=3 npm run test:vscode:ui` 全绿
  - `npm run package` 生成 `markly-1.5.4.vsix`

---

## M12-1：一键复制“可提交 Issue 模板”（Markdown）

现状：复制的是 JSON（可用但不够“可读/可提交”）。

- **输出格式**：Markdown 模板（示例结构）
  - 标题：`Rich 启动失败/超时/表格粘贴异常 ...`
  - 复现步骤（空白占位）
  - 期望/实际（空白占位）
  - 诊断包（折叠块 `<details>` + ` ```json `）
- **约束**：
  - 仍需脱敏（不包含绝对路径/用户名）
  - 总长度限长（建议 ≤ 32KB）；超出则裁剪重字段，并在模板中标注 `__truncated__`
- **验收**：
  - 点击后剪贴板内容可直接粘贴到 GitHub Issue/评论里，可读且结构清晰
  - 单测：断言不包含 `/Users/`、`C:\\Users\\` 等路径前缀；断言长度阈值

---

## M12-2：extension(host) 诊断信息整合

- **内容**：
  - 扩展版本、VS Code 版本、平台/架构
  - Markly 关键配置快照（wrapPolicy/tableCellWrap/enableMermaid/enableShiki 等）
- **实现建议**：
  - extension 侧生成 `hostDiagnostics`，在 webview `INIT` 或单独消息中下发并缓存
  - webview 复制模板时合并 `hostDiagnostics + webviewDiagnostics`
- **验收**：
  - 模板包含 host 信息
  - 不泄露用户工作区绝对路径（必要时只保留 basename/截断）

---

## M12-3：Rich 初始化/降级链路可观测性补齐

- **补齐字段**（进入诊断包）：
  - rich 启动 attemptId、watchdog 是否触发、fallback reason、最近错误摘要（限长）
  - retry/reload 点击计数（可选，限长）
- **验收**：
  - 单看诊断模板即可判断“失败发生在哪一步 + 是否重试过”

---

## M12-4：发布门禁命令收敛

- **新增/约定**：
  - `npm run test:vscode:ui` 支持 `MARKLY_UI_REPEAT`（已具备）
  - 推荐增加 `npm run test:vscode:ui:stable`（内部固定 repeat=3，便于 CI/本地一致）
  - 保持 bundle guard（`npm run check:bundle`）可选纳入发布门禁
- **验收**：
  - 一条命令可以完成“单测 + UI 测(稳定门禁) + 打包”前的核心验证

---

## M12-5：发版 `1.5.4`

- **验收**：
  - 完成 M12-1~M12-4
  - `npm test`、`MARKLY_UI_REPEAT=3 npm run test:vscode:ui`、`npm run package` 全通过
  - 产物文件名匹配版本：`markly-1.5.4.vsix`

