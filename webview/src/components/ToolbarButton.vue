<template>
  <button
    class="toolbar-btn"
    :class="{ active }"
    :title="title"
    :disabled="disabled"
    @click="$emit('click')"
  >
    <span class="btn-icon">{{ icon }}</span>
    <span v-if="label" class="btn-label">{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  icon: string;
  title: string;
  label?: string;
  active?: boolean;
  disabled?: boolean;
}>();

defineEmits<{
  (e: 'click'): void;
}>();
</script>

<style scoped>
.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 6px;
  border: none;
  background: transparent;
  color: var(--vscode-foreground);
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  gap: 4px;
  transition: background-color 0.15s;
  flex-shrink: 0;
}

.toolbar-btn:hover:not(:disabled) {
  background: var(--vscode-toolbar-hoverBackground);
}

.toolbar-btn:active:not(:disabled) {
  background: var(--vscode-toolbar-activeBackground);
}

.toolbar-btn.active {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.toolbar-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-label {
  font-size: 12px;
  font-weight: 500;
}
</style>
