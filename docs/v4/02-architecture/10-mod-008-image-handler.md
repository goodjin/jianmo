# MOD-008: Image Handler 图片处理模块

## 文档信息
- **项目名称**: Markly - CodeMirror 6 Markdown Editor
- **文档编号**: MOD-008
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
7. [数据结构](#数据结构)
8. [边界条件](#边界条件)
9. [实现文件](#实现文件)
10. [覆盖映射](#覆盖映射)

---

## 系统定位

### 在整体架构中的位置

**所属层次**: L6 - 功能组件层

**架构定位图**:
```
┌─────────────────────────────────────────────────────┐
│              L7: App.vue (全局布局)                  │
│         管理图片粘贴事件监听                          │
└─────────────────────┬───────────────────────────────┘
                      │ 粘贴事件
                      ▼
┌─────────────────────────────────────────────────────┐
│              ★ MOD-008: Image Handler ★             │
│              图片处理模块                            │
│  ┌─────────────────────────────────────────────┐   │
│  │  • useImageHandler.ts - 图片处理 Hook        │   │
│  │  • ImageDropZone.vue  - 图片拖放组件         │   │
│  │  • 粘贴/拖放/上传处理                        │   │
│  │  • 图片压缩与转换                            │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────┘
                      │ postMessage UPLOAD_IMAGE
                      ▼
┌─────────────────────────────────────────────────────┐
│              L2: MOD-011 VS Code Integration        │
│              保存图片到文件系统                       │
└─────────────────────────────────────────────────────┘
```

### 核心职责

- **粘贴处理**: 监听剪贴板粘贴事件，提取图片数据
- **拖放处理**: 支持从文件系统拖放图片到编辑器
- **图片压缩**: 压缩大尺寸图片以优化存储
- **格式转换**: 支持多种图片格式（PNG, JPG, WebP）
- **自动上传**: 通过 VS Code API 保存图片到工作区

### 边界说明

- **负责**:
  - 图片粘贴/拖放事件处理
  - 图片数据提取和转换
  - 图片压缩和格式优化
  - 生成 Markdown 图片语法

- **不负责**:
  - 图片文件系统存储（L2 负责）
  - 图片预览渲染（L5 负责）
  - 图片编辑功能（裁剪、旋转等）

---

## 对应PRD

| PRD章节 | 编号 | 内容 |
|---------|-----|------|
| 功能需求 | FR-010 | 图片处理 |
| 用户故事 | US-007 | 图片自动保存 |
| 业务流程 | Flow-002 | 图片粘贴处理 |
| 验收标准 | AC-007-01~04 | 图片处理相关 |

---

## 全局架构位置

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         图片处理模块架构位置                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │ L7: App.vue                                                      │  │
│   │  @paste="handleImagePaste"                                       │  │
│   └────────────────────────────────┬────────────────────────────────┘  │
│                                    │ 粘贴事件                          │
│                                    ▼                                   │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │ ★ MOD-008: Image Handler                                        │  │
│   │  composables/useImageHandler.ts                                 │  │
│   │  • handlePaste() - 处理粘贴事件                                  │  │
│   │  • handleDrop() - 处理拖放事件                                   │  │
│   │  • compressImage() - 压缩图片                                    │  │
│   │  • generateMarkdown() - 生成 Markdown                            │  │
│   │  components/ImageDropZone.vue                                   │  │
│   │  • 拖放区域视觉反馈                                              │  │
│   └────────────────────────────────┬────────────────────────────────┘  │
│                                    │ UPLOAD_IMAGE                      │
│                                    ▼                                   │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │ L2: VS Code Integration                                          │  │
│   │  • saveImage() - 保存到文件系统                                  │  │
│   │  • 返回相对路径                                                  │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 依赖关系

### 上游依赖

| 模块名称 | 模块编号 | 依赖原因 | 调用方式 |
|---------|---------|---------|---------|
| VS Code Integration | MOD-011 | 保存图片文件 | useVSCode().postMessage |
| Editor Core | MOD-001 | 插入 Markdown 文本 | editorView.dispatch |

### 下游依赖

| 模块名称 | 模块编号 | 被调用场景 | 调用方式 |
|---------|---------|-----------|---------|
| App.vue | L7 | 全局图片粘贴处理 | useImageHandler() |

---

## 核心设计

### 图片处理流程

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           图片处理流程                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  粘贴/拖放                                                               │
│     │                                                                   │
│     ▼                                                                   │
│  ┌─────────────────┐                                                    │
│  │ 提取图片数据     │ ◀── ClipboardEvent / DragEvent                    │
│  │ getImageData()  │                                                    │
│  └────────┬────────┘                                                    │
│           │                                                             │
│     ┌─────┴─────┐                                                       │
│     ▼         ▼                                                         │
│  ┌──────┐  ┌──────┐                                                     │
│  │ File │  │ Blob │                                                     │
│  └──┬───┘  └──┬───┘                                                     │
│     │         │                                                         │
│     └────┬────┘                                                         │
│          ▼                                                              │
│  ┌─────────────────┐                                                    │
│  │ 读取为 DataURL   │ ◀── FileReader.readAsDataURL()                    │
│  │ readAsDataURL() │                                                    │
│  └────────┬────────┘                                                    │
│           │                                                             │
│           ▼                                                             │
│  ┌─────────────────┐                                                    │
│  │ 压缩图片         │ ◀── Canvas 压缩（可选）                            │
│  │ compressImage() │                                                    │
│  └────────┬────────┘                                                    │
│           │                                                             │
│           ▼                                                             │
│  ┌─────────────────┐                                                    │
│  │ 上传到 VS Code   │ ◀── postMessage({ type: 'UPLOAD_IMAGE' })         │
│  │ uploadImage()   │                                                    │
│  └────────┬────────┘                                                    │
│           │                                                             │
│           ▼                                                             │
│  ┌─────────────────┐                                                    │
│  │ 接收保存路径     │ ◀── onMessage({ type: 'IMAGE_SAVED' })            │
│  │ handleSaved()   │                                                    │
│  └────────┬────────┘                                                    │
│           │                                                             │
│           ▼                                                             │
│  ┌─────────────────┐                                                    │
│  │ 插入 Markdown   │ ◀── editorView.dispatch({ changes })              │
│  │ insertMarkdown()│                                                    │
│  └─────────────────┘                                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### useImageHandler Hook

```typescript
// composables/useImageHandler.ts

import { ref, onMounted, onUnmounted } from 'vue';
import type { EditorView } from '@codemirror/view';
import { useVSCode } from './useVSCode';

export interface ImageHandlerOptions {
  editorView: Ref<EditorView | null>;
  maxWidth?: number;      // 最大宽度，默认 1200
  maxHeight?: number;     // 最大高度，默认 1200
  quality?: number;       // 压缩质量，默认 0.8
  maxFileSize?: number;   // 最大文件大小(MB)，默认 5
}

export interface ImageHandlerReturn {
  isProcessing: Ref<boolean>;
  progress: Ref<number>;
  handlePaste: (event: ClipboardEvent) => Promise<void>;
  handleDrop: (event: DragEvent) => Promise<void>;
  compressImage: (dataUrl: string, options?: CompressOptions) => Promise<string>;
}

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'image/jpeg' | 'image/png' | 'image/webp';
}

export const useImageHandler = (options: ImageHandlerOptions): ImageHandlerReturn => {
  const { editorView, maxWidth = 1200, maxHeight = 1200, quality = 0.8, maxFileSize = 5 } = options;
  const { postMessage, onMessage } = useVSCode();

  const isProcessing = ref(false);
  const progress = ref(0);

  // 从剪贴板提取图片
  const extractImageFromClipboard = async (event: ClipboardEvent): Promise<File | null> => {
    const items = event.clipboardData?.items;
    if (!items) return null;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) return file;
      }
    }

    return null;
  };

  // 从拖放提取图片
  const extractImageFromDrop = async (event: DragEvent): Promise<File | null> => {
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return null;

    const file = files[0];
    if (file.type.startsWith('image/')) {
      return file;
    }

    return null;
  };

  // 读取文件为 DataURL
  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // 压缩图片
  const compressImage = async (
    dataUrl: string,
    compressOptions: CompressOptions = {}
  ): Promise<string> => {
    const {
      maxWidth: targetWidth = maxWidth,
      maxHeight: targetHeight = maxHeight,
      quality: targetQuality = quality,
      format = 'image/jpeg',
    } = compressOptions;

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // 计算缩放后的尺寸
        let { width, height } = img;
        if (width > targetWidth || height > targetHeight) {
          const ratio = Math.min(targetWidth / width, targetHeight / height);
          width *= ratio;
          height *= ratio;
        }

        // 绘制到 Canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // 转换为 DataURL
        const compressed = canvas.toDataURL(format, targetQuality);
        resolve(compressed);
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  };

  // 生成文件名
  const generateFilename = (originalName: string): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = originalName.split('.').pop() || 'png';
    return `image-${timestamp}-${random}.${ext}`;
  };

  // 处理图片上传
  const processImage = async (file: File): Promise<void> => {
    if (!editorView.value) return;

    // 检查文件大小
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxFileSize) {
      throw new Error(`图片大小超过限制 (${maxFileSize}MB)`);
    }

    isProcessing.value = true;
    progress.value = 0;

    try {
      // 读取文件
      progress.value = 10;
      let dataUrl = await readFileAsDataURL(file);

      // 压缩图片
      progress.value = 30;
      const needsCompression = fileSizeMB > 1 || file.type === 'image/png';
      if (needsCompression) {
        dataUrl = await compressImage(dataUrl);
      }

      // 上传到 VS Code
      progress.value = 60;
      const filename = generateFilename(file.name);

      // 等待保存完成
      const imagePath = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('图片保存超时'));
        }, 30000);

        const unsubscribe = onMessage((message) => {
          if (message.type === 'IMAGE_SAVED' && message.payload.filename === filename) {
            clearTimeout(timeout);
            unsubscribe();
            resolve(message.payload.path);
          }
        });

        postMessage({
          type: 'UPLOAD_IMAGE',
          payload: {
            base64: dataUrl,
            filename,
          },
        });
      });

      // 插入 Markdown
      progress.value = 90;
      const altText = filename.replace(/\.[^/.]+$/, '');
      const markdown = `![${altText}](${imagePath})`;

      const pos = editorView.value.state.selection.main.head;
      editorView.value.dispatch({
        changes: {
          from: pos,
          to: pos,
          insert: markdown,
        },
        selection: {
          anchor: pos + markdown.length,
        },
      });

      progress.value = 100;
    } finally {
      isProcessing.value = false;
      setTimeout(() => {
        progress.value = 0;
      }, 1000);
    }
  };

  // 处理粘贴事件
  const handlePaste = async (event: ClipboardEvent): Promise<void> => {
    const file = await extractImageFromClipboard(event);
    if (file) {
      event.preventDefault();
      await processImage(file);
    }
  };

  // 处理拖放事件
  const handleDrop = async (event: DragEvent): Promise<void> => {
    const file = await extractImageFromDrop(event);
    if (file) {
      event.preventDefault();
      await processImage(file);
    }
  };

  return {
    isProcessing,
    progress,
    handlePaste,
    handleDrop,
    compressImage,
  };
};
```

### ImageDropZone 组件

```vue
<!-- components/ImageDropZone.vue -->
<template>
  <div
    class="image-drop-zone"
    :class="{ 'is-dragover': isDragOver, 'is-processing': isProcessing }"
    @dragenter="handleDragEnter"
    @dragleave="handleDragLeave"
    @dragover="handleDragOver"
    @drop="handleDrop"
  >
    <slot />

    <!-- 拖放提示 -->
    <div v-if="isDragOver" class="drop-overlay">
      <div class="drop-message">
        <span class="drop-icon">🖼️</span>
        <span>释放以上传图片</span>
      </div>
    </div>

    <!-- 处理进度 -->
    <div v-if="isProcessing" class="processing-overlay">
      <div class="processing-content">
        <div class="spinner" />
        <span class="processing-text">正在处理图片...</span>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${progress}%` }" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  isProcessing: boolean;
  progress: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'drop', event: DragEvent): void;
}>();

const isDragOver = ref(false);
let dragCounter = 0;

const handleDragEnter = (event: DragEvent) => {
  event.preventDefault();
  dragCounter++;
  if (event.dataTransfer?.types.includes('Files')) {
    isDragOver.value = true;
  }
};

const handleDragLeave = (event: DragEvent) => {
  event.preventDefault();
  dragCounter--;
  if (dragCounter === 0) {
    isDragOver.value = false;
  }
};

const handleDragOver = (event: DragEvent) => {
  event.preventDefault();
};

const handleDrop = (event: DragEvent) => {
  event.preventDefault();
  dragCounter = 0;
  isDragOver.value = false;
  emit('drop', event);
};
</script>

<style scoped>
.image-drop-zone {
  position: relative;
  width: 100%;
  height: 100%;
}

.drop-overlay,
.processing-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
}

