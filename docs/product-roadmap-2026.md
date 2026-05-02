# Markly Product Roadmap 2026

## 结论

Markly 后续产品路线以 **Rich 作为主编辑体验**。Source 保留为源码编辑和可靠兜底；IR 不再作为主路线继续投入。

这份文档用于替代旧 PRD 之间互相冲突的方向判断：v3 偏 Milkdown/Typora，v4 偏 CodeMirror IR/Split，M5-M14 已经验证 Rich 主体验更符合真实用户价值。因此 2026 后续路线应围绕 Rich 的真实高频编辑体验展开。

---

## 产品定位

Markly 是 VS Code 里的高质量 WYSIWYG Markdown 编辑器。

核心目标不是做一个功能列表最长的 Markdown 工具，而是让用户在 VS Code 内写 Markdown 时：

- 打开稳定
- 编辑流畅
- 表格好用
- 图片好管理
- 长文档能导航
- 出问题能自救
- Source 能兜底

---

## 模式策略

### Rich

Rich 是唯一主编辑体验。

后续所有高频编辑能力都优先在 Rich 中完成和验收，包括：

- 标题、段落、列表、引用、行内格式
- 表格编辑
- 链接、图片、代码块、数学块插入
- 保存、撤销、重做、查找替换
- 大纲跳转、长文档编辑

### Source

Source 保留，定位是：

- 精确编辑 Markdown 源码
- Rich 异常时兜底
- 高级用户校验序列化结果
- 调试和恢复文档

Source 不需要承担完整 WYSIWYG 体验。

### IR

IR 放弃作为产品主路线。

处理策略：

- 不再新增 IR 专属功能
- 不再以 IR 作为文档默认体验
- 不再围绕 IR 规划里程碑
- 可在合适时机从 UI 和文档中彻底移除

如果短期仍有代码残留，只作为历史兼容，不作为新需求入口。

### Split Preview

Split Preview 不作为近期主攻方向。

原因：

- Rich 已经承担主要“所见即所得”价值
- Split 会增加状态同步和滚动同步复杂度
- 相比图片、表格、长文档体验，用户收益更靠后

可以保留为远期可选增强，但不再按 v4 PRD 的 P0 处理。

---

## 未来重点

## P0：真实高频编辑体验

这是未来最重要方向。

重点包括：

- Rich 下格式按钮和快捷键一致
- Rich / Source 往返不丢内容
- 保存永远使用当前真实内容
- 撤销/重做可靠
- 光标、选区、焦点不乱跳
- 空文档、小文档、长文档都稳定

验收方式：

- 每个能力必须有真实行为测试
- 高频流程进入 `test:vscode:ui:stable`
- 避免只测按钮存在或函数不报错

## P0：Rich 表格继续增强

表格已经是 Markly 当前最有差异化的能力之一，值得继续做强。

后续重点：

- 更自然的单元格选区
- 表格内快捷键一致性
- 表格边界插入行为
- 表格对齐、表头、粘贴语义继续稳定
- 大表格性能和滚动体验

不建议做过重的 Excel 化功能，优先保证 Markdown 表格编辑流畅可靠。

## P0：图片资产管理

图片是 Markdown 高频场景，值得作为下一阶段重点。

重点包括：

- 粘贴/拖拽图片稳定保存
- 图片引用路径可配置、可修复
- 图片重命名、移动后自动更新引用
- 缺失图片检测
- 压缩策略清晰可控
- 保存失败时有重试和友好提示

暂不主攻复杂图片编辑器。裁剪、标注、滤镜这类能力收益低、复杂度高，可降级。

## P1：长文档导航体验

面向技术文档、知识库、长文章。

重点包括：

- 大纲当前章节高亮
- 大纲折叠/展开
- 点击大纲跳转稳定
- 长标题显示友好
- 大文档性能提示和降级策略
- 查找替换在长文档下保持响应

## P1：命令和快捷键体系

目标是让高级用户可以少点鼠标。

重点包括：

