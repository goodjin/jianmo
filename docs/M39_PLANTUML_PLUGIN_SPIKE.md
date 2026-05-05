# M39（里程碑）：PlantUML 插件化宿主 — Spike

> **命名**：本仓库另有一份 **Rich 链接** 专题计划 [`m39-rich-link-anchor-plan.md`](./m39-rich-link-anchor-plan.md)；两者主题不同，以路径区分。

## 目标（未默认开启）

- 在 **`webview/src/diagrams/pluggableDiagramHost.ts`** 预留「多后端」接口，导出 `PluggableDiagramBackend` / `DiagramRenderRequest`，默认 **空 registry**。
- **不**在本 milestone 接入 PlantUML 运行时（无新增 wasm/服务端假设），避免 VS Code webview CSP 与安全评审范围膨胀。

## 后续落地顺序（提议）

1. 配置项：`markly.diagram.plantumlServerUrl`（仅 http(s)，默认空）。  
2. Fence 方言检测：`plantuml` 与可选 `puml`。  
3. 渲染：服务端返回 SVG → 与现有 Mermaid 容器同一套占位/错误 UX（对齐 M38）。  
4. 导出：PDF/HTML 需静态或同源内联 SVG，与本阶段 [`htmlExport`](../src/core/export/htmlExport.ts) 链路对接。