.drop-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px 48px;
  background: var(--markly-surface);
  border-radius: 8px;
  border: 2px dashed var(--markly-primary);
}

.drop-icon {
  font-size: 48px;
}

.processing-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px;
  background: var(--markly-surface);
  border-radius: 8px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--markly-border);
  border-top-color: var(--markly-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.progress-bar {
  width: 200px;
  height: 4px;
  background: var(--markly-border);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--markly-primary);
  transition: width 0.3s ease;
}
</style>
```

---

## 接口定义

### 对外接口清单

| 接口编号 | 接口名称 | 类型 | 路径 | 对应PRD |
|---------|---------|------|------|---------|
| API-026 | useImageHandler | Hook | composables/useImageHandler.ts | FR-010 |
| API-027 | ImageDropZone | Component | components/ImageDropZone.vue | FR-010 |
| API-028 | compressImage | Method | useImageHandler.compressImage | FR-010 |

### 接口详细定义

#### API-026: useImageHandler

**对应PRD**: US-007

**接口定义**:
```typescript
interface ImageHandlerOptions {
  editorView: Ref<EditorView | null>;
  maxWidth?: number;      // 默认 1200
  maxHeight?: number;     // 默认 1200
  quality?: number;       // 默认 0.8
  maxFileSize?: number;   // 默认 5 (MB)
}

