# 包体趋势台账（M250）

本项目已用 `npm run check:bundle` 做 **硬阈值门禁**；但门禁只能告诉你“有没有超线”，不能告诉你“是否持续变胖”。因此增加一个**可选**的趋势记录流程。

## 1) 生成一次包体报告（输出到 `tmp/`）

先确保已构建：

```bash
npm run build
```

然后运行：

```bash
node ./scripts/record-bundle-sizes.mjs
```

会生成 `tmp/bundle-sizes.json`（已在 `.gitignore` 忽略），可作为 issue/PR 附件。

## 2) 追加到历史（可选）

如需把本次结果写入仓库历史文件（JSONL，一行一条记录）：

```bash
MARKLY_BUNDLE_HISTORY_APPEND=1 node ./scripts/record-bundle-sizes.mjs
```

输出会追加到 `resources/bundle-size-history.jsonl`。

> 说明：CI 不会自动写入历史（CI 不应改仓库内容）。建议由 release owner 在“发版准备 PR”里手动追加一次。

