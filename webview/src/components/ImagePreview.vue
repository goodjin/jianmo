<template>
  <div class="image-preview-overlay" v-if="visible" @click="close">
    <div class="image-preview-container" @click.stop>
      <div class="preview-header">
        <span class="preview-title">图片预览 ({{ currentIndex + 1 }}/{{ allImages.length }})</span>
        <button class="close-btn" @click="close">×</button>
      </div>

      <div class="preview-body">
        <!-- ViewerJS 容器：包含所有图片 -->
        <div ref="viewerContainerRef" class="viewer-container">
          <img
            v-for="(img, idx) in allImages"
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
import { ref, computed, watch, onUnmounted, nextTick } from 'vue';
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

const viewerContainerRef = ref<HTMLDivElement | null>(null);
let viewer: Viewer | null = null;

// 合并 src 和 images，形成完整的图片列表
const allImages = computed(() => {
  const list = props.images.length > 0 ? [...props.images] : [];
  // 如果 src 不在 images 中，添加到开头
  if (props.src && !list.includes(props.src)) {
    list.unshift(props.src);
  }
  return list;
});

// 计算当前显示的图片索引
const currentIndex = computed(() => {
  if (props.index !== undefined && props.index > 0) {
    return props.index;
  }
  // 如果 src 在列表中，找不到则默认 0
  const idx = allImages.value.indexOf(props.src);
  return idx >= 0 ? idx : 0;
});

watch(() => props.visible, async (visible) => {
  if (visible) {
    await nextTick();
    initViewer();
  } else {
    destroyViewer();
  }
});

// 监听 src 变化，更新 viewer
watch(() => props.src, () => {
  if (viewer && props.visible) {
    // 切换到对应的图片
    viewer.update();
    viewer.view(currentIndex.value);
  }
});

// 监听 index 变化
watch(() => props.index, () => {
  if (viewer && props.visible) {
    viewer.update();
    viewer.view(currentIndex.value);
  }
});

// 监听 images 变化
watch(() => props.images, () => {
  if (viewer && props.visible) {
    viewer.update();
    viewer.view(currentIndex.value);
  }
}, { deep: true });

function initViewer() {
  if (!viewerContainerRef.value || viewer) return;

  viewer = new Viewer(viewerContainerRef.value, {
    hidden: () => {
      emit('close');
    },
    zoomable: true,
    rotatable: true,
    scalable: true,
    keyboard: true,
    title: false,
    initialViewIndex: currentIndex.value,
    toolbar: {
      zoomIn: true,
      zoomOut: true,
      reset: true,
      rotateLeft: true,
      rotateRight: true,
      flipHorizontal: true,
      flipVertical: true,
      prev: allImages.value.length > 1,
      next: allImages.value.length > 1,
    },
    ready() {
      // 初始化完成后跳转到指定图片
      viewer?.view(currentIndex.value);
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

.viewer-container {
  display: none;
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
