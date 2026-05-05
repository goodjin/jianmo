# IR 模式冻结政策（贡献者必读）

**生效范围**：本仓库内 **`EditorMode === 'ir'`** 所对应的 CodeMirror 6 + 装饰器「中间渲染」路径（类型与协议中仍可能写作 `ir`，与 **Rich**/**Source** 并存）。

## 目标

- **产品主战场**为 **Rich（Milkdown）** 与 **Source（纯源码）**。
- **IR 进入维护收敛期**：降低双栈成本，为后续移除做准备（见 [`plan-ir-freeze-100MS-task-split.md`](./plan-ir-freeze-100MS-task-split.md)）。

## 禁止事项

1. **不向 IR 添加新功能**（新语法装饰、新交互、新工具栏/命令专供 IR、仅 IR 的导出路径等）。
2. **不扩展 IR 专用测试矩阵**（新的 e2e/单测若以 IR 为主场且非回归阻断，请勿合入；必要协议契约测试除外）。
3. **不将 IR 列为性能优化对象**（不测 IR 专项帧率/大文档优化里程碑；若改动共享代码，Rich/Source 仍需受益）。

## 允许事项

1. **阻断性回归修复**：IR 无法打开、崩溃、数据丢失风险、安全漏洞等，在最小 diff 下可修。
2. **共享代码的重构**：若同时服务 Rich/Source，且对 IR 无副作用或符合「仅维持现状」，可经 review 合入。
3. **类型与消息兼容**：在 IR 未移除前，`'ir'` 可继续出现在类型与协议守卫中，**但不得新增对外承诺**。

## 安全基线（冻结期）

- **不扩大 IR 的 HTML/远程内容解析面**（不新增未审查的 `innerHTML`、`document.write`、不可信 URL fetch 等路径「仅服务 IR」）。
- 若必须为 IR 修安全相关 bug：PR 标题或描述中注明 **`security` + `legacy-ir`**，便于专项 review。

## Issue / PR 标签约定

- **`legacy-ir`**：问题或修复仅与 IR/CodeMirror 装饰器链相关。
- Reviewer 默认合并前确认：**非新功能**、**测试增量符合上节**。

## 相关文档

- [IR 入口盘点](./IR_ENTRYPOINT_AUDIT.md)
- [Rich/Source 等价能力清单（验收用）](./RICH_SOURCE_PARITY_CHECKLIST.md)
- [extension `preview` ↔ Rich 命名技术债](./TECH_DEBT_PREVIEW_RICH_NAMING.md)
- 仓库根目录 [`CLAUDE.md`](../CLAUDE.md)
