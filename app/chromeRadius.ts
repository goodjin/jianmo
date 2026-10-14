/**
 * 独立桌面壳层的圆角。只给 Electron 界面用，不进 VS Code 插件。
 * 插件 webview 仍用自己的 `--markly-radius-*`。
 *
 * xxs 几乎方的小图标按钮（文件树向上一级、收起）。约 22px 宽上 8px 仍显胖。
 * xs  很小的图标（关掉标签、JSON 展开箭头）
 * sm  宽的文字按钮、输入框、菜单项、树行、标签顶角
 * md  下拉菜单、卡片、嵌套面板
 * lg  设置里的大分区
 * pill 本来就是胶囊的提示
 */
export const APP_RADIUS = {
  xxs: '6px',
  xs: '8px',
  sm: '12px',
  md: '16px',
  lg: '20px',
  pill: '999px',
} as const;

/** 挂在 `.markly-app` 上，子组件用 `var(--app-radius-*)` 取同一套数。 */
export const chromeRadiusStyle: Record<string, string> = {
  '--app-radius-xxs': APP_RADIUS.xxs,
  '--app-radius-xs': APP_RADIUS.xs,
  '--app-radius-sm': APP_RADIUS.sm,
  '--app-radius-md': APP_RADIUS.md,
  '--app-radius-lg': APP_RADIUS.lg,
  '--app-radius-pill': APP_RADIUS.pill,
};
