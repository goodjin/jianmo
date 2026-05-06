# M151–M160：导出与交付（用户指南）

这份文档把 Markly 的导出相关设置和取舍讲清楚，方便你在「离线可用 / 体积更小 / 更安全 / 更容易排障」之间做选择。

## 1. 我该选哪种导出？

- **导出 PDF**：适合发给别人阅读/打印；体积较大、耗时更长，但视觉更稳定。
- **导出 HTML**：适合发网页/本地打开；可选把本地图片一起打包，或保持外链。

## 2. 最常用的导出设置（推荐组合）

### 2.1 Mermaid 图表脚本（`markly.export.diagram.mermaidScriptBundling`）

- **`embedded`（默认，推荐离线）**：把 Mermaid 脚本内联进导出 HTML/PDF 渲染链路，**离线可用**，文件更大。
- **`external`（推荐“更小文件”）**：HTML 导出引用外部脚本（通常是 CDN），导出 HTML 更小，但**需要联网**才能渲染图表。

### 2.2 HTML 导出打包本地图片（`markly.export.html.copyLocalImages`）

- **`false`（默认）**：保持原始相对路径，适合“同目录打开”或你自己本地用。
- **`true`**：把文档目录内的本地图片复制到 HTML 输出旁的子目录，并重写 `<img src>`，更适合“发给别人”。

配套项：
- `markly.export.html.assetsSubdirectory`：指定输出旁的图片子目录名（单层目录）。

### 2.3 导出前预检（`markly.export.preflight.*`）

- **`markly.export.preflight.scope`**
  - `off`：不检查
  - `images`：只检查图片相关（缺失本地图/远端 host）
  - `full`（默认）：图片 + 本地链接 + 数学公式分隔符粗检
- **`markly.export.preflight.blockOnIssues`**
  - `false`（默认）：发现问题会提示，但允许继续
  - `true`：发现问题会阻止继续（适合团队门禁/交付前）

### 2.4 远端图片 host 白名单（`markly.image.remoteHttpsHostsAllowlist`）

当白名单 **非空** 时，导出预检会对 `![](https://...)` 做校验：

- **精确 host**：例如 `example.com`
- **受控通配（M133）**：`*.example.com`，允许 `a.example.com` / `b.example.com` 等子域（也允许根域 `example.com`）

## 3. 导出失败怎么自救？

当 PDF/HTML 导出失败时，Markly 会给出可复制的“导出失败诊断包”（路径已脱敏），建议直接粘贴到 issue。

如果导出耗时很长：
- 命令面板导出支持 **取消**（M156）：取消后会尽快停止当前导出流程（best-effort）。

## 4. 安全说明（M159，尽量说人话）

- **外链脚本**（例如 Mermaid `external`）意味着导出 HTML 打开时会访问网络资源。  
  - 好处：文件更小  
  - 风险：离线打不开图表；企业环境可能被拦截；也会把“你打开了这个 HTML”暴露给外部站点
- **内联脚本**（`embedded`）更适合离线与可控交付。
- 导出失败诊断包会对常见本地路径做脱敏（不会把你的用户目录完整路径直接暴露出来）。

## 5. 导出相关 `markly.*` 设置索引（M252）

| 设置键 | 作用摘要 |
|--------|----------|
| `markly.export.diagram.mermaidScriptBundling` | Mermaid 脚本 embedded（离线）/ external（小体积、需联网） |
| `markly.export.html.theme` | 导出 HTML 主题 |
| `markly.export.html.copyLocalImages` | 是否拷贝本地相对图片到 HTML 输出旁 |
| `markly.export.html.assetsSubdirectory` | 拷贝图片子目录名（单层） |
| `markly.export.preflight.scope` | 预检关 / 仅图 / 全量 |
| `markly.export.preflight.blockOnIssues` | 有问题时是否模态阻断导出 |
| `markly.export.pdf.*` | 版式、边距、目录、页眉页脚、`template` 等 |
| `markly.image.remoteHttpsHostsAllowlist` | 非空时预检校验 `![](https://…)` 的 host（支持 `*.example.com`） |

编辑器侧与导出正交但常一起调整：

| 设置键 | 作用摘要 |
|--------|----------|
| `markly.editor.enableMermaid` | Rich 内是否启用 Mermaid 动态渲染 |
| `markly.editor.deferDiagramRenderInRich` | Rich 内延迟/跳过 Mermaid 初始化（仍保留围栏；导出不受影响） |

## 6. 大批量图片与内存（M264）

导出 HTML/PDF 时，若一篇文档引用**极多**超大本地图，峰值内存与耗时会上升。建议：先压缩图片、分拆文档，或暂时将预检设为 `images`/`off` 做对比试验；团队交付可配合 `blockOnIssues` 做门禁。

当 Markdown 中出现**不少于 50 个不同的本地相对图片路径**引用时，`images`/`full` 导出预检会额外给出「大量本地图」提示（不改变导出语义，仅供参考）。

