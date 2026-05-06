# Markly 路线图 · 近期（Near Phase）

本文档约定 **近期阶段**（建议：**约 6–12 个小版本／3–9 个月**，以实际迭代为准）要做的全部事项、**全局执行顺序**与验收口径。里程碑编号 **`M201–M275`**。

**关联**：`docs/IR_REMOVAL_ROADMAP.md`（IR Phase 0→1）、`docs/M100-2.0-GATE.md`、`docs/2.0_RISKS_AND_ACCEPTANCE.md`、`resources/TROUBLESHOOTING.md`、`docs/EXPORT_GUIDE.md`。  
**下阶段入口**：完成后进入 `docs/ROADMAP_MID.md`（`M276` 起，`M360` 为中期收口参照）。远期见 `docs/ROADMAP_FAR.md`（`M361` 起）。

---

## 1. 阶段定位

- **主旋律**：稳住 **Rich 主编辑**与 **导出/图表/大纲**链路；推进 **IR 软下线（Phase 1）**；补足测试与文档，使问题可复现、可诊断、可回滚。
- **版本策略**：以 **PATCH / MINOR** 为主；不做协议 breaking、不改默认编辑器策略（除非单列评审）。

## 2. 非目标（本期明确不做）

- 不包含 **IR 实现删除**（属中期，见 IR Phase 2）。
- 不包含 **semver major（2.0）** 发布（除非你方单独拉起 M100/M200 评审并满足触发条件）。
- 不承诺 **完整国际化（i18n）译稿**——仅可做文案外置与技术评估。

## 3. 门禁（阶段完成前应稳定满足）

- `npm run gates:stable`（或团队等价 CI 全流程）在最近迭代中连续通过。
- `npm run check:release` 在每次发版路径执行。
- 关键链路具备自动化：`richFixtureRoundTrip`、导出/预检单测、`messageGuards` 与新模式相关用例不因本阶段重构而删减。

---

## 4. 全局执行顺序（M201–M275）

下列顺序兼顾 **依赖** 与 **风险收敛**：自上而下执行；标记「并行」可与前一条并行，但须在合并前满足其「前置」行。

