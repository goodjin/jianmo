# 开发计划 - MOD-011: VS Code Integration

## 文档信息
- **模块编号**: MOD-011
- **模块名称**: VS Code Integration
- **所属层次**: L2 - VS Code 集成层
- **对应架构**: [06-mod-011-vscode-integration.md](../02-architecture/06-mod-011-vscode-integration.md)
- **优先级**: P0
- **预估工时**: 1.5天

---

## 1. 模块概述

### 1.1 模块职责

VS Code Integration 模块负责 VS Code 扩展与 Webview 之间的集成：
- 扩展入口和激活
- Custom Text Editor Provider 实现
- Webview 生命周期管理
- 双向通信协议
- 图片保存到文件系统
- 配置同步

### 1.2 对应PRD

| PRD编号 | 功能 | 用户故事 |
|---------|-----|---------|
| FR-010 | 图片处理 | US-007 |
| FR-015 | VS Code 配置同步 | US-002 |

### 1.3 架构定位

```
Extension Host (Node.js)
    ↓
MOD-011: VS Code Integration
    ↓
Webview (Vue 3)
```

---

## 2. 技术设计

### 2.1 目录结构

```
src/
├── extension/
│   ├── extension.ts          # 扩展入口
│   ├── editorProvider.ts     # Custom Editor Provider
│   └── __tests__/
│       └── extension.test.ts
└── webview/
    └── src/
        └── composables/
            ├── useVSCode.ts  # Webview Hook
            └── __tests__/
                └── useVSCode.test.ts
```

### 2.2 依赖关系

| 依赖项 | 用途 |
|-------|------|
| vscode | VS Code API |
| @types/vscode | 类型定义 |

---

## 3. 接口清单

| 任务编号 | 接口 | 名称 | 复杂度 |
|---------|------|------|-------|
| T-01 | - | 类型定义 | 低 |
| T-02 | API-038 | useVSCode | 中 |
| T-03 | API-039 | postMessage | 低 |
| T-04 | API-040 | onMessage | 低 |
| T-05 | - | 图片保存 | 中 |

---

## 4. 开发任务拆分

### 任务清单

| 任务 | 名称 | 文件数 | 代码行数 | 依赖 |
|-----|------|-------|---------|------|
| T-01 | 类型定义 | 2 | ~60 | - |
| T-02 | 扩展入口 | 2 | ~100 | T-01 |
| T-03 | Editor Provider | 2 | ~150 | T-02 |
| T-04 | Webview Hook | 2 | ~100 | T-01 |
| T-05 | 图片保存 | 2 | ~80 | T-03 |

---

## 5. 详细任务定义

### T-01: 类型定义

**任务概述**: 定义通信协议类型

**对应架构**:
- 数据结构: DATA-002 DocumentConfig
- 通信协议: Webview ↔ Extension

**输出**:
- `src/shared/types.ts`

**实现要求**:

```typescript
// shared/types.ts

// 消息类型
export type MessageType =
  | 'INIT'
  | 'CONTENT_CHANGE'
  | 'SAVE'
  | 'UPLOAD_IMAGE'
  | 'IMAGE_SAVED'
  | 'CONFIG_CHANGE'
  | 'GET_THEME'
  | 'THEME_CHANGE';

// 基础消息接口
export interface VSCodeMessage {
  type: MessageType;
  payload?: unknown;
}

// Webview → Extension 消息
export interface ContentChangeMessage extends VSCodeMessage {
  type: 'CONTENT_CHANGE';
  payload: {
    content: string;
  };
}

export interface UploadImageMessage extends VSCodeMessage {
  type: 'UPLOAD_IMAGE';
  payload: {
    base64: string;
    filename: string;
  };
}

// Extension → Webview 消息
export interface InitMessage extends VSCodeMessage {
  type: 'INIT';
  payload: {
    content: string;
    config: EditorConfig;
  };
}

export interface ImageSavedMessage extends VSCodeMessage {
  type: 'IMAGE_SAVED';
  payload: {
    path: string;
    filename: string;
  };
}

// 编辑器配置
export interface EditorConfig {
  theme: 'light' | 'dark' | 'auto';
  tabSize: number;
  enableGFM: boolean;
  enableMath: boolean;
  assetsPath: string;
}
```