- Rich / Source 快捷键语义统一
- VS Code Command Palette 命令补齐
- 表格命令可搜索
- 插入命令可搜索
- 快捷键冲突有清晰策略

## P1：导出与发布体验

已有 PDF/HTML 导出基础，后续重点是“可用且稳定”。

重点包括：

- 导出样式稳定
- 图片、数学公式、代码块、表格导出一致
- 导出失败有明确错误
- 常用模板或主题可选

Word 导出暂不作为重点。

## P2：AI 写作辅助

AI 能成为差异化，但不应该早于基础编辑体验。

适合方向：

- 选中文本润色
- 摘要生成
- 标题生成
- Markdown 格式修复
- 表格整理
- 长文档结构建议

前提：Rich 主编辑体验稳定后再做。

---

## 明确放弃或降级

### 放弃

- IR 作为主模式
- 重新回到纯 CodeMirror IR WYSIWYG 大重构
- Word 导出作为近期目标
- 复杂图片编辑器作为近期目标
- 为了技术路线纯粹性而牺牲 Rich 用户体验

### 降级

- Split Preview
- 浮动工具栏
- 聚焦模式
- 打字机模式
- 复杂主题市场
- 过度 Excel 化的表格能力

这些不是不能做，而是不应排在真实高频编辑体验之前。

---

## 建议里程碑

## M15：图片资产管理

目标：让图片插入、保存、引用修复成为可靠能力。

建议任务：

- 图片粘贴/拖拽链路复核：已完成首批接线
- 图片保存失败重试：已完成失败消息和用户重试提示
- 缺失图片检测：已完成诊断包中的图片引用诊断
- 图片路径配置和相对路径修复：已沿用 `image.saveDirectory` 生成相对路径
- 图片相关 E2E：已补图片处理链路单元测试，真实拖拽/剪贴板 E2E 可作为后续稳定门禁增强

## M16：大纲与长文档体验

目标：增强长文档导航和大文档编辑体验。

建议任务：

- 当前章节高亮：后续增强
- 大纲折叠/展开：已完成首批
- 长标题 tooltip：已完成首批
- 查找替换长文档性能：已有防抖和截断，后续可做虚拟列表
- 大文档编辑流 E2E：后续稳定门禁增强

## M17：快捷键与命令体系

目标：让 Rich 成为高效率编辑器。

建议任务：

- Rich 常用快捷键补齐：后续扩展
- 表格命令注册到 VS Code 命令面板：已完成首个样板命令
- 插入命令注册到命令面板：已完成表格和代码块
- 快捷键冲突策略：已建立命令桥，后续补完整策略文档

## M18：导出与发布体验

目标：让用户能放心把 Markdown 变成可交付文档。

建议任务：

- PDF/HTML 导出一致性：已统一 Custom Editor HTML 导出核心链路
- 图片/表格/代码/数学导出回归：已补 HTML 表格、代码、任务列表、图片回归；数学后续增强
- 导出错误诊断：已补 Custom Editor 导出失败提示
- 导出样式模板：后续增强

## M19：AI 写作辅助

目标：在稳定编辑器基础上做差异化。

建议任务：

- 选中文本润色：后续接入 AI provider 后增强
- 摘要/标题生成：已完成本地摘要和标题建议
- Markdown 修复：已完成本地空白修复
- 表格清理：已完成本地 Markdown 表格整理
- 长文档结构建议：后续增强

## M20-M25：Rich 产品化收口

目标：把 Rich 作为主编辑体验继续打磨到“日常可长期使用”的状态，优先解决崩溃、焦点、图片资产、命令、导出和发布门禁。

完成项：

