/**
 * 图片处理 Hook
 * @module composables/useImageHandler
 * @description 处理图片粘贴、拖放、压缩和保存
 */

import { ref } from 'vue';
import type { Ref } from 'vue';
import type { EditorView } from '@codemirror/view';
import { useVSCode } from './useVSCode';

/**
 * 压缩选项
 */
export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'image/jpeg' | 'image/png' | 'image/webp';
}

/**
 * useImageHandler 选项
 */
export interface UseImageHandlerOptions {
  editorView: Ref<EditorView | null>;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxFileSize?: number;
}

/**
 * useImageHandler 返回接口
 */
export interface UseImageHandlerReturn {
  isProcessing: Ref<boolean>;
  progress: Ref<number>;
  handlePaste: (event: ClipboardEvent) => Promise<void>;
  handleDrop: (event: DragEvent) => Promise<void>;
  compressImage: (dataUrl: string, opts?: CompressOptions) => Promise<string>;
}

/**
 * 图片处理 Hook
 * @param options - 配置选项
 * @returns 图片处理接口
 */
export const useImageHandler = (options: UseImageHandlerOptions): UseImageHandlerReturn => {
  const {
    editorView,
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.8,
    maxFileSize = 5,
  } = options;

  const { postMessage, onMessage } = useVSCode();
  const isProcessing = ref(false);
  const progress = ref(0);

  /**
   * 从剪贴板提取图片文件
   */
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

  /**
   * 读取文件为 DataURL
   */
  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  /**
   * 压缩图片
   */
  const compressImage = (dataUrl: string, opts: CompressOptions = {}): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const targetMaxWidth = opts.maxWidth ?? maxWidth;
        const targetMaxHeight = opts.maxHeight ?? maxHeight;

        if (width > targetMaxWidth || height > targetMaxHeight) {
          const ratio = Math.min(targetMaxWidth / width, targetMaxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL(opts.format ?? 'image/jpeg', opts.quality ?? quality));
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    });
  };

  /**
   * 处理图片文件（压缩 + 保存 + 插入 Markdown）
   */
  const processImage = async (file: File): Promise<void> => {
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

      const ext = file.name.split('.').pop() ?? 'jpg';
      const filename = `image-${Date.now()}.${ext}`;

      const imagePath = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('图片保存超时')), 30000);
        const unsubscribe = onMessage((message) => {
          if (
            message.type === 'IMAGE_SAVED' &&
            (message.payload as { filename: string; path: string }).filename === filename
          ) {
            clearTimeout(timeout);
            unsubscribe();
            resolve((message.payload as { filename: string; path: string }).path);
          }
        });
        postMessage({ type: 'UPLOAD_IMAGE', payload: { base64: dataUrl, filename } });
      });

      progress.value = 90;

      const altText = filename.replace(/\.[^/.]+$/, '');
      const markdown = `![${altText}](${imagePath})`;
      const pos = editorView.value.state.selection.main.head;
      editorView.value.dispatch({
        changes: { from: pos, to: pos, insert: markdown },
        selection: { anchor: pos + markdown.length },
      });

      progress.value = 100;
    } finally {
      isProcessing.value = false;
      setTimeout(() => {
        progress.value = 0;
      }, 1000);
    }
  };

  /**
   * 处理粘贴事件
   */
  const handlePaste = async (event: ClipboardEvent): Promise<void> => {
    const file = await extractImageFromClipboard(event);
    if (file) {
      event.preventDefault();
      await processImage(file);
    }
  };

  /**
   * 处理拖放事件
   */
  const handleDrop = async (event: DragEvent): Promise<void> => {
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

export default useImageHandler;
