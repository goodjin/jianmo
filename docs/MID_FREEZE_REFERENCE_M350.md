# 中期封板参照（M350）

## 封板目标（满足其一不够，必须全部满足）

- **IR 已移除（实现层）**：不再作为运行时编辑路径；只保留必要兼容/历史痕迹
- **i18n 基线**：关键 UI 文案外置，可扩展语言包
- **A11y 基线**：键盘可达 + 关键区域 `aria` 口径
- **E2E 基线**：核心旅程 smoke suite + 稳定可复跑

## 封板硬门禁

- `npm run check:release`
- `npm run gates:stable`
- `npm run test:vscode`
- `npm run package` 产出 VSIX，并记录尺寸（对照 bundle budget）

## 证据文档

- `docs/MID_PHASE_COMPLETE_M343.md`
- `docs/MID_GONOGO_M344.md`
- `docs/COMPAT_SMOKE_M347.md`

