# Markly

> Clean, intuitive, powerful.

A WYSIWYG Markdown editor extension for VSCode — built for a seamless writing experience.

## Highlights (Marketplace)

- **Rich + Source**: Rich is the primary WYSIWYG experience; Source is a reliable fallback when needed.
- **Tables & images**: Rich table editing + paste support; image paste/drag-save with assets tools.
- **Export & supportability**: PDF/HTML export with preflight checks and copyable, sanitized diagnostics when things go wrong.
- **Mid-phase hardening**: stricter CSP, Mermaid offline-default for export preview, image assets cleanup wizard, SBOM generation.

Recent (v1.39.15): Rich fallback banner shows a copyable error snippet; export preflight warns on many local images; save failures return `SAVE_FAILED`.

## Features

- **Outline**: side panel with **heading search** (filter with ancestor path, Esc to clear) and **drag top-level sections** to reorder chapter blocks; sidebar **AI 操作** lists confirmed **selection rewrite / table-to-GFM applies** for read-back and revert (M79, see `CHANGELOG.md`)
- **Mode Switching**: Toggle between source and preview mode with one shortcut
- **WYSIWYG Editing**: What-you-see-is-what-you-get Markdown editing
- **Image Enhancements**:
  - Paste / drag-and-drop images with auto-save
  - Click-to-preview image lightbox
  - Image editing (crop, annotate, compress)
- **Rich Syntax Support**:
  - GFM (GitHub Flavored Markdown)
  - Rich table editing (Tab navigation, add/remove rows/cols, paste TSV/CSV/HTML with limits; **[表格说明](docs/RICH_TABLE_USER_GUIDE.md)**)
  - Math formulas (KaTeX)
  - Code highlighting (Shiki)
  - Diagrams (Mermaid)
- **Export**:
  - PDF export
  - HTML export
  - Export failure: sanitized diagnostics package (copy from error notification or command **Export: Copy Last Failure Diagnostics**)
  - Copy/paste: selection copy includes **HTML** for mail/IM (plain text still available)
  - **Export HTML preview** (command **Preview: Export HTML**): read-only panel matching exported HTML layout
  - **Document templates** (command **New Markdown from Template…**): built-in set + optional folder via **`markly.templates.userDirectory`**
  - Fenced code: long-line wrap / tab width; printed HTML allows code blocks to split across pages (M84)
  - Mermaid: exported HTML/PDF share the same fenced-block → inline `mermaid.min.js` + `initialize`/`run` pipeline (M85)

## Getting Started

### Install

```bash
# Install extension dependencies
npm install

# Install webview dependencies
cd webview && npm install
```

### Build

```bash
# Build everything
npm run build

# Or build separately
npm run build:extension
npm run build:webview
```

Press `F5` in VSCode to launch the extension in debug mode.

### Usage

