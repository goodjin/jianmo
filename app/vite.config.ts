import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

/**
 * Markly 独立应用 renderer 构建配置。
 *
 * 复用策略：通过 alias 指向 ../webview/src 与 ../src/types，import 纯模块源码，不改 webview/src 与 src。
 * 风险约束：CodeMirror/Lezer 必须去重（与 webview/vite.config.ts 一致），否则 CM6 Transaction 运行时崩。
 * P1 PreviewApp 不直接 import CM6，dedupe 列表保留以备 P2 编辑模式接入。
 */
export default defineConfig({
  plugins: [vue()],
  root: 'renderer',
  base: './',
  build: {
    outDir: '../dist/app/renderer',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'index.js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'renderer'),
      '@types': resolve(__dirname, '../src/types'),
      '@wv': resolve(__dirname, '../webview/src'),
    },
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