| 顺序 | ID | 里程碑 | 主要交付／验收要点 | 前置 |
|-----|-----|--------|-------------------|------|
| 1 | M201 | 近期路线 Kickoff | 里程碑owner、迭代节奏、`CHANGELOG`/分支策略写进团队共识 | — |
| 2 | M202 | IR Phase1：方案对齐 | IR 入口/设置/文案与 `IR_REMOVAL_ROADMAP` Phase1 一致；无新增 IR 能力 | M201 |
| 3 | M203 | IR：设置与分类整理 | `package.json` contribution 中 IR 相关设置归组、描述清晰；默认不鼓励新用户依赖 IR | M202 |
| 4 | M204 | IR：UI 入口软隐藏 | 主 UI 无突出 IR 切换；高级/实验入口可配置；无死链命令 | M203 |
| 5 | M205 | IR：诊断包标记 | 诊断文本中模式标记 `legacy-ir`（或与现实现一致的可机读字段） | M204 |
| 6 | M206 | 文档：仅 Rich+Source 主路径 | `README`/`TROUBLESHOOTING` 明确推荐路径；IR 仅 legacy 说明 | M204 |
| 7 | M207 | **发布点：IR 软下线可合并** | 上述 M202–M206 可独立发 MINOR；回滚策略（关实验入口）可查 | M205–M206 |
| 8 | M208 | Rich：降级／重试链路审计 | 「Retry Rich / Copy Diagnostics / Reload Webview」与用户文档一致 | 并行 |
| 9 | M209 | Rich：watchdog／性能 Tier 默认值 Review | `deferDiagramRenderInRich` 等与弱机默认值合理；记录在 `MARKDOWN_CAPABILITIES` 或专文 | M208 |
| 10 | M210 | Rich：阅读位置持久化回归 | 多文档/重开边界有手工剧本 + 单测覆盖（在已有 `restoreLastReadingPosition` 上扩展） | M208 |
| 11 | M211 | Rich↔Source：光标/滚动恢复扩展 | 覆盖「无选区」「全选」「文档末尾」等；单测不依赖时序运气 | M210 |
| 12 | M212 | Rich：IME 组合输入回归 | 已有 `richImeComposition` 类用例扩展常见输入法场景 | M211 |
| 13 | M213 | Rich：粘贴管线审计 | `richPasteSanitize` / denylist / 表格(TSV/HTML) 粘贴；缺失用例补齐 | M212 |
| 14 | M214 | Rich：复制语义 | 从 Rich 复制到外部应用（纯文本/HTML）关键场景有断言或手工清单 | M213 |
| 15 | M215 | Rich：列表/任务列表键位 | Tab/Shift-Tab/Enter/Backspace 在嵌套列表边界用例齐全 | M214 |
| 16 | M216 | Rich：表格键位与结构 | 与 `markly-table-rich` 测试对齐；关注 pipe/代码单元格边界 | M215 |
| 17 | M217 | Rich：链接与相对路径 | `http(s)`、`./`、`#anchor`、编码路径；round-trip 或行为表 | M216 |
| 18 | M218 | Rich：数学公式边界 | 与代码块/表格相邻、反斜杠转义；fixture 增补 | M217 |
| 19 | M219 | Rich：大图/粘贴性能手记 | 大像素图粘贴与压缩路径的时间/内存手记；写入运维文档或小节 | M218 |
| 20 | M220 | Source：与 Rich 的「意图差异」表 | 用户可见差异（快捷键/序列化）以表格列出，避免误判为 bug | M211 |
| 21 | M221 | Source：大包性能基线 | 打开 5k/20k 行级样本的滚动/查找可接受范围（定性+截图/指标） | M220 |
| 22 | M222 | 导出：取消与资源清理复核 | Puppeteer/HTML 流水线在取消后无句柄泄漏；必要时加单测/日志 | — |
| 23 | M223 | 导出：错误分类与用户文案 | 网络/超时/权限/磁盘满等映射到可操作提示；可复制诊断 | M222 |
| 24 | M224 | 导出：预检→定位 | 点击或命令跳转到问题行/资源 URI（尽最大努力）；文档说明限制 | M223 |
| 25 | M225 | 导出：远程图 allowlist | `*.host`、大小写、`exportPreflight` 与 UI 对齐；反面用例 | M224 |
| 26 | M226 | HTML/PDF：Mermaid bundle 一致性 | embedded/external 两套与 TOC/锚点在 fixture 中单测覆盖 | M225 |
| 27 | M227 | PDF：分页与宽表抽样 | A4 纵向宽表、`page-break` 行为记录；不达标则文档列为限制 | M226 |
| 28 | M228 | Html：离线资源嵌入矩阵 | `EXPORT_GUIDE` 与实现对齐；枚举测试补齐 | M226 |
| 29 | M229 | Mermaid：主题变量与 VS Code | 明暗切换后不花屏；回归步骤写入 `EXPORT_GUIDE` | M226 |
| 30 | M230 | Mermaid：defer 渲染与 Outline | defer 模式下大纲/跳转仍正确；大图文档不卡死交互 | M229 |
| 31 | M231 | 大纲：大文档筛选性能 | 1k+/5k heading 量级下无明显掉帧（或给出降级策略） | M230 |
| 32 | M232 | 大纲：拖拽与 slug 稳定性 | duplicate slug 告警与拖拽后锚点仍可导出跳转 | M231 |
| 33 | M233 | 图片：粘贴文件名策略 | `-0001` 序列与多时区/同秒并发；已有单测补强 | — |
| 34 | M234 | 图片：本地引用诊断键 | macOS 大小写/Windows：`canonicalMarkdownLocalRefKey` 与 UI 对齐 | M233 |
| 35 | M235 | 安全：SVG sanitize 样本库 | OWASP/SVG 常见向量进 fixture；sanitize 后与渲染策略一致 | M234 |
| 36 | M236 | 安全：pasteDenylist 复核 | `pasteDenylist` 与文档一致；误杀场景与白名单路径 | M235 |
| 37 | M237 | AI：并发护栏可观测 | 「仅 1 in-flight」错误提示可被用户理解；可考虑 UI 节流提示 | — |
| 38 | M238 | AI：SecretStorage／未启用路径 | `AI_PRIVACY` 与实际一致；mock provider 文档完善 | M237 |
| 39 | M239 | 配置：`settings.json` schema | 每项 `markdownDescription` 完整；默认值与实现对齐审计 | — |
| 40 | M240 | 配置：最小权限复核 | Remote images、出站、webview 能力与 `PRIVACY_AND_PERMISSIONS_AUDIT` 一致 | M239 |
| 41 | M241 | UX：命令面板关键词 | commands 可被「导出/大纲/Rich/PDF/HTML」等同义词搜到 | M239 |
| 42 | M242 | UX：Walkthrough／欢迎一致性 | activation 与实际功能同步；broken link 巡检 | M241 |
| 43 | M243 | A11y：焦点与键盘可达 | 工具栏/大纲/对话框 Tab 顺序；至少解决「完全不可达」项 | M242 |
| 44 | M244 | 测试：`richFixtureRoundTrip` 扩展 | `docs/fixtures` 覆盖表格+数学+代码+图；删除不稳定样本准则 | M216–M218 |
| 45 | M245 | 测试：vitest flaky 管控 | flaky 清单、重试策略、禁止「假断言」守则执行 | — |
| 46 | M246 | 测试：`messageGuards` 漂移防护 | 新消息必须经过 guard；PR checklist 勾选 | — |
| 47 | M247 | E2E：Rich 冒烟（可选但强烈建议） | 打开 md→Rich 可见→切换 Source→导出之一；记入 CI 手册 | M208 |
| 48 | M248 | CI：`check:bundle`/`check-release` 说明入 CONTRIBUTING/README | 新贡献者 10 分钟内能跑完本地门禁 | M245 |
| 49 | M249 | 工程：`npm audit` 节奏 | 高危漏洞修复 SLA；DOCUMENT in `DEPENDENCY_UPDATE_POLICY` | — |
| 50 | M250 | 工程：bundle 体积趋势 | 记录 extension/webview bundle 量级；异常增长阻塞发版评审 | M249 |
| 51 | M251 | 文档：`README` 排障链路 | 「三步自救」：`TROUBLESHOOTING`→诊断包→Issue 模板 | M206 |
| 52 | M252 | 文档：`EXPORT_GUIDE ↔ 配置` | 逐项映射 `markly.*` 导出相关设置 | M228 |
| 53 | M253 | 文档：`COMPATIBILITY_MATRIX` | 与 `engines.vscode`、`puppeteer` 平台备注一致 | — |
| 54 | M254 | 支持：Issue 模板 | 对齐 `REPRO_TEMPLATE.md`：版本/平台/最短复现/诊断包 | — |
| 55 | M255 | 发布：semver 自检 | PATCH/MINOR 规则与 `CHANGELOG` 头一致（`check-release` 已覆盖则记为核验） | M207 |
| 56 | M256 | **阶段检查点**：用户可见路径收敛 | IR 不显式鼓励；Rich 失败可救；导出可诊断 | M207+M223+M251 |
| 57 | M257 | 缓冲：Issues 反哺单测（滚动） | 每周期从高优 issue 抽取 1 条进 fixture/regression | 并行 |
| 58 | M258 | customEditor：消息路由单测增补 | Open/save/export 错误路径断言增强 | — |
| 59 | M259 | preview：预览导出 vs 正式导出 | 文档说明差异来源；如需对齐则列工单 | M228 |
| 60 | M260 | 代码健康：`TODO`/`FIXME` 清理 | Webview/extension 中非 IR 范围内的技术债收口或转 issue | — |
| 61 | M261 | 协议：兼容性回归（无变更前提下） | 跑一轮「旧 webview ↔ 新 ext」组合的说明性测试（按需） | M246 |
| 62 | M262 | 性能：webview 初始化指标（可选字段） | 诊断包可加 `webviewInitMs`（若隐私允许） | M249 |
| 63 | M263 | Rich：编辑器错误边界 UX | Milkdown 抛错时对用户可复制信息、不白板 | M208 |
| 64 | M264 | 导出：大批量图片内存策略 | 预检警告/分批导出（若暂不实现则需文档限制） | M224 |
| 65 | M265 | 表格：GFM pipe 逃逸监控 | fixture 捕获「代码单元格里 `|`」等已知限制 | M216 |
| 66 | M266 | 扩展激活：延迟与必要性审计 | activationEvents 是否仍最小集合；文档记录 | — |
| 67 | M267 | Marketplace：README/Changelog 摘要 | 对用户可见的三大卖点+最近修复（见 README 与 `docs/marketplace/HIGHLIGHTS.md`） | M251 |
| 68 | M268 | 近期「Go/No-Go」自检 | 对照 `docs/2.0_RISKS_AND_ACCEPTANCE.md` 风险 1–3 未抬头 | — |
| 69 | M269 | 近期收尾：里程碑表归档 | `CHANGELOG`/`MARKDOWN_CAPABILITIES` 本节链接本文件与本阶段完成日期 | M268 |
| 70 | M270 | 近期正式封板位 | 「可移交中期」：**IR 仍为 legacy 但未删代码**；Rich/导出主线稳定 | M269+M256 |
| 71 | M271 | 可选：本地化架构评估 | 文案外置、`nls`/`l10n` 方案选型（无译稿也行，见 `docs/LOCALIZATION_ARCH_EVAL.md`） | 并行 |
| 72 | M272 | 可选：`telemetry`（若产品有）默认关复核 | — | — |
| 73 | M273 | 可选：WSL／Remote SSH 手记 | 「已知良好/限制」记入 `COMPATIBILITY_MATRIX` | M253 |
| 74 | M274 | Bugfix Sprint 预留 | `docs/bugfix/README.md` 作为闭环模板与归档入口 | — |
| 75 | M275 | 近期最终 Release Train | semver + `gates:stable` + `check-release` | M270 |

