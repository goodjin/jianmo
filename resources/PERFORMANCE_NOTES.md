# 启动与首次打开 Markdown

## 激活（Activation）

扩展在以下情况激活：`onCustomEditor:markly.preview`、`onLanguage:markdown`、部分命令与 **Getting Started 引导**（`onWalkthrough:markly.welcome`）等。首次用 Markly 打开 `.md` 会加载自定义编辑器与 webview 资源。

## 减轻首次开销

1. 无需改设置即可：第二次打开同工作区通常更快（缓存）。
2. 大文档：Rich 模式会按 **档位** 自动降级 Shiki / Mermaid / 表格列宽等；可在设置中默认关闭 Shiki。
3. **PDF 导出**首次可能触发 Puppeteer 准备浏览器环境，与「仅打开编辑器」分离。

以上为用户可见提示的工程摘要；细节以代码与测评为准。
