# IR 冻结路线：100 里程碑 → 文件/PR 粒度任务拆分

> 状态：规划文档，未实施。每条 **Mxx** 可拆成 1～N 个 PR；同一条内已按推荐合并顺序排列子任务。  
> 约定：路径以仓库根为起点；`*` 表示可能多文件；`（新）` 表示建议新建文件。

---

## 阶段 A — IR 冻结与纪律

### M01 — 发布 IR 冻结约定（对内/贡献者）

| 建议 PR | `docs: IR freeze policy for contributors` |
|--------|------------------------------------------|
| 路径 | [`docs/IR_FREEZE_POLICY.md`](./IR_FREEZE_POLICY.md), `CLAUDE.md`, `README.md` |
| 子任务 | 写明：禁止新特性/新 e2e 依赖 IR；仅阻断性 bug；如何开 issue 标记 `legacy-ir`。 |

### M02 — 梳理进入 `ir` 的全部入口

| 建议 PR | `chore: inventory IR mode entrypoints` |
|--------|----------------------------------------|
| 路径 | `docs/IR_ENTRYPOINT_AUDIT.md`（新）, 代码引用表由脚本或手工填：`src/types/*.ts`, `src/types/messageGuards.ts`, `webview/src/**/*.ts`, `webview/src/**/*.vue`, `src/extension/**/*.ts`, `e2e/**/*` |
| 子任务 | 列：消息类型、命令、持久化键、测试文件；标注「可达/死代码」。 |

### M03 — Rich/Source 等价能力验收清单

| 建议 PR | `docs: Rich vs Source parity acceptance checklist` |
|--------|---------------------------------------------------|
| 路径 | `docs/RICH_SOURCE_PARITY_CHECKLIST.md`（新）, 可链到 `docs/MARKDOWN_CAPABILITIES.md` |
| 子任务 | 按语法块列「Rich 必选 / Source 必选 / 导出一致」；与 M02 对照标 IR-only 项。 |

### M04 — CI/审查门禁（禁止新 PR 绑定 IR）

| 建议 PR | `ci: guard against new IR-coupled features` |
|--------|--------------------------------------------|
| 路径 | `.github/workflows/*` 或 `package.json` scripts, `scripts/check-ir-freeze.ts`（新）, `docs/IR_FREEZE_POLICY.md` |
| 子任务 | 可选：`rg`/AST 扫描 `mode === 'ir'` 在 `webview/src/core/decorators` 新增文件即 fail；或在 PR template 勾选确认。 |

### M05 — 诊断/打点：模式字段区分

| 建议 PR | `feat: tag editor mode in diagnostics payload` |
|--------|-----------------------------------------------|
| 路径 | `webview/src/utils/diagnosticsPackage.ts`*, `webview/src/App.vue`, `src/types/index.ts`（若扩展 payload 类型）, 相关 `**/__tests__/*diagnostics*` |
| 子任务 | 统一：`rich` / `source` / `legacy-ir`；导出失败包、可选遥测共用字段。 |

### M06 — 用户可见文案统一（不主推 IR）

| 建议 PR | `copy: deprecate IR in user-visible strings` |
|--------|---------------------------------------------|
| 路径 | `webview/src/components/*.vue`, `package.json`（contributes），`docs/marketplace/FAQ.md`, `CHANGELOG.md` |
| 子任务 | 搜 `IR`/`即时渲染`/中间模式；保留必要技术词时加「旧版」。 |

### M07 — 性能文档：IR 不做性能类里程碑

| 建议 PR | `docs: performance investment scope (no IR)` |
|--------|---------------------------------------------|
| 路径 | `docs/IR_FREEZE_POLICY.md` 或 `CLAUDE.md`, `docs/m41-large-doc-perf-plan.md` 补充说明 |
| 子任务 | 明确 Rich/Source 为优化对象；IR 仅阻断修复。 |

### M08 — 安全基线：冻结期不扩大 IR 面

| 建议 PR | `docs: security scope for legacy IR` |
|--------|-------------------------------------|
| 路径 | `docs/IR_FREEZE_POLICY.md`, 可选 `docs/MARKDOWN_CAPABILITIES.md` |
| 子任务 | 写清：IR 不新增 HTML/远程内容解析路径；若必须修 bug，需安全 review 标签。 |

### M09 — 登记 `preview` ↔ Rich 命名技术债

