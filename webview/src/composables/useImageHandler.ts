/**
 * 图片处理 Hook
 * @module composables/useImageHandler
 * @description 处理图片粘贴、拖放、压缩和保存
 */

import { ref } from 'vue';
import type { Ref } from 'vue';
import type { EditorView } from '@codemirror/view';
import { useVSCode } from './useVSCode';
import { sanitizeSvgMarkup } from '../utils/svgSanitize';

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
  editorView?: Ref<EditorView | null>;
  insertMarkdown?: (markdown: string) => void;
  onSaved?: (payload: { path: string; filename: string }) => void;
  onError?: (error: Error) => void;
  /** 超过阈值将走 canvas 压缩；开始压缩前回调（M₃₀ 可感知） */
  onCompressingStart?: () => void;
  /** 接近 maxFileSize 上限时提示（M₃₁ 大文件） */
  onHeavyImageWarning?: (info: { mb: number; maxFileSizeMb: number }) => void;
  /** M49：粘贴/保存前的文件名前缀（默认 `paste`） */
  getPasteBasenamePrefix?: () => string;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  compressThreshold?: number | (() => number);
  maxFileSize?: number;
}

/**
 * useImageHandler 返回接口
 */
export interface UseImageHandlerReturn {
  isProcessing: Ref<boolean>;
  progress: Ref<number>;
  lastError: Ref<string>;
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
    compressThreshold = 1024 * 1024,
    maxFileSize = 5,
    insertMarkdown,
    onSaved,
    onError,
    onCompressingStart,
    onHeavyImageWarning,
    getPasteBasenamePrefix,
  } = options;

  const { postMessage, onMessage } = useVSCode();
  const isProcessing = ref(false);
  const progress = ref(0);
  const lastError = ref('');

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

  const readFileAsText = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error ?? new Error('read failed'));
      reader.readAsText(file);
    });

  // M134：粘贴命名二期（序号递增），避免同秒内重复且便于排序
  let pasteSequence = 0;

  function buildUploadedImageFilename(extension: string): string {
    const raw = getPasteBasenamePrefix?.() ?? 'paste';
    const prefix = String(raw).trim() || 'paste';
    const iso = new Date().toISOString();
    const ymd = iso.slice(0, 10).replace(/-/g, '');
    const hms = iso.slice(11, 19).replace(/:/g, '');
    pasteSequence += 1;
    const seq = String(pasteSequence).padStart(4, '0');
    return `${prefix}-${ymd}-${hms}-${seq}.${extension}`;
  }

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

  function newUploadRequestId(): string {
    const cryptoObj = typeof globalThis !== 'undefined' ? (globalThis as { crypto?: Crypto }).crypto : undefined;
    if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
    return `img-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  /**
   * 处理图片文件（压缩 + 保存 + 插入 Markdown）
   */
  const processImage = async (file: File): Promise<void> => {
    if (!editorView?.value && !insertMarkdown) return;

    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxFileSize) {
      throw new Error(`图片大小超过限制 (${maxFileSize}MB)`);
    }
    if (fileSizeMB >= maxFileSize * 0.65) {
      onHeavyImageWarning?.({ mb: fileSizeMB, maxFileSizeMb: maxFileSize });
    }

    const compressThresholdBytes =
      typeof compressThreshold === 'function' ? compressThreshold() : compressThreshold;

    isProcessing.value = true;
    progress.value = 10;
    lastError.value = '';

    try {
      const extFromName = (file.name.split('.').pop() ?? '').toLowerCase();
      const isSvg = file.type === 'image/svg+xml' || extFromName === 'svg';
      let dataUrl = await readFileAsDataURL(file);
      progress.value = 30;

      if (isSvg) {
        const raw = await readFileAsText(file);
        dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sanitizeSvgMarkup(raw))}`;
      } else if (file.size > compressThresholdBytes) {
        onCompressingStart?.();
        dataUrl = await compressImage(dataUrl);
      }
      progress.value = 60;

      const ext = isSvg ? 'svg' : extFromName || 'jpg';
      const requestedFilename = buildUploadedImageFilename(ext);
      const requestId = newUploadRequestId();

      const payload = await new Promise<{ path: string; savedFilename: string }>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('图片保存超时')), 30000);
        const unsubscribe = onMessage((message) => {
          if (message.type === 'IMAGE_SAVED') {
            const p = message.payload;
            const matchByReq = p.requestId !== undefined && p.requestId === requestId;
            const matchLegacy =
              p.requestId === undefined && typeof p.filename === 'string' && p.filename === requestedFilename;
            if (matchByReq || matchLegacy) {
              clearTimeout(timeout);
              unsubscribe();
              const savedFilename = typeof p.filename === 'string' ? p.filename : requestedFilename;
              onSaved?.({ path: p.path, filename: savedFilename });
              resolve({ path: p.path, savedFilename });
            }
          }
          if (message.type === 'IMAGE_SAVE_FAILED') {
            const p = message.payload;
            const matchByReq = p.requestId !== undefined && p.requestId === requestId;
            const matchLegacy =
              p.requestId === undefined && typeof p.filename === 'string' && p.filename === requestedFilename;
            if (matchByReq || matchLegacy) {
              clearTimeout(timeout);
              unsubscribe();
              reject(new Error(p.error || '图片保存失败'));
            }
          }
        });
        postMessage({
          type: 'UPLOAD_IMAGE',
          payload: { base64: dataUrl, filename: requestedFilename, requestId },
        });
      });

      progress.value = 90;

      const altText = payload.savedFilename.replace(/\.[^/.]+$/, '');
      const markdown = `![${altText}](${payload.path})`;
      if (insertMarkdown) {
        insertMarkdown(markdown);
      } else if (editorView?.value) {
        const pos = editorView.value.state.selection.main.head;
        editorView.value.dispatch({
          changes: { from: pos, to: pos, insert: markdown },
          selection: { anchor: pos + markdown.length },
        });
      }

      progress.value = 100;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      lastError.value = error.message;
      onError?.(error);
      throw error;
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
      try {
        await processImage(file);
      } catch {
        // onError/lastError already captured the failure.
      }
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
      try {
        await processImage(file);
      } catch {
        // onError/lastError already captured the failure.
      }
    }
  };

  return {
    isProcessing,
    progress,
    lastError,
    handlePaste,
    handleDrop,
    compressImage,
  };
};

export default useImageHandler;
