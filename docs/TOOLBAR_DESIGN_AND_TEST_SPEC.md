# 工具栏（Toolbar）设计文档：实现原理、效果与验证方法

> 目标：这份文档不仅列“有哪些按钮”，而是把每个功能的 **实现原理**、**效果要求**、**验证方法**（单测/E2E/手测）写清楚，便于对照代码检查“是否真实实现、是否按原理实现、是否有端到端覆盖”。
>
> 范围：Webview 工具栏（`webview/src/components/Toolbar.vue`）及其在 `webview/src/App.vue` 的处理链路；涉及 Extension 侧命令/导出/诊断的入口会给出指向，但本文重点是“工具栏触发的能力”。

## 1. 术语与架构

- **工具栏**：Webview 顶部按钮区，负责触发编辑命令、视图开关、导出、缩放等。
- **两种编辑内核**
  - **Rich**：Milkdown/ProseMirror（`milkdownRef`）负责格式化/插入/表格操作等。
  - **Source**：CodeMirror 6（`editor` composable）负责纯文本编辑、行号、部分格式化与插入。
- **通信协议（非 Markdown 协议）**
  - 工具栏触发“导出/保存”等需要由 Extension 执行的动作时，通过 `sendMessage(postMessage)` 发送类型化消息（见 `src/types`）。
  - 示例：`handleExport()` → `sendMessage({ type: 'EXPORT', payload: { format } })`。

## 2. 按钮总览（可审计清单）

本节给出“按钮 → 触发事件 → 处理函数 → 关键实现点”的对照表。审计时可以按每行去代码里核对。

### 2.1 模式切换（2）

- **Rich / Source**
  - **UI**：`webview/src/components/Toolbar.vue`（mode switch 组）
  - **事件**：`$emit('switch-mode', mode)`
  - **处理**：`webview/src/App.vue` → `switchMode(mode)`
  - **原理**：
    - Rich：同步内容到 Milkdown，启动 watchdog（失败自动 fallback 到 Source）
    - Source：同步内容到 CM6，重建/聚焦 view，恢复滚动位置
  - **效果要求**：
    - 切换不会丢内容；Rich 启动失败必须能自动回落 Source 并提示
  - **验证方法**：
    - 单测：`webview/src/components/__tests__/toolbarModes.test.ts`（至少验证只有 rich+source）
    - 手测：打开 md → Rich/Source 来回切 5 次，确认内容一致、焦点可输入

### 2.2 标题（4：H1/H2/H3/H4）

- **UI**：`Toolbar.vue` headingButtons
- **事件**：`$emit('format', 'h1' | 'h2' | 'h3' | 'h4')`
- **处理**：`App.vue` → `handleFormat(format)`
- **原理**：
  - Rich：`milkdownRef.applyFormat(format)`
  - Source：`editor.applyFormat(format)`
- **效果要求**：
  - 在光标所在行插入/切换为对应标题语义；不应破坏选区
- **验证方法**：
  - 单测（建议新增或已有）：对 Rich/Source 分别 setContent → click → assert content 结构变化
  - 手测：对多段落、列表内标题、已有标题的切换

### 2.3 文本格式（5：Bold/Italic/Strike/Inline Code/Clear）

- **UI**：`Toolbar.vue` formatButtons
- **事件**：`$emit('format', id)`
- **处理**：`App.vue` → `handleFormat(id)`
- **原理**：同标题，Rich 走 Milkdown，Source 走 CM6
- **效果要求**：
  - 对选区进行包裹或切换 mark；Clear 能移除已有 mark（按各编辑器能力实现）
- **验证方法**：
  - 单测：Rich 的格式化应通过 `milkdownRef.applyFormat` 路径覆盖；Source 覆盖 `editor.applyFormat`

### 2.4 列表（4：Bullet/Ordered/Task/Quote）

- **UI**：`Toolbar.vue` listButtons
- **事件**：`$emit('format', id)`
- **处理**：`App.vue` → `handleFormat(id)`
- **效果要求**：生成/切换列表与引用块结构
- **验证方法**：
  - 单测：对不同光标位置（空行/已有列表）点击后的 markdown 变化做断言

### 2.5 插入（6：Link/Image/CodeBlock/Table/HR/Math）

- **UI**：`Toolbar.vue` insertButtons
- **事件**：`$emit('insert', id)`
- **处理**：`App.vue` → `handleInsert(type)`
- **原理**：
  - Rich：`milkdownRef.insertNode(type)`
  - Source：`editor.insertNode(type)`
- **效果要求**：
  - 插入后保持可继续输入（焦点回到编辑器）
