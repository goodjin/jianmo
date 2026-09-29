import { createApp } from 'vue';
import { installVsCodeShim } from './vscodeShim';
import PreviewApp from './PreviewApp.vue';

// 先装 shim（注入 window.vscode），再挂载——组件 setup 即可能读 window.vscode
installVsCodeShim();

createApp(PreviewApp).mount('#app');