interface ImageHandlerReturn {
  isProcessing: Ref<boolean>;
  progress: Ref<number>;
  handlePaste: (event: ClipboardEvent) => Promise<void>;
  handleDrop: (event: DragEvent) => Promise<void>;
  compressImage: (dataUrl: string, options?: CompressOptions) => Promise<string>;
}
```

---

## 数据结构

### DATA-005: ImageUploadMessage

**对应PRD**: Flow-002

```typescript
// Webview → Extension
interface UploadImageMessage {
  type: 'UPLOAD_IMAGE';
  payload: {
    base64: string;      // Base64 编码的图片数据
    filename: string;    // 建议的文件名
  };
}

// Extension → Webview
interface ImageSavedMessage {
  type: 'IMAGE_SAVED';
  payload: {
    path: string;        // 保存后的相对路径
    filename: string;    // 实际文件名
  };
}
```

---

## 边界条件

### BOUND-023: 非图片文件拖放

**对应PRD**: AC-007-01

**边界描述**:
- 拖放非图片文件时应忽略

**处理逻辑**:
```typescript
const extractImageFromDrop = async (event: DragEvent): Promise<File | null> => {
  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) return null;

  const file = files[0];
  if (file.type.startsWith('image/')) {
    return file;
  }

  return null; // 非图片文件返回 null
};
```

### BOUND-024: 图片大小超限

**对应PRD**: AC-007-02

**边界描述**:
- 图片大小超过限制时应提示错误

**处理逻辑**:
```typescript
const fileSizeMB = file.size / (1024 * 1024);
if (fileSizeMB > maxFileSize) {
  throw new Error(`图片大小超过限制 (${maxFileSize}MB)`);
}
```

### BOUND-025: 剪贴板无图片数据

**对应PRD**: AC-007-03

**边界描述**:
- 剪贴板中没有图片数据时正常粘贴文本

**处理逻辑**:
```typescript
const handlePaste = async (event: ClipboardEvent): Promise<void> => {
  const file = await extractImageFromClipboard(event);
  if (file) {
    event.preventDefault(); // 只有处理图片时才阻止默认行为
    await processImage(file);
  }
  // 否则允许默认粘贴行为
};
```

### BOUND-026: 图片保存超时

**对应PRD**: AC-007-04

**边界描述**:
- 图片保存超过 30 秒应超时处理

**处理逻辑**:
```typescript
const imagePath = await new Promise<string>((resolve, reject) => {
  const timeout = setTimeout(() => {
    reject(new Error('图片保存超时'));
  }, 30000);

  const unsubscribe = onMessage((message) => {
    if (message.type === 'IMAGE_SAVED') {
      clearTimeout(timeout);
      unsubscribe();
      resolve(message.payload.path);
    }
  });
});
```

---

## 实现文件

| 文件路径 | 职责 |
|---------|------|
| composables/useImageHandler.ts | 图片处理逻辑 Hook |
| components/ImageDropZone.vue | 图片拖放组件 |

---

## 覆盖映射

### PRD需求覆盖情况

| PRD类型 | PRD编号 | 架构元素 | 覆盖状态 |
|---------|---------|---------|---------|
| 功能需求 | FR-010 | useImageHandler | ✅ |
| 用户故事 | US-007 | handlePaste, handleDrop | ✅ |
| 业务流程 | Flow-002 | processImage | ✅ |
| 验收标准 | AC-007-01 | extractImageFromDrop | ✅ |
| 验收标准 | AC-007-02 | maxFileSize 检查 | ✅ |
| 验收标准 | AC-007-03 | handlePaste 逻辑 | ✅ |
| 验收标准 | AC-007-04 | 超时处理 | ✅ |

---

## 变更历史

| 版本 | 日期 | 变更内容 | 作者 |
|-----|------|---------|------|
| 1.0 | 2026-03-18 | 初始版本 | AI |
