# Markly Markdown 渲染方案

本文描述 Markly（仓库名 jianmo，版本 **2.2.1**）怎样把一篇 Markdown 画成可读的页面。写给要为 **dsh** 做「渲染它所产生的 Markdown 文档和结果」的插件作者：按本文可以复现同一套只读渲染，不必先读完整仓库。

文中的路径都相对于本仓库根目录。

## 结论

dsh 只要「把 Markdown 画出来」，复用 **只读预览管线**，不要搬所见即所得编辑器。

权威实现是扩展宿主（Node）里的两个函数：

- `markdownToHtml`：Markdown 字符串 → 正文 HTML 片段
- `buildExportHtmlString` / `buildHtmlDocument`：正文片段 → 带样式、目录、公式字体、图表脚本的完整 HTML 页

源码：`src/core/export/htmlExport.ts`。

同一条管线服务四处：

| 使用处 | 入口 |
|---|---|
| VS Code 编辑器里的「预览」 | `src/extension/preview/exportHtmlPreview.ts` 的 `buildInlinePreviewHtmlForCustomWebview` |
| VS Code 侧栏「导出预览」 | 同文件的 `showExportHtmlPreviewPanel` |
| 导出 HTML 文件、导出 PDF | `exportToHtml`、`src/core/export/pdfExport.ts`（PDF 用同一份 HTML，再交给 Puppeteer 打印） |
| Electron 独立预览窗口 | `app/electron/hostBridge.ts` |

浏览器里的编辑界面自己不跑这条管线。它向宿主要 HTML，宿主算完再塞进 iframe。

## 系统里的三种模式

| 模式 | 用户看到什么 | 技术 | 插件要不要 |
|---|---|---|---|
| 预览 Preview | 只读排版页 | marked + KaTeX + Shiki + Mermaid | 要。这就是渲染方案 |
| 富文本 Rich | 可编辑的所见即所得，存盘仍是 Markdown | Milkdown 7 / ProseMirror | 只有要做编辑器才需要 |
| 源码 Source | 等宽字体的原始 Markdown | CodeMirror 6 | 不渲染，可忽略 |

2.0 已去掉旧的 IR 模式。遗留状态里的 `ir` 会当成源码模式。

## 只读渲染的固定顺序

`markdownToHtml(markdown, { codeTheme: 'light' | 'dark' })` 严格按下面七步执行。顺序不能颠倒：公式必须在 Markdown 解析之前替换，代码高亮必须在图表转换之前，而且高亮不能改掉外层 `<pre><code>` 标签，否则图表步骤认不出 Mermaid 围栏。

### 1. 保护代码围栏

把每一段 ` ``` ... ``` ` 整段换成占位符 `@@MARKLY_CODE_BLOCK_n@@`，记下来。下一步的公式替换不能进入代码块，否则代码里的 `$` 会被当成公式。公式处理完再按序号还原。

