# 性能：初始化/大文档/查找替换 基线记录（M312）

## 目标

把“我们认为性能正常”的基线明确写下来，后续每次改动都能对照，避免慢慢变卡却没人发现。

## 建议采集口径（最小集）

- **初始化**
  - webview mount 时间：诊断包中的 `app.webviewMountMs / webviewInitMs`
- **大文档**
  - 文档字符数、行数、体量档位（Tier）：诊断包 `doc.*`
  - Rich 启动是否触发 watchdog fallback：诊断包 `app.richStartupWatchdogFired / richFallbackBannerVisible`
- **查找替换**
  - 匹配数截断行为（上限）与 totalCount 超时标志（如有）：相关单测见 `webview/src/__tests__/findLargeDocPerf.test.ts`

## 当前已存在的工程锚点

- “复制诊断信息”会输出：
  - 协议版本、Rich 启动事件、性能档位等
- Webview 单测中包含大文档稳定性与 find 性能门禁用例

## 后续可加强（不阻塞本里程碑）

- 引入自动化采集：在 CI 中记录关键指标（例如 `richReadySuccess`、find totalCount timeout）并做趋势追踪。

