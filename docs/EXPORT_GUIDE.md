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

