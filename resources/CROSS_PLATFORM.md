# 跨平台说明（Windows / Linux / macOS）

## 路径

- 图片保存目录 **`markly.image.saveDirectory`** 为相对 **当前 Markdown 文件** 的 POSIX 风格路径（如 `./assets`）。在 Windows 上同样推荐正斜杠；扩展会按 URI 解析。
- 导出 HTML **复制本地图片** 时，目标路径受 OS 文件系统限制；避免保留名与超长路径。

## 快捷键

- **Toggle Edit Mode**：macOS 默认为 **`Cmd+\`**，Windows / Linux 为 **`Ctrl+\`**（可在键盘快捷方式中搜索 `markly.toggleMode` 修改）。
- 与系统或其它扩展快捷键冲突时，请在 **键盘快捷方式** 中调整。

## PDF 导出

- Puppeteer 使用本机用户目录下的浏览器缓存；沙箱、只读家目录或离线环境可能导致首次失败，见 **TROUBLESHOOTING.md**。
