# M32 图片缺失检测与定位闭环计划

目标：在 M28 的统一图片路径解析基础上，让用户能在诊断信息中看到本地图片是否真实存在，并能快速定位缺失引用。

## M32-0：计划与验收标准

- [x] 新建本计划文档
- [x] 明确首批范围：检测与定位优先，不自动改写正文
- [x] 验收：缺失本地图片能被列入诊断，远程图和 data URL 不误报

## M32-1：Extension 侧本地图片 stat 检测协议

- [x] 新增 Webview → Extension 请求：`CHECK_LOCAL_IMAGE_REFS`
- [x] 新增 Extension → Webview 返回：`LOCAL_IMAGE_REFS_RESULT`
- [x] 扩展侧复用 `resolveMarkdownImageUri`，用 `workspace.fs.stat` 判断存在性

## M32-2：诊断包增加缺失/存在图片引用

- [x] Webview 在复制诊断前刷新一次本地图片状态
- [x] `images` 诊断中增加 `missingRefs`、`existingRefs`、`checkedLocalRefs`、`lastCheckedAt`
- [x] 检测失败时保留错误样本，避免静默吞掉文件系统异常

## M32-3：定位缺失/图片引用基础能力

- [x] Extension 返回每个引用的 `resolvedPath`
- [x] 诊断包能直接展示缺失图片引用和解析后的路径
- [x] 首版不自动修改 Markdown 正文，避免误删用户内容

## M32-4：路径边界与协议测试

- [x] 覆盖 `./assets`、`../assets`、查询参数、远程图、data URL
- [x] 覆盖协议 guard 的合法/非法 payload
- [x] 覆盖图片诊断合并缺失/存在结果

## M32-5：集成式诊断测试与路线更新

- [x] 复制诊断测试断言包含缺失图片字段
- [x] 更新 `docs/product-roadmap-2026.md`
- [x] 运行 `npm run lint`
- [x] 运行 `npm test`（根项目 88 个测试，webview 362 个测试）
- [x] 运行 `npm run build`
- [x] 运行 `npm run check:bundle`
- [x] 运行 `npm run check:release`