- M20 Rich 结构安全：表格内块级插入移动到表格后方，避免非法 ProseMirror 结构崩溃
- M21 Rich 焦点体验：工具栏和命令操作后主动恢复 Rich 编辑焦点，诊断包增加 `richFocused`
- M22 图片资产诊断：图片引用诊断抽成可测工具，补本地引用样本和压缩策略
- M23 命令体系：补齐常用插入命令和 12 个 Rich 表格命令，收紧 `EDITOR_COMMAND.richTable`
- M24 导出质量：HTML 导出支持 KaTeX 行内/块级公式并内联样式
- M25 发布质量：新增 release check、preflight，并把 bundle/release guard 接入 CI

## M26-M31：Rich 长尾体验与发布闭环

目标：继续覆盖真实文档、编辑细节、图片路径、导出一致性、包体门禁和发布反馈入口。

完成项：

- M26 真实文档兼容性：新增混合 Markdown fixture，并纳入 Rich round-trip 稳定性测试
- M27 Rich 编辑细节：补命令面板插入和表格操作的真实行为测试
- M28 图片资产闭环：扩展侧统一解析本地图片相对路径，修复预览/编辑路径定位
- M29 导出质量第二阶段：PDF 导出复用 KaTeX 数学渲染，并保护代码块内美元符
- M30 性能和包体治理：新增 extension bundle 门禁，并入 `check:bundle`
- M31 发布和反馈闭环：补 repository/bugs 元数据，增强 `check-release` 发版校验

## M32：图片缺失检测与定位闭环

目标：让图片资产从“路径可解析”升级到“缺失可发现、可定位”。

完成项：

- M32-0 计划：新增 `docs/m32-image-missing-repair-plan.md`
- M32-1 协议：新增 `CHECK_LOCAL_IMAGE_REFS` / `LOCAL_IMAGE_REFS_RESULT`
- M32-2 诊断：复制诊断前刷新本地图片 `stat` 结果，补 `missingRefs` / `existingRefs`
- M32-3 定位：缺失引用返回 `resolvedPath`，方便用户定位路径问题
- M32-4 测试：覆盖路径边界、协议 guard 和诊断合并字段
- M32-5 验证：纳入 lint/test/build/bundle/release 门禁

## M33：图片引用修复与资产维护

目标：让图片资产从“缺失可发现”升级到“清单可复制、目录可打开、引用可修复”。

完成项：

- M33-0 计划：新增 `docs/m33-image-reference-repair-plan.md`
- M33-1 缺失清单：新增命令复制缺失图片引用清单
- M33-2 目录定位：新增命令打开当前文档的 assets 目录
- M33-3 引用修复：新增命令选择新图片并替换第一个缺失引用
- M33-4 路径规范化：新增命令将本地图片路径规范化到 `image.saveDirectory`
- M33-5 测试：覆盖替换、规范化、协议和路径计算

## M34：图片资产 UI 收口

目标：把图片缺失检测和修复能力从命令面板推进到编辑器可见 UI，减少用户定位图片问题的成本。

完成项：

- M34-0 计划：新增 `docs/m34-image-asset-ui-plan.md`
- M34-1 提示：检测到缺失本地图片后，在编辑器顶部显示缺失数量
- M34-2 入口：提示条提供复制清单、打开 assets、修复第一项入口
- M34-3 闭环：提示条按钮复用现有图片资产命令逻辑，继续通过 toast 反馈结果
- M34-4 面板：新增轻量图片资产弹窗，展示缺失引用和解析路径
- M34-5 测试：覆盖提示条、操作按钮和图片资产面板

---

## M35：Rich 剪贴板与表格日常闭环

目标：稳定「复制进 Rich」「删整表」「表格右键落点」等高频路径，减少误判与控制台告警。

完成项：

- M35-0 计划：新增 `docs/m35-rich-clipboard-table-daily-plan.md`
- M35-1 剪贴板：补 `htmlTablePasteHasNonTableContent` 单元测试与 Fragment/div 包裹单独 table 的粘贴回归
- M35-2 工具栏：增加「删除当前表格」按钮；帮助面板说明删整表入口
- M35-3 选区：表格右键与同步光标等改用 `TextSelection.near`，缓解非法 TextSelection 警告
- M35-4 启动：沿用已有 Rich 二次进入 ready 用例，清单内手测记录在计划文档
- M35-5 验证：更新路线图、版本与 lint/test/build/bundle/release

