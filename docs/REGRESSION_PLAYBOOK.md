# 回归用例与 Fixture 手册（M257）

目标：把线上/issue 里最常见、最痛的 bug 变成 **“删掉实现就会失败”** 的回归测试，避免反复踩坑。

## 1. 什么时候应该做回归用例

- **用户可复现**、且影响主路径（Rich 启动/表格/粘贴/导出/图片/大纲/查找）。
- 修复涉及边界条件（例如：表格里特殊字符、IME 组合输入、路径大小写、外链 host allowlist 等）。
- 曾经发生过、且很可能再发生（依赖升级、编辑器内核升级、导出模板变更）。

## 2. 选择用例类型

- **纯逻辑（Vitest）**：优先。写在 `src/**/__tests__` 或 `webview/src/**/__tests__`。
- **序列化稳定（fixture round-trip）**：放到 `docs/fixtures/m9/`（或同类目录），并在 `webview/src/__tests__/richFixtureRoundTrip.test.ts` 纳入。
- **VS Code 集成（Mocha e2e）**：用 `npm run test:vscode`，用例在 `e2e/suite/`。

## 3. Fixture 的要求（强制）

- **最小化**：只保留触发问题的最少文本。
- **稳定**：避免随机、时间戳、路径依赖；避免依赖网络。
- **可读**：开头一段注释说明“为什么存在这个 fixture / 对应的 issue/里程碑”。
- **禁止假测试**：删掉被测实现后，测试应该失败（见 `CLAUDE.md` 的三条铁律）。

## 4. 推荐流程（一次完整闭环）

1. 从 issue/复现模板抽出最小 Markdown（或最小操作序列）。
2. 先写 **失败的测试**（red）。
3. 修复实现（green）。
4. 运行：`npm test` +（必要时）`npm run test:vscode`。
5. 在 `CHANGELOG` 的 Unreleased/对应版本里写一句“回归已覆盖”的证据指向（测试文件/fixture）。

