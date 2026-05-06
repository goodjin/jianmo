<template>
  <div
    ref="containerRef"
    class="diagram-renderer"
    :class="{ 'diagram-error': hasError }"
  >
    <span v-if="hasError && offlineHint" class="error-message">离线或未加载：图表暂不可渲染（Mermaid）</span>
    <span v-else-if="hasError" class="error-message">图表语法错误或渲染失败</span>
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
const offlineHint = ref(false);

let idCounter = 0;
/** M37：code/theme 变更时作废进行中的异步 render */
let renderGeneration = 0;

async function render(): Promise<void> {
  if (!containerRef.value || !props.code.trim()) return;

  const myGen = ++renderGeneration;
  hasError.value = false;
  offlineHint.value = typeof navigator !== 'undefined' ? navigator.onLine === false : false;

  try {
    if (offlineHint.value) {
      if (containerRef.value && myGen === renderGeneration) {
        containerRef.value.innerHTML = '';
      }
      hasError.value = true;
      return;
    }

    const mermaid = (await import('mermaid')).default;
    if (myGen !== renderGeneration || !containerRef.value) return;
    mermaid.initialize({
      startOnLoad: false,
      theme: props.theme ?? 'default',
      securityLevel: 'strict',
    });

    const id = `diagram-${Date.now()}-${++idCounter}`;
    const { svg } = await mermaid.render(id, props.code);
    if (myGen !== renderGeneration || !containerRef.value) return;
    containerRef.value.innerHTML = svg;
  } catch {
    if (myGen !== renderGeneration) return;
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