---

## M36：Rich 查找/替换与链接闭环

目标：Rich 下查找可从命令面板切换；链接插入与 `Mod+K` 与选区行为一致。

完成项：

- M36-0 计划：新增 `docs/m36-rich-find-link-plan.md`
- M36-1 快捷键：`Mod+K` / `Mod+Shift+K` 在 Rich 下统一走 `handleInsert`（链接/代码块）
- M36-2 链接：`MilkdownEditor.insertNode('link')` 非空调区生成锚文本，默认 URL `https://example.com`
- M36-3 查找：`EDITOR_COMMAND.toggleFindReplace`，webview 切换查找面板
- M36-4 命令：`markly.find.toggle` 写入 contributes
- M36-5 验证：`messageContract` 扩展、`isExtensionMessage` 对 `toggleFindReplace`/`pastePlain` 形状收紧

## M37：Rich 剪贴板进阶

目标：纯文本粘贴、代码块内仅 plain、表格 HTML 轻量清理、诊断可观测。

完成项：

- M37-0 计划：新增 `docs/m37-rich-clipboard-advanced-plan.md`
- M37-1 纯文本：`marklyPastePlainShortcutPlugin`（`Mod+Shift+V`）与 `pastePlainAtSelection` + 扩展 `pastePlain` 命令
- M37-2 代码块：表格粘贴插件内在 `code_block` 中仅插入 `text/plain`
- M37-3 HTML：`sanitizeClipboardHtmlForTableParse` 接入 `parseTablePasteMatrix`
- M37-4 诊断：`buildDiagnosticsPayload` 增加 `richClipboard` 快照
- M37-5 验证：表格插件单测、路线图与版本 `1.5.14`、门禁与发版 PATCH

---

## M38：Rich 查找/替换深化

目标：查找不仅在 Rich 里「能用」，还要在替换、跳变、边界情况下焦点与选区可预期。

规划任务：

- M38-0 计划：新增 `docs/m38-rich-find-replace-deep-plan.md`
- M38-1 激活匹配：从面板「下一个/上一个」到 Rich 内高亮与滚动的稳定对齐（与 `content`/序列化节奏一致）
- M38-2 替换语义：单次/全部替换后撤销栈、选区落点与 `CONTENT_CHANGE` 节流可复述
- M38-3 模式边界：正则/通配在长文、非法模式、空匹配时的提示与不崩
- M38-4 命令：`markly.find.next` / `markly.find.previous`（可选）走 `EDITOR_COMMAND` 或与现有面板事件统一
- M38-5 验证：Webview 单测 + 路线图更新 + PATCH

## M39：Rich 链接与锚点编辑

目标：从「插入链接」升级到「改链接、跟 TOC/标题锚点少打架」。

规划任务：

- M39-0 计划：新增 `docs/m39-rich-link-anchor-plan.md`
- M39-1 行内链接：选区/光标在已有链接上可编辑 URL（Source/IR + Rich）
- M39-2 默认与安全：URL 规范化；外部链接仅 Ctrl/Cmd+Click 交给 VS Code 打开（仅 http/https）
- M39-3 与目录：TOC 内单击仍跳转；正文锚点链接需 Ctrl/Cmd+Click，避免选择文本时误触导航
- M39-4 自动链接：`https://` 裸链识别与一键包成 markdown 链接（可配置）
- M39-5 验证：行为测试 + 路线图 + PATCH

## M40：大纲与「当前章节」体验

目标：长文读写时「我在哪一章」一眼可见，跳转少弹跳。

规划任务：

