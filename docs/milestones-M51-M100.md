# M₅₁–M₁₀₀ 执行矩阵（接续 M₁–M₅₀）

**规则**：与 `milestones-M01-M50.md` 相同——完成 Mᵢ 只依赖 M₁…Mᵢ₋₁（及更早）已交付能力。

**状态**：`✅` 已在当前仓库可验收；`🔄` 进行中/部分落地；`□` backlog。

---

## M₅₁–M₆₀：日常写作与图片闭环

| 编号 | 里程碑 | 验收要点 | 状态 |
|------|--------|----------|------|
| M₅₁ | 图片重命名/移动 → 引用修复提示 | 宿主 `onDidRenameFiles`；仅图片；当前 MD + Markly webview 时用 `documentReplace` 批量替换 | ✅ `src/extension/index.ts`、`src/extension/image/renameImageRefs.ts`、单测 `renameImageRefs.test.ts` |
| M₅₂ | 同名图片粘贴策略 | `markly.image.sameNameHandling`；`UPLOAD_IMAGE`/`SAVE_IMAGE` 可选 `requestId`；落盘名与插入路径一致 | ✅ `customEditor.ts`、`useImageHandler.ts`、`package.json` contributes、单测 |
| M₅₃ | 图片资产面板二期 | 列出已存在/缺失/未引用（轻量，不阻塞编辑；保存目录一层） | ✅ `App.vue`、`customEditor.ts`（`LIST_ASSETS_IMAGE_FILES`）、`markdownLocalRefCanonical.ts` |
| M₅₄ | 批量修复缺失引用 | 去重后依次选图；确认框 + 文件框取消即停；`IMAGE_REF_REPAIR_OUTCOME` | ✅ `App.vue`、`customEditor.ts`、`repairMissingRefsBatch` 命令 |
| M₅₅ | 未引用 assets 建议 | 保存目录列出 + `computeUnreferencedAssetImages`（含链接与 ref 定义）；面板/横幅/复制与诊断字段 | ✅ `imageDiagnostics.ts`、`App.vue`、命令 `copyUnreferencedList`/`openAssetsPanel` |
| M₅₆ | Rich 表格快捷键精修 | Tab/Enter 与表格外行为一致、可测 | ✅ `markly-table-rich.ts`：`richTablePlainEnterChain`（hardbreak fallback）、`richTableToggleListIndentInTable`、`interceptRichTableKeydown`；`MilkdownEditor.vue` capture 监听；单测 `richTableKeyboard.test.ts` |
| M₅₇ | 表格粘贴预览 | 大表/脏 HTML 粘贴前确认 | ✅ `markly-table-rich.ts`（`truncatePasteGridToLimits`、`recoverOversizedPasteGrid`、预览确认文案）；插件 `handlePaste` 三路径；软阈值常量；单测补充 |
| M₅₈ | 表格 round-trip fixture 扩大 | 防止 Rich↔Source 丢格/丢对齐 | ✅ |
| M₅₉ | 大表格性能二期 | 滚动/选区延迟可接受；可选降级开关 | ✅ |
| M₆₀ | 表格用户说明 | 一页说明：插入/删表/粘贴/命令 | ✅ `docs/RICH_TABLE_USER_GUIDE.md`、`README`、`MARKDOWN_CAPABILITIES`、Webview 表格帮助入口 |

---

## M₆₁–M₇₀：长文档与知识库

