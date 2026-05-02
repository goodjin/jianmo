# Markly

> Clean, intuitive, powerful.

A WYSIWYG Markdown editor extension for VSCode — built for a seamless writing experience.

## Features

- **Mode Switching**: Toggle between source and preview mode with one shortcut
- **WYSIWYG Editing**: What-you-see-is-what-you-get Markdown editing
- **Image Enhancements**:
  - Paste / drag-and-drop images with auto-save
  - Click-to-preview image lightbox
  - Image editing (crop, annotate, compress)
- **Rich Syntax Support**:
  - GFM (GitHub Flavored Markdown)
  - Rich table editing (Tab navigation, add/remove rows/cols, paste TSV/CSV with safety limits)
  - Math formulas (KaTeX)
  - Code highlighting (Shiki)
  - Diagrams (Mermaid)
- **Export**:
  - PDF export
  - HTML export

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
| `markly.editor.theme` | Editor theme (`auto`, `light`, `dark`) | `auto` |
| `markly.editor.fontSize` | Font size | `14` |
| `markly.editor.defaultForMarkdown` | Use Markly as default Markdown editor | `true` |
| `markly.export.pdf.format` | PDF page format | `A4` |
| `markly.export.pdf.margin` | PDF margins (mm) | 上/右/下/左各默认约 25/20/25/20 |
| `markly.export.pdf.includeToc` | PDF 是否含目录 | `true` |
| `markly.export.pdf.displayHeaderFooter` | PDF 页眉页脚 | `true` |
| `markly.export.html.theme` | HTML 导出主题 | `default` |
| `markly.ai.rewrite.enabled` | 是否允许选区润色（走宿主 provider） | `false` |
| `markly.ai.rewrite.provider` | `none` / `mock` / `openai-compatible` | `mock` |

选区润色使用 OpenAI 兼容端点时，用命令 **AI: Set API Key**（`markly.ai.setApiKey`）将密钥写入 SecretStorage（不会进 `settings.json`）。

## Testing

```bash
npm test
npm run build
npm run gates:stable
```

`gates:stable` 为 **lint + 单测 + 构建 + 包体检查**，可在无桌面环境的 CI 中作为门禁。`npm run test:vscode:ui`（ExTester）依赖本机 UI 与 ChromeDriver，适合发布前手测，**不要**在无显示器的 CI 里当作必失败项；说明见 `docs/m46-stable-gates-plan.md`。

## License

MIT
