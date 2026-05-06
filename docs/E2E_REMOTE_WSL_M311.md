# E2E：Remote / WSL 场景补测（M311，可选）

## 目标

最小化覆盖 VS Code Remote / WSL 的常见差异点，避免“本地 OK、远程就坏”的回归：

- 文件系统路径/分隔符差异
- webview 与扩展 host 的资源加载路径差异
- Puppeteer/Chromium 在远程环境不可用或被策略拦截

## 建议覆盖的最小用例

1. **打开与编辑保存**
   - Remote/WSL 中打开 `.md`，切换 Rich/Source，编辑并保存
2. **图片资产**
   - 粘贴图片写入 `markly.image.saveDirectory`，引用可正确解析
3. **导出（可降级）**
   - 尝试导出 PDF/HTML；若 PDF 因 Puppeteer/Chromium 不可用失败，也必须能复制诊断并自救（不应卡死）

## CI 策略（本仓库当前）

默认 CI 先跑本机 headless 的 `npm run test:vscode` 作为 smoke。

Remote/WSL 若要纳入 CI，建议先采用：

- **手动触发**（workflow_dispatch）或定时任务（cron）
- 只跑最小用例（打开/保存 + HTML 导出 + 复制诊断）

> 备注：Remote/WSL 的 CI 环境差异很大（镜像、权限、浏览器依赖），更适合逐步引入。

