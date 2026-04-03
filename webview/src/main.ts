import { createApp } from 'vue';
import App from './App.vue';
import 'katex/dist/katex.min.css';
import './style.css';
import './styles/decorators.css';
import './styles/diagram.css';

// 声明 VSCode Webview API
declare function acquireVsCodeApi(): any;

console.log('Webview main.ts loading...');

const vscode = acquireVsCodeApi();
console.log('VSCode API acquired:', !!vscode);

// 将 vscode API 挂载到全局
(window as any).vscode = vscode;

try {
  const app = createApp(App);
  console.log('Vue app created');
  app.mount('#app');
  console.log('Vue app mounted');
} catch (error) {
  console.error('Error mounting Vue app:', error);
}
