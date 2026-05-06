# 扩展 activationEvents 审计（M266）

根目录 `package.json` 中 `activationEvents` 为**有意保持的最小集合**（避免空转占用）：

| 事件 | 作用 |
|------|------|
| `onCustomEditor:markly.preview` | 打开 Markly 自定义编辑器时激活 |
| `onLanguage:markdown` | 在 Markdown 语言上下文中提供命令/体验（含部分无自定义编辑器场景） |
| `onCommand:markly.template.newFromLibrary` | 从模板新建前激活 |
| `onWalkthrough:markly.welcome` | 欢迎引导打开时激活 |
| `onCommand:markly.help.recoveryCenter` | 恢复中心入口显式激活 |

其余命令（如导出）依赖上述路径之一触发扩展加载；若新增「未打开 md 即可执行」的全局命令，再评估是否追加对应 `onCommand:`。