**验收标准**:
- [ ] 所有消息类型定义完整
- [ ] 类型可正确导入

**预估工时**: 0.5小时

---

### T-02: 扩展入口

**任务概述**: 实现扩展激活入口

**对应架构**:
- 扩展入口: extension.ts

**输出**:
- `src/extension/extension.ts`

**实现要求**:

```typescript
// extension/extension.ts
import * as vscode from 'vscode';
import { MarkdownEditorProvider } from './editorProvider';

export function activate(context: vscode.ExtensionContext): void {
  // 注册 Custom Text Editor Provider
  const provider = new MarkdownEditorProvider(context);

  const registration = vscode.window.registerCustomEditorProvider(
    'markly.editor',
    provider,
    {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
      supportsMultipleEditorsPerDocument: false,
    }
  );

  context.subscriptions.push(registration);

  // 注册命令
  context.subscriptions.push(
    vscode.commands.registerCommand('markly.toggleMode', () => {
      provider.postMessageToActiveWebview({
        type: 'COMMAND',
        payload: { command: 'toggleMode' },
      });
    })
  );
}

export function deactivate(): void {
  // 清理资源
}
```

**验收标准**:
- [ ] 扩展可正常激活
- [ ] 命令可正常注册

**测试要求**:
- 测试激活函数

**预估工时**: 1小时

**依赖**: T-01

---

### T-03: Editor Provider

**任务概述**: 实现 Custom Text Editor Provider

**对应架构**:
- Custom Editor Provider: MarkdownEditorProvider

**输出**:
- `src/extension/editorProvider.ts`

**实现要求**:

```typescript
// extension/editorProvider.ts
import * as vscode from 'vscode';
import * as path from 'path';
import { VSCodeMessage } from '../shared/types';

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

    // 设置 HTML
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    // 保存引用
    this.webviewPanels.set(document.uri.toString(), webviewPanel);

    // 初始化内容
    this.postMessage(webviewPanel, {
      type: 'INIT',
      payload: {
        content: document.getText(),
        config: this.getEditorConfig(),
      },
    });

    // 设置消息处理
    this.setupMessageHandling(webviewPanel, document);

    // 监听文档变更
    const changeSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        this.postMessage(webviewPanel, {
          type: 'DOCUMENT_CHANGE',
          payload: { content: e.document.getText() },
        });
      }
    });

    // 清理
    webviewPanel.onDidDispose(() => {
      changeSubscription.dispose();
      this.webviewPanels.delete(document.uri.toString());
    });
  }

  private setupMessageHandling(
    webviewPanel: vscode.WebviewPanel,
    document: vscode.TextDocument
  ): void {
    webviewPanel.webview.onDidReceiveMessage(async (message: VSCodeMessage) => {
      switch (message.type) {
        case 'CONTENT_CHANGE':
          await this.updateDocument(document, message.payload.content);
          break;

        case 'UPLOAD_IMAGE':
          const imagePath = await this.saveImage(
            document,
            message.payload.base64,
            message.payload.filename
          );
          this.postMessage(webviewPanel, {
            type: 'IMAGE_SAVED',
            payload: { path: imagePath, filename: message.payload.filename },
          });
          break;
      }
    });
  }

  private async updateDocument(document: vscode.TextDocument, content: string): Promise<void> {
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length)
    );
    edit.replace(document.uri, fullRange, content);
    await vscode.workspace.applyEdit(edit);
  }

  private postMessage(webviewPanel: vscode.WebviewPanel, message: VSCodeMessage): void {
    webviewPanel.webview.postMessage(message);
  }

  public postMessageToActiveWebview(message: VSCodeMessage): void {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) return;

    const panel = this.webviewPanels.get(activeEditor.document.uri.toString());
    if (panel) {
      this.postMessage(panel, message);
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    // 返回 HTML 内容
    return `<!DOCTYPE html>...</html>`;
  }

  private getEditorConfig(): Record<string, unknown> {
    const config = vscode.workspace.getConfiguration('markly');
    return {
      theme: config.get('theme', 'auto'),
      tabSize: config.get('tabSize', 2),
    };
  }
}
```

