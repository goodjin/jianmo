# MOD-011: VS Code Integration VS Code 集成模块

## 文档信息
- **项目名称**: Markly - CodeMirror 6 Markdown Editor
- **文档编号**: MOD-011
- **版本**: v1.0
- **更新日期**: 2026-03-18
- **对应PRD**: docs/v4/01-prd.md

---

## 目录

1. [系统定位](#系统定位)
2. [对应PRD](#对应prd)
3. [全局架构位置](#全局架构位置)
4. [依赖关系](#依赖关系)
5. [核心设计](#核心设计)
6. [接口定义](#接口定义)
7. [通信协议](#通信协议)
8. [边界条件](#边界条件)
9. [实现文件](#实现文件)
10. [覆盖映射](#覆盖映射)

---

## 系统定位

### 在整体架构中的位置

**所属层次**: L2 - VS Code 集成层

**架构定位图**:
```
┌─────────────────────────────────────────────────────┐
│              L3: MOD-001 Editor Core                │
│              调用 VS Code API 保存文件               │
└─────────────────────┬───────────────────────────────┘
                      │ 调用
                      ▼
┌─────────────────────────────────────────────────────┐
│              ★ MOD-011: VS Code Integration ★       │
│              VS Code 集成模块                        │
│  ┌─────────────────────────────────────────────┐   │
│  │  • extension.ts       - 扩展入口            │   │
│  │  • editorProvider.ts  - Custom Editor       │   │
│  │  • useVSCode.ts       - Webview Hook        │   │
│  │  • 配置同步与通信                            │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────┘
                      │ postMessage
                      ▼
┌─────────────────────────────────────────────────────┐
│              VS Code Extension Host                 │
│              文件系统、配置管理                      │
└─────────────────────────────────────────────────────┘
```

### 核心职责

- **扩展入口**: 注册 Custom Text Editor Provider
- **Webview 管理**: 创建和管理 Webview Panel
- **双向通信**: Extension Host 与 Webview 之间的消息传递
- **配置同步**: 同步 VS Code 设置到编辑器
- **文件操作**: 保存、读取文件内容

### 边界说明

- **负责**:
  - VS Code API 的封装和调用
  - Webview 生命周期管理
  - 消息协议的实现
  - 配置的读取和同步

- **不负责**:
  - 编辑器内部逻辑（L3 负责）
  - UI 渲染（L6/L7 负责）
  - Markdown 处理（L4/L5 负责）

---

## 对应PRD

| PRD章节 | 编号 | 内容 |
|---------|-----|------|
| 功能需求 | FR-010 | 图片处理 |
| 功能需求 | FR-015 | VS Code 配置同步 |
| 用户故事 | US-007 | 图片自动保存 |
| 业务流程 | Flow-002 | 图片粘贴处理 |
| 验收标准 | AC-007-01~04 | 图片处理相关 |

---

## 全局架构位置

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     VS Code Extension Architecture                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │ Extension Host (Node.js)                                         │  │
│   │  ┌─────────────────────────────────────────────────────────┐   │  │
│   │  │ extension.ts                                            │   │  │
│   │  │  • activate() - 扩展激活                                │   │  │
│   │  │  • registerCustomEditorProvider()                       │   │  │
│   │  └─────────────────────────────────────────────────────────┘   │  │
│   │                              │                                   │  │
│   │                              ▼                                   │  │
│   │  ┌─────────────────────────────────────────────────────────┐   │  │
│   │  │ MarkdownEditorProvider                                  │   │  │
│   │  │  • resolveCustomTextEditor()                            │   │  │
│   │  │  • 创建 WebviewPanel                                    │   │  │
│   │  │  • 处理文档变更                                         │   │  │
│   │  └─────────────────────────────────────────────────────────┘   │  │
│   │                              │                                   │  │
│   │                              │ postMessage                       │  │
│   └──────────────────────────────┼───────────────────────────────────┘  │
│                                  │                                      │
│   ═══════════════════════════════╪══════════════════════════════════   │
│                                  │                                      │
│   ┌──────────────────────────────┼───────────────────────────────────┐  │
│   │ Webview (IFrame)               │                                   │  │
│   │  ┌─────────────────────────────┼─────────────────────────────┐   │  │
│   │  │ composables/useVSCode.ts    │                             │   │  │
│   │  │  • postMessage() ◀──────────┘                             │   │  │
│   │  │  • onMessage()                                            │   │  │
│   │  └─────────────────────────────────────────────────────────┘   │  │
│   │                              │                                   │  │
│   │                              ▼                                   │  │
│   │  ┌─────────────────────────────────────────────────────────┐   │  │
│   │  │ Webview API                                             │   │  │
│   │  │  • acquireVsCodeApi()                                   │   │  │
│   │  │  • postMessage()                                        │   │  │
│   │  └─────────────────────────────────────────────────────────┘   │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 依赖关系

### 上游依赖

| 模块名称 | 模块编号 | 依赖原因 | 调用方式 |
|---------|---------|---------|---------|
| VS Code API | vscode | 扩展 API | import * as vscode from 'vscode' |

### 下游依赖

| 模块名称 | 模块编号 | 被调用场景 | 调用方式 |
|---------|---------|-----------|---------|
| Editor Core | MOD-001 | 保存后更新编辑器 | events |
| Image Handler | MOD-008 | 图片上传保存 | postMessage |

---

## 核心设计

### 扩展入口设计

```typescript
// src/extension/extension.ts
import * as vscode from 'vscode';
import { MarkdownEditorProvider } from './editorProvider';

export function activate(context: vscode.ExtensionContext) {
  // 注册 Custom Text Editor Provider
  const provider = new MarkdownEditorProvider(context);

  const registration = vscode.window.registerCustomEditorProvider(
    'markly.editor',  // viewType
    provider,
    {
      webviewOptions: {
        retainContextWhenHidden: true,  // 隐藏时保留状态
      },
      supportsMultipleEditorsPerDocument: false,
    }
  );

  context.subscriptions.push(registration);

  // 注册命令
  context.subscriptions.push(
    vscode.commands.registerCommand('markly.toggleMode', () => {
      // 发送命令到 Webview
      provider.postMessageToActiveWebview({
        type: 'COMMAND',
        payload: { command: 'toggleMode' },
      });
    })
  );
}

export function deactivate() {
  // 清理资源
}
```

### Custom Editor Provider

```typescript
// src/extension/editorProvider.ts
import * as vscode from 'vscode';
import * as path from 'path';

export class MarkdownEditorProvider implements vscode.CustomTextEditorProvider {
  private webviewPanels = new Map<string, vscode.WebviewPanel>();

  constructor(private readonly context: vscode.ExtensionContext) {}

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // 配置 Webview
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this.context.extensionPath, 'media')),
      ],
    };

    // 设置 HTML 内容
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    // 保存面板引用
    this.webviewPanels.set(document.uri.toString(), webviewPanel);

    // 初始化内容
    this.postMessage(webviewPanel, {
      type: 'INIT',
      payload: {
        content: document.getText(),
        config: this.getEditorConfig(),
      },
    });

    // 监听 Webview 消息
    this.setupMessageHandling(webviewPanel, document);

    // 监听文档变更
    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.uri.toString() === document.uri.toString()) {
          this.postMessage(webviewPanel, {
            type: 'DOCUMENT_CHANGE',
            payload: { content: e.document.getText() },
          });
        }
      }
    );

    // 清理订阅
    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
      this.webviewPanels.delete(document.uri.toString());
    });
  }

  private setupMessageHandling(
    webviewPanel: vscode.WebviewPanel,
    document: vscode.TextDocument
  ): void {
    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'CONTENT_CHANGE':
          // Webview 内容变更，更新文档
          await this.updateDocument(document, message.payload.content);
          break;

        case 'SAVE':
          // 保存文档
          await document.save();
          break;

        case 'UPLOAD_IMAGE':
          // 保存图片
          const imagePath = await this.saveImage(
            document,
            message.payload.base64,
            message.payload.filename
          );
          this.postMessage(webviewPanel, {
            type: 'IMAGE_SAVED',
            payload: { path: imagePath },
          });
          break;

        case 'CONFIG_UPDATE':
          // 更新配置
          await this.updateConfig(message.payload.key, message.payload.value);
          break;
      }
    });
  }

  private async updateDocument(
    document: vscode.TextDocument,
    content: string
  ): Promise<void {
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length)
    );
    edit.replace(document.uri, fullRange, content);
    await vscode.workspace.applyEdit(edit);
  }

  private async saveImage(
    document: vscode.TextDocument,
    base64: string,
    filename: string
  ): Promise<string> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) {
      throw new Error('No workspace folder');
    }

    const assetsDir = vscode.Uri.joinPath(workspaceFolder.uri, 'assets');

    // 确保 assets 目录存在
    try {
      await vscode.workspace.fs.createDirectory(assetsDir);
    } catch {
      // 目录已存在
    }

    // 生成唯一文件名
    const uniqueFilename = this.generateUniqueFilename(assetsDir, filename);
    const imageUri = vscode.Uri.joinPath(assetsDir, uniqueFilename);

    // 保存图片
    const buffer = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    await vscode.workspace.fs.writeFile(imageUri, buffer);

    // 返回相对路径
    return path.relative(path.dirname(document.uri.fsPath), imageUri.fsPath);
  }

  private generateUniqueFilename(dir: vscode.Uri, filename: string): string {
    // 实现文件名去重逻辑
    return filename;
  }

  private getEditorConfig(): Record<string, unknown> {
    const config = vscode.workspace.getConfiguration('markly');
    return {
      theme: config.get('theme', 'auto'),
      tabSize: config.get('tabSize', 2),
      enableGFM: config.get('enableGFM', true),
      enableMath: config.get('enableMath', true),
      assetsPath: config.get('assetsPath', 'assets'),
    };
  }

  private async updateConfig(key: string, value: unknown): Promise<void> {
    const config = vscode.workspace.getConfiguration('markly');
    await config.update(key, value, true);
  }

  private postMessage(
    webviewPanel: vscode.WebviewPanel,
    message: VSCodeMessage
  ): void {
    webviewPanel.webview.postMessage(message);
  }

  public postMessageToActiveWebview(message: VSCodeMessage): void {
    const activePanel = vscode.window.activeTextEditor
      ? this.webviewPanels.get(vscode.window.activeTextEditor.document.uri.toString())
      : undefined;

    if (activePanel) {
      this.postMessage(activePanel, message);
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    // 获取资源 URI
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview.css')
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${styleUri}">
  <title>Markly Editor</title>
</head>
<body>
  <div id="app"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}
```

### Webview Hook

```typescript
// webview/src/composables/useVSCode.ts
import { ref, onMounted, onUnmounted } from 'vue';

interface VSCodeApi {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
}

declare global {
  interface Window {
    acquireVsCodeApi: () => VSCodeApi;
  }
}

export interface VSCodeMessage {
  type: string;
  payload?: unknown;
}

export const useVSCode = () => {
  const vscode = ref<VSCodeApi | null>(null);
  const isReady = ref(false);

  onMounted(() => {
    if (typeof window.acquireVsCodeApi === 'function') {
      vscode.value = window.acquireVsCodeApi();
      isReady.value = true;
    }
  });

  // 发送消息到 Extension
  const postMessage = (message: VSCodeMessage): void => {
    vscode.value?.postMessage(message);
  };

  // 监听来自 Extension 的消息
  const onMessage = (handler: (message: VSCodeMessage) => void): (() => void) => {
    const listener = (event: MessageEvent) => {
      handler(event.data as VSCodeMessage);
    };

    window.addEventListener('message', listener);

    // 返回取消订阅函数
    return () => {
      window.removeEventListener('message', listener);
    };
  };

  // 保存状态
  const setState = (state: unknown): void => {
    vscode.value?.setState(state);
  };

  // 获取状态
  const getState = (): unknown => {
    return vscode.value?.getState();
  };

  return {
    vscode,
    isReady,
    postMessage,
    onMessage,
    setState,
    getState,
  };
};
```

---

## 接口定义

### 对外接口清单

| 接口编号 | 接口名称 | 类型 | 路径 | 对应PRD |
|---------|---------|------|------|---------|
| API-038 | useVSCode | Hook | composables/useVSCode.ts | FR-015 |
| API-039 | postMessage | Method | useVSCode.postMessage | FR-010, FR-015 |
| API-040 | onMessage | Method | useVSCode.onMessage | FR-010, FR-015 |

---

## 通信协议

### 消息类型定义

```typescript
// Webview → Extension
interface WebviewToExtensionMessages {
  CONTENT_CHANGE: {
    content: string;
  };
  SAVE: {
    content: string;
  };
  UPLOAD_IMAGE: {
    base64: string;
    filename: string;
  };
  CONFIG_UPDATE: {
    key: string;
    value: unknown;
  };
}

// Extension → Webview
interface ExtensionToWebviewMessages {
  INIT: {
    content: string;
    config: EditorConfig;
  };
  DOCUMENT_CHANGE: {
    content: string;
  };
  IMAGE_SAVED: {
    path: string;
  };
  CONFIG_CHANGE: {
    config: Partial<EditorConfig>;
  };
  COMMAND: {
    command: string;
    args?: unknown[];
  };
}
```

### 通信流程图

```
┌─────────────┐     CONTENT_CHANGE      ┌─────────────┐
│   Webview   │ ───────────────────────▶ │  Extension  │
│             │                          │             │
│  用户输入   │                          │  更新文档   │
└─────────────┘                          └─────────────┘

┌─────────────┐     UPLOAD_IMAGE        ┌─────────────┐
│   Webview   │ ───────────────────────▶ │  Extension  │
│             │                          │             │
│  粘贴图片   │                          │  保存文件   │
└─────────────┘                          └──────┬──────┘
                                                │
                                                │ IMAGE_SAVED
                                                ▼
                                        ┌─────────────┐
                                        │   Webview   │
                                        │  插入链接   │
                                        └─────────────┘

┌─────────────┐         INIT            ┌─────────────┐
│  Extension  │ ───────────────────────▶ │   Webview   │
│             │                          │             │
│  打开文件   │                          │  初始化     │
└─────────────┘                          └─────────────┘
```

---

## 边界条件

### BOUND-030: 无工作区

**对应PRD**: AC-007-01

**边界描述**:
- 没有打开工作区时，图片保存到临时目录

**处理逻辑**:
```typescript
const saveImage = async (base64: string, filename: string): Promise<string> => {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);

  if (!workspaceFolder) {
    // 无工作区，使用全局存储
    const globalStorage = context.globalStorageUri;
    const assetsDir = vscode.Uri.joinPath(globalStorage, 'assets');
    // ...
  }

  // ...
};
```

### BOUND-031: 磁盘空间不足

**对应PRD**: Flow-002

**边界描述**:
- 保存图片时磁盘空间不足

**处理逻辑**:
```typescript
try {
  await vscode.workspace.fs.writeFile(imageUri, buffer);
} catch (error) {
  if (error.code === 'ENOSPC') {
    throw new Error('DISK_FULL: 磁盘空间不足');
  }
  throw error;
}
```

---

## 实现文件

| 文件路径 | 职责 |
|---------|------|
| src/extension/extension.ts | 扩展入口 |
| src/extension/editorProvider.ts | Custom Editor Provider |
| webview/src/composables/useVSCode.ts | Webview Hook |

---

## 覆盖映射

### PRD需求覆盖情况

| PRD类型 | PRD编号 | 架构元素 | 覆盖状态 |
|---------|---------|---------|---------|
| 功能需求 | FR-010 | saveImage | ✅ |
| 功能需求 | FR-015 | getEditorConfig, updateConfig | ✅ |
| 用户故事 | US-007 | UPLOAD_IMAGE, IMAGE_SAVED | ✅ |
| 业务流程 | Flow-002 | saveImage | ✅ |
| 验收标准 | AC-007-01~04 | saveImage | ✅ |

---

## 变更历史

| 版本 | 日期 | 变更内容 | 作者 |
|-----|------|---------|------|
| 1.0 | 2026-03-18 | 初始版本 | AI |
