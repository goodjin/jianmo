# 安全：整体审计与 checklist 固化（M336）

## 目标

把“每次发版前的安全直觉检查”固化成可勾选清单，减少漏项。

## 威胁面（最常见）

- Webview：HTML 注入、剪贴板、外链资源
- 导出：HTML 自包含、PDF 渲染链路、外部脚本
- 依赖：供应链、重依赖（mermaid/shiki/puppeteer）
- 本地文件：图片/模板路径穿越、工作区扫描范围

## 发布前 checklist（最小集）

- **权限与隐私**
  - 默认不采集内容；诊断不包含正文（或严格截断）
  - 遥测默认关闭（若存在）
- **Webview 输入**
  - 富文本/HTML paste 有 sanitize（参考 `docs/CLIPBOARD_HARDENING_M325.md`）
  - 图片/资源路径有 canonicalize，拒绝越界
- **导出**
  - HTML 自包含安全策略复核（参考 `docs/EXPORT_FAILURE_DIAGNOSTICS_UX_M324.md` 与相关导出审计文档）
  - Mermaid/第三方脚本策略：离线默认
- **依赖**
  - `npm audit`（仅作为信号，不作为唯一门槛）
  - bundle budget 未异常膨胀（见 `resources/BUNDLE_GOVERNANCE.md`）
- **门禁**
  - `npm run preflight` 通过

## 记录方式

建议每次 release 在 `docs/RELEASE_PLAYBOOK_M316.md` 的 checklist 里引用本文件。

