/**
 * 运行时切片入口：把 Shiki 高亮器单独打成 `dist/extension/markly-code-highlight.cjs`，
 * 由扩展入口在导出/预览渲染时按需加载（体积治理见 resources/BUNDLE_GOVERNANCE.md）。
 */
export { createShikiTokenizer } from './codeHighlight';