- M40-0 计划：新增 `docs/m40-outline-current-section-plan.md`
- M40-1 跟踪：Rich 滚动与可见标题计算，outline 高亮当前节（scroll spy）
- M40-2 UI：outline 折叠记忆（按文档或全局）、长标题截断与 tooltip 一致化
- M40-3 跳转：重复点击同一标题、快切模式时的滚动取消/防抖
- M40-4 Source：IR/Source 下按光标位置推导最近标题 slug，并同步到 outline 高亮
- M40-5 验证：大纲组件改为受控（active/collapsed 由父组件管理并持久化），并补齐回归单测

## M41：大文档性能与查找可预期性

目标：万行级仍能编辑与查找，卡的点有提示而不是假死。

规划任务：

- M41-0 计划：新增 `docs/m41-large-doc-perf-plan.md`
- M41-1 基线：文档体量分级与现有 M8 档位策略对齐，补「查找/替换」耗时上限
- M41-2 查找：UI 匹配列表严格截断（默认 5000）+「仅统计数量」模式（时间预算，显示为 `N+`）
- M41-3 Rich：大表格/大段代码块节点的降级渲染开关与文档说明
- M41-4 诊断：`buildDiagnosticsPayload` 追加 perf 片段（档位、字符数、最近一次慢操作）
- M41-5 验证： fixture 压测用例 + 路线图 + PATCH

## M42：Rich 表格体验二期

目标：在不做成 Excel 的前提下，把「表格周边」编辑做省心。

规划任务：

- M42-0 计划：新增 `docs/m42-rich-table-phase2-plan.md`
- M42-1 边界：明确本期不额外扩展 Enter/Backspace 语义（避免做成 Excel），表格外插入/表格结构保护由现有插入/粘贴策略兜底
- M42-2 结构：合并/拆分单元格与往返稳定性（已有能力），以单测门禁防回退
- M42-3 样式：列宽拖拽由 GFM preset + `columnResizingPlugin` 提供，超出范围的导出一致性暂不承诺
- M42-4 命令：不做行上移/列复制等重型命令（文档说明）
- M42-5 验证：`markly-table-rich` 插件单测已覆盖合并/拆分等关键路径

## M43：图片资产进阶

目标：图片从「能插能修」到「搬文件也不慌」。

规划任务：

- M43-0 计划：新增 `docs/m43-image-asset-advanced-plan.md`
- M43-1 重命名/移动：新增命令 `markly.image.replaceMovedImageRef`（选择旧/新图片文件，自动按当前文档路径计算相对引用并批量替换）
- M43-2 粘贴策略：同名校验、覆盖/重命名选择与配置项
- M43-3 压缩：大文件压缩阈值在 UI 或状态里可感知（读配置即可自解释）
- M43-4 协议：如需要，扩展 `LOCAL_IMAGE_REFS` 或新消息承载「建议替换」列表
- M43-5 验证：路径与安全单测 + 路线图 + MINOR 视协议兼容性

## M44：导出（PDF/HTML）质量与模板

目标：导出结果可交付，样式可重复。

规划任务：

- M44-0 计划：新增 `docs/m44-export-template-plan.md`
- M44-1 HTML：内置 1–2 套可切换打印主题（ light / print-friendly ）
- M44-2 PDF：页边距/分页与代码块、表格、数学公式的回归集扩大 ✅（`pdfExport` 打印 CSS + `pdfExportOptionsFromPdfConfig` + 单测）
- M44-3 资源：本地图片与相对路径在导出目录下的解析与用户提示 ✅（`<base>` + 导出前缺失引用 `showWarningMessage`）
- M44-4 配置：暴露 PDF 导出的 `includeToc` / `displayHeaderFooter` 与 HTML 主题等安全项 ✅
- M44-5 验证：导出快照测试 + 路线图 + 版本 ✅（字符串断言扩展，`1.7.0`）

## M45：命令面板、快捷键与冲突策略（成文）

目标：高级用户不必翻源码也知道「谁能用、什么时候用」。

规划任务：

