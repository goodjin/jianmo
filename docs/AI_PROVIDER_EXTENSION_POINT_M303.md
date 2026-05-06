# AI：Provider 扩展点（M303，可选）

## 目标

将 AI 能力的 provider 选择与实例化集中到 registry，便于后续增加新的 provider（例如 Azure OpenAI、Gemini、Local）。

## 现状

- 配置快照：`src/extension/ai/assistConfig.ts` → `AssistFeatureSnapshot`
- 能力接口：`src/extension/ai/assistTypes.ts` → `AssistModelOperations`
- 运行时依赖（密钥/transport）：`src/extension/ai/assistExtensionBridge.ts`

## 本次落地

- 新增 provider registry：`src/extension/ai/assistProviders.ts`
  - `ASSIST_PROVIDER_FACTORIES` 统一管理 provider → operations 的映射
  - `getAssistProviderFactory(...)` 对未知 provider 做降级（默认 mock）

## 后续扩展方式（开发者）

1. 在 `AssistProviderId` 增加新 id（或未来改成字符串枚举）
2. 实现一个 factory（输入 `snap + deps`，输出 `AssistModelOperations`）
3. 注册到 `ASSIST_PROVIDER_FACTORIES`

