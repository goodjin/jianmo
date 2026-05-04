# M₁–M₅₀ 执行矩阵（无前向依赖）

**规则**：完成 Mᵢ 所需能力只能来自 **M₁…Mᵢ₋₁** 及更早交付；禁止「为了 Mᵢ 必须等 Mᵢ₊ₙ」。

**用法**：迭代时按编号顺序收口；`✅` 表示当前仓库已可验收（含本轮对「部分」项的收口），`□` 仍为远期或未纳入。

---

## M₁–M₁₀：协议、文档模型、保存与模式

| 编号 | 里程碑 | 验收要点 | 状态 | 证据（入口） |
|------|--------|----------|------|----------------|
| M₁ | Webview ⇄ Extension 消息契约 | 类型联合 + 运行时 guard + 契约单测 | ✅ | `src/types/index.ts`、`messageGuards.ts`、`__tests__/messageContract.test.ts` |
| M₂ | 文档内存与版本 | set/get、update 递增 version、dirty、markSaved | ✅ | `src/core/documentStore/`、`documentStore.test.ts` |
| M₃ | INIT / READY 时序 | 首屏内容、配置、hostDiagnostics 下发 | ✅ | `customEditor.ts` INIT、`App.vue` READY |
| M₄ | 保存单路径 | 磁盘内容与 webview 一致、失败有提示 | ✅ | `SAVE` / `CONTENT_CHANGE` 链路、`customEditor` |
| M₅ | 撤销 / 重做 | Rich 关键编辑可撤销 | ✅ | `useEditor.ts`、相关 composable 单测 |
| M₆ | Rich ↔ Source | 切换不丢内容、模式可切换 | ✅ | `useEditor`、`MilkdownEditor`、`modeController` |
| M₇ | 焦点与选区 | 工具栏/命令后焦点可恢复 | ✅ | `queueRichFocus` 双 rAF；查找命中 Rich 后 `queueRichFocus`；诊断 `richFocused` |
| M₈ | 空/小文档性能基线 | 可运行、无明显阻塞 | ✅ | 诊断包 `doc.docBaselineTier`（xs–xl）；`findLargeDocPerf` |
| M₉ | 行内格式 | 粗斜体等与快捷键 | ✅ | Rich 工具栏、CM/Milkdown 行为 |
| M₁₀ | 标题与段落 | ATX 标题、段落结构稳定 | ✅ | 解析与 Rich 编辑 |

---

## M₁₁–M₁₆：列表、引用、代码、链接、数学、高亮

| 编号 | 里程碑 | 验收要点 | 状态 | 证据 |
|------|--------|----------|------|------|
| M₁₁ | 列表与任务 | 有序/无序/任务列表编辑与序列化 | ✅ | Rich GFM、decorators |
| M₁₂ | 引用与分隔线 | `>`、`---` | ✅ | Markdown 管线 |
| M₁₃ | 行内代码与围栏块 | 语言标识、Source 往返 | ✅ | 插入命令、导出单测 |
| M₁₄ | 链接与安全打开 | 相对/绝对、外链策略 | ✅ | `url.ts`、`wrapUrlLink`、M39 计划 |
| M₁₅ | KaTeX 数学 | 行内/块级、与代码块 `$` 不冲突 | ✅ | `htmlExport`/`pdfExport` 单测 |
| M₁₆ | Shiki 可选 | 开关、降级 | ✅ | `MilkdownEditor` 创建失败自动无 Shiki 重试；README 说明高档位不加载 |

---

## M₁₇–M₂₄：表格

| 编号 | 里程碑 | 验收要点 | 状态 | 证据 |
|------|--------|----------|------|------|
| M₁₇ | 表格基础网格 | 单元格编辑、Tab | ✅ | `markly-table-rich` |
| M₁₈ | 表头与对齐 | 表头行、对齐 | ✅ | 插件与命令 |
| M₁₉ | TSV/CSV 粘贴 | 限制与安全 | ✅ | M35/M37 剪贴板单测 |
| M₂₀ | HTML 表格粘贴净化 | 白名单/剥离 | ✅ | `sanitizeClipboardHtmlForTableParse` |
| M₂₁ | 合并/拆分单元格 | 往返稳定 | ✅ | `markly-table-rich.test.ts` |
| M₂₂ | 大表格性能 | 降级或流畅滚动 | ✅ | `style.css`：Rich 内 `table` 块级 + `max-height` + `overflow:auto`（非 DOM 虚拟化） |
| M₂₃ | 表格命令面板 | `markly.table.*` | ✅ | `package.json` contributes |
| M₂₄ | 表格稳定集 | 单测/手测清单 | ✅ | `markly-table-rich` 单测 + `e2e/ui-suite/markly-ui.test.js` Rich 表格用例（见 m46） |

---

## M₂₅–M₃₂：图片资产