| 编号 | 里程碑 | 验收要点 | 状态 |
|------|--------|----------|------|
| M₆₁ | 大纲搜索 | 按标题过滤 | ✅ `OutlinePanel` 筛选框、`collectOutlineFilterIndices`、单测 |
| M₆₂ | 大纲拖拽调序 | 拖动标题调整章节块 | ✅ `outlineReorder.ts`、`OutlinePanel` 顶级块拖放、`App` `handleOutlineReorder`、单测 |
| M₆₃ | 锚点/重复标题检查 | 跳转与 slug 冲突提示 | ✅ `getDuplicateHeadingSlugs` / `isHeadingSlugAmbiguous`（`shared/outline.ts`）；大纲 ⚠、`handleOutlineJump` + Rich `@toc-click` 提示；单测 `outline.test.ts`、`OutlinePanel.test.ts` |
| M₆₄ | 反向链接基础 | 工作区内链入当前文档列表 | ✅ `FIND_MARKDOWN_BACKLINKS` / `MARKDOWN_BACKLINKS_RESULT` / `OPEN_MARKDOWN_DOCUMENT`；`findMarkdownBacklinks.ts`、`markdownLinkRefs.ts`；侧栏 `BacklinksPanel`、`App.vue`；单测 `markdownLinkRefs.test.ts`、`BacklinksPanel.test.ts`、`messageContract` |
| M₆₅ | 内部链接悬停预览 | 显示目标标题摘要 | ✅ Rich 内 hover 内链显示浮层（标题 + 摘要 + 打开）；协议 `MARKDOWN_HOVER_PREVIEW_REQUEST/RESULT`；实现 `markdownHoverPreview.ts`、`MilkdownEditor` 事件；单测 `messageContract` | 
| M₆₆ | 大文档档位可见 | UI 提示当前档位与降级项 | ✅ 工具栏显示「档 XS/S/M/L/XL」并在 tooltip 中列出 Rich 降级项（Shiki/Mermaid/列宽拖拽等） | 
| M₆₇ | 查找命中列表 | 列表点击跳转（Rich/Source） | ✅ `FindReplacePanel` 增加命中列表（预览片段），点击后调用现有 `activateFindMatch`，Rich/Source 都可跳转 | 
| M₆₈ | 跨文件搜索入口 | 调起工作区搜索 | ✅ 查找面板增加「工作区搜索」按钮（🔎），调用 VS Code `workbench.action.findInFiles` 并带 query | 
| M₆₉ | 章节折叠编辑 | 按标题折叠块 | ✅ Source/IR：按 ATX 标题自动提供折叠（gutter 折叠三角），折叠范围为该标题到下一个同级/更高标题 | 
| M₇₀ | 长文档稳定门禁 | Fixture + 阈值 | ✅ `docs/fixtures/m70` seed + 单测门禁 `largeDocStabilityGate.test.ts`（跨越 `richPerfTier` 阈值 + 降级 banner 文案稳定） |

---

## M₇₁–M₈₀：写作辅助 / AI（在编辑稳定前提下）

