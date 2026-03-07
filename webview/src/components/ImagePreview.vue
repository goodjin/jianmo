<template>
  <div class="image-preview-overlay" v-if="visible" @click="close">
    <div class="image-preview-container" @click.stop>
      <div class="preview-header">
        <span class="preview-title">图片预览</span>
        <button class="close-btn" @click="close">×</button>
      </div>

      <div class="preview-body">
        <img
          ref="imageRef"
          :src="src"
          class="preview-image"
          @click.stop
        />
        <!-- 隐藏的图片列表供 viewerjs 使用 -->
        <div style="display: none;">
          <img
            v-for="(img, idx) in images"
            :key="idx"
            :src="img"
            :data-index="idx"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted, nextTick } from 'vue';
import Viewer from 'viewerjs';
import 'viewerjs/dist/viewer.css';

const props = defineProps<{
  visible: boolean;
  src: string;
  images: string[];
  index: number;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const imageRef = ref<HTMLImageElement | null>(null);
let viewer: Viewer | null = null;

watch(() => props.visible, async (visible) => {
  if (visible) {
    await nextTick();
    initViewer();
  } else {
    destroyViewer();
  }
});

watch(() => props.index, () => {
  if (viewer && props.images.length > 0) {
    viewer.update();
  }
});

function initViewer() {
  if (!imageRef.value || viewer) return;

  viewer = new Viewer(imageRef.value, {
    hidden: () => {
      emit('close');
    },
    zoomable: true,
    rotatable: true,
    scalable: true,
    keyboard: true,
    title: false,
    initialViewIndex: props.index,
    toolbar: {
      zoomIn: true,
      zoomOut: true,
      reset: true,
      rotateLeft: true,
      rotateRight: true,
      flipHorizontal: true,
      flipVertical: true,
      prev: props.images.length > 1,
      next: props.images.length > 1,
    },
  });
}

function destroyViewer() {
  if (viewer) {
    viewer.destroy();
    viewer = null;
  }
}

function close() {
  destroyViewer();
  emit('close');
}

onUnmounted(() => {
  destroyViewer();
});
</script>

<style scoped>
.image-preview-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.image-preview-container {
  background: var(--vscode-editor-background);
  border-radius: 8px;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--vscode-editorWidget-border);
  flex-shrink: 0;
}

.preview-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--vscode-foreground);
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--vscode-foreground);
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-btn:hover {
  background: var(--vscode-toolbar-hoverBackground);
}

.preview-body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  overflow: hidden;
  min-height: 400px;
}

.preview-image {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
}

/* Viewer.js 样式覆盖 */
:deep(.viewer-container) {
  background: rgba(0, 0, 0, 0.9);
}

:deep(.viewer-toolbar) {
  background: var(--vscode-editorWidget-background);
}

:deep(.viewer-button) {
  background: var(--vscode-editorWidget-background);
  color: var(--vscode-foreground);
}

:deep(.viewer-button:hover) {
  background: var(--vscode-toolbar-hoverBackground);
}

:deep(.viewer-title) {
  color: var(--vscode-foreground);
}
</style>
