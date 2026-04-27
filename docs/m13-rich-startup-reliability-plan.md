# M13：Rich 启动可靠性专项

目标：针对“Rich 启动超时后自动降级 Source”的问题，把启动链路拆成可观测阶段，并修正容易误判的 watchdog 策略，让空文档/小文档启动更稳定。

> 建议版本：`1.5.5`

## 交付物

- `docs/m13-rich-startup-reliability-plan.md`（本文件）
- Rich 启动事件 ring buffer（最近 20 条）
- 诊断包可定位 Rich 启动卡点
- watchdog 误降级保护

---

## M13-0：启动链路基线与诊断复核

- [x] 确认最新诊断包包含 M12 字段：
  - `host`
  - `richStartupAttemptId`
  - `richStartupWatchdogFired`
  - `richRetryCount`
  - `webviewReloadCount`
  - `richLastError`
- [x] 新增/更新单测，确保复制的 Issue 模板里包含关键诊断字段
- **验收**：
  - 从诊断包可以判断当前包是否为新格式，而不是旧版纯 JSON

---

## M13-1：Rich 初始化阶段打点

- [x] App 层记录：
  - `app:mounted`
  - `init:message`
  - `ensureEditor:start/done`
  - `switchRich:start`
  - `watchdog:armed`
  - `watchdog:fired`
  - `fallback:source`
  - `retry:rich`
  - `reload:webview`
- [x] Milkdown 层记录：
  - `milkdown:mounted`
  - `milkdown:init:start`
  - `milkdown:create:start/end`
  - `milkdown:listener:ready`
  - `milkdown:ready:emit`
  - `milkdown:init:error`
- [x] 诊断包里输出最近 20 条事件
- **验收**：
  - 看到 timeout 时能判断卡在 App 层、Milkdown 创建、listener、ready emit 或 watchdog

---

## M13-2：空文档/小文档启动超时专项

- [x] 针对空文档、小文档、仅标题文档补启动/诊断回归测试
- [x] 若 Rich 根节点和 editable 已存在但 ready 未返回，诊断包必须能说明状态
- **验收**：
  - 空文档 Rich 不应超时；若超时必须有明确 `richStartupEvents`

---

## M13-3：watchdog 策略修正

- [x] watchdog 触发前检查 DOM/ProseMirror editable 是否已存在
- [x] 若 editable 已存在但 ready 未回，延长一次等待而不是立即降级
- [x] 延长后仍失败才降级 Source
- **验收**：
  - 不再出现“editableExists=true 但立即 timeout 降级”的误判

---

## M13-4：自救闭环增强

- [x] retry 前清理旧 watchdog/attempt
- [x] retry/reload 写入 `richStartupEvents`
- [x] retry 成功/失败都可从诊断包看清楚
- **验收**：
  - 用户复制诊断后能看出是否点过重试、是否点过重载

---

## M13-5：发版 `1.5.5`

- [x] 版本号同步到 `1.5.5`
- [x] `npm test`
- [x] `npm run test:vscode:ui:stable`
- [x] `npm run package`
- **验收**：
  - 产物文件名：`markly-1.5.5.vsix`