- **验证方法**：
  - 单测：覆盖至少 3 个代表性插入（link/codeBlock/table）
  - 手测：插入图片时路径/占位符与后续保存是否正确

### 2.6 Rich 表格结构操作（14 + 帮助 1）

- **UI**：`Toolbar.vue` tableStructureButtons + help button
- **事件**：
  - op：`$emit('rich-table-op', op)`
  - help：`$emit('rich-table-help')`
- **处理**：
  - `App.vue` → `handleRichTableOp(op)`
  - `App.vue` → `richTableHelpOpen = true`（弹层）
- **原理**：
  - 仅在 Rich 且 `richTableActive` 时可点
  - `handleRichTableOp` 调 `milkdownRef.runRichTableOp(op)`
- **效果要求**：
  - 行/列插入删除、对齐、合并拆分在表格内即时生效
  - 不在表格内时按钮禁用（避免“点了没反应”的困惑）
- **验证方法**：
  - 单测：`toolbarModes.test.ts` 已覆盖“delete-table 按钮存在性”；建议补一条 “disabled 状态” 与 “emit op” 的断言
  - E2E（建议新增）：在 Rich 插入表格 → 执行 addRowAfter/deleteCol → 校验 markdown 变更或 DOM 表格结构变更

### 2.7 撤销/重做（2）

- **UI**：`Toolbar.vue`（Undo/Redo）
- **事件**：`$emit('undo')` / `redo`
- **处理**：`App.vue` → `handleUndo()` / `handleRedo()`
- **原理**：
  - Rich：`milkdownRef.undo/redo`
  - Source：`editor.undo/redo`，并 `focusEditor()` 恢复焦点
- **效果要求**：一次点击对应一次 undo/redo；焦点不丢
- **验证方法**：
  - 单测：Source 下插入文字 → undo → assert content；Rich 下同理（若已有相关测试则引用）

### 2.8 查找/替换（1）

- **UI**：`Toolbar.vue`（查找按钮）
- **事件**：`$emit('find-replace')`
- **处理**：`webview/src/App.vue` → `onToolbarFindReplace()` → `findReplaceVisible.value = true`
- **原理**：查找面板是 Webview 内部 UI（`FindReplacePanel`），不依赖 Extension
- **效果要求**：打开后可输入、可 next/prev、可替换
- **验证方法**：
  - 单测：`webview/src/composables/__tests__/useFindReplace.test.ts`、`FindReplacePanel.test.ts`
  - 手测：大文档匹配截断提示与性能表现

### 2.9 缩放（3：缩小/重置/放大；点击立即生效）

- **UI**：`Toolbar.vue`（Zoom 组三按钮）
- **事件**：`$emit('zoom-out')` / `zoom-reset` / `zoom-in`
- **处理**：`App.vue` → `zoomOut/zoomReset/zoomIn`
- **原理**：
  - `zoom` 状态写入 CSS 变量 `--markly-zoom`（`applyZoomToDom`）
  - 通过 `setState({ marklyZoom })` 持久化到 webview state（有 debounce）
- **效果要求**：点击一次立即生效；显示百分比；刷新/重载后可恢复
- **验证方法**：
  - 单测（建议新增）：触发事件后断言 `document.documentElement.style` 的 `--markly-zoom`
  - 手测：连续点击放大 5 次，重载 webview 后百分比仍一致

### 2.10 视图开关（2～3：大纲/行号/性能档位）

- **大纲**
  - **事件**：`$emit('toggle-outline')`
  - **处理**：`webview/src/App.vue`：`@toggle-outline="showOutline = !showOutline"`（直接在模板里切换）
  - **效果**：OutlinePanel 显示/隐藏
- **行号**
  - **事件**：`$emit('toggle-line-numbers')`
  - **处理**：`App.vue` → `handleToggleLineNumbers()` → `editor.toggleLineNumbers()`
  - **效果**：Source/CM6 行号显示切换
- **验证方法**：
  - 手测：开启/关闭大纲与行号不影响编辑焦点

### 2.11 导出（3：PDF/HTML/预览）

- **UI**：`Toolbar.vue` export buttons
- **事件**：`$emit('export', 'pdf'|'html'|'preview')`
- **处理**：`App.vue` → `handleExport(format)` → `sendMessage({ type:'EXPORT', payload:{format} })`
- **原理**：真正的导出执行在 Extension 侧；Webview 负责发起请求、展示结果/错误/诊断入口
- **效果要求**：
  - 预览导出失败时必须给出可诊断信息（而不是静默失败）