| 建议 PR | `docs: rename preview to rich in extension API (debt register)` |
|--------|----------------------------------------------------------------|
| 路径 | `docs/TECH_DEBT_PREVIEW_RICH_NAMING.md`（新）, `src/core/modeController/index.ts`, `src/extension/commands/index.ts`（引用说明） |
| 子任务 | 列改名影响面：status bar、设置、消息、测试；MAJOR 版本策略指向 M97–M98。 |

### M10 — IR 移除阶段 0：构建剔除 IR 可行性评估

| 建议 PR | `spike: build without IR decorators bundle` |
|--------|---------------------------------------------|
| 路径 | `webview/vite.config.ts`, `webview/src/core/editor.ts`, `webview/src/core/decorators/*`, 评估报告入 `docs/IR_REMOVAL_PHASE0.md`（新） |
| 子任务 | 体积分 diff、懒加载是否足够、对 `useEditor`/`createEditorState` 分支影响；结论供 M95 使用。 |

---

## 阶段 B — Rich 编辑内核

### M11 — Rich 块级嵌套与键盘/选区

| 建议 PR | `fix(rich): block nesting keyboard and selection` |
|--------|--------------------------------------------------|
| 路径 | `webview/src/components/Milkdown*.vue`*, `webview/src/**/*rich*`, `webview/src/__tests__/*`, Milkdown 相关 `crepe`/`plugin` 目录若存在 |
| 子任务 | 列表/引用/段落升级降级；回归用例按 `docs/fixtures/m9/*` 风格扩。 |

### M12 — 软/硬换行与 GFM 序列化 golden

| 建议 PR | `test(rich): newline serialization golden tests` |
|--------|---------------------------------------------------|
| 路径 | `webview/src/__tests__/richNewline*.test.ts`（新）, Rich 序列化入口（Milkdown `getContent` 封装处）, `docs/fixtures/*` 样例 |
| 子任务 | `\n` vs `  \n`、列表内换行；与 `docs/MARKDOWN_CAPABILITIES.md` 对齐。 |

### M13 — 粘贴 Word/HTML 净化版本化

| 建议 PR | `feat(rich): versioned HTML paste sanitizer` |
|--------|---------------------------------------------|
| 路径 | `webview/src/utils/*paste*`*, `webview/src/App.vue`, `webview/src/__tests__/*paste*` |
| 子任务 | 配置对象版本号；日志可开关；危险标签黑名单文件 `webview/src/utils/pasteDenylist.ts`（新）。 |

### M14 — 粘贴统一入口与撤销粒度

| 建议 PR | `refactor(rich): unified paste pipeline + history` |
|--------|---------------------------------------------------|
| 路径 | 同上 + Milkdown history/undo 集成点 |
| 子任务 | 单次粘贴单次 undo；与 M13 同 PR 或可拆前后两 PR。 |

### M15 — IME（CJK）压力用例

| 建议 PR | `test(rich): IME composition coverage` |
|--------|----------------------------------------|
| 路径 | `webview/src/__tests__/*ime*`（新，可能 jsdom 有限则 e2e）, `e2e/ui-suite/*` |
| 子任务 | 文档化：哪些必须在真机 e2e 跑。 |

### M16 — 段落级格式化命令语义

| 建议 PR | `feat(toolbar): block-scoped format commands` |
|--------|-----------------------------------------------|
| 路径 | `webview/src/components/Toolbar.vue`, `webview/src/shared/*toolbar*`, `webview/src/composables/useEditor.ts`（若仍触达 Rich）, `src/types/index.ts`（若新 command） |
| 子任务 | 规范「当前块」定义；加单元测试。 |

### M17 — 光标穿越内联公式/代码边界

| 建议 PR | `fix(rich): cursor boundary for inline math/code` |
|--------|---------------------------------------------------|
| 路径 | Milkdown  schema / plugins， `webview/src/core/*` 若与 CM6 无关则纯 Rich 目录 |
| 子任务 | 与 KaTeX inline 配置交叉验证。 |

### M18 — 空文档/模版占位 UX

| 建议 PR | `feat(rich): empty doc placeholders and templates entry` |
|--------|-----------------------------------------------------------|
| 路径 | `webview/src/App.vue`, 模版相关 `src/extension/templates/*`, `package.json` contributes |
| 子任务 | 与已有「从模版新建」命令对齐，避免重复入口。 |

### M19 — 多段落批量格式化时序

