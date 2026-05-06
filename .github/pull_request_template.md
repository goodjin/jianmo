## Summary

<!-- 简述动机与行为变化 -->

## Checklist

- [ ] **`npm run gates:stable` 已通过**（或等价：lint + test + build + check:bundle + **check:ir-freeze**）
- [ ] **协议/消息变更**：若改了 `ExtensionMessage` / `WebViewMessage`（`src/types/index.ts`），已同步 **`src/types/messageGuards.ts`** 及相应单测（近期路线 **M246**）
- [ ] **IR 冻结**（[`docs/IR_FREEZE_POLICY.md`](docs/IR_FREEZE_POLICY.md)）：未引入仅面向 `ir` 的新功能/新装饰器模块；若动到 `webview/src/core/decorators/*.ts` 文件集合，已更新 `scripts/ir-freeze-decorators-baseline.json` 并取得维护者确认
- [ ] 用户可见文案 / 快照测试已按需更新

## Screenshots（如适用）

<!-- UI 改动请附图 -->
