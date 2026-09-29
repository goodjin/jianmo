/**
 * shiki 子包（`@shikijs/*`）只带 `.d.mts` 类型，仓库 tsconfig 的 `moduleResolution: node`
 * 认不到 exports 映射；这里补一份通配声明，避免类型检查/编辑器误报。
 * 运行时解析由 Node/构建工具按 exports 映射完成，与此声明无关。
 */
declare module '@shikijs/langs/*' {
  const input: any;
  export default input;
}

declare module '@shikijs/themes/*' {
  const input: any;
  export default input;
}