| 编号 | 里程碑 | 验收要点 | 状态 |
|------|--------|----------|------|
| M₇₁ | AI Provider 配置体验 | Endpoint/模型/密钥说明与校验 | ✅ 增加 “AI: Validate Setup” 命令；当 AI 设置变更且启用 openai-compatible 时自动提示缺失项（endpoint/model/api key/timeout）；settings description 增强说明 | 
| M₇₂ | 润色 Diff 预览 | 确认后再替换选区 | ✅ Webview 显示润色预览对话框（原文/润色后），点击确认后才替换选区；单测 `rewriteSelectionPreview.test.ts` | 
| M₇₃ | AI 摘要侧栏 | 文档/章节摘要 | ✅ 侧栏新增「摘要」面板（全文/当前节），支持复制/插入；协议 `AI_SUMMARY_REQUEST/RESULT`，扩展端复用 openai-compatible 配置与 SecretStorage key | 
| M₇₄ | AI 标题建议二期 | 多候选 + 风格说明 | ✅ Webview：写作辅助「标题建议」调用 AI，弹窗展示多候选（含风格/理由）并可一键替换/插入一级标题；协议 `AI_SUGGEST_TITLES_REQUEST/RESULT`；扩展端复用 openai-compatible 配置（mock/provider）。单测：`titleSuggestions.test.ts`、`messageContract.test.ts` |
| M₇₅ | Markdown 结构修复二期 | 列表/空行/标题层级 | ✅ 「修复 Markdown」走 `fixMarkdownStructuralPhaseTwo`：fence 外标题层级纠偏（不允许一次跳过多级）；`*`/`+` 统一 `-`；task `[X]`→`[x]`；段落与标题、标题与正文间补规范化空行；最后仍叠加空白规整。命令标题改为 Fix Markdown Structure。单测 `markdownStructureRepair.test.ts` |
| M₇₆ | AI 表格整理二期 | 非表格文本 → GFM | ✅ 命令 `Writing: Convert Selection to GFM Table (AI)`：选区经 `AI_CONVERT_TEXT_TO_TABLE_REQUEST/RESULT`，扩展端 mock 可将 TSV/齐列 CSV 转成 GFM；openai-compatible 走 JSON `{markdown}`；Webview 双栏预览后替换选区。单测 `textToGfmTable.test.ts`、`messageContract`。 |
| M₇₇ | 长文结构建议 | 重复/断层提示 | ✅ 侧栏「结构建议」：`analyzeMarkdownStructureHints` 本地检测 **锚点重复**（同 `generateHeadingId`）、**标题层级跳级**（Hn 后直连 Hn+2+）、**开篇过深**（首条 ATX 为 H3+）；点击条目与大纲同路径跳转。单测：`markdownStructureHints.test.ts`、`StructureHintsPanel.test.ts` |
| M₇₈ | AI 隐私说明成文 | 默认不上传全文；可复述 | ✅ 随包 `privacy/AI_PRIVACY.md`（三句话 + 各能力出站范围表）；命令 **AI: Open Privacy Notice**；`markly.ai.rewrite.enabled` / `provider` 增加 `markdownDescription`；README 摘要；侧栏「摘要」固定出站提示。单测：`aiPrivacyNotice.test.ts` |
| M₇₉ | AI 操作历史 | 最近改写可回看/撤销 | ✅ 侧栏「AI 操作」：在 **选区润色 / 选区转 GFM 表** 用户点击「替换选区」成功后记录（最多 15 条）；支持 **回看**（只读双栏）与 **撤销**（IR/Source 按文档偏移整块还原并校正后续记录的位移；Rich 需当前选区仍匹配 AI 结果时用 `replacePlainSelection` 还原）。工具：`aiApplyHistory.ts`、`adjustAiApplyHistoryAfterSourceRevert`、`AiApplyHistoryPanel`。单测：`aiApplyHistory.test.ts`、`AiApplyHistoryPanel.test.ts` |
| M₈₀ | AI provider 插件化预留 | 接口与配置隔离 | ✅ `AssistFeatureSnapshot` / `AssistModelOperations` / `createAssistModelOperations`；`openAiCompatibleChatCompletion` 传输层；`getAssistModelOperationsForExtension`（SecretStorage 与 `fetch` 仅此桥接）；GFM 本地逻辑拆至 `gfmTableLocal.ts`。`rewriteSelection`/`summarize`/`suggestTitles`/`textToGfmTable` ViaProvider 变薄。单测：`assistModelOperations.test.ts`、`openAiCompatibleTransport.test.ts` |

---

## M₈₁–M₉₀：导出与交付