围栏识别用的是成对的 ` ``` `（三个反引号）。` ~~~ ` 围栏不在这套保护里。

### 2. 公式（KaTeX 0.16）

在已保护代码块的文本上做两次替换：

- `$$ ... $$`（可跨行）→ 块级公式
- 单行 `$ ... $` → 行内公式。前面不能再是 `$`，这样 `$$` 不会被拆成两个行内公式

调用：

```js
katex.renderToString(expr, {
  displayMode,          // 块级 true，行内 false
  throwOnError: false,
  strict: false,
  output: 'htmlAndMathml',
})
```

某一条公式失败时，退回 `<code>$$原文$$</code>` 或 `<code>$原文$</code>`，不让整篇渲染失败。页面头部要带上 `katex/dist/katex.min.css`，否则公式只有 DOM、没有排版。

富文本编辑器里公式**不**渲染，仍是 `$...$` 文本。KaTeX 只在预览和导出里生效。

### 3. Markdown 转 HTML（marked，GFM）

```js
marked.parse(segment, { gfm: true, breaks: true })
```

- `gfm: true`：表格、任务列表（`- [ ]` / `- [x]`）、删除线 `~~`、自动链接。
- `breaks: true`：单个换行变成 `<br>`。这和 CommonMark「单个换行仍是同一段」不同，是本系统的明确选择。插件若要和 Markly 看起来一致，必须打开 `breaks`。

正文超过约 **256KB** 时按行切开再解析，降低一次解析的内存峰值。切开时如果正处在 ` ``` ` 围栏内部，就继续累积，直到围栏结束。只认行首 ` ``` `，不处理 ` ~~~ `。

预览实际跑的是**扩展宿主**的 marked（`package.json` 里 `^12.0.2`）。网页包里另有 marked `^17.0.5`，只用于剪贴板，不负责预览。新插件请钉死一个版本，不要混用。

### 4. 标题锚点

解析完成后再给 `<h1>`–`<h6>` 补 `id`。标签上已经有 `id` 的保留。

id 的规则在 `src/core/export/headingAnchor.ts`，目录、大纲、预览跳转必须同一套，否则点击对不上：

1. 标题末尾写了 `{#自定义-id}` 时，用这个自定义 id。它是锚点语法，不出现在可见文字和目录文案里。
2. 否则用可见文字做 slug：去掉图片/链接/行内代码/粗体/斜体/删除线，转小写，保留中文和单词字符，空白折成一个 `-`，去掉首尾 `-`。
3. 都拿不到时用 `markly-h-序号`。序号从 1 起，按标题在文中出现的顺序。

标题内层的强调、行内代码、链接原样保留，只补 `id`。算 slug 和目录纯文本时，要剥掉 KaTeX 的 MathML 朗读层（`<span class="katex-mathml">...</span>`），避免同一公式被读两遍。

目录在 Markdown 解析**之前**从原文扫描 `#` 标题生成，围栏里的 `#` 不算标题。Mermaid 图也会进目录，链到下一节的图表 id。

### 5. 代码高亮（Shiki）

只替换 `<pre><code class="language-xx">...</code></pre>` 的**内层**。开标签和闭标签逐字留下。

- 亮色主题 `github-light`，暗色主题 `github-dark`。预览默认亮色。
- **跳过 `language-mermaid`**，留给下一步。
- 语言不认识、高亮器加载失败、或高亮抛错：保留原来的代码块。导出不能因为高亮失败而中断。
- 先把 marked 转义过的 `&lt; &gt; &amp;` 还原成源码，再交给 Shiki，最后只取它产出的 `<code>` 内层 HTML。

常见别名（不完整列举）：`js/mjs/cjs/jsx` → javascript，`ts/tsx` → typescript，`py/python3` → python，`sh/zsh/shell/console` → bash，`yml` → yaml，`md` → markdown，`c++` → cpp，`cs/c#` → csharp，`rs` → rust，`golang` → go。

### 6. Mermaid 图

把 marked 产出的：

```html
<pre><code class="language-mermaid">...</code></pre>
```

换成：

```html
<div id="markly-diagram-N"
     class="mermaid markly-mermaid-await"
     role="img"
     aria-roledescription="diagram"
     aria-label="说明文字"
     data-markly-mermaid-index="N">图的源码</div>
```

- `N` 从 1 起，按文中 ` ```mermaid ` 围栏的出现顺序。id 前缀固定为 `markly-diagram-`。
- 围栏内第一条 `%% alt: 说明`（大小写不敏感）用作 `aria-label` 和目录文字。没有则标签为「Mermaid 图表」，目录文字为「图表 #N」。
- 放进 HTML 文本节点时只转义 `&` 和 `<`。Mermaid 语法里的 `>` 要保留。
- **图不在 Node 里画。** 浏览器脚本稍后 `mermaid.run()`。

### 7. 包成完整 HTML 页

`buildHtmlDocument` 产出的页面大致是：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>文档标题</title>
  <style>/* katex.min.css + mermaid 容器样式 + 导出排版 */</style>
</head>
<body>
  <nav class="toc">...</nav>          <!-- includeToc 为真且文中有标题或图时 -->
  <div class="content">正文 HTML</div>
  <script>/* 锚点跳转、代码复制、表格滚动、标题锚点链接 */</script>
  <script>/* mermaid.min.js + initialize + run */</script>
</body>
</html>
```

排版样式在 `src/core/export/exportHtmlStyle.ts`，导出 HTML、预览、桌面端共用。可选 `htmlTheme: 'print-friendly'`，版心更接近打印。

页内脚本是渐进增强：脚本被禁时正文仍然可读。它做四件事：

1. 拦截 `#锚点` 点击，用 `window.scrollTo` 跳到对应 id，顶部留 16px。iframe 沙箱里 `scrollIntoView` 不可靠，所以用 `scrollTo`。父页面也可以 `postMessage({ type: 'SCROLL_TO_HEADING', headingId })` 要求跳转。
2. 每个 `<pre>` 外包 `.markly-codeblock`，显示语言名和「复制」按钮。
3. 每个 `<table>` 外包 `.markly-table-wrap`，宽表可以横向滚动。
4. 有 id 的标题前插入一个 `#` 锚点链接。

Mermaid 启动脚本：

```js
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',   // 暗色导出用 'dark'
  securityLevel: 'strict',
})
mermaid.run({ querySelector: '.markly-mermaid-await' })
```

脚本两种打包方式：

- `embedded`（预览固定用这个）：把 `mermaid@11.14.0` 的 `mermaid.min.js` 内联进页面，离线可用。
- `external`：改为 `<script src="https://cdn.jsdelivr.net/npm/mermaid@11.14.0/dist/mermaid.min.js">`，HTML 更小，需要联网。

预览和「结果展示」应使用 `embedded` + `securityLevel: 'strict'`。富文本编辑器里为了流程图文字用过 `loose`，那只属于编辑器，不要用在对外展示的页面上。

## 图片

`![说明](相对路径.png)` 经 marked 变成 `<img src="相对路径">`。iframe 的 `srcdoc` 解析不了相对路径，宿主必须在交给 iframe 之前改写 `src`。

安全约束：只改写落在**文档所在目录之内**的本地文件。`../` 逃出目录的路径保持原样，不读盘。`http(s):`、`data:`、`blob:` 不动。

三种宿主做法：

| 场景 | 做法 | 代码 |
|---|---|---|
| VS Code 预览 | 改成 webview 可加载的 URI，并给页面加上内容安全策略 | `src/core/export/htmlPreviewImgRewrite.ts` |
| Electron 窗口 | 读入内存，变成 data URL。单张上限 8MB，超限或读失败就留原地址 | `app/electron/previewImages.ts` |
| 导出 HTML 文件（可选） | 复制到输出旁边的 `markly-html-assets/`，再改 `src` | `src/core/export/htmlBundleImages.ts` |

支持内联的常见类型：png、jpg、jpeg、gif、webp、svg、bmp、ico、avif。

VS Code 预览的内容安全策略大意是：默认拒绝；样式和脚本允许内联（页面自带样式和 Mermaid）；图片允许 webview 自身、https、http、data、blob；字体允许 data。

## 宿主和页面怎么通信

浏览器侧发一条消息，宿主用上面的管线算完再回传。类型定义在 `src/types/index.ts`。

请求：

```json
{ "type": "REQUEST_PREVIEW_HTML" }
```

成功：

```json
{ "type": "PREVIEW_HTML", "payload": { "html": "<!DOCTYPE html>..." } }
```

失败：

```json
{ "type": "PREVIEW_HTML", "payload": { "error": "原因" } }
```

展示方式：把 `html` 设为 iframe 的 `srcdoc`。

- VS Code 内嵌预览：`sandbox="allow-scripts allow-same-origin"`，`referrerpolicy="no-referrer"`。
- Electron 预览：`sandbox="allow-scripts allow-popups"`，另外套一层编辑器字体和明暗配色（`app/electron/previewTheme.ts`）。

复制到系统剪贴板是一条更短的路，只用 `marked.parse`，不跑 KaTeX、Shiki、Mermaid。实现：`webview/src/utils/richClipboard.ts`。同时写入 `text/plain`（原始 Markdown）和 `text/html`。

## 富文本编辑器（插件默认不要搬）

只在 VS Code 扩展的 Rich 模式里，组件是 `webview/src/components/MilkdownEditor.vue`。它解决的是「边写边看、存回去仍是 Markdown」，不是「把一篇结果文档画出来」。

装配顺序：

1. Milkdown `Editor.make()`，根节点是页面上的 `.milkdown-editor`，初始值是整篇 Markdown。
2. `@milkdown/preset-commonmark`：标题、段落、列表、引用、代码、链接、图片、分隔线等 CommonMark。
3. `@milkdown/preset-gfm`：表格、任务列表、删除线。列宽拖拽默认开启，大表可以关掉。
4. 自写的表格键盘、纯文本粘贴、表格粘贴、列表缩进、gap cursor。
5. 可选 Shiki 高亮插件。要同时满足「用户打开了语法高亮」和「性能档位是 0」。大文档不加载。加载失败会丢掉 Shiki 再创建一次编辑器。动态 `import`，不打进首包。语言收得很窄：plaintext、markdown、javascript、typescript、json、html、css、bash、python。主题同样是 github-light / github-dark。
6. `remark-gfm`、撤销历史、复制时附带 HTML。
7. 创建成功后听 `markdownUpdated`：用户一改，用 Milkdown 的 `serializerCtx` 把 ProseMirror 文档序列化回 Markdown 字符串。这串字符串才是保存内容。外部把新 Markdown 灌回来时要防抖，并忽略「刚由自己发出去的那一版」，避免光标跳动。

编辑器里的 Mermaid 是后处理，不是导出那条 HTML 转换：

- 编辑器先可交互，空闲时再加载 `mermaid@11.14.0`。
- `startOnLoad: false`，`securityLevel: 'loose'`（仅编辑器），`htmlLabels: true`。
- 用 `IntersectionObserver` 等 `pre.language-mermaid` 进入视口再 `mermaid.render`，SVG 按源码缓存。
- 性能档位 ≥ 2 时不渲染图。
- 失败时留下源码，并提示检查语法或网络。

相对路径图片：ProseMirror 会把 `src` 留成相对路径，浏览器会相对 webview 的 `index.html` 去加载而 404。挂上「文档目录对应的 baseUrl」之后，把相对 `src` 改写成可加载地址。`http(s):`、`data:`、`file:`、`blob:` 以及已经是 webview 资源的地址不动。

`webview/src/components/MathRenderer.vue` 能用 KaTeX 画一条公式，但当前没有任何地方引用它。不要把它当成富文本的公式方案。

源码模式是 CodeMirror 6 的 `markdown()` 加按标题折叠，只显示原文。复制选区时同样附一份 marked 生成的 HTML。

## 依赖版本

版本写在两个 `package.json` 里，宿主和网页包并不一致。预览、导出以**宿主**为准。

| 用途 | 扩展宿主（预览/导出实际使用） | 网页包（编辑器 / 剪贴板） |
|---|---|---|
| Markdown 解析 | marked `^12.0.2` | marked `^17.0.5` |
| 公式 | katex `^0.16.9` | katex `^0.16.9` |
| 图 | mermaid `^11.14.0` | mermaid 精确 `11.14.0` |
| 代码高亮 | shiki `^1.0.0` | shiki `^3.2.0` |
| 所见即所得 | 无 | `@milkdown/core` 等 `^7.16.0` |
| 界面 | — | Vue `^3.4.0` |
| 源码编辑 | — | CodeMirror 6 |

CDN 与内嵌脚本都锁定 mermaid **11.14.0**。升级主版本要同时改编辑器、导出脚本和页面里的 class 约定。

## 给 dsh 插件的实现建议

目标：dsh 产出一篇 Markdown（含运行结果、表格、代码、公式、图），插件把它画成只读页。

建议做成：

1. **宿主侧一个函数**，签名等价于 `markdownToHtml` + `buildHtmlDocument`。输入是 Markdown 字符串和「结果文件所在目录」。输出是完整 HTML 字符串，或一条错误信息。
2. **严格保持七步顺序**：围栏保护 → KaTeX → marked（`gfm: true`，`breaks: true`）→ 标题 id → Shiki（跳过 mermaid，失败回退）→ Mermaid 容器 → 整页。
3. **图片由 dsh 宿主改写**。限制在该次结果的目录内。桌面或本地插件用 data URL（建议沿用 8MB 上限）；如果运行在带自己资源协议的壳里，改成那个协议的 URL。
4. **用 iframe（或等价沙箱）展示**。允许脚本，这样 Mermaid 和锚点跳转能工作。Mermaid 用 `securityLevel: 'strict'`，脚本内嵌 `mermaid@11.14.0`，不依赖 CDN。
5. **任何增强步骤失败都退回原文**：一条坏公式、一种不认识的语言、一张读不到的图，都不能让整篇空白。
6. **标题 id 用 `{#id}` / slug / `markly-h-n`**，图表 id 用 `markly-diagram-N`。这样目录点击和正文是同一套地址。
7. 若还要把选区复制到邮件或聊天窗口，另走一条只调用 marked 的短路径，纯文本和 HTML 一起写入剪贴板。

不需要实现的部分：Milkdown、ProseMirror、工具栏、撤销、表格列宽、性能分档、VS Code 的 `postMessage` 全套协议。那些都属于编辑器。

### 建议钉死的依赖

```json
{
  "marked": "12.0.2",
  "katex": "0.16.29",
  "shiki": "1.29.2",
  "mermaid": "11.14.0"
}
```

这四条是本仓库宿主锁文件里正在使用的版本。不要改用网页包的 marked 17 或 shiki 3，除非你准备自己对一下 HTML 形状。

### 验收时至少看这些输入

- 标题、列表、引用、链接、图片、分隔线。
- GFM 表格、任务列表、删除线；单个换行变成换行而不是并进同一段。
- 行内 `$E=mc^2$` 与块级 `$$...$$`；代码块里的 `$` 保持原样。
- 带语言的代码块有颜色；未知语言仍是普通代码块。
- ` ```mermaid ` 变成可缩放的图；源码第一行 `%% alt: 名字` 出现在目录里；坏掉的图不弄空白页。
- 标题 `{#my-id}` 的链接是 `#my-id`，可见文字里没有 `{#my-id}`。
- 文档目录内的 `./fig.png` 能显示；`../` 逃出目录的路径不被读取。
- 关掉页面脚本后，标题、段落、表格、代码原文仍在。

## 源码索引

| 做什么 | 文件 |
|---|---|
| 渲染主流程 | `src/core/export/htmlExport.ts` |
| 标题 id | `src/core/export/headingAnchor.ts` |
| 代码高亮 | `src/core/export/codeHighlight.ts` |
| Mermaid 转换与启动脚本 | `src/core/export/mermaidExport.ts`、`src/core/export/mermaidFenceUtils.ts` |
| 导出排版 | `src/core/export/exportHtmlStyle.ts` |
| 预览时改写本地图片 | `src/core/export/htmlPreviewImgRewrite.ts` |
| 导出时复制本地图片 | `src/core/export/htmlBundleImages.ts` |
| VS Code 预览怎么套这条管线 | `src/extension/preview/exportHtmlPreview.ts` |
| 编辑器里请求预览 | `src/extension/provider/customEditor.ts`（`REQUEST_PREVIEW_HTML`） |
| 桌面端怎么套同一条管线 | `app/electron/hostBridge.ts`、`app/electron/previewImages.ts` |
| 富文本编辑器 | `webview/src/components/MilkdownEditor.vue` |
| 编辑器里的 Mermaid 初始化参数 | `webview/src/config/mermaid.ts` |
| 剪贴板用的短路径 | `webview/src/utils/richClipboard.ts` |
| 消息类型 | `src/types/index.ts` |

## 容易踩错的地方

- 用网页包的 marked 17 去对宿主预览的结果，换行、表格和 HTML 形状可能对不上。预览以宿主的 marked 12 为准。
- 先高亮再识别 Mermaid，或高亮时改写了外层 `<pre><code class="language-mermaid">`，图会消失，只剩一块彩色源码。
- 公式替换没先摘掉代码围栏，代码示例里的 `$` 会被吃掉。
- 在 iframe `srcdoc` 里留相对图片路径，图片全部 404。
- 为了省事把 Mermaid 设成 `securityLevel: 'loose'` 或 `startOnLoad: true`。展示页用 `strict`，并且只 `run` 带 `.markly-mermaid-await` 的节点。
- 标题 id 另写一套 slug。目录、大纲、正文锚点必须调用同一套规则。
- 把 Milkdown 的序列化结果当成「标准 HTML」。编辑器存的是 Markdown；HTML 只在预览和导出时现算，而且不保证和原文逐字符来回一致。
