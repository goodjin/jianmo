# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### 桌面版

- **打开可以选择文件夹**（0.8.19）：在 Mac 上，文件树上面的「打开」可以选文件，也可以选一个文件夹。选中文件夹再点打开，不会打开里面的文件，左边直接换成这个文件夹，右边已经打开的文档留着。菜单里的「打开文件夹」同样会换上这棵树。
- **可以打开文本文件**（0.8.18）：除了 Markdown 和 JSON，日志、配置、代码、字幕、密钥这类文本也能打开。文件树、打开对话框和拖进窗口都认这些。没有默认程序的类型（例如 `.pub`、`.pem`、`.toml`、字幕和补丁）安装后可以直接双击打开。`.txt`、网页、JSON 和代码仍留给原来的程序，可以在「打开方式」里选 Markly。图片和压缩包拖进来不会打开。看起来像文本、其实是二进制的文件（例如 Publisher 的 `.pub`）会说明打不开。
- **文件树旁不再放刷新**（0.8.17）：打开旁边只留上一级和收起。重新读当前文件仍用顶栏那个「刷新」。删掉文件之后，目录自己会更新。
- **水纹更透、散得更慢**（0.8.16）：圈最多大约三成看得见，字更容易露出来。散开速度放慢一半，仍是先快后慢，从按钮中心往外走。
- **水纹改成一道有明暗的水脊**（0.8.15）：水波不再是几根细线，也不再糊成一块光。外缘暗，往里渐成水色，脊上有一道窄的亮边。字还露在外面，圈仍从按钮中心快出慢收。
- **水纹收细、透出底下的字**（0.8.14）：水波还是从按钮中心快出慢收。纹路收成大约两像素的一道，颜色更透，字和按钮下面的内容不再被一条宽带挡住。
- **水波从按钮中心快出慢收**（0.8.13）：按下后只荡开两圈，先快后慢，大约一秒走完。圆心是按钮中心，最大一圈贴着按钮较短的一边。每一圈是一道有明暗的水纹，字会跟着波峰往外、波谷往里轻轻晃，晃完回到原处。
- **新标签页写上仓库和邮箱**（0.8.12）：新开的空白标签上，简介下面写成「仓库地址」和「联系邮箱」。点仓库地址会用浏览器打开。已经打开的文档不显示这段。
- **水波慢一点散开**（0.8.11）：按下后的细圈不再一下子弹到边上，而是慢慢荡开，后面的圈也跟着晚一点出来。圈还是收到按钮里面。
- **文件树可以拖宽**（0.8.10）：文件树和正文之间的线可以左右拖，拉宽或收窄左边。双击这条线回到默认宽度。收起后仍只留展开箭头，不会把拖过的宽度套回去。标签栏留在窗口顶部。
- **按下是细的正圆水波**（0.8.9）：顶栏、正文右上角的复制、文件树和菜单里的按钮，按下时从指尖荡开几圈很细、很透的正圆水波。圈是算出来的，不再把色块放大，按钮上的字和边也不再被扭一下。水波仍收到按钮边上。没有小星星。文件列表和右键菜单没有。系统开了「减少动效」就不播。
- **正文自己滚动，并可自动换行**（0.8.8）：左右滚动条只出现在正文里，不再从文件树底下拉通整条窗口。文件树用自己的滚动条。设置里的「阅读」多了「自动换行」，默认勾选：太长的文字折到下一行，正文下面不再出左右滚动条。正文也不再挤在中间，左侧那块空白去掉了。
- **收起文件树后只留箭头**（0.8.7）：左侧收起来以后，不再留「开」和打开按钮，只剩展开用的箭头，这一列跟着箭头收窄。展开后「打开」、上一级和刷新目录还在原处。左侧的刷新是重新看一遍文件夹，右边那个才是重新读当前文件。
- **按钮按下会冒一下**（0.8.6）：顶栏、正文右上角的复制、文件树和菜单里的按钮，按下时散开一些很透的浅色小星星，并在按钮里面荡开一圈淡水波。星星再多也不盖住按钮。水波走到哪里，按钮上的字就跟着轻轻挪一下，像水波从纸面上走过。水波仍收到按钮边上。复制更多一点。文件列表和右键菜单没有。系统开了「减少动效」就不播。
- **源码、刷新、编辑留在外面**（0.8.5）：这三个按钮回到顶栏。最右边只留三个竖点，不再写字。菜单按每一行自己定宽，右对齐浮在按钮下面。导出 PDF、导出 HTML 和设置仍在这个菜单里。
- **操作按钮和菜单左右对齐**（0.8.4）：按钮宽到最宽的那一项，菜单锁成同一个宽度，左右边贴在一条线上，从按钮下沿拉出来。右边三个点拉开，看得清是可以下拉。
- **操作按钮和下拉一样宽**（0.8.3）：按钮宽到刚好放下最宽的那一项。菜单左右贴齐，从按钮下沿拉出来，不再比按钮宽一截，也不再窄到只包住「操作」两个字。
- **复制挪到正文右上角**（0.8.2）：「操作」里不再放复制。复制改成浮在正文右上角的小图标，点一下仍是复制全文。成功还是打勾，失败还是红框。「操作」按钮按字收窄，不再为了菜单被撑宽。
- **顶栏收成「操作」**（0.8.1）：新建标签的加号跟在最后一个标签右边。新标签不再放「打开」，改成一段简短介绍。刷新、复制、编辑、导出 PDF、导出 HTML 和设置收进最右边的「操作」。鼠标放上去就展开，按钮右边三个竖点表示可以下拉。正在编辑时，回退和重做单独留在外面，各带一个图标；源码和预览按钮也带一个小图标。
- **标签变多时会变窄**（0.8.1）：标签随数量变窄，窄到固定宽度就不再缩。挤不下时两边出现左右移动。设置里可以规定最多同时打开多少个，默认 20。再多就关掉最久没有查看的那一张。正在看的不会被关掉。那张如果还有没保存的修改，会先问你。
- **可以编辑原文**（0.8.0）：顶栏多了「编辑」。点进去改的是文件里的原文，不会自动保存。撤销、重做和保存只在编辑时出现。JSON 和 JSONL 按文件里的样子改，不会先排成缩进。离开编辑、关标签、刷新或退出时，如果还有没保存的修改，会问要不要保存。文件在外面被改过时，不会直接盖掉。
- **文件树按钮升到打开旁边**（0.7.6）：上一级、刷新目录、收起，从文件树顶上挪到「打开」右边。「文件」标题和那一整栏去掉了，目录从上面就开始列。收起后这一列只留下打开和展开。向上按钮改成更粗的箭头。
- **看源码时按钮写成「预览」**（0.7.5）：点「源码」看原文后，这个按钮改写成「预览」。再点一次回到预览。来回切换仍停在正在看的那一段。
- **打开后留在程序坞**（0.7.4）：窗口拉到当前桌面时，不再把 Markly 当成菜单栏小工具，图标会留在程序坞里，可以随时点回去。窗口仍停在菜单栏下面、程序坞上面。
- **导出菜单只写格式名**（0.7.3）：下拉里两项改成「PDF」和「HTML」，不再带「导出」。按钮自己仍叫「导出」。
- **导出按钮稍宽一点**（0.7.2）：按钮加宽到「导出 PDF」和「导出 HTML」各自一行。菜单仍跟按钮一样宽，仍贴着往下拉，相接处仍没有横框。
- **导出菜单和按钮连成一块**（0.7.1）：菜单跟导出按钮一样宽，左右对齐，垂直往下拉。按钮下沿和菜单上沿接上，中间不再有缝，也不再有一条横框。圆角只留在按钮顶上和菜单底下。
- **空标签的打开挪到底部**（0.7.1）：「打开」和旁边那句说明放在空白页底部。
- **空标签可以直接打开**（0.7.0）：点「+」出来的新标签上有「打开」。在这张空标签里，从左侧文件树点一篇文档，会打开在当前这张标签上，不再多开一张。这篇如果已经在别的标签打开了，就切过去，并把用不上的空标签关掉。已经有文档的标签，点文件树还是原来的开法。
- **看源码时留在原处**（0.7.0）：预览时按钮叫「源码」。点进去看原文，同一个按钮改成「渲染」，再点回到预览。来回切换都停在正在看的那一段，不会跳到文首。每个标签各自记住。
- **导出菜单贴住按钮**（0.7.0）：点「导出」或把鼠标放上去，PDF / HTML 菜单的上沿贴着按钮下沿，能看出是这个按钮的菜单。菜单打开时不再弹出系统提示盖住它。
- **文件可以移到废纸篓**（0.6.8）：在文件上点右键，选「删除」。会先问一次是不是要移到废纸篓，确认后才移走，不是直接抹掉。已经打开的标签和最近打开记录会一起去掉。
- **打开后窗口不再铺满整块屏幕**（0.6.7）：窗口会停在菜单栏下面、程序坞上面，关闭和缩小都能点到。程序坞里也会出现 Markly 的图标。
- **文件右键菜单**（0.6.6）：在文件树上对文件点右键，可以重命名、在 Finder 中显示、复制全路径、复制文件名。重命名后，已打开的标签和最近打开记录会换成新路径。
- **代码块的复制按钮不再挡住语言名**（0.6.6）：鼠标移到代码框上时，复制按钮出现在框的上沿外面。框内右上角只留语言名。每段代码都是这样。
- **复制前面可以刷新**（0.6.5）：点「刷新」重新读当前文件。读成功后顶部绿条提示，一会儿自己消失。文件已经不在，或这次没读成，正文保持原样，顶部黄条留下说明。
- **复制旁边可以查看源码**（0.6.4）：顶栏多了「源码」。点一下看原文，再点回到预览。JSON 和 JSONL 会排成缩进；排不了的原文仍按文件里的样子显示，并说明一下。每个标签各自记住。
- **文件树窄图标按钮圆角改小**（0.6.3）：向上一级和收起侧栏改用 6px 圆角，看起来仍是小方块。导出、设置、刷新这类宽按钮仍是 12px。
- **复制图标换成两个错开的圆角矩形**（0.6.2）：顶栏复制按钮空闲时用常见的「两页叠在一起」图标。复制成功仍是绿色打勾，失败仍是红框。
- **正文字体改成下拉**（0.6.1）：设置里可以选这台电脑已安装的字体，也可以选系统默认，或随应用自带的思源黑体。按钮和文件树仍用系统字体。
- **正文默认改用思源黑体**（0.6.0）：预览正文用打进应用的思源黑体，中英文都清晰。设置里可以改回系统字体。按钮和文件树仍用系统字体。
- **界面边角更圆**（0.5.8）：按钮、菜单、输入框、卡片、文件树和标签的圆角加大，看起来不那么硬。颜色和排版没改。
- **打开「文稿」里的文档不再直接退出**（0.5.7）：macOS 不允许未说明用途的应用读取文稿、桌面和下载。现在会先征求允许。若已经拒绝过，到「系统设置 → 隐私与安全性 → 文件和文件夹」里打开 Markly 的访问。
- **双击 Markdown 会直接出现窗口**（0.5.5）：在访达里双击打开文件时，窗口会显示到最前面。以前经常要再点一次程序坞图标才看得到。
- **设置挪到导出旁边**（0.5.6）：顶栏「设置」紧挨在「导出」右边。最近打开列表里不再放设置。
- **复制成功打勾**（0.5.4）：顶栏复制按钮在写入成功后变成绿色打勾，约 1.6 秒后恢复成复制图标。失败时图标不变，边框变红。
- **最近打开点空白收起**（0.5.4）：菜单打开后，点预览、侧栏或其它空白处会收起；点菜单里面不会。点进预览正文时也会收起。
- **JSON / JSONL 树形预览**（0.5.1）：打开 `.json` / `.jsonl` 时，键、值和数组元素各自一个圆角框，用树线连起来。点箭头（JSONL 也可点行号）展开或收起；点框复制这一格。行号在框外面。
- **选择即复制**（0.5.0）：在预览里选中文字后自动放进剪贴板。默认开启，可在「设置 → 阅读」或 Edit 菜单里关掉。

