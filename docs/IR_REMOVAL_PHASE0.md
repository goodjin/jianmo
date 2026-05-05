# IR 移除阶段 0：构建侧可行性评估（M10）

本文档记录在 **不彻底改写产品架构** 的前提下，从 webview bundle 中剔除 IR（CodeMirror 装饰器链路）时需要面对的技术事实与建议顺序。结论供 [M95](plan-ir-freeze-100MS-task-split.md) 及后续「无 IR」CI 分支使用。

## 1. 当前 webview 双栈结构

| 栈 | 职责 | 主要入口 |
|----|------|----------|
| **Rich** | Milkdown + ProseMirror | `webview/src/components/MilkdownEditor.vue` |
| **Source / legacy-IR** | CodeMirror 6 | `webview/src/composables/useEditor.ts`，`webview/src/core/editor.ts`，`webview/src/core/decorators/*` |

`App.vue` 在 **Rich ↔ CM6** 间切换：**Source** 与 **极少数协议路径下的 `ir`** 共用 CM6 视图；bundle 现阶段 **静态 import** CM6 + 整块装饰器图。

## 2. Bundle 体量（近似结论）

在未做按需切割前：**装饰器源码 + CodeMirror lang-markdown/marked 链路**已与 Rich 共存于同一 SPA。精确 gzip 拆分需跑一次 `pnpm vite build --report`（或 rollup-plugin-visualizer）作为 M95 的定量任务；此处阶段 0 只确认：

- CM6/`decorators` **不是 Extension 宿主侧依赖**（宿主走 `esbuild` 另一棵树），删减只影响 `dist/webview/*.js*`。
- 删除 IR 会减少 **webview 初始化 JS 峰值**（对「纯 Rich 会话」最明显），对大文档 Source 仍可保留 CM6 纯源码分支（不包含装饰器）。

## 3. 「无 IR」构建策略选项

### 方案 A：Vite `define` + 条件 dead-code（低风险试点）

1. `vite.config.ts` 增加 `define: { __MARKLY_STRIP_LEGACY_IR__: JSON.stringify(...) }`。  
2. `editor.ts` 内 `mode === 'ir'` 分支与 `createIRDecorators` 引用置于 `if (!__MARKLY_STRIP_LEGACY_IR__) { ... import 若需顶层则改为动态 import 或拆文件 }`。  
3. TypeScript：**不可**单靠 `define` 抹类型，需在 `webview/tsconfig` 中加 path 替身或 shim `decorators.stub.ts`。  

适用于 **阶段性** 二进制对比与 CI 「无 IR」每日构建。

### 方案 B：源码层面拆分包（`/ir/` 可选 chunk）

把 `webview/src/core/decorators/**/*`（及仅 IR 用的 CM6 widget）迁至 `webview/src/legacyIr/**`，`editor.ts` 通过 `void import('../legacyIr/decorators').then(...)` 仅在切换到 `mode==='ir'` 时加载。  

- **优点**：默认首屏不向 Rich-only 用户支付 IR CSS/JS；与产品「IR 退场」对齐。  
- **成本**：需在 `switchMode('ir')` 路径上补齐 **loading/async 错误边界**（今日几乎无入口，仍须有防御）。

### 方案 C：产品侧先下线 `ir`，再删除代码（推荐顺序）

对齐 [Rich/Source 等价清单](./RICH_SOURCE_PARITY_CHECKLIST.md)：当协议与 UI 都不再需要 `SWITCH_MODE: ir` 时，直接删除 decorators 目录与 CM6 IR 分支，**比**长期在构建层打补丁更符合维护成本。

## 4. 对 useEditor / createEditorState 的影响

| 改动点 | 说明 |
|--------|------|
| `initialMode \|\| 'ir'`（`useEditor.ts`） | 若宿主仅暴露 source/rich：`useEditor` 默认应改为 **`source`**，避免隐式挂载装饰器开销。 |
| `createEditorState(content, mode, ...)` | `mode !== 'rich'` 分支中 **删除 `mode==='ir'`**：fold、richClipboard、`createIRDecorators` 整块消失，仅保留 `source` CSS 与共用扩展。 |
| 测试矩阵 | `webview/test/ir-mode.test.ts`、`decorators/**`、部分 e2e 将删除或在「legacy job」跑一次。 |

## 5. 懒加载是否「足够」

- **对用户**：Rich 会话若永不切 CM6，懒加载 IR 可改善冷启动（方案 B）。  
- **对工程**：单靠懒加载 **不减少** `@codemirror/lang-markdown` 等与 Source **共享**部分的体积——IR 退场后仍会保留 CM6-for-source。  

因此体积收益主要来自：**删除装饰器包 + markdown 语义 widget（math/mermaid/table 等与 IR 强绑的 CM6 UI）**。需核对是否可被 Rich 独占（多数已迁至 Milkdown）。

## 6. vite.config 与本仓库 manualChunks（现状）

[`webview/vite.config.ts`](../webview/vite.config.ts) 当前仅对大 vendor（Shiki/Mermaid）做 `manualChunks`。**未**对 CM6 单独 chunk；IR 退场时应评估是否将 `@codemirror/*` 打入独立 `codemirror-source.js`，以便 Rich-only 预览未来可进一步延迟加载 Source 编辑器（更远期）。

## 7. 建议的收口顺序（与里程碑映射）

1. **完成 Source/Rich 功能对齐**（M03 清单 + Rich 深化 M11+）。  
2. **冻结 IR 门禁**（M04 `check:ir-freeze` 已通过）。  
3. **宿主与协议停止使用 `mode: ir`**（M98）。  
4. **方案 A/B 试错 CI**（M95）；采纳后再走 **decorators 目录删除 PR**（M96）。  

## 8. 未决风险

- `messageGuards`/e2e 仍允许 `'ir'` 时，贸然 `define` strip 易导致 **运行时协议仍发 ir、前端缺 chunk**——必须协议层先行。  
- 动态 import IR 会破坏部分 **同步单元测试** 假设，需要 `await flushPromises`。

---

**阶段 0 交付物**：本文为定性 + 分项评估；定量 bundle diff 记在 M95 任务中执行即可。
