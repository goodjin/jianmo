# 第三方脚本策略：Mermaid CDN（M302）

## 目标

在“导出能力可用”和“供应链/离线安全”之间做默认取舍：

- **默认离线可用**（不依赖第三方 CDN）
- 允许高级用户为了更小 HTML 体积选择外链，但需明确风险

## 策略

- **默认**：`markly.export.diagram.mermaidScriptBundling = embedded`
  - 导出 HTML/PDF 内联 `mermaid.min.js`
  - 优点：离线可渲染、可复现
  - 缺点：HTML 体积更大

- **可选**：`external`
  - 从 jsDelivr 拉取与扩展版本绑定的 Mermaid 脚本
  - 风险：离线不可用；第三方供应链风险；企业网络可能拦截

## 预览与导出的一致性

- **导出预览**（Preview: Export HTML）固定使用 `embedded`：
  - 避免 webview CSP 放开第三方脚本
  - 避免“预览可用/导出不可用”或反之的混乱

## 建议（企业/安全敏感）

- 强制 `embedded`
- 如需进一步收敛：在后续里程碑引入“策略开关”禁止 `external`（并在 UI/设置层做约束）