### Changed

- **预览和导出的代码块**：复制按钮改到框外上沿，鼠标移上去才出现，不再盖住右上角的语言名。

### Fixed

- 导出与预览里，标题前的「#」和代码块上的「复制」按钮不会再被鼠标选进正文。

## [2.3.1] - 2026-10-12

### Changed

- **表格操作改到边上**：光标停在单元格里不再套整表选中框。鼠标移到两行或两列的交界处才出现加号；移到行头或列头，点一下选中这一行或这一列，并出现删除。按住拖动或按着 Shift 再点，可以选中多行或多列，删除会一起删掉。选中全部行或全部列时，删除会删掉整张表。

## [2.3.0] - 2026-10-12

### Changed

- **工具栏改成两行**：标题、格式、列表和撤销留在第一行，插入、表格、查找、缩放、大纲和导出放在第二行。按钮按文字收窄、高度变矮，避免第二行只挤下几个按钮就再折出第三行。
- **工具栏默认只显示图标**：鼠标停在按钮上才出现名称。设置里可以勾选「显示按钮名称」一直显示。顶栏的 Rich / Source / 预览和「设置」按钮也缩小了一档。
- **设置里可以调工具栏**：编辑器「设置」和 VS Code 设置项 `markly.editor.toolbarFontSize`（10–18）可改工具栏字号；`markly.editor.toolbarShowLabels` 控制是否一直显示名称；`markly.editor.toolbarButtons` 可单独隐藏每个按钮。没写到的按钮默认仍然显示。

### Mid Phase (M305–M316) snapshot

- Docs: Profiles support (`docs/CONFIG_PROFILES_M305.md`), enterprise managed settings (`docs/ENTERPRISE_POLICY_MANAGED_SETTINGS_M306.md`).
- i18n: moved `package.json` user-facing strings to `package.nls*.json`.
- A11y/E2E/Perf: added baseline docs (`docs/A11Y_BASELINE_M308.md`, `docs/E2E_BRIDGE_CONTRACT_M309.md`, `docs/E2E_SMOKE_SUITE_M310.md`, `docs/PERF_BASELINE_M312.md`).
- Release: added release playbook (`docs/RELEASE_PLAYBOOK_M316.md`).

## [2.2.1] - 2026-09-29

### Fixed