| 建议 PR | `fix(rich): multi-paragraph format batch ordering` |
|--------|---------------------------------------------------|
| 路径 | Rich 命令实现文件、 `Toolbar.vue`、测试 |
| 子任务 | 定义与 Source 行为一致或可接受差异表（写入 M03 清单）。 |

### M20 — Rich ↔ Source 撤销栈文档与测试

| 建议 PR | `docs+test: undo semantics across mode switch` |
|--------|---------------------------------------------|
| 路径 | `docs/RICH_SOURCE_PARITY_CHECKLIST.md`, `webview/src/__tests__/*undo*`, `webview/src/App.vue`（switchMode） |
| 子任务 | 固定：切换模式是否清空历史、是否需提示。 |

### M21 — 拖拽大块重排（可选产品）

| 建议 PR | `feat(rich): drag block reorder (spike or ship)` |
|--------|------------------------------------------------|
| 路径 | Rich 侧 DnD API、 `OutlinePanel.vue` 与联动若需要 |
| 子任务 | Spike PR 与正式 PR 可分；数据层防环、undo。 |

### M22 — 选区可读性辅助（可选）

| 建议 PR | `style: selection visibility in rich` |
|--------|--------------------------------------|
| 路径 | `webview/src/styles/*`, Milkdown theme |
| 子任务 | 对比 light/dark WCAG。 |

### M23 — 窄屏可读性（可选）

| 建议 PR | `style: narrow viewport rich layout` |
|--------|-------------------------------------|
| 路径 | `webview/src/App.vue`, CSS |
| 子任务 | 与工具栏折叠策略一致。 |

### M24 — Rich 脚注一等体验

| 建议 PR | `feat(rich): footnote editing parity` |
|--------|--------------------------------------|
| 路径 | Milkdown GFM/footnote 插件、序列化测试、 `docs/fixtures/m9/05-footnotes.md` |
| 子任务 | 与导出脚注 M71 协调顺序。 |

### M25 — Wiki 链接、别名、自动链接

| 建议 PR | `feat(rich): wiki links and autolink policy` |
|--------|---------------------------------------------|
| 路径 | Rich parser 配置、 `docs/m39-rich-link-anchor-plan.md` 更新、测试 |
| 子任务 | 安全：抑制 `javascript:`；与 M08 一致。 |

---

## 阶段 C — Rich 表格

### M26 — 大表虚拟化/分段渲染

| 建议 PR | `perf(rich): table virtualization or chunk render` |
|--------|--------------------------------------------------|
| 路径 | Milkdown table 插件、 `webview/src/App.vue`（降级逻辑已有可扩展）、性能测试 `webview/src/__tests__/*` |
| 子任务 | 与 `markly.editor.richTableColumnResize` 交互验证。 |

### M27 — 粘贴超大 HTML 表上限与提示

| 建议 PR | `fix(rich): large html table paste limits` |
|--------|-------------------------------------------|
| 路径 | `webview/src/utils/*paste*`, `docs/RICH_TABLE_USER_GUIDE.md`, 错误 toast 文案 |
| 子任务 | 数值与 M41 大文档策略对齐。 |

### M28 — 表格无障碍

| 建议 PR | `a11y(rich): table focus and roles` |
|--------|------------------------------------|
| 路径 | 表格组件 DOM、 `Toolbar.vue`、axe 或手动 checklist 入 `docs/` |
| 子任务 | 与 M06 文案协调。 |

### M29 — 表格 × 导出分页测试集

| 建议 PR | `test(export): table pagination golden` |
|--------|----------------------------------------|
| 路径 | `src/core/export/*`, `webview` 导出预览相关、 `docs/fixtures/*`、快照或 PDF 体积断言脚本 |
| 子任务 | 依赖稳定序列化 M12。 |

### M30 — 单元格多段落 ↔ Markdown 等价

| 建议 PR | `fix(rich): table cell block serialization` |
|--------|----------------------------------------------|
| 路径 | Rich table schema、 `**/__tests__/*table*` |
| 子任务 | 更新 M03 清单勾选。 |

### M31 — 表格与内联公式混排矩阵

| 建议 PR | `test(rich): table cell math matrix` |
|--------|-------------------------------------|
| 路径 | 测试 + fixture、导出抽样 |
| 子任务 | 与 M17、M29 交叉。 |

### M32 — 导出重复表头（可选）

