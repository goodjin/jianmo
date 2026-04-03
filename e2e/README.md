# Markly 端到端 / 集成测试

本项目**以真实 VS Code 环境为准**：扩展集成测试（Mocha）与带 UI 的 ExTester（Selenium + 真实 Electron/VS Code）。

## 1. 扩展集成测试（无 UI 自动化，`@vscode/test-electron`）

会先 `build`，再启动 VS Code 实例加载本仓库扩展，运行 `e2e/suite/`：

```bash
npm run test:vscode
```

## 2. 真实 UI：ExTester（推荐用于验证「像用户一样点」）

首次需下载测试专用 VS Code 与驱动（进入 `.vscode-test/extest-ui/`）：

```bash
npm run test:vscode:ui:setup
```

日常运行（会先打包 VSIX 并安装到测试 profile，再跑 UI 用例，避免测到陈旧扩展）：

```bash
npm run test:vscode:ui
```

用例入口：`e2e/ui-suite/`（Mocha + vscode-extension-tester）。

**环境要求**（见根目录 `CLAUDE.md`）：须在 **macOS 已登录桌面的本机终端** 运行；纯 SSH / 无 WindowServer 时 Electron 常会立刻退出。

## 3. 目录说明

| 路径 | 说明 |
|------|------|
| `e2e/index.js` | `test:vscode` 入口，调用 `@vscode/test-electron` |
| `e2e/suite/` | 集成测试套件（Mocha） |
| `e2e/run-extest-ui.mjs` 等 | `test:vscode:ui` 编排脚本 |
| `e2e/ui-suite/` | ExTester UI 测试与 fixture 工作区 |