- **大纲不再收录围栏代码里的 `#` 行**：` ``` ` 围栏内的 `# 注释` 曾被当成标题进入大纲（webview 大纲 / 结构提示 / 悬停预览 / 桌面端大纲共用同一解析器），现与导出目录同规则跳过；围栏后正文的标题锚点定位（from/to）不受影响。
- **`{#custom-id}` 不再残留为可见文本**：导出 HTML / Preview 预览 / PDF 的标题与目录标签此前会显示标记原文（如「快速开始 {#quick}」），现只在锚点与跳转里生效；尾部标记剥除，正文中间或行内代码里的同形文本视为普通文案不受影响。锚点 id 计算规则不变，跨侧契约测试已覆盖「可见文本」一致性。

### 桌面版

- 随本修复打包 **0.4.1**（含 0.4.0 的 UI 改版：打开拆分按钮、设置入口、根目录文件树、大纲整栏收起、拖拽只开 Markdown）。

## [2.2.0]

### 渲染视觉升级

- **排版升级**：导出 HTML / Preview 预览 / 独立桌面端预览共用一套新版式（标题层级、段落节奏、引用卡片、表格、目录卡片、脚注、行内元素），亮暗双主题与打印样式同步刷新。
- **代码块语法高亮**：导出与 PDF 的围栏代码块按语言着色（Shiki：JS/TS/Python/Bash/JSON/YAML/HTML/CSS/SQL/Java/Go/Rust/C/C++/C#/Diff/XML/Markdown），未知语言自动回退素色；代码块带语言标签与悬停「复制」按钮，宽表格自动加横向滚动。
- **标题与目录修复**：标题内强调/行内代码不再被转义显示；目录标签渲染行内标记；锚点与 webview 大纲 slug 对齐（中文标题可跳转）；`{#custom-id}` 自定义锚点生效；围栏代码里的 `# 注释` 不再误入目录。
- **PDF 版式**：默认与学术模板同步新视觉（标题、引用卡片、表格、代码块），保留分页与表头重复规则。
- **Rich 编辑器**：编辑态的标题、段落、代码、引用、列表、链接排版与导出版式统一。
- **包体治理**：语法高亮器独立为按需加载切片 `dist/extension/markly-code-highlight.cjs`，扩展入口包体积不变；`check:bundle` 为切片新增独立预算（见 `resources/BUNDLE_GOVERNANCE.md`）。

### 锚点契约统一（跨侧一致性）

- 标题锚点收敛为一份权威实现（`src/core/export/headingAnchor.ts`）：`{#custom-id}` 优先 → 文本 slug（保留中文、剥行内标记）→ 按出现序号兜底；导出 HTML、webview 大纲（含 Rich / 目录 / 结构提示）、桌面端大纲全部对齐，并有跨侧契约测试守着一致性。
- 修掉「点大纲/目录跳不动」的一类问题：中文标题、自定义锚点标题、带链接/强调的标题在导出预览与桌面端预览都能正确落点；跳转改为坐标直滚（沙箱 iframe 下 `scrollIntoView` 不可靠）。
- 桌面版随本次渲染升级打包 **0.4.0**（`app/release/Markly-0.4.0-arm64.dmg`）。

## [1.39.15] - 2026-05-06

### Highlights (user-facing)

- Rich 启动失败/超时时：顶部提示条可展示错误摘录，并支持「复制错误摘要」自助排障。
- 导出预检：当本地图片引用过多时给出风险提示，减少导出内存/耗时误判。
- 保存失败：宿主写入失败会回传 `SAVE_FAILED`，避免静默丢保存。

### Added

- **M258**：`webviewInboundRouting`/`exportFilters` 可测拆分与单测（Open/导出意图与对话框过滤器）。
- **M261 / M266**：`docs/PROTOCOL_COMPAT_SMOKE.md`、`docs/ACTIVATION_EVENTS_AUDIT.md`。
- **M262**：诊断包增补 **`webviewInitMs`**（与同源的 `webviewMountMs` 一致）。
- **M264**：导出预检 **`many_local_images`**（阈值 50）；`EXPORT_GUIDE` 第 6 节补充说明。
- **M265**：`docs/fixtures/m9/17-table-code-cell-pipe.md`（GFM pipe 边界监控）。
- **协议**：Extension → Webview **`SAVE_FAILED`**（宿主写入失败）；`messageGuards`/`messageContract` 覆盖。

### Changed

- **M263**：Rich 降级条展示错误摘录并支持 **复制错误摘要**；`setContent` 失败上报 `milkdown:setContent:error`；全局 Milkdown editorView 竞态降级时同步显示降级条。
- **customEditor**：`OPEN_EXTERNAL_LINK`/导出早退路径与 **`classify*`** / **`getExportFilters`** 对齐；Webview **`SAVE`** 失败时宿主提示 + `SAVE_FAILED`。

### Documentation

- `docs/ROADMAP_NEAR.md`：§7 快照增补 **M258–M266** 落地摘要。

## [1.39.14] - 2026-05-06

### Added

- **M201 / M268 / M270 / M275**：新增近期阶段 **Kickoff / Go-NoGo** 可重复记录模板：`docs/NEAR_KICKOFF_TEMPLATE.md`、`docs/NEAR_GONOGO_TEMPLATE.md`。
- **M259**：新增 `docs/EXPORT_PREVIEW_VS_EXPORT.md`，说明 Preview 导出与正式导出差异与排障建议。
- **M250**：npm 脚本 **`npm run record:bundle-sizes`**（同 `node ./scripts/record-bundle-sizes.mjs`）。

### Changed

- **CI**：`check` job **timeout** 调至 **30min**（覆盖 `test:vscode` 下载与冷启动）。

### Documentation

- `docs/ROADMAP_NEAR.md`、`docs/MARKDOWN_CAPABILITIES.md`、`README.md` 增补上述模板与说明的链接入口。
- **`CONTRIBUTING.md` / `e2e/README.md`**：说明 CI 跑 `test:vscode` / `record:bundle-sizes` 与 **`MARKLY_VSCODE_EXECUTABLE_PATH`**。
- **`resources/BUNDLE_GOVERNANCE.md`**：补充指向 **`resources/BUNDLE_SIZE_HISTORY.md`**（趋势记录入口）。

## [1.39.13] - 2026-05-06

### Added

- **M247（E2E Rich 冒烟进 CI）**：CI（GitHub Actions）增加 headless 运行 `npm run test:vscode`（xvfb）以覆盖自定义编辑器打开与基础命令链路；并将 e2e runner 改为跨平台：CI 不再依赖本机 VS Code 路径。
- **M250（包体趋势）**：新增 `scripts/record-bundle-sizes.mjs` 输出 `tmp/bundle-sizes.json`，并提供 `resources/BUNDLE_SIZE_HISTORY.md` + `resources/bundle-size-history.jsonl` 作为趋势台账入口；CI 额外生成一次报告。
- **M245 / M257**：新增 `docs/FLAKY_TESTS.md`（flaky 管控）与 `docs/REGRESSION_PLAYBOOK.md`（issue→fixture 回归流程）。

## [1.39.12] - 2026-05-06

### Added

- **M201–M275（近期路线 · 工程落地）**：`CONTRIBUTING.md`、Issue 模板（`.github/ISSUE_TEMPLATE/bug_report.md`）、`docs/SOURCE_VS_RICH.md`；`EXPORT_GUIDE` 增补导出相关 `markly.*` 索引与大批量图片说明；`COMPATIBILITY_MATRIX` 增补 Remote/WSL 手记；`MARKDOWN_CAPABILITIES` **§5.8**；`docs/ROADMAP_NEAR.md` **§7** 执行快照。
- **M224**：导出预检为每条 issue 附上 **源码行号（约）**；宿主侧预检 UI 支持 **打开文档并定位**（阻塞模式下会取消本次导出；非阻塞仍可继续）。
- **M262**：诊断包增加 **`webviewMountMs`**（webview 脚本启动→App mounted 毫秒数，仅供排障）。
- **M231**：大纲标题筛选输入 **100ms 防抖**，减轻超大纲连续键入开销。

### Changed

- **M223/M222**：导出失败归因补充 **Export cancelled / 权限 / 磁盘满**；PDF 导出 `browser.close()` **吞掉次要异常**，避免遮盖真实错误。
- **M241**：命令面板部分标题增加中文检索后缀（导出 PDF/HTML、大纲、Toggle 模式）。
- **M242**：Welcome walkthrough 第一步改为 **Rich + Source** 主路径描述，并链到 IR 冻结/移除路线图。
- **DEPENDENCY_UPDATE_POLICY**：补充 **`npm audit` 高危 7 日**处理预期（**M249**）。

### Documentation

- `resources/TROUBLESHOOTING.md`：导出预检跳转、大图粘贴；`README`：**三步排障 + CONTRIBUTING**。
- **`markly.editor.deferDiagramRenderInRich`** 的 markdown 描述：补充性能档位/看门狗与 IR roadmap 指针。

### Housekeeping

- **M246**：PR 模板勾选 **protocol / messageGuards**；**M235**：SVG sanitize **onload** 向量例。

## [1.39.11] - 2026-05-05

### Changed

- **M₁₀₀（2.0 门禁执行）**：按 [`docs/M100-2.0-GATE.md`](docs/M100-2.0-GATE.md) 完成收口记录：M₅₁–M₉₉ 矩阵可验收、gates/release 可查、无不兼容协议/默认破坏性变更的结论下 **保持 1.x（本版 PATCH）**。[`MARKDOWN_CAPABILITIES.md`](docs/MARKDOWN_CAPABILITIES.md) 增补 **§5.7** 指向本文。

## [1.39.10] - 2026-05-05

### Documentation

- **M₉₀–M₉₉ 矩阵收口**：[`docs/MARKDOWN_CAPABILITIES.md`](docs/MARKDOWN_CAPABILITIES.md) 增补 **§5.6**（用户模板目录、Welcome walkthrough、`Markly` 命令分组、设置说明、自救中心与 `TROUBLESHOOTING`、遥测、包体/性能/跨平台资源文档、Marketplace FAQ）。矩阵见 [`docs/milestones-M51-M100.md`](docs/milestones-M51-M100.md)。**M₁₀₀**（2.0 门禁）见 [`docs/M100-2.0-GATE.md`](docs/M100-2.0-GATE.md)，未纳入本表。

## [1.39.9] - 2026-05-05

### Documentation

- **M₈₀–M₈₉ 矩阵收口**：[`docs/MARKDOWN_CAPABILITIES.md`](docs/MARKDOWN_CAPABILITIES.md) 增补 **§5.5**（AI Provider 分层、PDF 模板、HTML 打包图、导出预检、代码块/Mermaid 导出、失败诊断拷贝、Rich 复制、导出 HTML 预览、模板库与用户目录提示）。矩阵与证据见 [`docs/milestones-M51-M100.md`](docs/milestones-M51-M100.md)。

## [1.39.8] - 2026-05-05

### Documentation

- **M₇₀–M₇₉ 矩阵收口**：[`docs/MARKDOWN_CAPABILITIES.md`](docs/MARKDOWN_CAPABILITIES.md) 增补 **§5.4**（长文档 fixture 门禁、AI Validate Setup、润色预览/摘要/标题建议、结构修复与转表、结构建议面板、隐私说明、AI 操作历史）；并注明默认不向远程发送全文、详见 `privacy/AI_PRIVACY.md`。实现与单测参见 [`docs/milestones-M51-M100.md`](docs/milestones-M51-M100.md) M₇₀–M₇₉ 各行。

## [1.39.7] - 2026-05-05

### Documentation

- **M₆₀–M₆₉ 矩阵收口**：[`docs/MARKDOWN_CAPABILITIES.md`](docs/MARKDOWN_CAPABILITIES.md) 增补 **§5.3**（表格用户说明指路 `RICH_TABLE_USER_GUIDE`、大纲筛选/拖拽/锚点冲突、反向链接与内链悬停预览、档位与查找命中列表、工作区查找、Source/IR ATX 折叠）。实现与单测在此前迭代已落地（见 [`docs/milestones-M51-M100.md`](docs/milestones-M51-M100.md) M₆₀–M₆₉ 行）。

## [1.39.6] - 2026-05-05

### Added

- **M₅₀**：`npm run check:release` 现校验 **CHANGELOG** 含当前 `package.json` 版本对应的 `## [x.y.z]` 标题（与根 / webview 版本对齐、SemVer、repository / bugs / engines 等一并检查）。`.vsix` 文件名与版本一致改为 **可选**：`MARKLY_CHECK_VSIX=1` 时在根目录存在 `.vsix` 则须含 `markly-x.y.z.vsix`，避免本机堆积历史包导致误失败。
- **M₅₈**：新增表格往返 fixture [`docs/fixtures/m9/15-table-mixed-align-sparse.md`](docs/fixtures/m9/15-table-mixed-align-sparse.md)（三列左/中/右对齐 + 稀疏空单元格 + 格内不含 `|` 的反引号码片），纳入 [`richFixtureRoundTrip.test.ts`](webview/src/__tests__/richFixtureRoundTrip.test.ts)。

### Notes

- **M₅₁–M₅₇、M₅₉**：执行矩阵见 [`docs/milestones-M51-M100.md`](docs/milestones-M51-M100.md)（重命名修引用、粘贴同名策略、资产列表面板、批量修图、未引用资产、Rich 表快捷键、粘贴预览、大表性能档位等）——本版以 **发布门禁 + M58 补测** 收口，无行为回归。

## [1.39.5] - 2026-05-05

### Added

- **M40**：`markly.export.diagram.mermaidScriptBundling`（`embedded` | `external`）；HTML/PDF/导出预览共用。
- **M42/M43**：导出目录含 Mermaid 锚点（`markly-diagram-n`）；围栏内 `%% alt:` 写入 `aria-label`。
- **M45**：`markly.editor.deferDiagramRenderInRich`——Rich 下跳过 Mermaid 初始化。
- **M46**：`markly.image.remoteHttpsHostsAllowlist` + 导出预检外链图 host 告警。
- **M47**：粘贴 SVG 时轻量剥离 script/event handler/foreignObject（`webview/src/utils/svgSanitize.ts`）。
- **M49**：`markly.image.pasteImageBasenamePrefix`，粘贴图为 `{前缀}-日期时间-随机.扩展`。

### Changed

- 大纲：`parseMermaidOutlineEntries` 与标题按源码位置合并排序，支持跳转到图表块（Rich：`scrollToHeading`）。
- Rich Mermaid：`themeVariables` 从 VS Code CSS 变量读取主色与字体。

## [1.39.4] - 2026-05-05

### Added

- **M30**：[`docs/M30_TABLE_CELL_BLOCKS.md`](docs/M30_TABLE_CELL_BLOCKS.md)；fixture [`docs/fixtures/m9/14-table-cell-linebreaks.md`](docs/fixtures/m9/14-table-cell-linebreaks.md) + [`richFixtureRoundTrip.test.ts`](webview/src/__tests__/richFixtureRoundTrip.test.ts)。
- **M31**：[`docs/M31_TABLE_MATH_MATRIX.md`](docs/M31_TABLE_MATH_MATRIX.md)；HTML 导出表内行内公式单测。
- **M34–M35（可选顺延）**：[`docs/M34_M35_TABLE_CSV_VALIDATION_OPTIONAL.md`](docs/M34_M35_TABLE_CSV_VALIDATION_OPTIONAL.md)。
- **M36**：[`docs/M36_MERMAID_VERSION_POLICY.md`](docs/M36_MERMAID_VERSION_POLICY.md)；`webview` 将 **`mermaid` 锁为精确版本** `11.12.3`。
- **M37**：Rich Mermaid 渲染 **代际令牌**，丢弃过时 `m.render` 结果（[`MilkdownEditor.vue`](webview/src/components/MilkdownEditor.vue)、[`DiagramRenderer.vue`](webview/src/components/DiagramRenderer.vue)）。
- **M38**：Mermaid **离线/加载失败**时的可视占位与源码回退；`DiagramRenderer` 离线提示文案。
- **M39**：[`docs/M39_PLANTUML_PLUGIN_SPIKE.md`](docs/M39_PLANTUML_PLUGIN_SPIKE.md)；[`webview/src/diagrams/pluggableDiagramHost.ts`](webview/src/diagrams/pluggableDiagramHost.ts) 宿主类型桩；[`m39-rich-link-anchor-plan.md`](docs/m39-rich-link-anchor-plan.md) 补充与路线图 M39 编号区分说明。

### Changed

- **M32**：导出 HTML **`@media print`** 增补 `thead`/`tbody`/`tr`/`td`/`th` 分页与 **表头组**语义（[`htmlExport.ts`](src/core/export/htmlExport.ts) + 单测）。
- **M33**：窄视口下 Rich 表格 **字号 / 格内 padding**（[`MilkdownEditor.vue`](webview/src/components/MilkdownEditor.vue)）。
- [`docs/RICH_SOURCE_PARITY_CHECKLIST.md`](docs/RICH_SOURCE_PARITY_CHECKLIST.md) 管道表格行链至 M30。

## [1.39.3] - 2026-05-05

### Added

- **M20**：[`docs/RICH_SOURCE_UNDO_SEMANTICS.md`](docs/RICH_SOURCE_UNDO_SEMANTICS.md)；`useEditor` 撤销栈切换语义单测。
- **M21/M26**：阶段性文档 [`docs/M21_BLOCK_DRAG_REORDER_SPIKE.md`](docs/M21_BLOCK_DRAG_REORDER_SPIKE.md)、[`docs/M26_TABLE_VIRTUALIZATION.md`](docs/M26_TABLE_VIRTUALIZATION.md)。
- **M24**：脚注 fixture（`docs/fixtures/m9/05-footnotes.md`）在 Rich 往返中补充 **行内引用** 断言 [`richFixtureRoundTrip.test.ts`](webview/src/__tests__/richFixtureRoundTrip.test.ts)。
- **M25**：[`webview/src/utils/__tests__/url.test.ts`](webview/src/utils/__tests__/url.test.ts)；`m39-rich-link-anchor-plan.md` 增补 Wiki 链评估段落。
- **M27**：`MARKLY_TABLE_HTML_CLIPBOARD_MAX_CHARS` + HTML 超限 toast + [`markly-table-rich.test.ts`](webview/src/plugins/__tests__/markly-table-rich.test.ts)；[`docs/RICH_TABLE_USER_GUIDE.md`](docs/RICH_TABLE_USER_GUIDE.md) 说明。
- **M28**：[`docs/M28_TABLE_A11Y.md`](docs/M28_TABLE_A11Y.md)；`MilkdownEditor` 表格 `:focus-within` 轮廓与 `::selection`。
- **M29**：[`htmlExport.test.ts`](src/core/export/__tests__/htmlExport.test.ts) 长表 `thead/tbody`/行数断言。

### Changed

- **M22/M23**：`App.vue`、`MilkdownEditor.vue` 窄视口（`max-width: 520px`）边距与侧栏宽度。
- [`docs/RICH_SOURCE_PARITY_CHECKLIST.md`](docs/RICH_SOURCE_PARITY_CHECKLIST.md) 撤销行链接至 M20 语义文档。

## [1.39.2] - 2026-05-05

### Added

- **M10**：[`docs/IR_REMOVAL_PHASE0.md`](docs/IR_REMOVAL_PHASE0.md)（IR 剔除构建可行性：双栈、`define`/懒加载/删码顺序）；[`webview/vite.config.ts`](webview/vite.config.ts) 增补指向说明。
- **M11**：`marklyRichListIndentKeymapPlugin`（列表 Tab / Shift-Tab）抽取到 [`webview/src/plugins/markly-table-rich.ts`](webview/src/plugins/markly-table-rich.ts)；[`webview/src/__tests__/richListIndentKeymap.test.ts`](webview/src/__tests__/richListIndentKeymap.test.ts)。
- **M12**：[`webview/src/__tests__/richNewlineSerialization.test.ts`](webview/src/__tests__/richNewlineSerialization.test.ts)（硬换行与列表折行 stabilize）。
- **M13–M14**：共用 HTML 粘贴净化 [`webview/src/utils/richPasteSanitize.ts`](webview/src/utils/richPasteSanitize.ts)、黑名单 [`webview/src/utils/pasteDenylist.ts`](webview/src/utils/pasteDenylist.ts)；表格路径改调用该入口。
- **M15**：[`docs/RICH_IME_MANUAL.md`](docs/RICH_IME_MANUAL.md) + [`webview/src/__tests__/richImeComposition.test.ts`](webview/src/__tests__/richImeComposition.test.ts)（jsdom 烟雾）。
- **M16**：块级工具栏命令前「扩选区不单独入撤销栈」语义，见 [`docs/M16_BLOCK_FORMAT_SEMANTICS.md`](docs/M16_BLOCK_FORMAT_SEMANTICS.md)。
- **M17**：`prosemirror-gapcursor` + 样式；[`docs/M17_PROSEMIRROR_GAPCURSOR.md`](docs/M17_PROSEMIRROR_GAPCURSOR.md)。
- **M18**：Rich 空文档占位引导（[`MilkdownEditor.vue`](webview/src/components/MilkdownEditor.vue) 外壳层）。
- **M19**：多段 **`toggleMark` 顺序**单测 [`webview/src/__tests__/richMultiParagraphToggleMark.test.ts`](webview/src/__tests__/richMultiParagraphToggleMark.test.ts)。

### Changed

- 验收清单 [`docs/RICH_SOURCE_PARITY_CHECKLIST.md`](docs/RICH_SOURCE_PARITY_CHECKLIST.md) 补充 M11–M19 可追溯条目。

## [1.39.1] - 2026-05-05

### Added

- **IR 冻结（工程纪律 M01–M09）**：维护者文档 [`docs/IR_FREEZE_POLICY.md`](docs/IR_FREEZE_POLICY.md)，入口盘点 [`docs/IR_ENTRYPOINT_AUDIT.md`](docs/IR_ENTRYPOINT_AUDIT.md)，[`docs/RICH_SOURCE_PARITY_CHECKLIST.md`](docs/RICH_SOURCE_PARITY_CHECKLIST.md)，[`docs/TECH_DEBT_PREVIEW_RICH_NAMING.md`](docs/TECH_DEBT_PREVIEW_RICH_NAMING.md)；[`npm run check:ir-freeze`](scripts/check-ir-freeze.mjs)（`webview/src/core/decorators` 顶层 `*.ts` 数量基线）；PR 模板 [`.github/pull_request_template.md`](.github/pull_request_template.md)；CI 与该检查对齐。

### Changed

- Webview「复制诊断信息」载荷：在 `app` 段增加 **`editorModeTracked`**（`rich` / `source` / `legacy-ir`）；**`mode`** 仍为原始 **`EditorMode` 字符串**（含 `ir`）。
- AI 操作历史列表中非 Rich 条目的模式文案由「IR/源码」调整为「源码」（历史类型本为 CM6 `source`，不区分 IR/Source 子态）。

## [1.39.0] - 2026-05-05

### Added

- **M₉₁–M₁₀₀（产品化与工程收口）**：Getting Started 引导（`walkthroughs` **Markly 快速上手**）；全部命令 **Markly** 分组；设置项补充 **`markdownDescription`**（遥测、图片目录、Mermaid/Shiki、导出预检等）；**Help: Open Recovery & Troubleshooting**（`markly.help.recoveryCenter`）与 **`resources/TROUBLESHOOTING.md`**；**`markly.telemetry.enabled`**（默认 `false`，开启后仅本地 Output 计数）；工程文档 **`resources/BUNDLE_GOVERNANCE.md`**、**`PERFORMANCE_NOTES.md`**、**`CROSS_PLATFORM.md`**；**`docs/marketplace/FAQ.md`**、**`docs/M100-2.0-GATE.md`**；宿主 bundle 检查脚本增加 M96 策略提示。`ExtensionConfig.telemetry`、契约 `isExtensionConfig`、配置校验与相关单测已更新。

## [1.38.0] - 2026-05-05

### Added

- **M90（自定义模板目录）**：设置 **`markly.templates.userDirectory`** 为含 `*.md` / `*.markdown` 的目录（绝对路径或 `~/…`）。**New Markdown from Template…** 在「内置模板」下增加 **「自定义模板」** 分区，与 M89 内置模板同一流程另存为并打开。安全：读取用户文件时校验路径落在该目录下。实现：`userTemplateDirectory.ts`、`loadUserTemplate.ts`；单测：`userTemplateDirectory.test.ts`、配置/契约测试。

## [1.37.0] - 2026-05-05

### Added

- **M89（文档模板库）**：内置 **会议记录、周报、项目 README、博客文章、学习笔记** 五套 Markdown 模板（仓库根目录 `templates/*.md`，打进 VSIX）。命令 **`markly.template.newFromLibrary`**（**New Markdown from Template…**）：QuickPick 选择模板 → 另存为 → 用 Markly 打开。实现：`src/extension/templates/`。

## [1.36.0] - 2026-05-05

### Added

- **M88（发布前预览）**：使用与 **导出 HTML** 相同的 `buildExportHtmlString` 管线在侧栏 **Webview** 中只读预览（目录、KaTeX、Mermaid 等与导出一致）；本地相对路径图片改写为 Webview 可加载 URI。命令 **`markly.preview.exportHtml`**；工具栏增加预览按钮（与 PDF/HTML 导出并列）。实现：`src/core/export/htmlExport.ts`、`src/core/export/htmlPreviewImgRewrite.ts`、`src/extension/preview/exportHtmlPreview.ts`；单测：`htmlExport.test.ts`、`htmlPreviewImgRewrite.test.ts`。

## [1.35.0] - 2026-05-05

### Added

- **M87（富文本复制）**：**源码 / IR** 模式下复制选区时除 Markdown 文本外写入 **`text/html`**（由 `marked` 渲染片段）；**Rich** 模式下用 ProseMirror **`DOMSerializer`** 序列化选区为 HTML，并写入可读 **`text/plain`**。便于粘贴到邮件客户端与多数 IM 保留标题、列表、加粗、表格等结构。实现：`webview/src/utils/richClipboard.ts`、`webview/src/core/editor.ts`、`marklyRichClipboardCopyPlugin`（`markly-table-rich.ts`）；单测：`richClipboard.test.ts`。

## [1.34.0] - 2026-05-05

### Added

- **M86（导出失败诊断包）**：**PDF / HTML** 导出失败时错误通知提供 **「复制诊断包」**（错误信息与堆栈路径已脱敏）；命令 **`markly.export.copyFailureDiagnostics`** 可复制最近一次导出失败诊断。自定义编辑器侧导出失败与命令面板导出共用同一套逻辑。实现：`src/core/export/exportDiagnostics.ts`、`src/extension/export/exportFailureUi.ts`；单测：`exportDiagnostics.test.ts`。

## [1.33.0] - 2026-05-05

### Added

- **M85（Mermaid 导出一致）**：导出 **HTML** 与 **PDF** 共用 `src/core/export/mermaidExport.ts`：将 marked 产出的 ` ```mermaid ` 围栏转为 `<div class="mermaid markly-mermaid-await">`，内联 **`mermaid.min.js`**（运行时从扩展 `node_modules` 读取），在 **`DOMContentLoaded`** 中 **`mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme })`** 与 **`mermaid.run({ querySelector: '.markly-mermaid-await' })`**，与编辑器侧 `webview/src/config/mermaid.ts` 默认策略对齐；**HTML** 主题随 `darkMode` 在 `default`/`dark` 间切换，**PDF** 固定浅色 `default`。PDF 在 **`page.setContent`** 后 **`waitForFunction`** 等待各占位块出现 **`svg`**（超时仍导出）。根依赖 **`mermaid` 升至 `^11.12.3`** 与 webview 对齐。单测：`mermaidExport.test.ts`、`htmlExport.test.ts`、`pdfExport.test.ts`。

## [1.32.0] - 2026-05-05

### Added

- **M84（代码块导出增强）**：**PDF** 与 **导出 HTML** 中围栏代码统一加强 **长行换行**（`white-space: pre-wrap`、`word-break`、`overflow-wrap`）、**Tab 宽度**（`tab-size: 4`），PDF 增加 **`print-color-adjust: exact`** 以利打印背景色稳定；**HTML 打印**（`@media print`）将 `pre` 从「禁止拆页」改为 **允许跨页**，避免长代码块整段挤在一页；`blockquote` 仍保持尽量不拆页。`print-friendly` HTML 主题对 `pre` 追加相同换行规则。**学术** PDF 模板下的 `pre` 同步换行属性。单测：`pdfExport.test.ts`、`htmlExport.test.ts`。

## [1.31.0] - 2026-05-05

### Added

- **M83（导出前检查）**：导出 **PDF / HTML** 前增加可配置预检（`markly.export.preflight.scope`：`off` | `images` | `full`，默认 `full`；`markly.export.preflight.blockOnIssues` 为 `true` 时须确认「仍要导出」）。`full` 覆盖 **本地图片缺失**、**可解析为本地 fs 路径的 Markdown 链接目标缺失**、**疑似未配对的 `$` / `$$`**（围栏代码块已剔除的启发式检查）。实现：`exportPreflight.ts`、`exportPreflightUi.ts`；`markdownLinkRefs` 与图片引用解析迁入 `src/core/markdown/` 供 core 与扩展共用。单测：`exportPreflight.test.ts`、`configuration.test.ts`、`messageContract.test.ts`。

## [1.30.0] - 2026-05-05

### Added

- **M82（HTML 资源打包导出）**：可选 **`markly.export.html.copyLocalImages`**（默认 `false`）在导出 HTML 时把 Markdown 文档目录内的 **本地相对路径图片** 复制到输出 HTML 旁的 **`markly.export.html.assetsSubdirectory`**（默认 `markly-html-assets`，单层目录名，配置校验禁止 `..` 与路径分隔符），并重写 `<img src>`。实现：`htmlBundleImages.ts`、`exportToHtml` 选项 `documentBaseDir` / `assetsSubdirectory`；`MarkdownEditorProvider` 与 **`Export as HTML`** 命令传入文档目录。单测：`htmlBundleImages.test.ts`、`htmlExport.test.ts`、`configuration.test.ts`。

## [1.29.0] - 2026-05-05

### Added

- **M81（PDF 模板扩充）**：新增 VS Code 设置 **`markly.export.pdf.template`**，可选 **`default`**（沿用原 GitHub 系浅色无衬线版式）与 **`academic`**（衬线字体、暖灰纸感代码块/表格、双线下划目录标题等）。页边距、目录开关、页眉页脚开关仍由既有 `markly.export.pdf.*` 控制；导出时 `body` 带 `markly-pdf--{template}` 类名，Puppeteer 页眉文案随模板区分。类型：`PdfExportTemplateId`。单测：`pdfExport.test.ts`、`configuration.test.ts`。

## [1.28.0] - 2026-05-05

### Added

- **M80（AI Provider 插件化预留）**：写作辅助宿主侧拆分 — **`AssistFeatureSnapshot`**（与用户设置对齐、不含密钥）与 **`AssistModelOperations`**（`rewriteSelection` / `summarize` / `suggestTitles` / `convertTextToGfmTable`）由 **`createAssistModelOperations`** + **`AssistRuntimeDeps`**（`getBearerToken`、可注入 **`fetch`**）装配；HTTP 共用 **`openAiCompatibleChatCompletion`**。VS Code 绑定集中在 **`assistExtensionBridge.getAssistModelOperationsForExtension`**。GFM 本地工具迁至 **`gfmTableLocal.ts`**，`textToGfmTable.ts` re-export；`validateAiRewriteConfig` 使用 **`assistFeatureSnapshotFromExtensionConfig`**。行为与报错文案保持与拆分前一致。单测：`assistModelOperations.test.ts`、`openAiCompatibleTransport.test.ts`。

## [1.27.0] - 2026-05-05

### Added

- **M79（AI 操作历史）**：侧栏在「摘要」下新增 **「AI 操作」** 面板，记录最近一次 **已成功落盘** 的 **选区润色** 与 **选区转 GFM 表**（最多 15 条）。支持 **回看**（与 M72/M76 同款双栏只读对照）及 **撤销**：IR/源码模式下按 UTF-16 偏移将仍与记录一致的段落还原为原文并调整后续条目偏移（与撤回区间相交的条目自动丢弃）；Rich 模式下若当前选区仍等于记录中的 AI 结果则尝试 `replacePlainSelection` 还原。实现：`webview/src/utils/aiApplyHistory.ts`、`AiApplyHistoryPanel.vue`。单测：`aiApplyHistory.test.ts`、`AiApplyHistoryPanel.test.ts`。

## [1.26.0] - 2026-05-05

### Added

- **M78（AI 隐私说明成文）**：新增随扩展分发的 **`privacy/AI_PRIVACY.md`**（「三句话」可复述摘要 + 各 AI 能力出站数据范围表 + SecretStorage 说明）；命令 **AI: Open Privacy Notice**（`markly.ai.openPrivacyNotice`）在编辑器中打开该文档。`markly.ai.rewrite.enabled` / `markly.ai.rewrite.provider` 补充 **`markdownDescription`**；README 增加 AI 隐私小节；侧栏「摘要」面板增加固定出站提示。单测：`aiPrivacyNotice.test.ts`。

## [1.25.0] - 2026-05-05

### Added

- **M77（长文结构建议）**：侧栏在大纲下新增「**结构建议**」面板，**纯本地**扫描 ATX 标题：**锚点与其它节重复**、**层级断层**（例如 H2 后直连 H4）、**文档以 H3+ 起头**；点击任一条与大纲相同方式滚至对应标题。实现：`analyzeMarkdownStructureHints`、`StructureHintsPanel`。单测：`markdownStructureHints.test.ts`、`StructureHintsPanel.test.ts`。

## [1.24.0] - 2026-05-05

### Added

- **M76（AI 表格整理二期）**：新增命令 “Writing: Convert Selection to GFM Table (AI)”，将 **选区内非 Markdown 管道的表格文本**（含 mock 支持的 **TSV / 逗号分列且列数一致**）转为 **GFM**，并在 Webview **预览确认后才替换选区**（对齐 M72 安全模型）。扩展端：`textToGfmTableViaProvider` + `AI_CONVERT_TEXT_TO_TABLE_*` 消息；mock 仅用确定性分列规则，通用转换需 openai-compatible。单测：`textToGfmTable.test.ts`、`messageContract`。

## [1.23.0] - 2026-05-05

### Added

- **M75（Markdown 结构修复二期）**：文档级本地「修复 Markdown」增强为结构修复：**标题层级**（避免从上一级一下跳到 H4+）；**列表**（`*`/`+`→`-`，task 勾选规范化）；**空行**（段落↔标题、标题↔正文之间补一空行）；` ``` ` / `~~~` 代码围栏内保持不变。合并入口 `fixMarkdownStructuralPhaseTwo`。命令面板条目更名为 “Writing: Fix Markdown Structure”。单测：`markdownStructureRepair.test.ts`。

