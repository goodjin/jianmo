# UX：命令可发现性（帮助入口/搜索词）（M330）

## 目标

让用户在不看文档的情况下，也能在命令面板里“搜得到、找得对、用得上”。

## 当前状态

- 主要命令都已在命令面板以 `Markly` 分类出现（见 `package.json` contributes.commands）
- 自救入口：`markly.help.recoveryCenter`（Help: Open Recovery & Troubleshooting）

## 建议口径（不破坏现有结构）

- 命令标题尽量包含用户常用关键词：
  - export / 导出
  - outline / 大纲
  - find / 查找
  - images / 图片
  - recovery / troubleshooting / 排障
- README / Walkthrough 指向：
  - “自救中心”作为统一入口（而不是散落十几个链接）

