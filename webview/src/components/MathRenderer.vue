<template>
  <span
    ref="containerRef"
    class="math-renderer"
    :class="displayMode ? 'math-block' : 'math-inline'"
  ></span>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';

const props = defineProps<{
  latex: string;
  displayMode?: boolean;
}>();

const containerRef = ref<HTMLElement | null>(null);

async function render(): Promise<void> {
  if (!containerRef.value) return;

  try {
    const katex = await import('katex');
    containerRef.value.innerHTML = katex.renderToString(props.latex, {
      throwOnError: false,
      displayMode: props.displayMode ?? false,
    });
  } catch {
    containerRef.value.textContent = props.displayMode
      ? `$$${props.latex}$$`
      : `$${props.latex}$`;
    containerRef.value.classList.add('math-error');
  }
}

onMounted(render);
watch(() => [props.latex, props.displayMode], render);
</script>

<style scoped>
.math-renderer {
  display: inline;
}

.math-block {
  display: block;
  text-align: center;
  margin: 1em 0;
  overflow-x: auto;
}

.math-inline {
  display: inline;
}

.math-error {
  color: var(--vscode-errorForeground, #f44747);
  font-family: monospace;
}
</style>
