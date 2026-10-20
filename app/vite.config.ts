import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

/**
 * Markly 独立应用 renderer 构建配置。
 *
 * 复用策略：通过 alias 指向 ../webview/src 与 ../src/types，import 纯模块源码，不改 webview/src 与 src。
 * 风险约束：CodeMirror/Lezer 必须去重（与 webview/vite.config.ts 一致），否则 CM6 Transaction 运行时崩。
 * 原文编辑直接用这套编辑器，依赖装在本包里，构建时打进页面。
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
      // 插件目录里还有一份 CodeMirror。编辑器源码从那边引进来时必须用这一份，否则撤销会崩。
      '@codemirror/state': resolve(__dirname, 'node_modules/@codemirror/state'),
      '@codemirror/view': resolve(__dirname, 'node_modules/@codemirror/view'),
      '@codemirror/commands': resolve(__dirname, 'node_modules/@codemirror/commands'),
      '@codemirror/language': resolve(__dirname, 'node_modules/@codemirror/language'),
      '@codemirror/lang-markdown': resolve(__dirname, 'node_modules/@codemirror/lang-markdown'),
      codemirror: resolve(__dirname, 'node_modules/codemirror'),
      '@lezer/common': resolve(__dirname, 'node_modules/@lezer/common'),
      '@lezer/highlight': resolve(__dirname, 'node_modules/@lezer/highlight'),
      '@lezer/markdown': resolve(__dirname, 'node_modules/@lezer/markdown'),
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
