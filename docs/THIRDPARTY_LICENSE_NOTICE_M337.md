# 合规：第三方许可与 NOTICE 复核（M337）

## 目标

在不引入“隐藏法律风险”的前提下发布：

- 关键依赖（含字体、导出链路、语法高亮、图表）许可明确
- NOTICE/归档方式明确

## 结论（本阶段）

**流程固化，实际逐条法律复核延期到专门合规迭代**。原因：完整 license 扫描与逐条归档需要专门时间窗；但我们可以先把“怎么做、做什么算完成”写清楚。

## 建议做法

- **依赖清单来源**
  - `package-lock.json` + `webview/package-lock.json`
- **扫描**
  - `npm ls --all`（结构）
  - `npm audit`（安全信号）
  - 许可证扫描工具（后续引入，例如 license-checker / oss-review-toolkit）
- **重点关注**
  - Mermaid、Shiki、KaTeX 字体与样式
  - PDF/HTML 导出链路依赖（含 puppeteer external）

## 交付物建议（后续迭代）

- `NOTICE` 文件（含第三方声明）
- `THIRD_PARTY_NOTICES.md`（按包名/版本/许可证/链接）