**验收标准**:
- [ ] Webview 可正常创建
- [ ] 文档变更可同步到 Webview
- [ ] Webview 内容可同步到文档

**测试要求**:
- 测试消息处理

**预估工时**: 4小时

**依赖**: T-02

---

### T-04: Webview Hook

**任务概述**: 实现 Webview 通信 Hook

**对应架构**:
- 接口: API-038 useVSCode
- 接口: API-039 postMessage
- 接口: API-040 onMessage

**输出**:
- `webview/src/composables/useVSCode.ts`

**实现要求**:

```typescript
// composables/useVSCode.ts
import { ref, onMounted, onUnmounted } from 'vue';
import { VSCodeMessage } from '../../shared/types';

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

export const useVSCode = () => {
  const vscode = ref<VSCodeApi | null>(null);
  const isReady = ref(false);

  onMounted(() => {
    if (typeof window.acquireVsCodeApi === 'function') {
      vscode.value = window.acquireVsCodeApi();
      isReady.value = true;
    }
  });

  // 发送消息
  const postMessage = (message: VSCodeMessage): void => {
    vscode.value?.postMessage(message);
  };

  // 监听消息
  const onMessage = (handler: (message: VSCodeMessage) => void): (() => void) => {
    const listener = (event: MessageEvent) => {
      handler(event.data as VSCodeMessage);
    };

    window.addEventListener('message', listener);

    return () => {
      window.removeEventListener('message', listener);
    };
  };

  // 状态管理
  const setState = (state: unknown): void => {
    vscode.value?.setState(state);
  };

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

**验收标准**:
- [ ] 可发送消息到 Extension
- [ ] 可接收来自 Extension 的消息
- [ ] 状态管理正常

**测试要求**:
- 测试消息发送和接收

**预估工时**: 2小时

**依赖**: T-01

---

### T-05: 图片保存

**任务概述**: 实现图片保存功能

**对应架构**:
- 业务流程: Flow-002 图片粘贴处理

**输出**:
- `src/extension/editorProvider.ts` (saveImage 方法)

**实现要求**:

```typescript
// extension/editorProvider.ts (add to class)

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

  // 确保目录存在
  try {
    await vscode.workspace.fs.createDirectory(assetsDir);
  } catch {
    // 目录已存在
  }

  // 生成唯一文件名
  const uniqueFilename = this.generateUniqueFilename(assetsDir, filename);
  const imageUri = vscode.Uri.joinPath(assetsDir, uniqueFilename);

  // 保存文件
  const buffer = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
  await vscode.workspace.fs.writeFile(imageUri, buffer);

  // 返回相对路径
  return path.relative(path.dirname(document.uri.fsPath), imageUri.fsPath);
}

private generateUniqueFilename(dir: vscode.Uri, filename: string): string {
  // 简单实现：添加时间戳
  const ext = path.extname(filename);
  const name = path.basename(filename, ext);
  const timestamp = Date.now();
  return `${name}-${timestamp}${ext}`;
}
```

**验收标准**:
- [ ] 图片可保存到 assets 目录
- [ ] 返回正确的相对路径
- [ ] 文件名唯一

**测试要求**:
- 测试图片保存

**预估工时**: 2小时

**依赖**: T-03

---

## 6. 验收清单

### 6.1 功能验收

- [ ] 扩展可正常激活
- [ ] Webview 可正常创建
- [ ] 双向通信正常
- [ ] 图片可正常保存

### 6.2 质量验收

- [ ] 测试覆盖率 ≥ 80%
- [ ] 无 TypeScript 错误

---

## 7. 覆盖映射

| 架构元素 | 任务 | 覆盖状态 |
|---------|------|---------|
| API-038 useVSCode | T-04 | ✅ |
| API-039 postMessage | T-03, T-04 | ✅ |
| API-040 onMessage | T-03, T-04 | ✅ |
| Flow-002 图片粘贴 | T-05 | ✅ |