> **说明**：M271–M275 可与主链并行收尾，但以 **M270** 为移交中期的硬性封板参考。

---

## 5. 工作流视图（分组，对应上表序号）

以下为 **不按执行顺序**，仅帮助你从主题角度核对「是否遗漏」。

| 工作流 | 覆盖里程碑（节选） |
|--------|---------------------|
| **IR 软下线** | M202–M207，M206 |
| **Rich 稳定性** | M208–M219，M263–M265 |
| **Source 兜底** | M220–M221 |
| **导出/PDF/HTML/预检** | M222–M228 |
| **Mermaid/TOC** | M226–M230 |
| **大纲** | M231–M232 |
| **图片/安全** | M233–M236 |
| **AI** | M237–M238 |
| **配置/合规** | M239–M240 |
| **UX/A11y** | M241–M243 |
| **测试与 CI** | M244–M248，M261 |
| **文档与支持** | M251–M254，M267 |
| **工程与发布** | M249–M250，M255–M256 |

---

## 6. 阶段出口标准（移交中期）

满足以下可进入 `docs/ROADMAP_MID.md`：

1. IR **Phase 1** 已发布且可观测（入口/文案/诊断一致）。  
2. Rich/Source/导出主路径 **无已知 P0**。  
3. `gates:stable` **最近 N 次**（例如 3–5）通过记录可查。  
4. 文档链路闭环：`README` ↔ `TROUBLESHOOTING` ↔ `REPRO_TEMPLATE`。  

