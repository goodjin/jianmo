# M184：兼容性矩阵（最小版）

## VS Code

- **最低版本**：见根目录 `package.json` → `engines.vscode`
- 建议在升级 VS Code 大版本后，优先运行一次：
  - `Markly: Toggle Edit Mode`（Rich/Source 切换）
  - 表格粘贴（TSV/HTML）
  - 导出 PDF/HTML

## 平台说明

- **Windows**：建议在 `markly.image.saveDirectory` 等路径配置里使用正斜杠（`./assets`）；扩展会做基本归一化。
- **Linux**：字体/渲染差异可能导致导出 PDF 的字形/换行略不同；以导出预览与最终输出为准。
- **macOS**：输入法（IME）组合输入相关问题可参考 `webview/src/__tests__/richImeComposition.test.ts` 的回归覆盖。

