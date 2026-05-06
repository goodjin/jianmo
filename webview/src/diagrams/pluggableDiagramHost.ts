/**
 * M39 spike：第二图表后端（例如 PlantUML）的宿主抽象位。
 * 当前仓库 **未** 默认注册任何实现；仅预留类型，避免未来硬编码到 Mermaid 分支内。
 */

export type DiagramBackendId = 'mermaid' | 'plantuml' | (string & {});

export interface DiagramRenderRequest {
  readonly backend: DiagramBackendId;
  readonly code: string;
  readonly signal?: AbortSignal;
}

/** 占位：后端返回 SVG 或 HTML 片段，由宿主注入 DOM */
export interface DiagramRenderResult {
  readonly mime: 'image/svg+xml' | 'text/html';
  readonly body: string;
}

export interface PluggableDiagramBackend {
  readonly id: DiagramBackendId;
  render(req: DiagramRenderRequest): Promise<DiagramRenderResult>;
}

export const diagramBackendRegistryStub: PluggableDiagramBackend[] = [];
