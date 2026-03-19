<template>
  <div
    class="image-drop-zone"
    :class="{ 'is-dragging': isDragging }"
    @dragenter.prevent="isDragging = true"
    @dragleave.prevent="isDragging = false"
    @dragover.prevent
    @drop.prevent="handleDrop"
  >
    <slot />
    <div v-if="isProcessing" class="processing-overlay">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progress + '%' }"></div>
      </div>
      <span class="processing-text">处理图片中... {{ progress }}%</span>
    </div>
    <div v-if="isDragging" class="drop-hint">
      <span>释放以插入图片</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  isProcessing: boolean;
  progress: number;
}>();

const emit = defineEmits<{
  (e: 'drop', event: DragEvent): void;
}>();

const isDragging = ref(false);

function handleDrop(event: DragEvent): void {
  isDragging.value = false;
  emit('drop', event);
}
</script>

<style scoped>
.image-drop-zone {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.image-drop-zone.is-dragging {
  outline: 2px dashed var(--vscode-focusBorder);
  outline-offset: -2px;
}

.processing-overlay {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--vscode-editorWidget-background);
  border: 1px solid var(--vscode-editorWidget-border);
  border-radius: 8px;
  padding: 12px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  z-index: 100;
  min-width: 200px;
}

.progress-bar {
  width: 100%;
  height: 4px;
  background: var(--vscode-progressBar-background, #e0e0e0);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--vscode-button-background);
  border-radius: 2px;
  transition: width 0.2s ease;
}

.processing-text {
  font-size: 12px;
  color: var(--vscode-foreground);
}

.drop-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 120, 212, 0.08);
  font-size: 16px;
  color: var(--vscode-focusBorder);
  pointer-events: none;
}
</style>
