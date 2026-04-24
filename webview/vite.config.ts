import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  base: './',
  build: {
    outDir: '../dist/webview',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'index.js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
        manualChunks(id) {
          // M7-1：减少 VSIX 内文件数量（shiki 的语言/主题会生成大量小 chunk）
          if (id.includes('/node_modules/shiki/')) return 'shiki-vendor';
          if (id.includes('/node_modules/@shikijs/')) return 'shiki-vendor';
          if (id.includes('/node_modules/mermaid/')) return 'mermaid-vendor';
          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@types': resolve(__dirname, '../src/types'),
    },
    // CodeMirror / Lezer 相关包必须去重，否则会出现
    // “Trying to update state with a transaction that doesn't start from the previous state.”
    // 这会让 undo/redo 等基于 Transaction 的逻辑在运行时直接报错。
    dedupe: [
      '@codemirror/state',
      '@codemirror/view',
      '@codemirror/commands',
      '@codemirror/language',
      '@codemirror/lang-markdown',
      '@lezer/common',
      '@lezer/highlight',
      '@lezer/markdown',
    ],
  },
});
