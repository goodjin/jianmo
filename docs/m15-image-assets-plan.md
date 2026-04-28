# M15: Image Asset Management

## 目标

让 Rich 主编辑体验里的图片插入、保存、引用和失败处理变成可靠能力。M15 不做复杂图片编辑器，先保证真实用户最常见的“粘贴/拖拽图片到 Markdown 文档”稳定可用。

## 范围

- [x] M15-0：锁定图片资产管理任务清单和验收标准
- [x] M15-1：接通粘贴/拖拽图片到当前编辑器
- [x] M15-2：图片保存失败时给出明确反馈
- [x] M15-3：补充图片引用诊断能力
- [x] M15-4：补充图片链路单元测试、协议测试和诊断覆盖
- [x] M15-5：运行验证并更新路线文档状态

## 验收标准

- Rich 模式下粘贴图片后，文档中插入 `![alt](assets/xxx.png)`。
- Source/IR 模式下仍可通过同一条上传链路插入图片。
- Extension 保存失败时，Webview 能收到明确失败消息并提示用户。
- 图片处理测试必须验证真实消息往返和真实插入行为，不能只测函数存在。
- 不新增 IR 专属能力，不围绕 IR 做额外产品投入。

## 完成记录

- Webview 已在统一编辑器容器上接入图片粘贴和拖拽事件。
- 图片处理链路统一走 `UPLOAD_IMAGE`，保存成功后插入 `![alt](path)`。
- Rich 通过 Milkdown 暴露的 `insertMarkdown` 接入同一条图片插入链路。
- Source/IR 继续通过 CodeMirror 当前光标位置插入 Markdown。
- Extension 新增 `IMAGE_SAVE_FAILED` 下行消息，图片保存失败时 Webview 能提示用户重试。
- 诊断包新增 `images` 字段，包含图片引用数量、本地/远程引用数量、保存目录和渲染图片数量。

## 验证记录

- `npx vitest run src/types/__tests__/messageContract.test.ts`
- `cd webview && npx vitest run src/composables/__tests__/useImageHandler.test.ts src/__tests__/copyDiagnostics.test.ts`
- `npm run build`

## 不做

- 不做裁剪、标注、滤镜等复杂图片编辑器。
- 不做 Word 导出图片链路。
- 不做复杂资产重命名/移动联动，后续可作为 M15 第二批。

