# M20-M25 Rich 产品化收口计划

目标：沿 `docs/product-roadmap-2026.md` 继续推进 Rich 主编辑体验，把崩溃、焦点、图片诊断、命令体系、导出质量和发布门禁做成可验证闭环。

## M20：Rich 结构安全与崩溃收口

- [x] 表格内插入表格、代码块、列表等块内容时，不再尝试把非法块塞进 `table_row` / `table_cell`
- [x] 块内容在表格内触发时移动到当前表格后方，避免 ProseMirror schema 抛未捕获异常
- [x] E2E 表格粘贴辅助路径对不规则表格 `TableMap` 偏移做防护
- [x] 验收：非法插入不会崩溃；失败时给用户可理解提示

## M21：Rich 选区与焦点体验

- [x] Rich 工具栏格式化、插入、表格结构操作完成后，焦点回到 ProseMirror 编辑区
- [x] 复制诊断信息增加 `richFocused`，便于判断快捷键/工具栏焦点问题
- [x] 验收：点击工具栏后可以继续键盘输入；诊断包能看到 Rich 焦点状态

## M22：图片资产管理第二阶段

- [x] 将图片引用解析和诊断从 `App.vue` 抽成 `imageDiagnostics` 工具
- [x] 诊断中区分本地/远程图片，提供本地路径样本
- [x] 诊断中记录图片保存目录和压缩阈值/质量配置
- [x] 验收：给定 Markdown 能稳定得到引用数量、本地样本和压缩策略

## M23：快捷键与命令体系收口

- [x] 补齐 VS Code 命令面板中的常用插入命令：图片、链接、分隔线
- [x] 补齐 Rich 表格 12 个结构命令：行列增删、表头、对齐、合并/拆分
- [x] 收紧 `EDITOR_COMMAND.richTable` 类型和运行时 guard
- [x] 验收：非法表格命令会被拒绝；命令面板能力与工具栏能力对齐

## M24：导出质量收口

- [x] HTML 导出支持 KaTeX 行内公式和块级公式渲染
- [x] HTML 导出内联 KaTeX 样式，减少导出文件样式缺失
- [x] 补公式导出行为测试
- [x] 验收：`$E=mc^2$` 与 `$$...$$` 导出为 KaTeX HTML，而不是原样美元符

## M25：发布质量与升级体验

- [x] 新增 `scripts/check-release.mjs`，检查根包和 webview 版本一致
- [x] 检查版本号符合 `MAJOR.MINOR.PATCH`
- [x] 若存在 VSIX，检查文件名与当前版本匹配
- [x] 新增 `npm run preflight`，串联 lint、测试、构建、包体和发布元信息检查
- [x] CI 增加 bundle guard 和 release metadata guard
- [x] 验收：发版前不再依赖人工确认双包版本和 VSIX 命名

## 验证记录

- 已通过：`npm test`（根项目 81 个测试，webview 359 个测试）
- 已通过：`npm run build`
- 已通过：`npm run check:bundle`
- 已通过：`npm run check:release`

