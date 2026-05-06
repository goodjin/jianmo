# 图片：未引用资源清理向导（M300）

## 目标

让用户能在 webview 内对“保存目录一层内但正文未引用”的图片做**安全删除**：

- 必须二次确认（宿主弹窗）
- 默认走回收站（可恢复）
- 只允许删除 `saveDirectory` 下**一层文件**（防止越界误删）

## 使用方式

1. 打开「图片资产列表」面板
2. 在「未引用」区点击 **删除未引用（谨慎）**
3. 宿主弹窗确认后执行删除，并回传结果（成功/失败数）

## 实现要点

- webview → extension：
  - `DELETE_ASSETS_IMAGE_FILES`（携带相对路径清单）
- extension → webview：
  - `ASSETS_IMAGE_DELETE_RESULT`（回传 deleted / failed / cancelled）
- extension 侧删除：
  - `vscode.workspace.fs.delete(uri, { useTrash: true })`
  - 路径校验：拒绝包含 `..`，且必须位于 `saveDirectory/` 下的一层文件

