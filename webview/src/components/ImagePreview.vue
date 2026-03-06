<template>
  <div class="image-preview-overlay" v-if="visible" @click="close">
    <div class="image-preview-container" @click.stop>
      <div class="preview-header">
        <span class="preview-title">图片预览</span>
        <button class="close-btn" @click="close">×</button>
      </div>

      <div class="preview-body">
        <img :src="currentSrc" class="preview-image" @click.stop />
      </div>

      <div class="preview-footer" v-if="images.length > 1">
        <button
          class="nav-btn"
          :disabled="currentIndex === 0"
          @click="prevImage"
        >
          ← 上一张
        </button>
        <span class="image-counter">{{ currentIndex + 1 }} / {{ images.length }}</span>
        <button
          class="nav-btn"
          :disabled="currentIndex === images.length - 1"
          @click="nextImage"
        >
          下一张 →
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  visible: boolean;
  src: string;
  images: string[];
  index: number;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const currentIndex = ref(props.index);
const currentSrc = ref(props.src);

watch(() => props.visible, (visible) => {
  if (visible) {
    currentIndex.value = props.index;
    currentSrc.value = props.src;
  }
});

watch(() => props.index, (index) => {
  currentIndex.value = index;
  currentSrc.value = props.src;
});

function close() {
  emit('close');
}

function prevImage() {
  if (currentIndex.value > 0) {
    currentIndex.value--;
    currentSrc.value = props.images[currentIndex.value];
  }
}

function nextImage() {
  if (currentIndex.value < props.images.length - 1) {
    currentIndex.value++;
    currentSrc.value = props.images[currentIndex.value];
  }
}
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
  overflow: auto;
}

.preview-image {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
}

.preview-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-top: 1px solid var(--vscode-editorWidget-border);
}

.nav-btn {
  padding: 6px 12px;
  border: 1px solid var(--vscode-editorWidget-border);
  border-radius: 4px;
  background: var(--vscode-editor-background);
  color: var(--vscode-foreground);
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.nav-btn:hover:not(:disabled) {
  background: var(--vscode-toolbar-hoverBackground);
}

.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.image-counter {
  font-size: 13px;
  color: var(--vscode-descriptionForeground);
}
</style>
