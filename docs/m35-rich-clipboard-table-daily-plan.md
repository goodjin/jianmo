# M35 Rich 剪贴板与表格日常闭环

目标：把「从网页/表格软件复制进 Rich」与「在 Rich 里改表、删表」做成稳定、可测的日常路径，减少误判降级与难以恢复的状态。

## M35-0：计划与验收标准

- [x] 新建本计划文档
- [x] 明确范围：Rich 表格外粘贴、表格工具栏与右键选区、二次进入 Rich 的相关验证
- [x] 验收：混合 HTML 不误伤；纯表格（含 Excel/外壳包裹）仍可走矩阵建表；表格右键落点不触发 PM 选区告警；工具栏可见删整表入口

## M35-1：剪贴板与表格 HTML

- [x] 校验 `htmlTablePasteHasNonTableContent` 对「仅 div/Fragment 包裹的单独 table」为 false，避免误走默认粘贴
- [x] 单元测试覆盖：div 包裹仅表、StartFragment 注释包裹、段落+表混合
- [x] 回归：表格外仅表粘贴仍插入表格

## M35-2：工具栏与帮助

- [x] 工具栏增加「删除当前表格」按钮（与 `deleteTable` / 命令面板一致）
- [x] Rich 表格帮助面板补充删整表说明（命令面板 + 工具栏）

## M35-3：选区与控制台告警

- [x] 表格右键菜单落点使用 `TextSelection.near`，避免 `endpoint not pointing into inline content` 类告警
- [x] 其它高风险 `TextSelection.create` 单点落位改为就近合法文本选区（插入同步光标、E2E 选格）

## M35-4：Rich 启动二次进入

- [x] 依赖已有 `rich:ready:existing` 用例；本里程碑仅做清单内手测与文档记录
- [x] 手测建议：Source → Rich → 再切 Source → Rich，确认无超时横幅；空文档与小段表格文档各试一次

## M35-5：路线、版本与门禁

- [x] 更新 `docs/product-roadmap-2026.md` 增加 M35
- [x] 版本 `1.5.13`（根目录与 webview 一致）
- [x] 运行 `npm run lint`、`npm test`、`npm run build`、`npm run check:bundle`、`npm run check:release`