- **验证方法**：
  - 单测：`src/core/export/__tests__/*`、`src/extension/export/*` 相关（按导出链路）
  - E2E：`e2e/suite/*` 覆盖导出/预览路径（若已有则补断言）

## 3. 交互与信息架构要求（针对“按钮太宽/需要名字/缩放即点即生效”）

- **两排布局**：避免一行过宽导致横向滚动（降低发现成本）
- **按钮显示名称**：每个按钮都必须做到“看得懂干什么”，不得依赖 tooltip
- **缩放即时生效**：放大/缩小必须是“一次点击一次生效”，不要让用户先打开菜单再选择

## 4. 端到端（E2E）覆盖建议（验收清单）

> 目的：让“文档里的功能”能被自动化验证，防止假实现/回归。

最小 E2E 清单建议（按优先级）：

1. **模式切换**：Rich ↔ Source，内容不丢
2. **格式化**：Bold/Heading 代表性用例（Rich 与 Source 各 1）
3. **插入**：插入 codeBlock/link 代表性用例（Rich 与 Source 各 1）
4. **查找替换**：打开面板、find next
5. **缩放**：点放大一次，断言缩放状态变化（可通过 CSS 变量或显示百分比）
6. **导出预览**：触发 preview export，断言成功或失败时有诊断入口
7. **Rich 表格**：插入表格后执行 addRowAfter，断言表格结构变化

## 6. 现有 E2E 覆盖映射（按钮级）

> 位置：`e2e/ui-suite/markly-ui.test.js`（ExTester，真 VS Code UI）

### 6.1 模式与视图

- **Rich / Source**：`toolbar: Rich → Source → Rich round-trip`、`Rich/Source: toggling 10x...`
- **大纲/行号**：`toggles outline and line number visibility from toolbar`

### 6.2 查找/替换

- **打开面板（快捷键）**：`Find/Replace panel: keyboard opens UI...`
- **打开面板（工具栏按钮）**：`Find/Replace panel: toolbar Find button opens UI`

### 6.3 缩放（立即生效）

- **缩小/重置/放大**：`Toolbar: zoom buttons apply immediately and update indicator`  
  断言点：工具栏百分比 + `--markly-zoom` CSS 变量。

### 6.4 导出（按钮 → EXPORT 消息）

- **PDF/HTML/预览**：`Toolbar: export buttons post EXPORT message with correct format`  
  断言点：E2E bridge `getPostedMessages()` 观测到 `{ type:'EXPORT', payload:{ format } }`。

### 6.5 标题/格式/列表/插入

- **标题 H1/H3 + inline 格式 + Clear（Source）**：`Source mode: headings H1/H3, inline formats, clear format`
- **标题 H2/H4（Source）**：`Source mode: headings H2/H4 are wired and change markdown`
- **Bold/Undo/Redo（Source）**：`Source mode: bold, toolbar undo, toolbar redo`
- **列表 4 项（Source）**：`Source mode: bullet, ordered, task list, quote`
- **插入（Source：HR/CodeBlock/Table/Math）**：`Source mode: toolbar inserts HR, code block, table, math`
- **插入（Rich：Link/Image/CodeBlock/Math）**：`Rich mode: toolbar inserts link image code block and math placeholders`

### 6.6 Rich 表格结构按钮（按钮级覆盖）

- **表格帮助**：`Toolbar: rich table help button opens/closes help dialog`
- **结构操作集合（覆盖 addRowBefore/addColAfter/toggleHeaderRow/alignLeft/Center/Right/deleteRow/deleteCol/deleteTable）**：  
  `Rich table: all toolbar structure ops are present and work (minimal effects)`
- **merge/split 语义（按钮级）**：`Rich table: toolbar merge(2x2) then split...`
- **addRowAfter（按钮级）**：`Rich mode: toolbar "insert row below" adds a table row...`

### 6.7 语义单元测试补强（非 UI、但验证“原理/效果”）

- **E2E bridge 白名单契约**：`webview/src/utils/__tests__/e2eBridgeContract.test.ts`
- **toggleHeaderRow 非 no-op**：`webview/src/plugins/__tests__/markly-table-rich.test.ts`（新增用例：`toggleHeaderRow 会改变表格结构`）

## 5. 代码真实性审计（如何用本文档“验实现”）

按每个功能至少做三步：

1. **找入口**：`Toolbar.vue` 是否有对应按钮与 emit
2. **找链路**：`App.vue` 是否有对应 handler（如 `handleFormat/handleInsert/handleExport/zoomIn`）
3. **找效果**：是否真的调用到编辑器内核（Milkdown/CM6）或发出消息（EXPORT/SAVE 等）