| 建议 PR | `feat(export): repeat table header on break` |
|--------|-------------------------------------------|
| 路径 | `src/core/export/html*.ts`, `pdf*`*, 打印 CSS |
| 子任务 | 若 HTML 优先则先 HTML PR 再 PDF PR。 |

### M33 — 窄视图画布列宽（可选）

| 建议 PR | `style(rich): table column width on narrow view` |
|--------|-----------------------------------------------|
| 路径 | Rich 表格样式、响应式 CSS |
| 子任务 | 与 M23 可同 PR。 |

### M34 — CSV 导入映射 UI（可选）

| 建议 PR | `feat(rich): csv import column mapping` |
|--------|----------------------------------------|
| 路径 | 新 webview 面板或 modal、粘贴入口、测试 |
| 子任务 | 安全：行数列数上限。 |

### M35 — 列校验（可选）

| 建议 PR | `feat(rich): optional column validation` |
|--------|-----------------------------------------|
| 路径 | 表格扩展元数据存哪（需设计）；设置项 `package.json` |
| 子任务 | 默认 off。 |

---

## 阶段 D — 图表与重渲染

### M36 — Mermaid 版本策略与公告

| 建议 PR | `chore: pin mermaid + changelog hook` |
|--------|--------------------------------------|
| 路径 | `webview/package.json`, `package-lock`/`webview/package-lock`, `CHANGELOG.md`, `docs/*` |
| 子任务 | CI 检查 lockfile 与运行时版本一致。 |

### M37 — 渲染队列与可取消

| 建议 PR | `feat: diagram render queue with cancel` |
|--------|------------------------------------------|
| 路径 | `webview/src/**/*mermaid*`, `App.vue`、AbortController 封装 |
| 子任务 | 与 Rich 性能档位 M74–M75 对齐。 |

### M38 — 离线图表占位

| 建议 PR | `feat: offline diagram placeholder` |
|--------|------------------------------------|
| 路径 | 图表加载失败 UI、网络检测 util |
| 子任务 | 文案入 M06 体系。 |

### M39 — PlantUML 插件化宿主（可选）

| 建议 PR | `spike: pluggable second diagram backend` |
|--------|------------------------------------------|
| 路径 | 新 `webview/src/diagrams/*` 抽象、设置项 |
| 子任务 | Spike 独立 PR，不默认开启。 |

### M40 — 导出矢量 vs 体积策略

| 建议 PR | `feat(export): diagram export strategy matrix` |
|--------|-----------------------------------------------|
| 路径 | `src/core/export/*`, 用户设置 `package.json` |
| 子任务 | 文档写入 `docs/MARKDOWN_CAPABILITIES.md`。 |

### M41 — 图表配色 token 对齐主题

| 建议 PR | `style: diagram theme tokens` |
|--------|------------------------------|
| 路径 | `webview/src/composables/useTheme.ts`*, Mermaid init、Shiki 若共享 token |
| 子任务 | 打印预览专用变量。 |

### M42 — 图表锚点与 TOC

| 建议 PR | `feat: diagram anchors and toc linking` |
|--------|----------------------------------------|
| 路径 | `webview/src/composables/useOutline.ts`*, 标题/块 ID 生成 |
| 子任务 | 与 M25 链接策略一致。 |

### M43 — 图表无障碍文字替代

| 建议 PR | `a11y: diagram alt text pipeline` |
|--------|----------------------------------|
| 路径 | fence 属性解析、导出 HTML alt |
| 子任务 | 规范入 `docs/MARKDOWN_CAPABILITIES.md`。 |

### M44 — 图表渲染 golden snapshot

| 建议 PR | `test: mermaid render snapshot suite` |
|--------|--------------------------------------|
| 路径 | `webview/src/__tests__/*` 或 headless、fixture under `docs/fixtures/*` |
| 子任务 | CI 稳定性：锁字体/时区若需要。 |

### M45 — 仅导出时渲染模式

| 建议 PR | `feat: defer diagram render until export` |
|--------|------------------------------------------|
| 路径 | `App.vue`、导出命令路径、设置项 |
| 子任务 | 与编辑预览体验权衡，默认策略写文档。 |

---

## 阶段 E — 多媒体与附件

### M46 — 远端图/图床白名单

| 建议 PR | `feat: remote image allowlist` |
|--------|-------------------------------|
| 路径 | `webview/src/composables/useImageHandler.ts`*, `src/types/index.ts`, `package.json` configuration |
| 子任务 | 与扩展侧 fetch 若存在则同步。 |

