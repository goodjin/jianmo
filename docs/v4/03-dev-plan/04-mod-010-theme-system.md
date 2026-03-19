# 开发计划 - MOD-010: Theme System

## 文档信息
- **模块编号**: MOD-010
- **模块名称**: Theme System
- **所属层次**: L6 - 功能组件层
- **对应架构**: [09-mod-010-theme-system.md](../02-architecture/09-mod-010-theme-system.md)
- **优先级**: P0
- **预估工时**: 1天

---

## 1. 模块概述

### 1.1 模块职责

Theme System 负责编辑器主题管理：
- 主题状态管理（亮色/暗色/自动）
- VS Code 主题同步
- CSS 变量系统
- 主题配置持久化

### 1.2 对应PRD

| PRD编号 | 功能 | 用户故事 |
|---------|-----|---------|
| FR-013 | 主题系统 | US-002 |

---

## 2. 技术设计

### 2.1 目录结构

```
webview/src/
├── composables/
│   ├── useTheme.ts           # 主题 Hook
│   └── __tests__/
│       └── useTheme.test.ts
├── shared/
│   └── themeConfig.ts        # 主题配置
└── styles/
    └── theme.css             # 主题样式
```

---

## 3. 开发任务拆分

| 任务 | 名称 | 文件数 | 代码行数 | 依赖 |
|-----|------|-------|---------|------|
| T-01 | 主题配置 | 2 | ~100 | - |
| T-02 | useTheme Hook | 2 | ~120 | T-01 |
| T-03 | CSS 变量 | 1 | ~80 | T-01 |
| T-04 | 单元测试 | 2 | ~100 | T-02 |

---

## 4. 详细任务定义

### T-01: 主题配置

**任务概述**: 定义主题配置和颜色

**输出**:
- `webview/src/shared/themeConfig.ts`

**实现要求**:

```typescript
// shared/themeConfig.ts
export interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  primary: string;
  selection: string;
  heading: string;
  link: string;
  linkHover: string;
  code: string;
  codeBackground: string;
}

export interface ThemeConfig {
  name: string;
  type: 'light' | 'dark';
  colors: ThemeColors;
}

export const lightTheme: ThemeConfig = {
  name: 'Light',
  type: 'light',
  colors: {
    background: '#ffffff',
    surface: '#f5f5f5',
    text: '#333333',
    textSecondary: '#666666',
    primary: '#0066cc',
    selection: '#b3d7ff',
    heading: '#1a1a1a',
    link: '#0066cc',
    linkHover: '#0052a3',
    code: '#d32f2f',
    codeBackground: '#f5f5f5',
  },
};

export const darkTheme: ThemeConfig = {
  name: 'Dark',
  type: 'dark',
  colors: {
    background: '#1e1e1e',
    surface: '#252526',
    text: '#d4d4d4',
    textSecondary: '#a0a0a0',
    primary: '#007acc',
    selection: '#264f78',
    heading: '#e0e0e0',
    link: '#4daafc',
    linkHover: '#6cb8ff',
    code: '#f44747',
    codeBackground: '#2d2d2d',
  },
};

export type ThemeType = 'light' | 'dark' | 'auto';
```

**预估工时**: 1小时

---

### T-02: useTheme Hook

**任务概述**: 实现主题管理 Hook

**输出**:
- `webview/src/composables/useTheme.ts`

**实现要求**:

```typescript
// composables/useTheme.ts
import { ref, computed, watch, onMounted } from 'vue';
import { ThemeType, ThemeConfig, lightTheme, darkTheme } from '../shared/themeConfig';
import { useVSCode } from './useVSCode';

export interface UseThemeOptions {
  defaultTheme?: ThemeType;
}

export const useTheme = (options: UseThemeOptions = {}) => {
  const { defaultTheme = 'auto' } = options;
  const { onMessage, postMessage } = useVSCode();

  const theme = ref<ThemeType>(defaultTheme);
  const systemPrefersDark = ref(false);

  const effectiveTheme = computed<'light' | 'dark'>(() => {
    if (theme.value === 'auto') {
      return systemPrefersDark.value ? 'dark' : 'light';
    }
    return theme.value;
  });

  const currentConfig = computed<ThemeConfig>(() => {
    return effectiveTheme.value === 'dark' ? darkTheme : lightTheme;
  });

  onMounted(() => {
    // 监听系统主题
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    systemPrefersDark.value = mediaQuery.matches;
    mediaQuery.addEventListener('change', (e) => {
      systemPrefersDark.value = e.matches;
    });

    // 监听 VS Code 主题
    onMessage((message) => {
      if (message.type === 'THEME_CHANGE') {
        const vsTheme = message.payload.theme as string;
        theme.value = vsTheme.includes('dark') ? 'dark' : 'light';
      }
    });
  });

  // 应用主题
  const applyTheme = () => {
    const root = document.documentElement;
    const config = currentConfig.value;

    Object.entries(config.colors).forEach(([key, value]) => {
      root.style.setProperty(`--markly-${key}`, value);
    });

    root.setAttribute('data-theme', effectiveTheme.value);
  };

  // 设置主题
  const setTheme = (newTheme: ThemeType) => {
    theme.value = newTheme;
  };

  // 切换主题
  const toggleTheme = () => {
    const themes: ThemeType[] = ['light', 'dark', 'auto'];
    const currentIndex = themes.indexOf(theme.value);
    theme.value = themes[(currentIndex + 1) % themes.length];
  };

  watch(effectiveTheme, applyTheme, { immediate: true });

  return {
    theme,
    effectiveTheme,
    currentConfig,
    setTheme,
    toggleTheme,
  };
};
```

**预估工时**: 3小时

**依赖**: T-01

---

### T-03: CSS 变量

**任务概述**: 定义 CSS 变量样式

**输出**:
- `webview/src/styles/theme.css`

**实现要求**:

```css
/* styles/theme.css */
:root {
  --markly-background: #ffffff;
  --markly-surface: #f5f5f5;
  --markly-text: #333333;
  --markly-textSecondary: #666666;
  --markly-primary: #0066cc;
  --markly-selection: #b3d7ff;
  --markly-heading: #1a1a1a;
  --markly-link: #0066cc;
  --markly-linkHover: #0052a3;
  --markly-code: #d32f2f;
  --markly-codeBackground: #f5f5f5;
}

[data-theme="dark"] {
  --markly-background: #1e1e1e;
  --markly-surface: #252526;
  --markly-text: #d4d4d4;
  --markly-textSecondary: #a0a0a0;
  --markly-primary: #007acc;
  --markly-selection: #264f78;
  --markly-heading: #e0e0e0;
  --markly-link: #4daafc;
  --markly-linkHover: #6cb8ff;
  --markly-code: #f44747;
  --markly-codeBackground: #2d2d2d;
}
```

**预估工时**: 1小时

**依赖**: T-01

---

### T-04: 单元测试

**任务概述**: 编写单元测试

**输出**:
- `webview/src/composables/__tests__/useTheme.test.ts`

**预估工时**: 2小时

**依赖**: T-02

---

## 5. 覆盖映射

| 架构元素 | 任务 | 覆盖状态 |
|---------|------|---------|
| API-032 useTheme | T-02 | ✅ |
| API-033 ThemeProvider | T-02 | ✅ |
| API-034 themeConfig | T-01 | ✅ |
