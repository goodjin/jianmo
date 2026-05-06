# 依赖：升级扫尾与风险说明（M357）

## 结论（本阶段）

**不做大规模升级，只补“升级原则 + 风险说明 + 执行步骤”**。原因：升级扫尾容易引入不可预期回归；中期封板更看重稳定性与可复跑门禁。

## 升级原则

- 以 **patch/minor** 为主，优先修安全与稳定性
- 重大版本升级必须：
  - 写入 `CHANGELOG`
  - 跑 `npm run preflight` + `npm run test:vscode`
  - 关注 bundle budget

## 风险点

- 构建链（vite/esbuild）升级可能影响 webview 打包
- 大依赖（mermaid/shiki/katex）升级可能影响导出与渲染一致性

## 推荐执行步骤（后续迭代）

1. 选定目标包（一次最多 1–3 个）
2. 升级后跑 `npm run preflight`
3. 记录 bundle size 变化
4. 如有回归，优先回滚并开 issue