---

## 7. 工程执行快照（相对 M201–M275 的落地记录）

以下为 **已实现或已入库文档/模板** 的摘要，便于和表格对照；「Kickoff／季度复盘／E2E 全绿」类组织项仍需团队自行维护。（**补丁版本**：以 `CHANGELOG` / `package.json` 为准。）

> Near Phase 完成记录（v1.39.15 / 2026-05-06）：`docs/NEAR_PHASE_COMPLETE_1.39.15.md`。

| 编号段 | 已对齐交付（节选） |
|--------|---------------------|
| M201–M207 | README 路线图链、Walkthrough/IR 叙事与设置项 `deferDiagramRenderInRich` 说明指向 `PERFORMANCE_NOTES`、`IR_REMOVAL_ROADMAP`、`ROADMAP_NEAR` |
| M208–M219 | `TROUBLESHOOTING` 补 Rich/导出链；大图粘贴手记（compress 相关）；`SOURCE_VS_RICH.md` |
| M222–M225 | PDF `browser.close` 容错；预检 **`sourceLine` + 「打开文档并定位」**；`formatExportFailure` 取消/权限/磁盘 |
| M231–M232 | `OutlinePanel` 筛选防抖 |
| M235–M236 | SVG sanitize 增补用例 |
| M246–M248 | PR 模板 **messageGuards** 勾选；`CONTRIBUTING.md`；Issue 模板 `bug_report.md` |
| M251–M254 | README 三步链路；`EXPORT_GUIDE` 设置索引与大图节；`COMPATIBILITY_MATRIX` Remote/WSL |
| M258–M266 | `webviewInboundRouting`/`exportFilters` 单测；`SAVE_FAILED`；Rich 降级条可复制错误摘要；诊断 `webviewInitMs`（与 mount 同源）；导出预检 `many_local_images`；`PROTOCOL_COMPAT_SMOKE.md`、`ACTIVATION_EVENTS_AUDIT.md`、fixture `17-table-code-cell-pipe.md` |
| M262–M264 | `webviewMountMs`/`webviewInitMs`、`EXPORT_GUIDE` 第 6 节与预检大量本地图告警 |
| M245 / M257 | `docs/FLAKY_TESTS.md`（flaky 管控）；`docs/REGRESSION_PLAYBOOK.md`（issue→fixture 回归手册） |
| M247 / M250 | CI 增加 `npm run test:vscode`（headless, xvfb）；`scripts/record-bundle-sizes.mjs` + `resources/BUNDLE_SIZE_HISTORY.md` |
| M201 / M268 / M270 / M275 | `docs/NEAR_KICKOFF_TEMPLATE.md`、`docs/NEAR_GONOGO_TEMPLATE.md`（组织项模板化） |
| M259 | `docs/EXPORT_PREVIEW_VS_EXPORT.md`（Preview vs 正式导出差异说明） |
| M267–M275 | Marketplace 摘要：`docs/marketplace/HIGHLIGHTS.md`；Go/No-Go 记录：`docs/NEAR_GONOGO_1.39.15.md`；封板声明：`docs/NEAR_PHASE_COMPLETE_1.39.15.md`；本地化评估：`docs/LOCALIZATION_ARCH_EVAL.md`；Bugfix Sprint：`docs/bugfix/README.md`；`MARKDOWN_CAPABILITIES` §5.8 与 `CHANGELOG` 同步完成日期 |

**仍为人工/周期长项**：`npm audit` SLA 的持续执行、M257 工单选择与回归优先级的持续治理、M201/M268/M270 等“封板/复盘/Owner”类组织项。

