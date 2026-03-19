# 开发计划 - MOD-008: Image Handler

## 文档信息
- **模块编号**: MOD-008
- **模块名称**: Image Handler
- **所属层次**: L6 - 功能组件层
- **对应架构**: [10-mod-008-image-handler.md](../02-architecture/10-mod-008-image-handler.md)
- **优先级**: P0
- **预估工时**: 1.5天

---

## 1. 模块概述

### 1.1 模块职责

Image Handler 负责图片处理功能：
- 剪贴板粘贴图片
- 拖放图片上传
- 图片压缩
- 自动生成 Markdown 语法

### 1.2 对应PRD

| PRD编号 | 功能 | 用户故事 |
|---------|-----|---------|
| FR-010 | 图片处理 | US-007 |

---

## 2. 技术设计

### 2.1 目录结构

```
webview/src/
├── composables/
│   ├── useImageHandler.ts    # 图片处理 Hook
│   └── __tests__/
│       └── useImageHandler.test.ts
└── components/
    └── ImageDropZone.vue     # 拖放区域组件
```

---

## 3. 开发任务拆分

| 任务 | 名称 | 文件数 | 代码行数 | 依赖 |
|-----|------|-------|---------|------|
| T-01 | 类型定义 | 2 | ~60 | - |
| T-02 | useImageHandler Hook | 2 | ~150 | T-01 |
| T-03 | ImageDropZone 组件 | 2 | ~100 | T-02 |
| T-04 | 单元测试 | 2 | ~100 | T-01~03 |

---

## 4. 详细任务定义

### T-01: 类型定义

**任务概述**: 定义图片处理类型

**输出**:
- `webview/src/types/image.ts`

**实现要求**:

```typescript
export interface ImageHandlerOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxFileSize?: number;
}

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'image/jpeg' | 'image/png' | 'image/webp';
}
```

**预估工时**: 0.5小时

---

### T-02: useImageHandler Hook

**任务概述**: 实现图片处理 Hook

**输出**:
- `webview/src/composables/useImageHandler.ts`

**实现要求**:

```typescript
// composables/useImageHandler.ts
import { ref } from 'vue';
import type { EditorView } from '@codemirror/view';
import { useVSCode } from './useVSCode';
import { ImageHandlerOptions, CompressOptions } from '../types/image';

export interface UseImageHandlerOptions {
  editorView: Ref<EditorView | null>;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxFileSize?: number;
}

export const useImageHandler = (options: UseImageHandlerOptions) => {
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
        return item.getAsFile();
      }
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
  const compressImage = async (dataUrl: string, opts: CompressOptions = {}): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > (opts.maxWidth || maxWidth) || height > (opts.maxHeight || maxHeight)) {
          const ratio = Math.min((opts.maxWidth || maxWidth) / width, (opts.maxHeight || maxHeight) / height);
          width *= ratio;
          height *= ratio;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Failed to get canvas context'));

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL(opts.format || 'image/jpeg', opts.quality || quality));
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  };

  // 处理图片
  const processImage = async (file: File) => {
    if (!editorView.value) return;

    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxFileSize) {
      throw new Error(`图片大小超过限制 (${maxFileSize}MB)`);
    }

    isProcessing.value = true;
    progress.value = 10;

    try {
      let dataUrl = await readFileAsDataURL(file);
      progress.value = 30;

      if (fileSizeMB > 1) {
        dataUrl = await compressImage(dataUrl);
      }
      progress.value = 60;

      const filename = `image-${Date.now()}.${file.name.split('.').pop()}`;

      // 等待保存完成
      const imagePath = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('图片保存超时')), 30000);
        const unsubscribe = onMessage((message) => {
          if (message.type === 'IMAGE_SAVED' && message.payload.filename === filename) {
            clearTimeout(timeout);
            unsubscribe();
            resolve(message.payload.path);
          }
        });
        postMessage({ type: 'UPLOAD_IMAGE', payload: { base64: dataUrl, filename } });
      });

      progress.value = 90;
      const markdown = `![${filename.replace(/\.[^/.]+$/, '')}](${imagePath})`;
      const pos = editorView.value.state.selection.main.head;
      editorView.value.dispatch({
        changes: { from: pos, to: pos, insert: markdown },
        selection: { anchor: pos + markdown.length },
      });

      progress.value = 100;
    } finally {
      isProcessing.value = false;
      setTimeout(() => { progress.value = 0; }, 1000);
    }
  };

  // 处理粘贴
  const handlePaste = async (event: ClipboardEvent) => {
    const file = await extractImageFromClipboard(event);
    if (file) {
      event.preventDefault();
      await processImage(file);
    }
  };

  // 处理拖放
  const handleDrop = async (event: DragEvent) => {
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.type.startsWith('image/')) {
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

**预估工时**: 4小时

**依赖**: T-01

---

### T-03: ImageDropZone 组件

**任务概述**: 实现图片拖放区域组件

**输出**:
- `webview/src/components/ImageDropZone.vue`

**预估工时**: 2小时

**依赖**: T-02

---

### T-04: 单元测试

**任务概述**: 编写单元测试

**输出**:
- `webview/src/composables/__tests__/useImageHandler.test.ts`

**预估工时**: 2小时

**依赖**: T-01~03

---

## 5. 覆盖映射

| 架构元素 | 任务 | 覆盖状态 |
|---------|------|---------|
| API-026 useImageHandler | T-02 | ✅ |
| API-027 ImageDropZone | T-03 | ✅ |
| API-028 compressImage | T-02 | ✅ |
