import { createApp } from 'vue';
import 'katex/dist/katex.min.css';
import 'prosemirror-tables/style/tables.css';
import './style.css';
import './styles/decorators.css';
import './styles/diagram.css';

function installGlobalErrorGuards(): void {
  const shouldSwallow = (errOrMsg: unknown): boolean => {
    let msg = '';
    try {
      msg = String((errOrMsg as any)?.message ?? errOrMsg ?? '');
    } catch {
      msg = '';
    }
    return msg.includes('MilkdownError') && msg.includes('Context "editorView" not found');
  };

  // 兜底 1：传统 window.onerror（某些 webview 错误页仅走这个路径）
  const prevOnError = window.onerror;
  window.onerror = function (message, source, lineno, colno, error) {
    if (shouldSwallow(error ?? message)) return true;
    return typeof prevOnError === 'function'
      ? prevOnError.call(window, message, source, lineno, colno, error)
      : false;
  };

  window.addEventListener(
    'error',
    (e) => {
      const ev = e as ErrorEvent;
      // 注意：在部分环境下 ev.error 为空，只能从 message 读到信息
      if (shouldSwallow(ev.error ?? ev.message)) {
        e.preventDefault();
        // 有些运行时会把默认 handler 继续向下传；这里尽量截断
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (e as any).stopImmediatePropagation?.();
      }
    },
    true
  );

  window.addEventListener(
    'unhandledrejection',
    (e) => {
      const ev = e as PromiseRejectionEvent;
      if (shouldSwallow(ev.reason)) {
        e.preventDefault();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (e as any).stopImmediatePropagation?.();
      }
    },
    true
  );
}

// 声明 VSCode Webview API
declare function acquireVsCodeApi(): any;

console.log('Webview main.ts loading...');

// 尽早安装：必须在加载 App 模块之前装上（ESM 静态 import 会先执行）
installGlobalErrorGuards();

async function start(): Promise<void> {
  const vscode = acquireVsCodeApi();
  console.log('VSCode API acquired:', !!vscode);

  // 将 vscode API 挂载到全局
  (window as any).vscode = vscode;

  try {
    const mod = await import('./App.vue');
    const App = mod.default;
    const app = createApp(App);
    console.log('Vue app created');
    app.mount('#app');
    console.log('Vue app mounted');
  } catch (error) {
    console.error('Error mounting Vue app:', error);
  }
}

void start();