| 编号 | 里程碑 | 验收要点 | 状态 |
|------|--------|----------|------|
| M₈₁ | PDF 模板扩充 | ≥2 套可切换 | ✅ 设置 `markly.export.pdf.template`：`default` 与 `academic`（衬线+印刷向色面+页眉文案区分）；`PdfConfig` / `pdfExportOptionsFromPdfConfig` / `buildPdfHtmlDocument` / Puppeteer 页眉联动。单测：`pdfExport.test.ts`、`configuration.test.ts` |
| M₈₂ | HTML 资源打包导出 | 图片复制到输出目录可选 | ✅ 设置 `markly.export.html.copyLocalImages` + `markly.export.html.assetsSubdirectory`；`exportToHtml` 集成 `bundleHtmlLocalImages`（`htmlBundleImages.ts`）；自定义编辑器与命令导出传入 `documentBaseDir`。单测：`htmlBundleImages.test.ts`、`htmlExport.test.ts`、`configuration.test.ts` |
| M₈₃ | 导出前检查 | 缺失图/公式/无效链 | ✅ 设置 `markly.export.preflight.scope`（`off` / `images` / `full`）与 `markly.export.preflight.blockOnIssues`；`exportPreflight.ts` + `confirmContinueAfterExportPreflight`；PDF/HTML（自定义编辑器 + 命令）导出前执行。链接解析与 `extractMarkdownLinkHrefs` 迁至 `@core/markdown/markdownLinkRefs`，图片抽取迁至 `@core/markdown/markdownImageRefs`。单测：`exportPreflight.test.ts`、`configuration.test.ts`、`messageContract.test.ts` |
| M₈₄ | 代码块导出增强 | 分页/换行/长行 | ✅ PDF：`buildPdfHtmlDocument` 中 `pre`/`pre code` 增加 `overflow-wrap`、`tab-size`、行内 `code` 断行、`print-color-adjust`；学术模板 `pre` 同步换行。HTML：`buildHtmlDocument` 屏读 `pre` 换行与 tab；`@media print` 中 `pre` 改为可跨页（`blockquote` 仍 `avoid`）；`print-friendly` 主题补充 `pre` 规则。单测：`pdfExport.test.ts`、`htmlExport.test.ts` |
| M₈₅ | Mermaid 导出一致 | HTML/PDF 对齐 | ✅ `mermaidExport.ts`：`transformMermaidFencesForExport` + 磁盘读取 `mermaid.min.js` 内联 + `buildMermaidExportBootstrapScript`（`startOnLoad:false`、`securityLevel:'strict'`，HTML 用 `darkMode`→theme，PDF 默认 `default`）；`markdownToHtml` / `markdownToPdfHtml` 共用转换；`buildHtmlDocument` / `buildPdfHtmlDocument` 共用 CSS + 脚本；PDF `setContent` 后 `waitForFunction` 等待 `.markly-mermaid-await` 内出现 `svg`。根依赖 `mermaid` 与 webview 对齐 `^11.12.3`。单测：`mermaidExport.test.ts`、`htmlExport.test.ts`、`pdfExport.test.ts` |
| M₈₆ | 导出失败诊断包 | 脱敏可提交 | ✅ `exportDiagnostics.ts`、`exportFailureUi.ts`、命令 `copyFailureDiagnostics` |
| M₈₇ | 富文本复制 | 邮件/IM 粘贴友好 | ✅ `richClipboard.ts`、CM 复制扩展、`marklyRichClipboardCopyPlugin` |
| M₈₈ | 发布前预览视图 | 接近导出效果 | ✅ `buildExportHtmlString`、`htmlPreviewImgRewrite.ts`、`exportHtmlPreview.ts`、命令 `preview.exportHtml`、工具栏预览 |
| M₈₉ | 文档模板库 | 内置模板若干 | ✅ `templates/*.md`、`builtinTemplates.ts`、命令 `template.newFromLibrary` |
| M₉₀ | 自定义模板目录 | 用户模板路径配置 | ✅ `markly.templates.userDirectory`、`userTemplateDirectory.ts`、与内置模板合并 QuickPick |

---

## M₉₁–M₁₀₀：产品化与工程

| 编号 | 里程碑 | 验收要点 | 状态 |
|------|--------|----------|------|
| M₉₁ | 首次使用引导 | Rich/Source/导出/快捷键 | □ |
| M₉₂ | Command Palette 分组 | `markly.*` 可发现性 | □ |
| M₉₃ | 设置页说明优化 | 常见项有示例 | □ |
| M₉₄ | 错误自救中心 | 集中入口修复 Rich/导出/资产 | □ |
| M₉₅ | 可选匿名遥测 | 默认关闭；隐私说明 | □ |
| M₉₆ | 包体治理二期 | Puppeteer/Shiki/Mermaid 策略 | □ |
| M₉₇ | 启动性能专项 | 首次打开 Markdown | □ |
| M₉₈ | 跨平台一致性 | Win/Linux/macOS | □ |
| M₉₉ | Marketplace 素材 | 截图/动图/FAQ | □ |
| M₁₀₀ | 2.0 评审门禁 | M₅₁–M₉₉ 收口复盘；是否 semver major | □ |

---

## 备注

- **M₁–M₅₀** 仍为「依赖有序主干」：`docs/milestones-M01-M50.md`。
- **M₅₃–M₁₀₀** 条目多、周期长；每项落地时应补 **契约/单测/门禁**（与 `gates:stable`、`test:vscode:ui:stable` 策略一致）。
- 「一次做完 M₅₁–M₁₀₀ 全部代码」不现实；本矩阵用于 **排期与验收**，代码按迭代从表顶向下咬合。
