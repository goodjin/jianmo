# M16: Outline And Large Document UX

## 目标

让 Rich 主编辑体验下的长文档导航更稳定、更容易用。M16 首批聚焦大纲，因为这是长文档中最高频的导航入口。

## 范围

- [x] M16-0：梳理大纲、查找、大文档性能现状
- [x] M16-1：统一标题清洗与 heading id 生成逻辑
- [x] M16-2：大纲支持长标题 tooltip
- [x] M16-3：大纲支持章节折叠/展开
- [x] M16-4：补充大纲行为测试和共享解析测试
- [x] M16-5：运行验证并同步总路线文档

## 验证记录

- `cd webview && npx vitest run src/shared/__tests__/outline.test.ts src/components/__tests__/OutlinePanel.test.ts`

## 验收标准

- 大纲标题中的 `{#id}` 不再显示给用户。
- 长标题 hover 能看到完整标题。
- 点击父级标题可折叠/展开子标题，不影响兄弟章节显示。
- 大纲点击仍会发出正确 `jump` 事件。

## 后续可增强

- 当前章节随滚动/光标自动高亮。
- 长文档查找结果虚拟列表。
- 大文档编辑流 E2E 稳定门禁。

