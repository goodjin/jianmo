# M18: Export And Release Experience

## 目标

让导出体验更一致、更容易诊断。M18 首批聚焦 PDF/HTML 导出链路一致性和导出失败提示。

## 范围

- [x] M18-0：梳理 PDF/HTML/image 导出现状
- [x] M18-1：Custom Editor HTML 导出统一使用核心 `exportToHtml`
- [x] M18-2：Custom Editor 导出失败给出明确错误提示
- [x] M18-3：补充 HTML 导出对表格、代码块、任务列表、图片的回归测试
- [x] M18-4：运行验证并同步总路线文档

## 验证记录

- `npx vitest run src/core/export/__tests__/htmlExport.test.ts`

## 验收标准

- 工具栏 HTML 导出与命令面板 HTML 导出复用同一核心实现。
- 导出失败时用户能看到明确错误信息。
- HTML 导出保留 GFM 表格、围栏代码、任务列表和相对路径图片。

## 后续可增强

- PDF 相对图片资源解析。
- KaTeX 数学公式导出。
- 导出模板选择。
- 图片导出产品形态定案。