### M47 — SVG 清理与分级告警

| 建议 PR | `feat: svg sanitize pipeline` |
|--------|------------------------------|
| 路径 | 图片落地前处理、 `src/core/*` 若扩展参与 |
| 子任务 | 依赖 M08 安全流程。 |

### M48 — 音视频引用（可选）

| 建议 PR | `feat: media embed with security policy` |
|--------|-----------------------------------------|
| 路径 | Rich schema、渲染、 `docs/*` 一页安全说明 |
| 子任务 | CSP 与 webview 策略。 |

### M49 — 粘贴截图命名与冲突消解

| 建议 PR | `feat: screenshot paste naming` |
|--------|--------------------------------|
| 路径 | `useImageHandler`、文件系统桥接 extension |
| 子任务 | 与 `markly.image.saveDirectory` 一致。 |

### M50 — 大图渐进加载

| 建议 PR | `perf: progressive image load in preview` |
|--------|------------------------------------------|
| 路径 | `webview` 图片组件/CSS、lightbox 若存在 |
| 子任务 | 可选 low-res 占位。 |

### M51 — 多图并排最小语义（可选）

| 建议 PR | `feat: multi-image row syntax` |
|--------|-------------------------------|
| 路径 | Rich 解析、序列化、文档 |
| 子任务 | 与 GFM 兼容性评估。 |

### M52 — 外链失效巡检（可选）

| 建议 PR | `feat: periodic link health check` |
|--------|-----------------------------------|
| 路径 | extension command、background 任务、结果面板 |
| 子任务 | 隐私：默认 off、域名限制。 |

### M53 — OCR 离线路径（可选）

| 建议 PR | `feat: optional ocr pipeline` |
|--------|------------------------------|
| 路径 | extension 侧 native/ wasm 集成点、设置与声明 |
| 子任务 | 独立大 PR；法律声明。 |

### M54 — 导出资产嵌入策略矩阵

| 建议 PR | `feat(export): embed local assets policy` |
|--------|--------------------------------------------|
| 路径 | `src/core/export/*`, 设置、测试 |
| 子任务 | 与 M46 远端图策略互斥/优先级写清。 |

### M55 — 非默认 assets 路径策略

| 建议 PR | `docs+fix: image path outside assets` |
|--------|--------------------------------------|
| 路径 | `useImageHandler`、诊断、FAQ |
| 子任务 | 与 M05 诊断字段一致。 |

---

## 阶段 F — Source 模式

### M56 — 默认 Source 入口与引导

| 建议 PR | `feat: optional default source mode onboarding` |
|--------|------------------------------------------------|
| 路径 | `package.json` 设置、 `webview/src/App.vue` 首次运行 state、 `docs/marketplace/FAQ.md` |
| 子任务 | 不破坏现用户默认 Rich。 |

### M57 — VS Code 主题 ⇄ CM6 映射表生成

| 建议 PR | `tool: generate cm theme from vscode` |
|--------|--------------------------------------|
| 路径 | `scripts/*`（新）, `webview/src/composables/useTheme.ts`, `docs/*` |
| 子任务 | npm script + CI 可选校验。 |

### M58 — Source 专用格式化（不改语义）

| 建议 PR | `feat(source): format document without semantic change` |
|--------|--------------------------------------------------------|
| 路径 | `webview/src/composables/useEditor.ts`、新 util、Prettier/markdown 若引入则 `package.json` |
| 子任务 | 与 markdownlint 冲突测一次。 |

### M59 — markdownlint/LSP 官方共存文档

| 建议 PR | `docs: markdownlint and markly coexistence` |
|--------|---------------------------------------------|
| 路径 | `docs/SOURCE_LSP_MARKDOWNLINT.md`（新）, `README.md` 链接 |
| 子任务 | 样例 `.vscode/settings.json`。 |

### M60 — 大文档 Source-only 降级提示

| 建议 PR | `feat: suggest source for large docs` |
|--------|--------------------------------------|
| 路径 | `App.vue`、已有 perf tier 逻辑扩展、toast 文案 |
| 子任务 | 与 M74–M76 一致。 |

### M61 — 怪异字符诊断视图

| 建议 PR | `feat(source): invisible char highlighter` |
|--------|-------------------------------------------|
| 路径 | CM6 扩展 `webview/src/core/extensions.ts`、命令 |
| 子任务 | 性能：大文件开关。 |