1. Open any `.md` file
2. Press `Cmd + \` to toggle edit mode
3. Edit directly in the preview

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd + \` | Toggle source / preview mode |
| `Cmd + B` | Bold |
| `Cmd + I` | Italic |
| `Cmd + K` | Insert link |

## Configuration

Search `markly` in VSCode settings:

| Setting | Description | Default |
|---------|-------------|---------|
| `markly.image.saveDirectory` | Image save directory (relative to document) | `./assets` |
| `markly.image.compressThreshold` | Compression threshold in bytes | `512000` |
| `markly.image.compressQuality` | Compression quality (0-1) | `0.8` |
| `markly.image.sameNameHandling` | Paste/drop image filename already exists in assets: `overwrite` / `rename` / `prompt` | `rename` |
| `markly.editor.theme` | Editor theme (`auto`, `light`, `dark`) | `auto` |
| `markly.editor.fontSize` | Font size | `14` |
| `markly.editor.defaultForMarkdown` | Use Markly as default Markdown editor | `true` |
| `markly.editor.enableShiki` | 代码块 Shiki 高亮；大文档高档位不加载；Rich 创建失败会自动降级无 Shiki | `false` |
| `markly.editor.enableMermaid` | Mermaid 图表（Rich） | `true` |
| `markly.editor.richTableColumnResize` | Rich 表格列宽拖拽：`auto` 大表自动关 / `on` `off` 强制 | `auto` |
| `markly.export.pdf.format` | PDF page format | `A4` |
| `markly.export.pdf.margin` | PDF margins (mm) | 上/右/下/左各默认约 25/20/25/20 |
| `markly.export.pdf.includeToc` | PDF 是否含目录 | `true` |
| `markly.export.pdf.displayHeaderFooter` | PDF 页眉页脚 | `true` |
| `markly.export.pdf.template` | PDF 版式：`default`（GitHub 系无衬线浅色）/ `academic`（衬线、偏印刷阅读色） | `default` |
| `markly.export.html.theme` | HTML 导出主题 | `default` |
| `markly.export.html.copyLocalImages` | 导出 HTML 时将文档目录内本地图片复制到输出旁并重写引用 | `false` |
| `markly.export.html.assetsSubdirectory` | 上述复制目标子目录名（单层，不可含 `/`、`\`、`..`） | `markly-html-assets` |
| `markly.export.preflight.scope` | 导出 PDF/HTML 前预检：`off` / `images`（仅本地图）/ `full`（图 + 本地链 + 公式 `$`/`$$` 粗检） | `full` |
| `markly.export.preflight.blockOnIssues` | 有问题时是否弹窗确认后才允许导出 | `false` |
| `markly.templates.userDirectory` | 自定义模板文件夹（绝对路径或 `~/…`）；该目录下一层的 `*.md` 会出现在「从模板新建」 | （空） |
| `markly.ai.rewrite.enabled` | 是否允许选区润色（走宿主 provider） | `false` |
| `markly.ai.rewrite.provider` | `none` / `mock` / `openai-compatible` | `mock` |

选区润色使用 OpenAI 兼容端点时，用命令 **AI: Set API Key**（`markly.ai.setApiKey`）将密钥写入 SecretStorage（不会进 `settings.json`）。

### AI 与隐私（默认不上传全文）

用三句话概括：**默认关闭 AI 总开关**；**默认 `mock` 不向公网发写作内容**；只有你启用 **`openai-compatible`** 并**主动点击**某次 AI 能力时，才把当次对应的文本片段发往你配置的 Endpoint（例如侧栏「全文」摘要会带当前整篇 Markdown）。完整的数据范围表与可复述说明见：

- 命令面板：**AI: Open Privacy Notice**（`markly.ai.openPrivacyNotice`），或  
- 仓库内 [`privacy/AI_PRIVACY.md`](privacy/AI_PRIVACY.md)（与 VSIX 同路径附带）。

宿主侧写作能力已拆分为 **快照配置 + `AssistModelOperations` + HTTP 传输**（详见 `CHANGELOG` M80）：后续若要接其它 SaaS Provider，主要在扩展宿主增加装配，而不必复制四套 `fetch` 逻辑。

## Contributing / IR freeze

维护政策与 **`ir`（CodeMirror 装饰器中间模式）** 冻结约定见 **[`docs/IR_FREEZE_POLICY.md`](docs/IR_FREEZE_POLICY.md)**。产品路线图（里程碑顺序与验收要点）见：**[近期](docs/ROADMAP_NEAR.md)** · **[中期](docs/ROADMAP_MID.md)** · **[远期](docs/ROADMAP_FAR.md)**。**参与贡献**：[`CONTRIBUTING.md`](CONTRIBUTING.md)。三步排障：**[`resources/TROUBLESHOOTING.md`](resources/TROUBLESHOOTING.md)** → Webview「复制诊断」/ 导出失败「复制诊断包」→ Issue 模板（[`docs/REPRO_TEMPLATE.md`](docs/REPRO_TEMPLATE.md)）。提交 PR 前请勾选 [`.github/pull_request_template.md`](.github/pull_request_template.md)，并确保 **`npm run gates:stable`**（含 **`check:ir-freeze`**）通过。

补充文档：**Preview 导出 vs 正式导出**见 [`docs/EXPORT_PREVIEW_VS_EXPORT.md`](docs/EXPORT_PREVIEW_VS_EXPORT.md)；近期阶段的 Kickoff/Go-NoGo 记录模板见 [`docs/NEAR_KICKOFF_TEMPLATE.md`](docs/NEAR_KICKOFF_TEMPLATE.md) / [`docs/NEAR_GONOGO_TEMPLATE.md`](docs/NEAR_GONOGO_TEMPLATE.md)。

## Testing

```bash
npm test
npm run build
npm run gates:stable
```

`gates:stable` 为 **lint + 单测 + 构建 + 包体检查**，可在无桌面环境的 CI 中作为门禁。`npm run test:vscode:ui`（ExTester）依赖本机 UI 与 ChromeDriver，适合发布前手测，**不要**在无显示器的 CI 里当作必失败项；说明见 `docs/m46-stable-gates-plan.md`。表格等 Rich 关键路径亦见 `e2e/ui-suite/markly-ui.test.js`。

## Release（M₅₀）

发版前请更新根目录 **`CHANGELOG.md`**（[Keep a Changelog](https://keepachangelog.com/)），并执行 `npm run check:release` 与 `npm run gates:stable`。`check:release` 会校验根与 `webview/package.json` 的 **version** 一致（SemVer）、`repository` / `bugs` / `engines.vscode`，且 **CHANGELOG 须含当前版本的 `## [x.y.z]` 标题**。打包后若需校验根目录 **仅** 存在与版本匹配的 `.vsix`，可执行 `MARKLY_CHECK_VSIX=1 npm run check:release`。

## License

MIT
