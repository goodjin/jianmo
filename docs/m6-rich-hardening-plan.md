## M6：Rich 稳用与可配置化（Hardening）

> 状态：已完成（2026-04-21）
> 目标版本：`1.4.3`（PATCH）

### 目标（DoD）

- **稳定性**：Rich 初始化失败/超时可自动降级到 Source（已具备），并提供 **一键重试回 Rich**。
- **性能与降级**：重渲染能力（Mermaid/Shiki 等）支持按需启用/失败降级，不影响编辑。
- **可配置**：超宽内容策略可配置（换行 vs 横向滚动，表格单元格换行策略等），三模式一致。
- **回归门禁**：新增 3–5 条单测覆盖降级/重试/配置生效，`npm test` 全绿。

### 任务顺序（按依赖）

1) **M6-1**：Rich 降级后的“一键重试回 Rich”
2) **M6-2**：重渲染插件按需启用/降级（Mermaid/Shiki）
3) **M6-3**：超宽内容策略可配置化（wrap/scroll/table cell wrap）
4) **M6-4**：补回归测试（ready=false、watchdog、重试、配置）
5) **M6-5**：发版 1.4.3 + 文档记录

### 执行记录

- [x] **M6-1**：Rich 降级提示条 + “重试 Rich”
- [x] **M6-2**：Mermaid 懒加载 + Shiki 可选启用且失败自动降级启动
- [x] **M6-3**：新增配置：`wrapPolicy` / `tableCellWrap` / `enableMermaid` / `enableShiki`
- [x] **M6-4**：新增回归单测：wrapPolicy class、watchdog 降级、重试 Rich
- [x] **M6-5**：发版 `1.4.3`（门禁/构建/打包）

### M6-1：一键重试回 Rich

- **实现**：
  - Source/IR 模式下，当最近一次 Rich 启动失败/超时并触发降级时，在编辑器顶部或工具栏附近展示轻提示条：
    - 文案：`Rich 启动失败，已切换到 Source。`
    - 按钮：`重试 Rich`
  - 点击后执行：
    - 清理 watchdog/状态
    - 允许再次自动降级（但仍需防止循环 toast）
    - 切换到 `rich`
- **验收**：
  - 模拟 `@ready(false)` 后自动切 Source，提示条出现
  - 点击“重试 Rich”后尝试切回 Rich；若仍失败，仍能再次降级且不刷屏

### M6-2：重渲染按需启用/失败降级

- **实现**：
  - 为 Mermaid/Shiki 等提供开关或延迟加载策略
  - 失败时降级为纯文本/代码块，不阻断 Rich 编辑器启动
- **验收**：
  - 关闭开关或模拟异常时，Rich 仍可启动并编辑

### M6-3：超宽内容策略可配置化

- **建议配置项（最小集合）**：
  - `markly.rich.wrapPolicy`: `autoWrap | preferScroll`
  - `markly.rich.tableCellWrap`: `wrap | nowrap`
- **验收**：
  - 改配置能即时影响编辑区表现（至少 rich + source）
  - `npm test` 全绿

### M6-4：测试与回归

- **新增单测建议**：
  - `App`：触发 `onRichReady(false)` → 自动切 `source` 且出现提示条
  - watchdog 超时（fake timers）→ 自动切 `source`
  - 点击“重试 Rich”→ 调用切换逻辑并复位状态
  - wrapPolicy/tableCellWrap 配置生效（断言 class/style）

### 涉及文件（预计）

- `webview/src/App.vue`
- `webview/src/components/Toolbar.vue`（如提示条放工具栏区域）
- `webview/src/components/MilkdownEditor.vue`
- `src/types/index.ts`（若新增配置项）
- `webview/src/**/__tests__/*`

