# M70 Fixtures：长文档稳定门禁

目的：用**可复现的 seed** 生成接近 / 跨越 `richPerfTier` 阈值的大文档，给单测提供门禁。

## seed

- `01-seed.md`
  - 覆盖点：标题层级、列表、代码块、引用、内部链接（便于长文档中常见结构）
  - 用法：测试中把 seed 重复拼接到目标字符数 / 行数附近，验证：
    - `getRichPerfTier` 档位在阈值附近正确切换
    - `App.recomputePerfDegradeUi` 文案与 banner 可见性稳定

