# Markdown 格式协议深度研究

## 一、协议概述

### 1.1 历史演进

| 阶段 | 时间 | 说明 |
|------|------|------|
| 原始 Markdown | 2004 | John Gruber 创建，用于将文本转换为 HTML |
| CommonMark | 2014 | 标准化版本，解决原始规范歧义问题 |
| GFM | 2017 | GitHub 扩展版本，成为事实标准 |
| Markdown IT / Math | 2022+ | 数学公式、更多扩展支持 |

### 1.2 协议层级关系

```
原始 Markdown (2004)
       ↓
CommonMark (2014) - 核心规范
       ↓
GFM (2017) - CommonMark + 表格/任务列表/删除线/自动链接
       ↓
扩展 Markdown - 数学公式/图表/脚注/高亮等
```

---

## 二、CommonMark 核心规范

### 2.1 块级元素 (Block Elements)

#### 2.1.1 标题 (Headings)

**语法：**
```markdown
# 一级标题
## 二级标题
### 三级标题
#### 四级标题
##### 五级标题
###### 六级标题

一级标题
========

二级标题
--------
```

**规范要点：**
- `#` 后必须有空格
- 支持 1-6 级标题
- Setext 风格（下划线）只支持 1-2 级
- ATX 风格（`#`）可闭合（`# 标题 #`）

**渲染效果：** 转换为 `<h1>` 到 `<h6>` HTML 标签

---

#### 2.1.2 段落 (Paragraphs)

**语法：**
```markdown
这是第一段。

这是第二段。
```

**规范要点：**
- 一个或多个空行分隔段落
- 单个换行符不产生新段落
- 段落内连续空格会被压缩

**渲染效果：** 转换为 `<p>` 标签

---

#### 2.1.3 引用块 (Block Quotes)

**语法：**
```markdown
> 这是一级引用
>
> > 这是嵌套引用
>
> 回到一级引用
```

**规范要点：**
- `>` 后可省略空格
- 支持多层嵌套
- 可包含其他块级元素

**渲染效果：** 转换为 `<blockquote>` 标签

---

#### 2.1.4 列表 (Lists)

**无序列表：**
```markdown
- 项目一
- 项目二
  - 嵌套项目
* 也可以用星号
+ 或加号
```

**有序列表：**
```markdown
1. 第一项
2. 第二项
   1. 嵌套项
5. 数字不需要连续（渲染时自动递增）
```

**规范要点：**
- 无序列表可用 `-`、`*`、`+`
- 有序列表数字后跟 `.` 或 `)`
- 嵌套需要 2-4 空格缩进
- 列表项间空行产生 `<p>` 包装

**渲染效果：**
- 无序列表：`<ul>` + `<li>`
- 有序列表：`<ol>` + `<li>`

---

#### 2.1.5 代码块 (Code Blocks)

**Fenced 风格：**
```markdown
```javascript
function hello() {
  console.log("Hello");
}
```
```

**缩进风格：**
```markdown
    缩进4个空格
    形成代码块
```

**规范要点：**
- Fenced 使用 3 个或更多反引号
- 可指定语言标识符
- 缩进风格需要 4 空格或 1 Tab

**渲染效果：**
- 转换为 `<pre><code>`
- 语言标识符通常作为 class

---

#### 2.1.6 分隔线 (Thematic Breaks)

**语法：**
```markdown
---

***

___

* * *
```

**规范要点：**
- 3 个或更多 `-`、`*`、`_`
- 可包含空格
- 不能有其他字符

**渲染效果：** 转换为 `<hr>` 标签

---

### 2.2 行内元素 (Inline Elements)

#### 2.2.1 强调 (Emphasis)

**语法：**
```markdown
*斜体* 或 _斜体_
**粗体** 或 __粗体__
***粗斜体*** 或 ___粗斜体___
```

**规范要点：**
- `*` 和 `_` 效果相同
- 不能用空格分隔
- 可以嵌套

**渲染效果：**
- 斜体：`<em>`
- 粗体：`<strong>`

---

#### 2.2.2 行内代码 (Inline Code)