## [1.22.0] - 2026-05-05

### Added

- **M74（AI 标题建议二期）**：写作辅助「标题建议」升级为 AI 多候选：弹窗展示多条候选标题（含**风格**与可选理由），可一键应用到文档（替换第一条 `#` 标题或插入到顶部）。实现：`AI_SUGGEST_TITLES_REQUEST/RESULT` 协议；扩展端 `suggestTitlesViaProvider` 复用 openai-compatible 配置/SecretStorage key。单测：`titleSuggestions.test.ts`、`messageContract.test.ts`。

## [1.21.0] - 2026-05-05

### Added

- **M73（AI 摘要侧栏）**：侧栏新增「摘要」面板，支持生成**全文**或**当前章节**摘要，并可复制/插入到文档。实现：`AI_SUMMARY_REQUEST/RESULT` 消息协议；扩展端 `summarizeViaProvider` 复用 openai-compatible 配置与 SecretStorage API key；Webview `AISummaryPanel` + `extractMarkdownSectionByHeadingId`。单测：`AISummaryPanel.test.ts`、`outline.test.ts`、`messageContract.test.ts`。

## [1.20.0] - 2026-05-05

### Added

- **M72（润色 Diff 预览）**：选区润色不再直接替换内容；AI 返回后先弹出预览对话框（原文 / 润色后），用户点击「替换选区」后才真正写入。若选区内容已变化则提示重新选择，避免误替换。单测：`rewriteSelectionPreview.test.ts`。

