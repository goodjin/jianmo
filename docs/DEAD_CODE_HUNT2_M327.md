# 清理：Dead code Hunt 2（IR 删除后依赖瘦身）（M327）

## 目标

在 IR 实现层移除后做第二轮清理，减少：

- 不再使用的代码路径
- 不必要的依赖与构建产物
- 文档/脚本中的过期引用

## 本轮策略（最小、可重复）

1. 以 `npm run gates:stable` 为主门禁，确保清理不引入回归。
2. 优先清理“确定不会再走到”的分支（例如 legacy/compat-only 且已无调用者）。
3. 对依赖瘦身：只在确认无引用后移除（避免误删导致 webview/build 失败）。

## 现状备注

- 当前仓库已经把 IR decorators 清零并有 `check:ir-freeze` baseline 约束。
- 后续若要做更激进的依赖瘦身，建议拆成独立 PR 并附 bundle size 前后对比（`record-bundle-sizes`）。