- M45-0 计划：新增 `docs/m45-commands-keybindings-policy.md`
- M45-1 清单：全量 `markly.*` contributes 命令表 + 默认键位（若有）+ `when` 子句
- M45-2 Rich vs Source：同一键在两种模式下的语义对照表
- M45-3 与 VS Code：保留键冲突说明（如 `Ctrl+F` 以 webview 为准时的前提）
- M45-4 实现缺口：对照清单补注册/补 `EDITOR_COMMAND`（只补缺，不大改）
- M45-5 验证：贡献点 JSON 校验 + 路线图 + PATCH

## M46：稳定门禁与 UI/E2E 扩展

目标：把「手测清单」收敛成跑在 CI/本机的扩展 UI 测或稳定脚本。

规划任务：

- M46-0 计划：新增 `docs/m46-stable-gates-plan.md`
- M46-1 选型：ExTester 场景扩展或 Playwright 附加套件（二选一为主）✅（维持 ExTester 为主路径）
- M46-2 用例：Rich 启动、切换模式、保存、表格粘贴、图片缺失条 — 最小可重复集（手测清单见本文档 §最小可重复集）
- M46-3 CI：文档化「仅标签/手动」触发的任务，避免无桌面环境硬失败 ✅（README + 本文档）
- M46-4 诊断：失败时自动打包 webview 控制台摘要（若可行）⏸ 暂缓
- M46-5 验证：提供不依赖 VSIX 清理的本机门禁脚本（`npm run gates:stable`）+ 路线图 + PATCH ✅

## M47：AI 写作辅助（可选 provider，第一期）

目标：在不强绑商业 API 的前提下，为「选区润色」留可插拔出口。

规划任务：

- M47-0 计划：新增 `docs/m47-ai-assist-phase1-plan.md`
- M47-1 配置：设置项：provider / endpoint / API key（SecretStorage 或 env 说明）
- M47-2 命令：`markly.assist.rewriteSelection` → webview 读取选区文本 → 回填（Rich/Source 双路径）
- M47-3 安全：默认关闭、超时、不静默上传全文、日志脱敏
- M47-4 降级：无 key 时文案与本地「摘要/修复」并存
- M47-5 验证：mock provider 单测 + 路线图 + MINOR（新能力）

---

## 判断标准

后续任何新需求都按下面标准判断：

1. 是否服务 Rich 主编辑体验？
2. 是否真实高频？
3. 是否能被自动化测试稳定覆盖？
4. 是否比图片、表格、长文档、保存同步更重要？
5. 是否会重新引入 IR/Split 的复杂状态成本？

如果答案是否定的，就降级或放弃。

---

## 当前状态

截至 `1.5.14` 之后的开发线：

- Rich 已成为实际主编辑体验
- Source 是可靠兜底
- IR 不再适合作为主路线
- Rich 表格、启动可靠性、诊断、自救、日常编辑同步已经完成多轮收口
- M20-M25 已继续补齐结构安全、焦点、图片诊断、命令体系、公式导出和发布门禁
- M26-M31 已继续覆盖真实复杂文档、Rich 命令行为、图片路径定位、PDF 数学导出、extension 包体门禁和发布反馈元信息
- M32 已补齐本地图片缺失检测协议、诊断字段和路径定位信息
- M33 已补齐图片缺失清单复制、assets 目录定位、单项引用修复和本地路径规范化
- M34 已补齐缺失图片数量提示、可操作按钮和轻量图片资产面板
- M35 已补齐表格剪贴板回归、删整表工具栏入口、表格选区落点稳定性
- M36 已补齐查找面板命令桥与 Rich 链接选区插入、`Mod+K` 一致性
- M37 已补齐 Rich 纯文本粘贴快捷键与命令、代码块内纯文本粘贴、表格 HTML 清理与剪贴板诊断字段
- M38–M47：`1.7.0` 起——M44-2～M44-5（PDF 分页样式、导出前本地图提示、工作区 PDF 选项贯通、导出单测）、M46 门禁文档与 `gates:stable`、M47 选区润色（SecretStorage、`openai-compatible` fetch、超时、错误脱敏、单测）已收口；表格粘贴策略等见 M43 未闭合项