### M62 — 换行归一化与 diff 对齐

| 建议 PR | `feat: eol normalization option` |
|--------|---------------------------------|
| 路径 | `useEditor`、保存钩子在 `customEditor.ts`、设置 |
| 子任务 | 与 Git `autocrlf` 文档说明。 |

### M63 — Source 快捷键冲突检测脚本

| 建议 PR | `tool: source keybinding conflict check` |
|--------|-----------------------------------------|
| 路径 | `scripts/check-keybindings.ts`（新）, `package.json`, `docs/m17-command-shortcuts-policy.md` 更新 |
| 子任务 | 读 `package.json` contributes。 |

---

## 阶段 G — 导出与模版

### M64 — PDF 分页 golden（多主题 × 体量）

| 建议 PR | `test(export): pdf pagination golden suite` |
|--------|----------------------------------------------|
| 路径 | `src/core/export/*`, `docs/fixtures/*`, 快照或像素 diff 脚本 |
| 子任务 | CI 时间预算；可选夜间任务。 |

### M65 — 中文字体嵌入/回退自动化矩阵

| 建议 PR | `test(export): cjk font fallback matrix` |
|--------|-----------------------------------------|
| 路径 | `src/core/export/pdf*.ts`, fixture、容器字体若需要 |
| 子任务 | 与 puppeteer 版本钉住。 |

### M66 — HTML 自洽 zip 导出（可选）

| 建议 PR | `feat(export): self-contained html zip` |
|--------|----------------------------------------|
| 路径 | `src/core/export/html*`, 新 command `src/extension/commands/*` |
| 子任务 | 资源收集与 M54 重叠处复用。 |

### M67 — 模版变量扩展（git/封面/水印）

| 建议 PR | `feat(templates): extended template variables` |
|--------|-----------------------------------------------|
| 路径 | `src/extension/templates/*`, `docs/m44-export-template-plan.md` |
| 子任务 | 与 `markly.templates.userDirectory` 行为一致。 |

### M68 — 多文件批量导出队列

| 建议 PR | `feat(export): batch export queue` |
|--------|-----------------------------------|
| 路径 | `src/extension/commands/*`, UI progress、 `DocumentStore` 若需 |
| 子任务 | 取消与错误聚合。 |

### M69 — 导出预览 vs 产物 hash CI gate

| 建议 PR | `ci: export preview vs artifact hash` |
|--------|----------------------------------------|
| 路径 | `webview` 预览命令相关、 `src/core/export/*`、GitHub Action |
| 子任务 | 定义允许 diff 的阈值。 |

### M70 — 打印边距校准工具（可选）

| 建议 PR | `feat(export): print margin calibration helper` |
|--------|----------------------------------------------|
| 路径 | `docs/` + dev command 或脚本 |
| 子任务 | 低优先级可与 M64 同迭代。 |

### M71 — 脚注/TOC/锚点三联一致

| 建议 PR | `fix(export): footnote toc anchor parity` |
|--------|------------------------------------------|
| 路径 | HTML/PDF 生成器、`docs/fixtures/m9/05-footnotes.md` |
| 子任务 | 与 M24 顺序：先 Rich footnote 再导出或并行。 |

### M72 — 代码块分页与 orphan 策略

| 建议 PR | `feat(export): code block pagination policy` |
|--------|---------------------------------------------|
| 路径 | `src/core/export/*`, CSS、测试 |
| 子任务 | 用户设置开关。 |

### M73 — 企业水印模版包雏形（可选）

| 建议 PR | `feat(templates): enterprise watermark samples` |
|--------|------------------------------------------------|
| 路径 | `docs/` + builtin template 文件夹若存在 |
| 子任务 | 法务免责模板文案。 |

---

## 阶段 H — 性能、稳定、观测

### M74 — Rich 启动 Watchdog 指标标准

| 建议 PR | `feat: rich startup watchdog metrics schema` |
|--------|---------------------------------------------|
| 路径 | `webview/src/App.vue`（已有 event 缓冲扩展）、导出到 diagnostics |
| 子任务 | 与 M05 字段兼容。 |

### M75 — 降级与强制完整渲染文案统一

| 建议 PR | `copy+logic: perf tier banners consistency` |
|--------|--------------------------------------------|
| 路径 | `App.vue`、`Toolbar`、FAQ |
| 子任务 | 与 M36–M37 图表降级交叉检查。 |

