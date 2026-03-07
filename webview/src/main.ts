import { createApp } from 'vue';
import App from './App.vue';
import 'katex/dist/katex.min.css';
import './style.css';

// 声明 VSCode Webview API
declare function acquireVsCodeApi(): any;

const vscode = acquireVsCodeApi();

// 将 vscode API 挂载到全局
(window as any).vscode = vscode;

createApp(App).mount('#app');