## [1.19.0] - 2026-05-05

### Added

- **M71（AI Provider 配置体验）**：新增命令 “AI: Validate Setup” 用于校验 openai-compatible 配置；当 AI 相关 settings 变更且启用时，自动提示 endpoint / model / API Key / timeout 等常见缺失或不合理项，并提供一键入口（设置 API Key / 打开设置）。配置项 description 增强提示 SecretStorage 与校验命令。单测：`validateAiRewriteConfig.test.ts`。

## [1.18.0] - 2026-05-05

### Added

- **M70（长文档稳定门禁）**：新增 `docs/fixtures/m70` 的长文档 seed，并补充单测门禁 `largeDocStabilityGate.test.ts`：用 seed 生成跨越 `richPerfTier`（T1/T2）阈值的大文档，验证档位切换与降级 banner 文案稳定，防止回归。

## [1.17.0] - 2026-05-05

### Added

- **M69（章节折叠编辑）**：Source/IR 模式支持按 Markdown ATX 标题折叠章节块（gutter 折叠三角）。折叠范围为「当前标题行之后」直到下一条同级或更高标题行。实现：`computeMarkdownHeadingFoldRange`（`webview/src/core/markdownFolding.ts`）+ CM6 `foldService`/`foldGutter`；单测 `markdownFolding.test.ts`。

