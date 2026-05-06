# 回归：跨平台/场景矩阵（最小集）（M339）

## 目标

用“最小但覆盖关键风险”的矩阵，保证每次发版不靠运气。

## 平台最小集

- macOS（本机）
- Windows（CI 或人工）
- Linux（CI）

## 场景最小集

- **本地 workspace**
- **Remote/WSL**（若团队常用，至少 1 条固定回归）

## 用例最小集（每条平台都跑）

- 打开 markdown → Rich 启动成功
- 切换 Rich/Source
- 编辑 1 行并保存（确保无 `SAVE_FAILED`）
- 打开/关闭大纲、查找替换
- 导出预检（或导出 HTML/PDF 任一）
- 复制诊断信息（payload 不空、不过大）

## 自动化入口

- 单测：`npm test`
- 集成：`npm run test:vscode`
- 门禁：`npm run preflight`

