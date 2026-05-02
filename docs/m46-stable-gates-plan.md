# M46：稳定门禁与 UI 测试（计划）

## 现状

- 扩展侧 ExTester/UI 链路见 README `npm run test:vscode:ui`。
- CI 无桌面环境时不应强制跑 ExTester（本机 / 带 UI 的 pipeline 执行）。

## 最小可重复集（手测清单 → 门禁候选）

1. Rich 启动与切换 Source 往返不乱版。
2. 保存丢失防护：Mod+S 触发 `CONTENT_CHANGE` / 宿主保存。
3. 表格 TSV/HTML 粘贴小样本。
4. 图片缺失条与复制诊断。

## 验收

- 本文档归档；路线图指向 README 门禁命令。

## 已对齐（M46-3 / M46-5）

- 本机/CI 可重复门禁：`npm run gates:stable`（见根目录 `README.md` → Testing）。
- ExTester UI 测（`npm run test:vscode:ui`）保留为**需桌面**的扩展链路，不作为无头 CI 硬门禁。
- M46-4（失败自动打包 webview 控制台）：暂缓，仍以本地 DevTools / ExTester 日志为主。
