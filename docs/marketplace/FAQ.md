# Marketplace 发布 FAQ（M99）

面向发布者与 README 读者的常见问题占位；**截图 / 动图**需在桌面端录制后放入仓库 `images/` 或文档约定路径，并在 README「Screenshots」一节引用。

## 常见问题（草稿）

1. **Markly 与内置 Markdown 预览有何不同？**  
   Markly 提供自定义编辑器 + Rich/Source 模式、导出 PDF/HTML、表格与图片工具链等；详见 README。

2. **首次打开慢？**  
   见随扩展 `resources/PERFORMANCE_NOTES.md`（首次激活与 webview 加载）。

3. **导出 PDF 失败？**  
   使用 **Export: Copy Last Failure Diagnostics** 收集脱敏信息；企业网络可能限制 Chromium 下载。

4. **会收集我的文档吗？**  
   默认不开启遥测；`markly.telemetry.enabled` 为 `true` 时仅 **本地 Output** 记录匿名事件，不向第三方发送。AI 能力见 `privacy/AI_PRIVACY.md`。

5. **快捷键冲突？**  
   在 **键盘快捷方式** 中搜索 `markly.` 调整。

## 发布前检查清单

- [ ] `package.json` / `webview/package.json` 版本号一致  
- [ ] `npm run preflight` 或 `gates:stable` 通过  
- [ ] README 中的功能列表与当前版本一致  
- [ ] 至少 1 张主界面截图 + 1 条动图（或「待补」说明）  
- [ ] 本 FAQ 与隐私/遥测说明已对外一致  