## [1.16.0] - 2026-05-05

### Added

- **M68（跨文件搜索入口）**：查找面板增加「工作区搜索」按钮（🔎），一键调起 VS Code 的「在文件中查找」（`workbench.action.findInFiles`）并自动填入当前查找词。实现：Webview `OPEN_WORKSPACE_SEARCH` 消息 + extension 执行命令；单测 `FindReplacePanel.test.ts`、`messageContract.test.ts`。

## [1.15.0] - 2026-05-05

### Added

- **M67（查找命中列表）**：查找面板下方展示命中列表（上下文片段预览），点击某条可直接跳转到对应匹配；Rich/Source 统一复用 `activateFindMatch` 逻辑（Rich 会定位第 n 次出现的 plain text）。单测：`FindReplacePanel.test.ts`。

## [1.14.0] - 2026-05-05

### Added

- **M66（大文档档位可见）**：工具栏增加「档位」提示（XS/S/M/L/XL），并在 tooltip 中汇总当前 Rich 性能档位与已生效的降级项（如 Shiki 语法高亮 / Mermaid 渲染 / Rich 表格列宽拖拽自动关闭等），让用户明确“为什么某些效果没了”。实现：`App.vue` 计算 `docBaselineTierLabel` + `perfDegradeTitle`，`Toolbar.vue` 展示；单测 `toolbarModes.test.ts`。