### M76 — 内存压测脚本

| 建议 PR | `tool: memory stress script for large doc` |
|--------|-------------------------------------------|
| 路径 | `scripts/memory-stress.mjs`（新）或 `webview` 调试入口、文档 |
| 子任务 | 不接 CI 或仅 nightly。 |

### M77 — Web Worker offload 路线图 + 首个试点

| 建议 PR | `spike+feat: worker offload first slice` |
|--------|-----------------------------------------|
| 路径 | `webview/src/*` 拆分 compute-heavy 模块、vite worker 配置 |
| 子任务 | Spike 文档 `docs/worker-roadmap.md`（新）。 |

### M78 — 长任务埋点与预算

| 建议 PR | `feat: longtask instrumentation` |
|--------|---------------------------------|
| 路径 | `App.vue`、`performance.mark` 封装、可选 opt-in |
| 子任务 | 隐私说明。 |

### M79 — 崩溃前草稿应急写出（可选）

| 建议 PR | `feat: emergency draft flush before crash` |
|--------|-------------------------------------------|
| 路径 | extension `workspaceState`/`globalState`、内容大小上限 |
| 子任务 | 与隐私/磁盘写频率评审。 |

### M80 — 远端资源超时与重试

| 建议 PR | `fix: unified remote fetch timeout` |
|--------|------------------------------------|
| 路径 | 图片加载、Mermaid CDN、centralize `webview/src/utils/fetch*`（新） |
| 子任务 | 与 M38、M46 一致。 |

### M81 — 编辑事件防抖/节流复核

| 建议 PR | `refactor: debounce throttle audit` |
|--------|------------------------------------|
| 路径 | `App.vue`、outline、find、Milkdown onChange |
| 子任务 | 文档列各事件频率预算。 |

### M82 — IndexedDB 离线草稿（可选）

| 建议 PR | `feat: indexeddb local draft` |
|--------|------------------------------|
| 路径 | webview idb 封装、extension 许可、设置 |
| 子任务 | 大 PR；加密可选。 |

### M83 — 升级后冒烟一键脚本

| 建议 PR | `tool: post-upgrade smoke script` |
|--------|------------------------------------|
| 路径 | `scripts/smoke.sh`（新）、`package.json` |
| 子任务 | 调用 vitest 子集 + build。 |

### M84 — Beta 报错脱敏规范

| 建议 PR | `docs+feat: beta error redaction` |
|--------|-----------------------------------|
| 路径 | diagnostics 包构建、 `docs/BETA_REDACTION.md`（新） |
| 子任务 | 与 M05 同审。 |

### M85 — 真实仓库抽样卡顿回归

| 建议 PR | `test: real-repo perf regression fixtures` |
|--------|-------------------------------------------|
| 路径 | `docs/fixtures/*` 或 git submodule 可选、CI manual |
| 子任务 | 许可证注意；仅元数据路径。 |

---

## 阶段 I — AI 与工作流

### M86 — AI 批量审计与回放 UI

| 建议 PR | `feat: ai apply history batch audit` |
|--------|-------------------------------------|
| 路径 | `webview/src/components/AiApplyHistoryPanel.vue`*, `aiApplyHistory.ts` |
| 子任务 | 与现有 history 模型扩展。 |

### M87 — 仅预览不落盘统一组件

| 建议 PR | `feat: unified ai preview modal` |
|--------|----------------------------------|
| 路径 | `App.vue`、rewrite/table convert 预览逻辑合并 |
| 子任务 | 减少重复 state。 |

### M88 — 本地模型 + 隐私勾选（可选）

| 建议 PR | `feat: optional local model provider` |
|--------|--------------------------------------|
| 路径 | extension 配置、webview bridge、 `package.json` |
| 子任务 | 独立 PR；默认关闭。 |

### M89 — 团队 Prompt 托管与署名

| 建议 PR | `feat: shared prompt pack metadata` |
|--------|-------------------------------------|
| 路径 | 工作区 `.markly/*` 约定或 settings、文档 |
| 子任务 | 与版权 M90 联动。 |

### M90 — AI 引用与版权标记

| 建议 PR | `feat: ai citation footer` |
|--------|---------------------------|
| 路径 | 插入逻辑、模版、用户设置 |
| 子任务 | 可关闭。 |

### M91 — 语气/安全策略模版库

