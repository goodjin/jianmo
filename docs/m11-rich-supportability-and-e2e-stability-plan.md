# M11：Rich 可支持性（Supportability）+ E2E 稳定性收敛

目标：在 M10（诊断入口 + 表格边界）基础上，把“出问题时可定位/可复现/可修复”的链路补齐，同时把 E2E 从“依赖 bridge”收敛到“尽量像真实用户操作”，减少维护成本与隐患。

> 里程碑建议版本：`1.5.3`（若 M10-4 还未发版，则先完成 M10-4 发 `1.5.2`，M11 结束再发 `1.5.3`）

## 交付物

- `docs/m11-rich-supportability-and-e2e-stability-plan.md`（本文件）
- 一套“可复制的诊断包”（copy → paste 到 issue 即可复现线索）
- E2E bridge 白名单收敛 + 约束（新增必须配测试）
- E2E 用例稳定性门禁（避免 flaky）

---

## M11-0：收尾门槛（先决条件）

> 这条不是新工作，是把“进入 M11 前必须完成”的门槛写清楚。

- **必须完成**：M10-3（bridge 最小化与约束）、M10-4（发版 1.5.2）
- **验收**：
  - `npm test` 全绿
  - `npm run test:vscode:ui` 全绿
  - `npm run package` 产出 `markly-1.5.2.vsix`

---

## M11-1：诊断信息升级为“可提交的诊断包”

现状：已有“复制诊断信息”，但字段/脱敏/长度可能还不够稳定，且缺少“用户如何使用”的引导。

- **内容**（建议 JSON 顶层字段）：
  - `app`: 扩展版本、webview 版本、构建 hash（若有）
  - `env`: vscode 版本、os/platform、语言、webview 引擎信息（可选）
  - `doc`: chars/lines、rich perf tier、生效的 wrap/overflow 策略
  - `mode`: 当前模式、rich 初始化成功/失败/降级原因、重试次数、最近一次错误摘要
  - `editor`: selection/table 上下文（只在 rich ready 时提供；严格限长）
- **脱敏与限长**：
  - 任何路径信息：只保留 basename 或截断（例如前 2 段 + `…` + 后 2 段）
  - 整包最大长度：例如 **≤ 32KB**（超出则裁剪 `recentErrors`/`editor` 细节）
- **UI/文案**：
  - copy 成功 toast：提示“已复制诊断信息，可直接粘贴到 Issue”
  - copy 失败 toast：提示“复制失败，请手动复制（fallback）”
- **验收**：
  - 单测：覆盖 `navigator.clipboard` 成功/失败 + `execCommand` fallback
  - 诊断包中不出现绝对路径（断言：不包含 `/Users/`、`C:\\` 等典型前缀）

---

## M11-2：Rich “自救操作”补齐（不止复制诊断）

面向用户的最低自救闭环：

- **新增入口**（至少 1 个）：
  - fallback banner：增加“重试 Rich”（已有的 retry 策略若存在，则给显式按钮）
  - 帮助菜单/toolbar：增加“重启 Rich / 重新加载 webview”（按现有架构选择最小成本实现）
- **约束**：
  - 自救操作必须是幂等的：多次点击不会让状态更坏
  - 自救失败必须自动转 Source + 给出可复制的错误摘要
- **验收**：
  - 单测：模拟 rich init 失败 → 点击重试 → 触发重试计数变化/状态变化
  - E2E：失败场景可稳定触发（通过注入假失败开关或测试专用路径）

---

## M11-3：E2E bridge 收敛（“最小表面积”真正落地）

原则：bridge 只做“测试无法稳定通过 DOM 操作完成”的那一小撮能力，其余尽量走用户路径（点击/键盘/粘贴）。

- **做法**：
  - 建立白名单（文档化 + 代码层约束），例如：
    - `getDiagnostics`
    - `simulateRichTablePaste`
    - `runRichTableOp`
    - `e2eSetCellSelectionInFirstTable`（若仍必要）
  - 非白名单 API：标记 deprecated，并逐个迁移掉（E2E 侧改用 DOM 操作）
  - bridge 初始化超时/缺失时：E2E 要给出可读错误（而不是 60s timeout）
- **验收**：
  - bridge API 数量相对当前 **净减少**（给出数字）
  - 新增 API 必须同 PR 同时新增/修改对应测试（门禁）

---

## M11-4：E2E 稳定性门禁（拒绝 flaky）

- **新增门禁脚本/规则**（二选一或都做）：
  - UI 测同一条关键用例 **重复跑 3 次**（只对关键用例集合），必须全过
  - 或：关键用例集合运行时间/失败率阈值（例如连续 N 次 CI 失败才报警）
- **统一等待策略**：
  - 所有“等待 Rich ready/内容同步”走同一个 helper（避免各测各写）
  - 每个 wait 超时必须打印诊断包（直接复用 M11-1）
- **验收**：
  - `npm run test:vscode:ui` 连跑 3 次全绿（本机）

---

## M11-5：发版（1.5.3）

- **验收**：
  - `npm test` 全绿
  - `npm run test:vscode:ui` 全绿（且关键用例重复跑稳定）
  - `npm run package` 输出 `markly-1.5.3.vsix`