## [1.13.0] - 2026-05-05

### Added

- **M65（内部链接悬停预览）**：在 Rich 模式中鼠标悬停到内部 Markdown 链接（`#锚点` 或相对 `.md#锚点`）时，显示浮层预览：目标标题 + 该标题下的摘要片段，并提供「打开」按钮在宿主侧预览打开目标文件。实现：`MARKDOWN_HOVER_PREVIEW_REQUEST/RESULT` 消息协议、扩展端 `computeMarkdownHoverPreview`（`src/extension/markdown/markdownHoverPreview.ts`）、`MilkdownEditor` hover 事件、`App.vue` 浮层 UI；契约单测更新。

## [1.12.0] - 2026-05-05

### Added

- **M64（反向链接基础）**：打开「大纲」侧栏时在下方展示 **反向链接**：扫描当前工作区内其它 Markdown（最多约 650 个文件，超限标记截断）中是否包含指向本篇的 `[文字](路径)`、`[ref]: 路径` 或 `[[wiki]]`（无扩展名时按 `.md` 解析）；以工作区相对路径列出，点击在宿主中用预览模式打开对应文件（须落在工作区内）。↻ 可手动刷新。单测：`markdownLinkRefs.test.ts`、`BacklinksPanel.test.ts`。

## [1.11.0] - 2026-05-05

### Added

- **M63（锚点 / 重复标题）**：按与大纲一致的 `generateHeadingId` 规则检测文档内重复 slug；侧栏重复标题行显示 ⚠ 与说明；点击大纲跳转或 Rich 内 `#` 锚点（含目录）时若存在冲突则 Toast 提示「可能总是跳到第一个同名标题」。实现：`getDuplicateHeadingSlugs`、`isHeadingSlugAmbiguous`（`webview/src/shared/outline.ts`）、`OutlinePanel.vue`、`App.vue`（`handleOutlineJump`、`handleRichTocAnchorClick`）；单测 `outline.test.ts`、`OutlinePanel.test.ts`。