| 建议 PR | `docs+feat: ai policy template library` |
|--------|----------------------------------------|
| 路径 | `docs/`、内置 json/yaml |
| 子任务 | i18n。 |

### M92 — 用量上限与成本告警

| 建议 PR | `feat: ai usage budget warnings` |
|--------|---------------------------------|
| 路径 | extension 计数持久化、webview 显示 |
| 子任务 | 本地估算非精确计费。 |

### M93 — Git AI modified 钩子（可选）

| 建议 PR | `docs: git hook recipe for ai modified` |
|--------|----------------------------------------|
| 路径 | `docs/GIT_HOOKS_AI.md`（新）、示例 hook 脚本 |
| 子任务 | 不强制安装。 |

### M94 — 多轮上下文裁剪配置

| 建议 PR | `feat: ai context window policy` |
|--------|-----------------------------------|
| 路径 | `App.vue` 或 extension AI 调用处、设置 |
| 子任务 | 与 token 估算 util。 |

---

## 阶段 J — IR 退场

### M95 — 「无 IR」每日构建分支

| 建议 PR | `ci: daily build branch without IR` |
|--------|------------------------------------|
| 路径 | `.github/workflows/*`, vite conditional、参考 M10 报告 |
| 子任务 | 失败 issue 自动开或通知。 |

### M96 — 删除 CM6 IR 装饰器与依赖

| 建议 PR | `refactor!: remove IR decorators bundle` |
|--------|-----------------------------------------|
| 路径 | `webview/src/core/decorators/*`, `webview/src/core/editor.ts`, `useEditor.ts`, 测试大删 |
| 子任务 | 多 PR 按目录拆：decorators → editor → tests。 |

### M97 — MAJOR：`EditorMode` 仅 rich|source

| 建议 PR | `feat!: shrink EditorMode type` |
|--------|---------------------------------|
| 路径 | `src/types/index.ts`, `messageGuards.ts`, `webview` 全量 `rg 'ir'`, `e2e/*` |
| 子任务 | 与版本号规则同步 `package.json` + `webview/package.json` + `CHANGELOG.md`。 |

### M98 — Extension 协议 preview/ir 迁移

| 建议 PR | `feat!: extension mode naming migration` |
|--------|------------------------------------------|
| 路径 | `src/core/modeController/index.ts`, `src/extension/commands/index.ts`, `customEditor.ts`, 文档 M09 |
| 子任务 | 兼容层一个版本或并行消息。 |

### M99 — 用户配置迁移

| 建议 PR | `feat: migrate user settings from ir-related keys` |
|--------|-----------------------------------------------------|
| 路径 | `src/extension/*` activation、 `package.json` contributes 清理 |
| 子任务 | 首次启动通知。 |

### M100 — 发布后 30 天 FAQ 与观察期

| 建议 PR | `docs: post-major IR removal FAQ` |
|--------|----------------------------------|
| 路径 | `docs/marketplace/FAQ.md`, `CHANGELOG.md`, 可选 blog 片段 |
| 子任务 | 链到 Rich 入门与 Source 降级 M56。 |

---

## PR 合并策略（摘要）

| 策略 | 说明 |
|------|------|
| 文档先行 | M01–M04、M07–M09 可 1～2 个 PR 合批，避免反复改同一政策文件。 |
| 测试固钉 | M12、M29、M44、M64、M69 等宜带 fixture，独立 PR 减少 flake。 |
| 破坏性变更 | M96–M99 必须 **`!` / MAJOR** 分段：先 M96 代码删，再 M97 类型，再 M98 协议，再 M99 迁移。 |
| 可选项 | 标注「可选」的里程碑（M21–M23、M32–M35、M39、M45、M48、M51–M53、M66、M70、M73、M79、M82、M88、M93）可整段推迟或砍 scope。 |

---

## 与现有计划文档的关系

以下文档可能已覆盖部分子任务，实施时避免重复开题：  
`docs/m9-rich-stability-fidelity-plan.md`, `docs/m41-large-doc-perf-plan.md`, `docs/m42-rich-table-phase2-plan.md`, `docs/m44-export-template-plan.md`, `docs/m47-ai-assist-phase1-plan.md`, `docs/product-roadmap-2026.md`。  
本文件提供 **IR 冻结 + 退场** 语境下的 **PR 切片索引**；细节以对应专题 plan 为准，冲突时以 **IR 冻结政策** 优先。
