import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'renderer'),
      '@types': resolve(__dirname, '../src/types'),
      '@wv': resolve(__dirname, '../webview/src'),
      // 此环境未安装 root/node_modules；htmlExport 复用自 root/src，import 'katex'/'marked'
      // 从 root/src 向上解析不到。指回 app/node_modules 让 vitest 能 transpile。
      katex: resolve(__dirname, 'node_modules/katex'),
      marked: resolve(__dirname, 'node_modules/marked'),
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
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['renderer/**/*.test.ts', 'electron/**/*.test.ts'],
    env: {
      // htmlExport 内部 require.resolve 从 root/src/core/export 位置向上找 node_modules；
      // root 没有 node_modules。NODE_PATH 指向 app/node_modules 作 fallback，
      // 使 readKatexCss() 与 mermaid embedded 模式的 fs 读取能找到文件。
      NODE_PATH: resolve(__dirname, 'node_modules'),
    },
  },
});