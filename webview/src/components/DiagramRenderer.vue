<template>
  <div
    ref="containerRef"
    class="diagram-renderer"
    :class="{ 'diagram-error': hasError }"
  >
    <span v-if="hasError" class="error-message">图表语法错误</span>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';

const props = defineProps<{
  code: string;
  theme?: 'default' | 'dark' | 'forest' | 'neutral';
}>();

const containerRef = ref<HTMLElement | null>(null);
const hasError = ref(false);

let idCounter = 0;

async function render(): Promise<void> {
  if (!containerRef.value || !props.code.trim()) return;

  hasError.value = false;

  try {
    const mermaid = (await import('mermaid')).default;
    mermaid.initialize({
      startOnLoad: false,
      theme: props.theme ?? 'default',
      securityLevel: 'strict',
    });

    const id = `diagram-${Date.now()}-${++idCounter}`;
    const { svg } = await mermaid.render(id, props.code);
    if (containerRef.value) {
      containerRef.value.innerHTML = svg;
    }
  } catch {
    hasError.value = true;
  }
}

onMounted(render);
watch(() => [props.code, props.theme], render);
</script>

<style scoped>
.diagram-renderer {
  display: block;
  text-align: center;
  padding: 8px;
  margin: 8px 0;
  overflow-x: auto;
}

.diagram-renderer :deep(svg) {
  max-width: 100%;
  height: auto;
}

.diagram-error {
  color: var(--vscode-errorForeground, #f44747);
  padding: 8px;
  font-size: 13px;
}

.error-message {
  display: block;
}
</style>
