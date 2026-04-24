## M8：大文档体验 + 启动加速（Large doc UX + startup）

> 状态：已完成（2026-04-22）  
> 目标版本：`1.5.0`（MINOR）

### 1) 背景

M7 已做包体/缓存/「超大文档二档」硬降级。M8 在**不退化可编辑性**的前提下，把体验做成**可分级、可恢复、可量化**：

- 中等规模文档就提前减负（不等到硬阈值才卡顿）
- Rich **尽快进入可编辑**（重渲染/初始化排队到空闲/可见时）
- 大文件会话内增长时，**运行时**尽量跟随策略（不强制用户重开；少数能力仍以首次打开时的插件栈为准，见下文科注）

### 2) 文档规模分级（与代码一致）

阈值定义在 `webview/src/utils/richPerfTier.ts`（下列数字必须与之保持一致）：

| 档 | 条件（满足任一即落入该档） | Mermaid | Shiki（`markly.editor.enableShiki === true` 时） |
|----|----------------------------|--------|--------------------------------------------------|
| **0** | 字符 ≤ 80,000 且 行数 ≤ 2,000 | 按配置；可见性调度优先 | 可加载高亮插件 |
| **1** | 80,000 &lt; 字符 ≤ 180,000 或 2,000 &lt; 行数 ≤ 4,000 | 按配置；**仅视口/空闲队列渲染** | 运行时关闭高亮（插件可不加载时则不加载） |
| **2** | 字符 &gt; 180,000 或 行数 &gt; 4,000 | **关闭** | **关闭** |

> **科注**：`enableShiki` 在**首次** `Editor.create` 时决定是否打入高亮插件栈；同一会话内从小编辑大到「1 档」时，通过 `getRuntimeRichPerfTier()` 让已加载的高亮在运行时快速返回空 decorations，避免全量重算。若从打开即落在 1 档，可完全不加载高亮插件。

### 3) 可执行 Checklist

#### M8-0 基线 fixture + 基线输出（必须先做）

- [x] 新建 `docs/fixtures/m8/README.md`：描述至少 3 个手工/生成场景如何验收（小/中/大）
- [x] 新增 `scripts/m8-baseline.mjs`：在 `dist/webview` 构建完成后输出**文件数、总 bytes、最大单文件、最大单文件 gzip 约估**（用于对比，不等同于 VSIX 压缩后大小）
- [x] 根 `package.json` 增加 `m8:baseline`（可单独跑，未 build 时会退出非零）
- **验收**：`npm run build:webview && npm run m8:baseline` 能打印稳定字段；`npm test` 仍全绿

#### M8-1 渐进启动：可编辑优先

- [x] `MilkdownEditor` 在**核心 `Editor.create` 成功 + 必要事件绑定**后即 `emit('ready', true)`
- [x] Mermaid 初始化/首批渲染不阻塞 `ready`（`requestIdleCallback` 或 `setTimeout(0)` 退化）
- **验收**：在 DevTools Performance 中 Rich 可交互时间点不应被 Mermaid `import`/初始化长任务明显推迟（主观+后续可接埋点）

#### M8-2 三级降级 + 手动恢复

- [x] `App` 用 `getRichPerfTier` 计算**有效档**；提供「仍要完整渲染 / 恢复自动」切换（会 toast 提示可能变卡）
- [x] 文案与 `data-testid` 便于 E2E/单测
- **验收**：档 1/2 的提示与按钮行为可测；`npm test` 全绿

#### M8-3 Shiki 运行时跟随（无插件栈时的最优）

- [x] 已加载高亮时，`safeParser` 在档 ≥1 时快速 `return []`
- [x] 首次建编时，档 0 才加载 `shiki-highlight` 动态插件（与 M7 行为对齐）
- **验收**：`richPerfTier` 单测覆盖边界；不出现「假测试」（删除实现仍应失败）

#### M8-4 Mermaid 可见性 + 空闲调度

- [x] 为 `pre.language-mermaid` 建 `IntersectionObserver`（`root: null`），仅进入视口再渲染
- [x] 渲染队列用 `requestIdleCallback`（或 16ms 退化）串行/限流
- [x] 档 2 不加载/不调用 Mermaid（`richPerfEffectiveTier`）
- **验收**：大文档+多 mermaid 时，首次打开主线程不长时间连续 `m.render`；回退时仍有降级路径

#### M8-5 门禁 + 发版

- [x] `check:bundle` 增加最大单文件 **gzip** 门禁（`MARKLY_WEBVIEW_MAX_BIGGEST_GZIP_BYTES` 可调，默认 2.5MB）
- [x] 发布前建议顺序：`npm test` → `npm run build` → `npm run check:bundle` → `npm run m8:baseline`
- [x] 版本 `1.5.0`：`package.json` / `webview/package.json` / lock 已同步
- [x] 生成 `markly-1.5.0.vsix` 做体积核对

### 4) 与 M7 的衔接

- 保留 M7-4 的 `check:bundle`（总大小/文件数/最大文件）
- M8 的 gzip 与「分级阈值」是**更细**的门禁与体验层，不再重复要求 VSIX 再减 30% 这类 M7 口径，除非回归异常

### 5) 风险与回滚

- **IO + mermaid 异步替换 DOM**：需观察与 ProseMirror 更新竞态；若出现闪烁/错版，可收敛为「仅对首屏/idle 后批量 observe」
- **档边界调整**：只改 `richPerfTier.ts` 一处，避免 App/Editor 各写魔数
