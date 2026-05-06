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

## Remote / WSL（M273）

- **Remote SSH / Dev Containers / WSL**：一般可用；PDF 导出依赖远端/容器内可用的 **Node + Puppeteer Chromium**（与路径/权限、`no-sandbox` 策略有关）。若在远程侧失败率高：
  - 先用 `Export: Copy Last Failure Diagnostics` 复制诊断包（脱敏）；
  - 尝试将导出输出目录换到明确可写的位置（如工作区内临时目录）；
  - 进行对照：同一文档在本地桌面 VS Code 中导出一次，区分“远程环境问题”还是“内容问题”。
- **纯 Web / Codespaces**：子进程/权限策略差异更大；导出失败时请附 **导出诊断包** 与运行环境标签（Remote 类型、容器/WSL、Node 版本等）。

