# Rich / Source 等价能力验收清单（M03）

用于 **IR 退场前** 核对：用户与导出是否仅依赖 **Rich + Source** 即可覆盖主要场景。  
详细语法见 [`MARKDOWN_CAPABILITIES.md`](./MARKDOWN_CAPABILITIES.md) 与 README；本表为 **验收勾选**，不重复长规范。

**图例**  
- **R**：Rich 必须可编辑/可呈现（或明确为「仅 Source」场景）  
- **S**：Source 必须可用  
- **E**：PDF/HTML 导出与设计一致（或与产品声明的局限一致）  
- **IR-O**：当前主要仍依赖 IR 装饰器链的能力（冻结期 **不新增**；退场前须清空或迁到 Rich/Source）

## 块级与行内

| 能力 | R | S | E | IR-O / 备注 |
|------|---|---|---|-------------|
| ATX 标题 H1–H6 | ☐ | ☐ | ☐ | 大纲/折叠与两种模式一致 |
| 段落 / 硬换行语义 | ☐ | ☐ | ☐ | golden：`webview/src/__tests__/richNewlineSerialization.test.ts`（M12） |
| 无序/有序/任务列表 | ☐ | ☐ | ☐ | |
| 嵌套列表 | ☐ | ☐ | ☐ | Tab 缩进项：`webview/src/__tests__/richListIndentKeymap.test.ts`（M11） |
| 引用块 | ☐ | ☐ | ☐ | |
| 分割线 | ☐ | ☐ | ☐ | |
| 粗斜体、删除线、行内代码 | ☐ | ☐ | ☐ | |
| 链接与图片 | ☐ | ☐ | ☐ | 本地 assets 策略见 README |
| 自动链接 | ☐ | ☐ | ☐ | 与安全策略一致 |

## GFM 扩展

| 能力 | R | S | E | IR-O / 备注 |
|------|---|---|---|-------------|
| 管道表格 | ☐ | ☐ | ☐ | Rich 为主；宽表性能见专门计划；格内换行语义见 [`M30_TABLE_CELL_BLOCKS.md`](./M30_TABLE_CELL_BLOCKS.md)（M30） |
| 脚注 | ☐ | ☐ | ☐ | |
| Strikethrough 等 GFM | ☐ | ☐ | ☐ | |

## 富媒体

| 能力 | R | S | E | IR-O / 备注 |
|------|---|---|---|-------------|
| 行内/块级数学（KaTeX） | ☐ | ☐ | ☐ | |
| Mermaid（fenced） | ☐ | ☐ | ☐ | 导出与预览一致声明 |
| 代码块 / Shiki | ☐ | ☐ | ☐ | 档位降级与 Source 可读性 |

## 编辑体验（非语法）

| 能力 | R | S | 备注 |
|------|---|---|------|
| 查找/替换 | ☐ | ☐ | Rich 内实现差异可文档化 |
| 撤销/重做 | ☐ | ☐ | 跨模式语义见 [`RICH_SOURCE_UNDO_SEMANTICS.md`](./RICH_SOURCE_UNDO_SEMANTICS.md)（M20） |
| Rich 工具栏块级语义 | ☐ | — | [`M16_BLOCK_FORMAT_SEMANTICS.md`](./M16_BLOCK_FORMAT_SEMANTICS.md) |
| 跨段行内格式（顺序一致） | ☐ | — | `richMultiParagraphToggleMark.test.ts`（M19） |
| 大纲导航 | ☐ | ☐ | |
| 粘贴 HTML/表格/TSV | ☐ | ☐ | HTML 共用净化：`webview/src/utils/richPasteSanitize.ts`（M13–14） |

## IR-only 跟踪（退场前归零）

在完成 [`plan-ir-freeze-100MS-task-split.md`](./plan-ir-freeze-100MS-task-split.md) 验收前，将仍 **仅 IR 可达** 的项列于此：

- （暂无则写「无」或删除本段）
