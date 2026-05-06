# E2E：bridge contract 刷新与约束（M309）

## 目标

让 E2E 测试依赖的“webview 内部桥接接口”保持：

- 最小表面积（不暴露无关能力）
- 有白名单契约（新增 key 必须同步测试）
- 在运行时与单测中都能发现不一致

## 现状（已具备）

- 白名单：`webview/src/utils/e2eBridgeContract.ts` 导出 `MARKLY_E2E_BRIDGE_KEYS`
- 运行时校验：`webview/src/App.vue` 在 bridge 注入时比较 `Object.keys(bridge)` 与白名单，发现不一致会 `console.warn`
- 单测门禁：`webview/src/utils/__tests__/e2eBridgeContract.test.ts` 固定断言 keys 列表

## 约束规则（贡献者必读）

1. **任何新增 bridge key 都必须**：
   - 更新 `MARKLY_E2E_BRIDGE_KEYS`
   - 更新 `e2eBridgeContract.test.ts`
   - 在 E2E 或 webview 单测里增加至少 1 个用例覆盖
2. 禁止把 bridge 当作“内部调试后门”；只允许暴露 UI 测试必须且无法稳定通过 DOM 完成的能力。

# E2E：bridge contract 刷新与约束（M309）

## 背景

Webview 内置了一份 **E2E bridge**（`window.__marklyE2E`），用于 UI 测试在“纯 DOM 操作容易 flaky”时提供最小稳定能力面。

## 契约（必须遵守）

- Bridge **只允许白名单 key**，禁止随意扩张表面积。
- 任何新增/删除 key 都必须：
  - 修改白名单 `MARKLY_E2E_BRIDGE_KEYS`
  - 同步更新/新增测试用例（否则视为不合入）

## 代码位置

- 白名单：`webview/src/utils/e2eBridgeContract.ts`
- 契约门禁测试：`webview/src/utils/__tests__/e2eBridgeContract.test.ts`

