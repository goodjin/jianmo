# M26-M31 Rich 长尾体验与发布闭环计划

目标：在 M20-M25 的产品化收口之后，继续把 Rich 主编辑体验推进到真实文档、日常编辑、图片路径、导出一致性、性能门禁和发布反馈闭环。

## M26：真实文档兼容性

- [x] 新增 `docs/fixtures/m26/01-real-world-mixed.md`，覆盖表格、任务列表、代码、数学、HTML、图片和长链接混合场景
- [x] 将 M26 fixture 纳入 Rich parse → serialize 双轮稳定性测试
- [x] 验收：复杂真实文档关键内容保存后仍存在，且二次序列化不继续漂移

## M27：Rich 编辑细节打磨

- [x] 补 `EDITOR_COMMAND insert` 的 Rich 行为测试，断言命令会路由到 `insertNode`
- [x] 补 `EDITOR_COMMAND richTable` 的 Rich 行为测试，断言表格操作参数准确传递
- [x] 验收：命令面板触发插入/表格操作不只是“不报错”，而是确实调用 Rich 编辑器能力

## M28：图片资产闭环

- [x] 新增扩展侧图片路径解析工具，统一按“当前文档目录 + Markdown 相对路径”解析
- [x] 修复图片预览/编辑路径解析，不再用字符串替换文档文件名
- [x] 补 `./assets`、`../assets`、查询参数、远程图片等路径单测
- [x] 验收：本地图片路径定位逻辑可单测，后续缺失图片 `stat` 可复用同一解析入口

## M29：导出质量第二阶段

- [x] PDF 导出复用 HTML 导出的 KaTeX 数学公式预处理
- [x] PDF 导出内联 KaTeX 样式，减少 HTML/PDF 数学表现不一致
- [x] 补 PDF 中间 HTML 的数学公式与代码块保护测试
- [x] 验收：`$...$` / `$$...$$` 在 PDF 导出链路中也会渲染为 KaTeX，代码块内美元符不被误处理

## M30：性能和包体治理

- [x] 新增扩展宿主 bundle 体积检查 `scripts/check_extension_bundle.mjs`
- [x] `npm run check:bundle` 同时检查 webview 和 extension bundle
- [x] 保留 `check:bundle:webview` / `check:bundle:extension` 便于单独排查
- [x] 验收：CI/preflight 不只看 webview，也会拦截 extension bundle 体积异常

## M31：发布和用户反馈闭环

- [x] `package.json` 补 `repository` 和 `bugs` 元数据
- [x] `check-release` 增加 repository、bugs、engines.vscode 校验
- [x] 验收：发版元信息缺失会在本地/CI 门禁失败，用户反馈入口更明确

## 验证记录

- 已通过：`npm test`（根项目 87 个测试，webview 362 个测试）
- 已通过：`npm run lint`
- 已通过：`npm run build`
- 已通过：`npm run check:bundle`
- 已通过：`npm run check:release`