**语法：**
```markdown
`code`
``包含反引号 ` 的代码``
```

**规范要点：**
- 单反引号包裹
- 内含反引号时用双反引号
- 空格分隔内部反引号

**渲染效果：** 转换为 `<code>` 标签

---

#### 2.2.3 链接 (Links)

**行内链接：**
```markdown
[链接文字](https://example.com "标题")
```

**引用链接：**
```markdown
[链接文字][ref]

[ref]: https://example.com "标题"
```

**自动链接：**
```markdown
<https://example.com>
<email@example.com>
```

**规范要点：**
- 方括号包裹文字
- 圆括号包裹 URL
- 可选标题用双引号
- 引用定义可放文档任意位置

**渲染效果：** 转换为 `<a href="...">` 标签

---

#### 2.2.4 图片 (Images)

**语法：**
```markdown
![替代文字](image.png "标题")

![替代文字][ref]

[ref]: image.png "标题"
```

**规范要点：**
- 与链接语法类似，前面加 `!`
- 替代文字用于无障碍访问
- 不支持尺寸调整（需 HTML）

**渲染效果：** 转换为 `<img src="..." alt="...">` 标签

---

## 三、GFM 扩展规范

### 3.1 表格 (Tables)

**语法：**
```markdown
| 左对齐 | 居中 | 右对齐 |
| :--- | :---: | ---: |
| 内容 | 内容 | 内容 |
| 长内容 | 长内容 | 长内容 |
```

**规范要点：**
- 分隔行定义对齐方式
- `:---` 左对齐，`:---:` 居中，`---:` 右对齐
- 列数不需要对齐（自动填充/截断）
- 单元格内支持行内格式

**渲染效果：**
```html
<table>
  <thead><tr><th align="left">...</th></tr></thead>
  <tbody><tr><td align="left">...</td></tr></tbody>
</table>
```

**编辑器能力边界：**
- ✅ 基础表格渲染
- ✅ 对齐支持
- ✅ **Rich** 模式下支持合并 / 拆分等结构操作（保存形态以 GFM 序列化为准；用户使用说明见 **`docs/RICH_TABLE_USER_GUIDE.md`**）
- ❌ Excel 级复杂排版（不推荐在本扩展内追求完整等价）

---

### 3.2 任务列表 (Task Lists)

**语法：**
```markdown
- [x] 已完成任务
- [ ] 未完成任务
- [x] 支持嵌套
  - [ ] 子任务
```

**规范要点：**
- 在列表项内使用 `[ ]` 或 `[x]`
- `x` 大小写不敏感
- 可嵌套

**渲染效果：**
```html
<ul>
  <li><input type="checkbox" checked disabled> 已完成</li>
  <li><input type="checkbox" disabled> 未完成</li>
</ul>
```

**编辑器能力边界：**
- ✅ 渲染复选框
- ✅ 显示完成状态
- ⚠️ 交互式勾选（需要额外实现）

---

### 3.3 删除线 (Strikethrough)

**语法：**
```markdown
~~删除的内容~~
```

**规范要点：**
- 两个波浪号包裹
- 必须紧贴内容

**渲染效果：** 转换为 `<del>` 或 `<s>` 标签

---

### 3.4 自动链接 (Autolinks)

**语法：**
```markdown
https://example.com
www.example.com
user@example.com
```

**规范要点：**
- 无需尖括号
- URL 和邮箱自动识别
- GitHub 扩展支持 @mentions 和 #issue

**渲染效果：** 自动转换为 `<a>` 标签

---

## 四、扩展语法（非标准但广泛支持）

### 4.1 数学公式 (Math/LaTeX)

**语法：**
```markdown
行内公式：$E = mc^2$

块级公式：
$$
\sum_{i=1}^{n} x_i = x_1 + x_2 + ... + x_n
$$
```

**规范要点：**
- 行内用单 `$`
- 块级用双 `$$`
- 使用 LaTeX 语法

**渲染效果：**
- 通常通过 MathJax 或 KaTeX 渲染
- 转换为 HTML/CSS 或 SVG

**编辑器能力边界：**
- ✅ 基础公式渲染
- ⚠️ 复杂 LaTeX 可能不支持
- ❌ 某些 LaTeX 宏包不可用

---

### 4.2 脚注 (Footnotes)

**语法：**
```markdown
正文内容[^1]。

[^1]: 这是脚注内容。
```

**规范要点：**
- `[^标识符]` 引用
- `[^标识符]:` 定义
- 标识符可以是数字或文字

**渲染效果：**
- 生成可点击的引用链接
- 页脚显示脚注内容

**编辑器能力边界：**
- ⚠️ 非所有解析器支持
- ⚠️ WYSIWYG 编辑体验有限

---

### 4.3 高亮标记 (Highlight/Mark)

**语法：**
```markdown
==高亮文字==
```

**规范要点：**
- 双等号包裹
- 非标准语法

**渲染效果：** 转换为 `<mark>` 标签

---

### 4.4 上标与下标

**语法：**
```markdown
H~2~O 水分子
X^2^ 平方
```

**规范要点：**
- `~` 包裹下标
- `^` 包裹上标
- 非标准语法

**渲染效果：**
- 下标：`<sub>`
- 上标：`<sup>`

---

### 4.5 定义列表 (Definition Lists)

**语法：**
```markdown
术语
: 定义内容

术语二
: 定义一
: 定义二
```

**规范要点：**
- PHP Markdown Extra 扩展
- 冒号 + 空格开头

**渲染效果：** 转换为 `<dl>`、`<dt>`、`<dd>`

---

### 4.6 图表 (Diagrams/Mermaid)

**语法：**
```markdown
```mermaid
graph TD
    A[开始] --> B{判断}
    B -->|是| C[执行]
    B -->|否| D[结束]
```
```

**支持类型：**
- 流程图 (flowchart)
- 时序图 (sequence diagram)
- 甘特图 (Gantt chart)
- 饼图 (pie chart)
- 状态图 (state diagram)

**编辑器能力边界：**
- ⚠️ 需要 Mermaid.js 支持
- ⚠️ WYSIWYG 编辑困难
- ✅ 渲染预览可行

---

## 五、编辑器实现能力矩阵

### 5.1 WYSIWYG 编辑能力评估

| 语法 | 渲染 | 直接编辑 | 格式化按钮 | 难度 |
|------|:----:|:--------:|:----------:|:----:|
| 标题 | ✅ | ✅ | ✅ | 低 |
| 粗体/斜体 | ✅ | ✅ | ✅ | 低 |
| 删除线 | ✅ | ✅ | ✅ | 低 |
| 行内代码 | ✅ | ✅ | ✅ | 低 |
| 代码块 | ✅ | ⚠️ | ✅ | 中 |
| 链接 | ✅ | ✅ | ✅ | 低 |
| 图片 | ✅ | ⚠️ | ✅ | 中 |
| 列表 | ✅ | ✅ | ✅ | 低 |
| 引用 | ✅ | ✅ | ✅ | 低 |
| 表格 | ✅ | ⚠️ | ✅ | 中 |
| 任务列表 | ✅ | ⚠️ | ✅ | 中 |
| 分隔线 | ✅ | ✅ | ✅ | 低 |
| 数学公式 | ✅ | ⚠️ | ✅ | 高 |
| 高亮 | ✅ | ✅ | ✅ | 低 |
| 上标/下标 | ✅ | ✅ | ✅ | 低 |
| 脚注 | ⚠️ | ❌ | ❌ | 高 |
| 图表 | ⚠️ | ❌ | ❌ | 高 |

### 5.2 技术限制分析

| 限制类型 | 描述 |
|----------|------|
| **HTML 安全** | 出于安全考虑，不直接支持内嵌 HTML |
| **复杂嵌套** | 深层嵌套结构编辑体验差 |
| **自定义块** | 需要开发自定义 ProseMirror 节点 |
| **实时预览** | 部分语法（如 Mermaid）需要异步渲染 |
| **格式保真** | 某些 Markdown 变体语法会丢失 |

### 5.3 Markly 增补：表格说明与长文档导航（M₆₀–M₆₉）

以下内容描述 **Markly** 在 VS Code/Webview 中提供的编辑能力边界（与上文「通用 Markdown 语法」并行阅读即可）。

| 编号 | 能力 | 概要 |
|------|------|------|
| M₆₀ | 表格用户说明 | 插入/删表行列、粘贴 TSV·CSV·HTML 与软上限、`Insert Table`/整理类命令：**`docs/RICH_TABLE_USER_GUIDE.md`** |
| M₆₁ | 大纲搜索 | 侧栏大纲支持按关键字过滤标题（以及与 Mermaid 图表条目的合并列表） |
| M₆₂ | 大纲拖拽调序 | 多个顶级 `#` 章节时可通过拖动手柄调整整块顺序 |
| M₆₃ | 锚点冲突提示 | 重复标题生成的 slug 冲突时大纲标 ⚠；跳转/`#` 链接可能落在首条同名标题 |
| M₆₄ | 反向链接 | 侧栏列出工作区内 Markdown **链入当前文档** 的引用 |
| M₆₅ | 内链悬停预览 | Rich 模式下 `*.md` 内链悬停可请求宿主返回目标标题与摘要预览 |
| M₆₆ | 大文档档位提示 | 工具栏展示文档体量档位（XS/S/M/L/XL）及当前 Rich 降级项（如 Shiki/Mermaid） |
| M₆₇ | 查找命中列表 | 「查找替换」面板展示匹配条目预览列表，单击跳转到对应命中 |
| M₆₈ | 工作区查找入口 | 查找面板 **🔎** 调起 `workbench.action.findInFiles` 并填入当前检索词 |
| M₆₉ | ATX 标题折叠 | **Source/IR** gutter 可对 ATX 标题折叠，范围至下一条同级或更高级标题 |

### 5.4 Markly 增补：大文档门禁与写作/AI 辅助（M₇₀–M₇₉）

> **默认行为**：未在设置中开启 **AI**（`markly.ai.rewrite.enabled`）或未配置 **openai-compatible** 时，不向远程发送全文；各能力出站范围见随包 **`privacy/AI_PRIVACY.md`**（命令：**AI: Open Privacy Notice**）。

| 编号 | 能力 | 概要 |
|------|------|------|
| M₇₀ | 长文档稳定门禁 | Fixture `docs/fixtures/m70/` + Vitest **`largeDocStabilityGate.test.ts`**：跨过 Rich 档位阈值时节流/banner 文案稳定 |
| M₇₁ | AI 配置校验 | 命令 **AI: Validate Setup**（`markly.ai.validateSetup`）；设置变更时对缺失 Endpoint/模型/密钥/超时给出提示 |
| M₇₂ | 润色 Diff 预览 | 选区润色结果弹窗对照后再替换 |
| M₇₃ | AI 摘要侧栏 | 「摘要」全文/当前节，`AI_SUMMARY_REQUEST/RESULT` |
| M₇₄ | AI 标题建议二期 | 多候选与简短理由，可替换一级标题，`AI_SUGGEST_TITLES_*` |
| M₇₅ | Markdown 结构修复二期 | 「Fix Markdown Structure」：`fixMarkdownStructuralPhaseTwo`（fence 外标题层级、列表符号、task 勾选、段落空行） |
| M₇₆ | 选区转 GFM（AI） | `AI_CONVERT_TEXT_TO_TABLE_*`，Mock/Provider 预览后写入 |
| M₇₇ | 长文结构建议 | 侧栏检测重复锚点、标题跳级、首标题过深；点击与大纲同源跳转 |
| M₇₈ | AI 隐私说明 | `privacy/AI_PRIVACY.md`、设置项 markdown 描述、README 摘要 |
| M₇₉ | AI 操作历史 | 侧栏记录润色/转表替换，支持回看片段与有条件的撤销，`aiApplyHistory.ts` |

### 5.5 Markly 增补：AI Provider 底座与导出/交付（M₈₀–M₈₉）

| 编号 | 能力 | 概要 |
|------|------|------|
| M₈₀ | AI Provider 分层 | `AssistModelOperations`、`openAiCompatibleChatCompletion`、`gfmTableLocal.ts`：各 AI 能力与密钥/`fetch` 桥接隔离，便于替换 Provider |
| M₈₁ | PDF 双模板 | 设置 **`markly.export.pdf.template`**：`default` \| `academic`（印刷向衬线与页眉区别） |
| M₈₂ | HTML 本地图打包 | **`markly.export.html.copyLocalImages`** + **`markly.export.html.assetsSubdirectory`**：可选用相对文档目录拷贝图片并重写 `<img src>` |
| M₈₃ | 导出前预检 | **`markly.export.preflight.scope`**（`off` / `images` / `full`）与 **`markly.export.preflight.blockOnIssues`**；缺图 / 可疑公式 / 坏链等 |
| M₈₄ | 代码块导出可读性 | HTML/PDF 中 `pre`/`code` 长行换行、`tab-size`、打印与学术模板一致性 |
| M₈₅ | Mermaid 导出对齐 | **`mermaidExport.ts`**：`transformMermaidFencesForExport`、嵌入 `mermaid.min.js`（或 CDN，见 **`markly.export.diagram.mermaidScriptBundling`**）、HTML/PDF 共用引导脚本；可选围栏内 **`%% alt:`** |
| M₈₆ | 导出失败诊断 | 命令 **Copy failure diagnostics**：脱敏信息便于提交 issue **`exportDiagnostics.ts`** |
| M₈₇ | Rich 结构化复制 | 选区复制为邮件/IM 友好 HTML：**`richClipboard.ts`**（Source/IR CM 管线） |
| M₈₈ | 发布前 HTML 预览 | 命令 **`markly.preview.exportHtml`**：与 **`buildExportHtmlString`** 同管线，`htmlPreviewImgRewrite` 重写本地图为 Webview URI |
| M₈₉ | 文档模板库 | 内置 **`templates/*.md`**，命令 **`markly.template.newFromLibrary`**；自选模板目录为 **M₉₀**（`markly.templates.userDirectory`） |

### 5.6 Markly 增补：模板目录、产品与工程基建（M₉₀–M₉₉）

| 编号 | 能力 | 概要 |
|------|------|------|
| M₉₀ | 用户模板目录 | 设置 **`markly.templates.userDirectory`**：`userTemplateDirectory.ts` 与内置模板一并出现在 **New Markdown from Template…** QuickPick |
| M₉₁ | 欢迎使用引导 | **`contributes.walkthroughs`**（`markly.welcome`）：Rich/Source、导出与快捷方式入门 |
| M₉₂ | Command Palette 分组 | 全部 **`markly.*`** 命令带 **`category: Markly`**，便于在命令面板中检索 |
| M₉₃ | 设置页可读性 | 关键项 **`markdownDescription`**（遥测、图片目录、Mermaid/Shiki、`preflight`、导出/HTML、AI、模板路径等） |
| M₉₄ | 自救与排障 | 命令 **`markly.help.recoveryCenter`**（见 **`resources/TROUBLESHOOTING.md`**） |
| M₉₅ | 本地遥测（可选） | **`markly.telemetry.enabled`** 默认 **`false`**；开启后计数写入 Output「Markly Telemetry (local)」 |
| M₉₆ | 包体与依赖策略 | **`resources/BUNDLE_GOVERNANCE.md`**；根脚本 **`check_extension_bundle` / check_webview_bundle** 提示 Shiki/Mermaid/Puppeteer 边界 |
| M₉₇ | 启动性能说明 | **`resources/PERFORMANCE_NOTES.md`**（首开 Markdown、懒加载等） |
| M₉₈ | 跨平台说明 | **`resources/CROSS_PLATFORM.md`**（Win / Linux / macOS 差异与注意点） |
| M₉₉ | 上架素材说明 | **`docs/marketplace/FAQ.md`**：截图/动图清单与市场文案占位指引 |

### 5.7 Milestone M₁₀₀（2.0 评审门禁）

计划在 **semver major（2.0.0）** 前或过 major 发行线时：按 **`docs/M100-2.0-GATE.md`** 逐项核对「M₅₁–M₉₉ 收口、契约单测、gates、是否破坏性变更」，并由发版 Owner 在该文档勾选 **保持 1.x** 或 **升 2.0.0**（附迁移）。**不作为**替换 `npm run gates:stable` 的自动化脚本。

### 5.8 近期路线图工程收口（M201–M275，摘录）

本仓库已按 **`docs/ROADMAP_NEAR.md`**（M201–M275）完成近期阶段收口（记录：**2026-05-06 / v1.39.15**）。核心交付包括：主路径 **Rich + Source**、IR 标记为 `legacy-ir` 且冻结、导出预检可 **打开文档并定位**、导出错误可复制诊断包、Rich 启动失败可降级并复制错误摘要、协议守卫与单测门禁稳定等。

| 文档 | 说明 |
|------|------|
| **Rich vs Source** | **`docs/SOURCE_VS_RICH.md`** |
| **Preview vs Export** | **`docs/EXPORT_PREVIEW_VS_EXPORT.md`** |
| **Near templates** | **`docs/NEAR_KICKOFF_TEMPLATE.md`** / **`docs/NEAR_GONOGO_TEMPLATE.md`** |
| **Near Go/No-Go record** | **`docs/NEAR_GONOGO_1.39.15.md`** |
| **Near phase complete** | **`docs/NEAR_PHASE_COMPLETE_1.39.15.md`** |

---

## 六、最佳实践建议

### 6.1 文档编写

1. **保持简洁**：避免过度嵌套
2. **统一风格**：选择一种列表标记（推荐 `-`）
3. **适当空行**：提高可读性
4. **图片优化**：压缩后再插入

### 6.2 编辑器开发

1. **核心优先**：先实现 CommonMark 完整支持
2. **渐进增强**：按需添加 GFM 扩展
3. **性能优化**：大文档虚拟滚动
4. **降级方案**：复杂语法回退到源码编辑

---

## 参考资源

- [CommonMark 规范](https://spec.commonmark.org/)
- [GFM 规范](https://github.github.com/gfm/)
- [Markdown Guide](https://www.markdownguide.org/)
- [LaTeX 数学公式参考](https://katex.org/docs/supported.html)