## [1.10.0] - 2026-05-05

### Added

- **M62（大纲拖拽调序）**：侧栏大纲在「最低标题级别」上显示 **⋮⋮** 拖动手柄（≥2 个同级章时）；将整块正文（该标题及其下所有更深层标题，直到下一同级章）拖到另一顶级标题行上释放以调整顺序。筛选开启时禁用拖放。实现：`partitionMarkdownByTopLevelHeadings`、`reorderMarkdownTopLevelSections`（`shared/outlineReorder.ts`）、`OutlinePanel` + `App.handleOutlineReorder`；单测 `outlineReorder.test.ts`。

## [1.9.0] - 2026-05-05

### Added

- **M61（大纲搜索）**：侧栏大纲增加「筛选标题」输入框；不区分大小写子串匹配，显示匹配项及其**祖先标题**以便定位；无匹配时提示「无匹配标题」；<kbd>Esc</kbd> 清空筛选。实现：`collectOutlineFilterIndices`（`shared/outline.ts`）、`OutlinePanel.vue` 样式与行为；单测 `outline.test.ts`、`OutlinePanel.test.ts`。

## [1.8.3] - 2026-05-05

### Added

- **M60（表格用户说明）**：新增 `docs/RICH_TABLE_USER_GUIDE.md`（插入、删表/行列、粘贴与上限、`markly.table.*`/`Insert Table`、`tidyTables`、性能相关设置）；`README` 与 `MARKDOWN_CAPABILITIES` 增补链接或边界说明；Rich 表格帮助弹层提示该文档路径。

## [1.8.2] - 2026-05-05

### Added

- **M59（大表格性能二期）**：设置项 `markly.editor.richTableColumnResize`（`auto`|`on`|`off`）。`auto` 按 Markdown 中表格体量（阈值与粘贴软确认对齐：≥18 行、≥10 列或 ≥200 格）自动跳过 GFM `columnResizingPlugin`，减轻滚动与选区跟手延迟；`on`/`off` 强制开关。文档变更后约 480ms 防抖重算，设置变更立即生效。`MilkdownEditor` 开关变化时安全销毁并重载实例。表格容器增加 `contain` / `overscroll-behavior`。工具模块 `richTablePerf.ts` + 单测 `richTablePerf.test.ts`。

## [1.8.1] - 2026-05-05

### Added

- **M58（表格 round-trip fixture）**：`docs/fixtures/m9` 新增 `11-tables-stacked.md`、`12-table-rich-cells.md`、`13-table-wide-grid.md`；`04-tables-gfm.md` 的 `MUST_CONTAIN` 扩充为对齐规范化子串与空单元格 `<br />` 等，锁住 Rich↔Source 序列化不丢格/不丢对齐信息。单测：`richFixtureRoundTrip.test.ts`。

## [1.8.0] - 2026-05-05

### Added

- **M57（表格粘贴预览）**：Rich 中解析为矩阵粘贴前 `window.confirm` 展示节选预览与说明。触发条件：① 剪贴板 HTML 含 `<table>` 且 `body` 上仍有其它可见片段（「脏 HTML」，仅插入解析矩阵）；② 矩阵超过软阈值（`MARKLY_TABLE_PASTE_SOFT_CONFIRM_*`，仍低于硬上限）；③ 超限矩阵经 `recoverOversizedPasteGrid` **截断**到硬上限再粘贴（用户可选择确认）。取消时：仅脏 HTML + 矩阵不大则 **不拦截**（交给浏览器默认粘贴）；否则会拦截并可选 toast「已取消表格粘贴。」。导出：`buildHtmlTableGridUnchecked`、`truncatePasteGridToLimits`、`recoverOversizedPasteGrid`、`gridNeedsSoftPasteConfirm`、`summarizePasteGridPreview`。单测：`markly-table-rich.test.ts`。

## [1.7.6] - 2026-05-05

### Fixed

- **M56（Rich 表格快捷键）**：表内普通 Enter 不再走 GFM 「整表退出」；GFM `table_cell` 仅允许单段 `paragraph`、`splitBlock` 无效时用 `hardbreak` 单元格内换行；Tab/Shift-Tab 在表内仍优先列表 `sinkListItem`/`liftListItem`（无列表时交由 GFM 切格）；`webview/src/__tests__/richTableKeyboard.test.ts`；导出 `richTableToggleListIndentInTable` 供单测。**说明**：当前 Milkdown 预设下单元格内无法合法嵌套 `bullet_list`，列表缩进项用精简 PM schema 单元测覆盖。

## [1.7.5] - 2026-05-05

### Added

- **M55**：未引用 assets 扫描建议：比对保存目录一层图片与正文本地路径（`![]()`、`[](url)`、引用定义行）；资产面板新增「复制未引用清单」，无缺失时显示信息横幅；复制诊断前自动拉取目录列表；命令 `markly.image.copyUnreferencedList`、`markly.image.openAssetsPanel`。

## [1.7.4] - 2026-05-05

### Added

- **M54**：缺失图片批量修复：宿主在选图替换或取消后下发 `IMAGE_REF_REPAIR_OUTCOME`；Webview 顺序等待并支持 `window.confirm` 确认；命令 `markly.image.repairMissingRefsBatch` 与提示条/资产面板入口。

## [1.7.3] - 2026-05-05

### Added

- **M53**：图片资产面板二期：分区展示「已引用且存在」「已引用缺失」「保存目录一层内未检出引用」；协议 `LIST_ASSETS_IMAGE_FILES` / `ASSETS_IMAGE_FILES_RESULT`；路径规范化比对 `canonicalMarkdownLocalRefKey`。

## [1.7.2] - 2026-05-05

### Added

- **M51**：工作区图片文件重命名/移动后，若当前活动编辑器为 Markdown，提示「修复当前文档」中的图片引用（经 Markly webview 执行 `documentReplace`）。
- **M52**：设置项 `markly.image.sameNameHandling`（`overwrite` / `rename` / `prompt`）；粘贴/拖拽 `UPLOAD_IMAGE` 与 `SAVE_IMAGE` 在 assets 下同名时按策略处理；`IMAGE_SAVED` / `IMAGE_SAVE_FAILED` 可选 `requestId` 与上传请求对齐。
- 文档：`docs/milestones-M51-M100.md`（执行矩阵与 backlog）。

## [1.7.1] - 2026-05-02

### Added

- `exportErrors.formatExportFailure` for PDF/HTML export user-facing errors; tests in `exportErrors.test.ts`.
- Diagnostics `doc.docBaselineTier` (xs–xl) for document size baseline (M₈).
- Image paste: toast when compressing over threshold and when file nears max size; `compressThreshold` follows workspace config.

### Changed

- Rich focus restoration: `queueRichFocus` uses double `requestAnimationFrame`; find-match activation refocuses Rich.
- Outline scroll spy throttled (120ms) with timer cleanup on unmount.
- Rich tables: scrollable max-height in editor (`style.css`).
- A11y: app root `role="application"`, toolbar `role="toolbar"`, `ToolbarButton` `aria-label`.
- Docs: M₄₅/M₄₆ Rich vs Source table; README Shiki, release checklist, UI test pointer; milestones M₁–M₅₀ all satisfied in matrix.

## [1.7.0] - 2026-05-02

### Added

- PDF export: workspace-driven margins/format/TOC/header-footer via `pdfExportOptionsFromPdfConfig`; print-oriented CSS for tables, code blocks, and block math.
- PDF export: pre-flight warning when local image refs are missing; `<base>` for relative assets.
- AI assist: `rewriteSelection` host path with mock and OpenAI-compatible provider, SecretStorage API key, timeout, and error snippet redaction; extension tests.
- Plans and roadmap updates for M38–M47 (`docs/m38`–`m47`, `product-roadmap-2026.md`).
- Stable gate script documentation: `npm run gates:stable` and UI test guidance in README / `m46-stable-gates-plan.md`.

### Changed

- README configuration table expanded for PDF, HTML theme, and AI rewrite settings.
