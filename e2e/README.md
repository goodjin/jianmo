# Markly E2E 测试

本项目使用两种测试方式：

## 方式一：VS Code 调试模式（推荐）

1. 在 VS Code 中打开项目
2. 按 `F5` 启动扩展测试
3. 测试会自动运行

这是最简单的方式，会在真实的 VS Code 环境中运行所有测试。

## 方式二：命令行测试

```bash
# 构建项目
npm run build

# 运行 VS Code 测试（需要在 VS Code 中打开）
npm run test:vscode
```

## 方式三：Playwright（WebView 测试）

```bash
# 安装依赖
npm install
npx playwright install chromium

# 运行 Playwright 测试
npm run test:e2e
```

注意：Playwright 测试需要特殊的 VS Code 连接配置。

## 测试文件

| 文件 | 说明 |
|-----|------|
| `e2e/complete-vscode.spec.ts` | VS Code 扩展测试 (27个用例) |
| `e2e/integration.spec.ts` | 集成测试 |
| `e2e/complete.spec.ts` | Playwright 测试 (44个用例) |

## 测试覆盖

| 功能 | 测试用例数 |
|-----|----------|
| 模式切换 | 2 |
| 撤销/重做 | 2 |
| 标题 | 6 |
| 格式化 | 8 |
| 列表 | 6 |
| 插入功能 | 8 |
| 查找替换 | 1 |
| 大纲面板 | 1 |
| 字数统计 | 1 |
| 源码编辑 | 1 |
| 导出功能 | 3 |
| 快捷键 | 3 |
| 主题 | 1 |
| 图片预览 | 1 |
| 完整流程 | 1 |
| **总计** | **44+** |

## 常见问题

### 测试无法运行

确保：
1. 已运行 `npm install` 安装依赖
2. 已运行 `npm run build` 构建项目
3. 使用 VS Code 打开项目（按 F5）

### VS Code API 不可用

VS Code 测试必须在扩展环境中运行，不能在普通 Node.js 中运行。
