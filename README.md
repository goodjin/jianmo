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

## License

MIT