| 编号 | 里程碑 | 验收要点 | 状态 | 证据 |
|------|--------|----------|------|------|
| M₂₅ | 粘贴/拖拽保存 | 落盘、相对路径 | ✅ | 图片处理 composable |
| M₂₆ | assets 目录与配置 | `image.saveDirectory` | ✅ | 配置、`openAssetsDirectory` |
| M₂₇ | 缺失检测协议 | CHECK / RESULT | ✅ | `messageGuards`、M32 |
| M₂₈ | 修复与清单 | 复制缺失、单项修复 | ✅ | M33 命令 |
| M₂₉ | 移动后引用 | `replaceMovedImageRef` | ✅ | M43-1 |
| M₃₀ | 压缩可感知 | 阈值/质量配置 | ✅ | `useImageHandler` 超阈值前 `onCompressingStart` → App Toast；阈值随 `config.image.compressThreshold` |
| M₃₁ | 超大图降级 | 不卡死、有提示 | ✅ | 接近 `maxFileSize` 65% 时 `onHeavyImageWarning` Toast；超限仍抛错 |
| M₃₂ | 图片 E2E/稳定集 | 关键路径自动化 | ✅ | `useImageHandler` 粘贴/压缩/上传单测；拖拽与真剪贴板仍建议 ExTester 手测 |

---

## M₃₃–M₃₉：大纲与查找/替换

| 编号 | 里程碑 | 验收要点 | 状态 | 证据 |
|------|--------|----------|------|------|
| M₃₃ | 大纲解析与跳转 | 点击滚动到标题 | ✅ | `OutlinePanel`、`useOutline` |
| M₃₄ | 当前章节高亮 | scroll spy、折叠记忆 | ✅ | M40、`OutlinePanel.test` |
| M₃₅ | 大文档大纲 | 节流、长标题 | ✅ | `onDocumentScrollOutlineSpy` 120ms 节流 + `onUnmounted` 清理 |
| M₃₆ | 查找面板 | 大小写、全词等 | ✅ | `FindReplacePanel` |
| M₃₇ | 正则与无效提示 | 不崩溃、有 warning | ✅ | `findPattern`、单测 |
| M₃₈ | 大文档查找 | 截断、计数模式 | ✅ | `findCount`、`findLargeDocPerf` |
| M₃₉ | 替换单次/全部 | 可撤销、CONTENT_CHANGE | ✅ | `useFindReplace.test`：空串替换、replaceAll 后匹配清空 |

---

## M₄₀–M₄₄：导出

| 编号 | 里程碑 | 验收要点 | 状态 | 证据 |
|------|--------|----------|------|------|
| M₄₀ | HTML 主题 | default / print-friendly | ✅ | `htmlExport`、`configuration` |
| M₄₁ | HTML 资源与 base | 相对路径 | ✅ | `htmlExport`、单测 |
| M₄₂ | PDF 版式与分页 | margin、TOC、打印 CSS | ✅ | `pdfExport.ts`、单测 |
| M₄₃ | PDF 配置贯通 | settings → export | ✅ | `pdfExportOptionsFromPdfConfig`、`commands`、`customEditor` |
| M₄₄ | 导出失败归因 | 用户可读错误 | ✅ | `exportErrors.formatExportFailure`；Custom Editor + 命令面板 HTML/PDF |

---

## M₄₅–M₄₈：命令、无障碍、门禁

| 编号 | 里程碑 | 验收要点 | 状态 | 证据 |
|------|--------|----------|------|------|
| M₄₅ | 命令与快捷键成文 | 清单与冲突说明 | ✅ | `docs/m45-commands-keybindings-policy.md` |
| M₄₆ | Rich vs Source 键位对照 | 文档化 | ✅ | `docs/m45-commands-keybindings-policy.md` 对照表 |
| M₄₇ | A11y 基线 | 区域/标签/关闭钮可读 | ✅ | 根 `role="application"`；`ToolbarButton` `aria-label`；查找/大纲此前已补 |
| M₄₈ | `gates:stable` | lint+test+build+bundle | ✅ | `package.json`、`README.md`、m46 |

---

## M₄₉–M₅₀：AI 与发布卫生

| 编号 | 里程碑 | 验收要点 | 状态 | 证据 |
|------|--------|----------|------|------|
| M₄₉ | AI 选区润色一期 | mock / openai-compatible、SecretStorage、超时、脱敏 | ✅ | `rewriteSelection.ts`、`aiRewriteProvider.test.ts` |
| M₅₀ | 发布卫生 | SemVer、CHANGELOG、发版检查 | ✅ | `CHANGELOG.md` + README「Release」小节；`npm run check:release` |

---

## 与历史编号（M15–M47）的关系

- 路线图 **`docs/product-roadmap-2026.md`** 中的 **M32–M47** 为按主题拆的交付记录；本文件的 **M₁–M₅₀** 为**依赖有序**的总序列，便于排期与门禁对齐。
- 新增能力时：先在本表找到「最小编号仍可插入」的缺口，再改路线图小节，避免后序里程碑反依赖。

---

## 单次迭代无法「一键完成」□ 项时

1. 在路线图或主题计划（如 `m43-*`）中拆子任务。  
2. 优先补 **测试与门禁**（M₄₈），再补体验（M₇、M₂₂、M₃₉ 等）。  
3. AI（M₄₉）与导出（M₄₀–M₄₄）已通过协议与配置解耦，可并行排期但**不改变** M₁–M₃₈ 的契约。
