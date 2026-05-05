## Summary

<!-- 简述动机与行为变化 -->

## Checklist

- [ ] **`npm run gates:stable` 已通过**（或等价：lint + test + build + check:bundle + **check:ir-freeze**）
- [ ] **IR 冻结**（[`docs/IR_FREEZE_POLICY.md`](docs/IR_FREEZE_POLICY.md)）：未引入仅面向 `ir` 的新功能/新装饰器模块；若动到 `webview/src/core/decorators/*.ts` 文件集合，已更新 `scripts/ir-freeze-decorators-baseline.json` 并取得维护者确认
- [ ] 用户可见文案 / 快照测试已按需更新

## Screenshots（如适用）

<!-- UI 改动请附图 -->
