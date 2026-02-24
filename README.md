# 简墨 (JianMo)

> 简洁轻量，智能好用

一款为用户体验而生的 VSCode Markdown 编辑器插件。

## 功能特性

- **单视图模式切换**: 源码模式 / 预览模式 一键切换
- **WYSIWYG 编辑**: 所见即所得的 Markdown 编辑体验
- **图片功能增强**:
  - 粘贴/拖拽图片自动保存
  - 点击图片弹窗预览
  - 图片编辑（裁剪/标注/压缩）
- **语法支持**:
  - GFM (GitHub Flavored Markdown)
  - 数学公式 (KaTeX)
  - 代码高亮 (Shiki)
  - 图表 (Mermaid)
- **导出功能**:
  - PDF 导出
  - HTML 导出

## 快速开始

### 安装依赖

```bash
# 安装扩展依赖
npm install

# 安装 Webview 依赖
cd webview && npm install
```

### 开发模式

```bash
# 构建扩展
npm run build:extension

# 构建 Webview
npm run build:webview

# 或一次性构建
npm run build
```

在 VSCode 中按 `F5` 启动调试。

### 使用

1. 打开任意 `.md` 文件
2. 按 `Cmd + \` 切换编辑模式
3. 在预览模式下直接编辑内容

## 快捷键

| 快捷键 | 功能 |
|-------|------|
| `Cmd + \` | 切换源码/预览模式 |
| `Cmd + B` | 加粗 |
| `Cmd + I` | 斜体 |
| `Cmd + K` | 插入链接 |

## 配置

在 VSCode 设置中搜索 `jianmo` 进行配置：

- `jianmo.image.saveDirectory`: 图片保存目录
- `jianmo.image.compressThreshold`: 图片压缩阈值
- `jianmo.editor.theme`: 编辑器主题
- `jianmo.export.pdf.format`: PDF 页面格式

## 项目结构

```
jianmo-markdown/
├── src/
│   ├── extension/        # VSCode 扩展层
│   ├── core/             # 核心层（模式控制、文档状态）
│   ├── editor/           # 编辑器层
│   ├── plugins/          # Milkdown 插件
│   ├── image/            # 图片模块
│   ├── services/         # 服务层（导出等）
│   └── types/            # 类型定义
├── webview/              # WebView 前端
│   └── src/
│       └── components/   # Vue 组件
├── docs/                 # 文档
└── dist/                 # 构建输出
```

## 文档

- [PRD 文档](docs/v2/01-prd-md-editor-plugin.md)
- [架构设计](docs/v2/02-architecture/)

## 开发路线

- [x] Phase 1: MVP - 基础编辑、模式切换、图片显示
- [ ] Phase 2: 图片增强 - 弹窗预览、图片编辑
- [ ] Phase 3: 完善功能 - 数学公式、代码高亮、图表
- [ ] Phase 4: 导出与优化 - PDF/HTML 导出、性能优化

## License

MIT
