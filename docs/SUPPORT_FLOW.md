# M180：支持流程（issue → 修复 → 发布）

## 1. 收集信息（不要先猜）

- 让用户提供：
  - **复现步骤**（用 `docs/REPRO_TEMPLATE.md`）
  - **诊断信息**（复制诊断信息 / 导出失败诊断包）
  - OS / VS Code / Markly 版本

## 2. 先分级，再行动

- **P0（阻断）**：无法打开/空白/内容丢失/崩溃/导出全挂  
- **P1（严重）**：核心编辑能力错误（表格/图片/撤销），但有绕过方案  
- **P2（一般）**：细节/体验/文档  

## 3. 复现与定位路径（推荐顺序）

1. 先用 **最小样例**复现（越短越好）
2. 尝试切换 Rich/Source、重试 Rich、重载 Webview（用户侧可自救）
3. 开始定位代码：
   - 编辑相关：webview（App/MilkdownEditor/插件）
   - 导出相关：`src/core/export/*`
   - 图片路径/修复：extension provider + webview 诊断

## 4. 修复与门禁

- 修复后至少满足：
  - 对应单测补齐（避免回归）
  - `npm test` 通过
  - 若涉及交互稳定性：考虑补充门禁用例（`gates:stable` / UI 测）

## 5. 发布与回溯

- `CHANGELOG.md` 记录：用户可读的“影响 + 修复”
- 若是高频问题：补到 `resources/TROUBLESHOOTING.md`

