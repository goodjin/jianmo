# MOD-010: Theme System 主题系统模块

## 文档信息
- **项目名称**: Markly - CodeMirror 6 Markdown Editor
- **文档编号**: MOD-010
- **版本**: v1.0
- **更新日期**: 2026-03-18
- **对应PRD**: docs/v4/01-prd.md

---

## 目录

1. [系统定位](#系统定位)
2. [对应PRD](#对应prd)
3. [全局架构位置](#全局架构位置)
4. [依赖关系](#依赖关系)
5. [核心设计](#核心设计)
6. [接口定义](#接口定义)
7. [数据结构](#数据结构)
8. [边界条件](#边界条件)
9. [实现文件](#实现文件)
10. [覆盖映射](#覆盖映射)

---

## 系统定位

### 在整体架构中的位置

**所属层次**: L6 - 功能组件层

**架构定位图**:
```
┌─────────────────────────────────────────────────────┐
│              L7: App.vue (全局布局)                  │
│         管理主题状态切换                              │
└─────────────────────┬───────────────────────────────┘
                      │ 主题配置
                      ▼
┌─────────────────────────────────────────────────────┐
│              ★ MOD-010: Theme System ★              │
│              主题系统模块                            │
│  ┌─────────────────────────────────────────────┐   │
│  │  • useTheme.ts        - 主题管理 Hook        │   │
│  │  • themeConfig.ts     - 主题配置定义         │   │
│  │  • VS Code 主题同步                          │   │
│  │  • 自定义主题支持                            │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────┘
                      │ CSS Variables
                      ▼
┌─────────────────────────────────────────────────────┐
│              L3: MOD-001 Editor Core                │
│              应用主题到编辑器                         │
└─────────────────────────────────────────────────────┘
```

### 核心职责

- **主题管理**: 管理编辑器主题状态（亮色/暗色/自动）
- **VS Code 同步**: 自动同步 VS Code 主题设置
- **CSS 变量系统**: 使用 CSS 变量实现动态主题切换
- **自定义主题**: 支持用户自定义主题配置

### 边界说明

- **负责**:
  - 主题状态管理
  - CSS 变量生成和应用
  - VS Code 主题监听和同步
  - 主题配置持久化

- **不负责**:
  - 具体的编辑器样式（L3 负责）
  - 主题编辑器 UI（L7 负责）
  - 图标主题（VS Code 负责）

---

## 对应PRD

| PRD章节 | 编号 | 内容 |
|---------|-----|------|
| 功能需求 | FR-013 | 主题系统 |
| 用户故事 | US-002 | 主题偏好 |
| 验收标准 | AC-013-01~03 | 主题系统相关 |

---

## 全局架构位置

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         主题系统模块架构位置                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │ L7: App.vue                                                      │  │
│   │  <ThemeProvider :theme="currentTheme">                          │  │
│   └────────────────────────────────┬────────────────────────────────┘  │
│                                    │ ThemeConfig                        │
│                                    ▼                                   │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │ ★ MOD-010: Theme System                                         │  │
│   │  composables/useTheme.ts                                        │  │
│   │  • theme: Ref<ThemeType>                                        │  │
│   │  • syncWithVSCode(): 同步 VS Code 主题                           │  │
│   │  • applyTheme(): 应用主题到 DOM                                  │  │
│   │  shared/themeConfig.ts                                          │  │
│   │  • lightTheme: ThemeConfig                                      │  │
│   │  • darkTheme: ThemeConfig                                       │  │
│   └────────────────────────────────┬────────────────────────────────┘  │
│                                    │ CSS Variables                      │
│                                    ▼                                   │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │ L3: Editor Core                                                  │  │
│   │  • EditorView.theme()                                            │  │
│   │  • 装饰器样式应用                                                │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 依赖关系

### 上游依赖

| 模块名称 | 模块编号 | 依赖原因 | 调用方式 |
|---------|---------|---------|---------|
| VS Code Integration | MOD-011 | 获取 VS Code 主题设置 | useVSCode() |

### 下游依赖

| 模块名称 | 模块编号 | 被调用场景 | 调用方式 |
|---------|---------|-----------|---------|
| App.vue | L7 | 全局主题管理 | useTheme() |
| Editor Core | MOD-001 | 编辑器主题应用 | CSS Variables |

---

## 核心设计

### 主题配置结构

```typescript
// shared/themeConfig.ts

export interface ThemeColors {
  // 背景色
  background: string;
  surface: string;
  surfaceHover: string;

  // 文字色
  text: string;
  textSecondary: string;
  textMuted: string;

  // 边框色
  border: string;
  divider: string;

  // 强调色
  primary: string;
  primaryHover: string;

  // 功能色
  selection: string;
  highlight: string;
  cursor: string;

  // Markdown 特定
  heading: string;
  link: string;
  linkHover: string;
  code: string;
  codeBackground: string;
  blockquote: string;
  blockquoteBorder: string;
}

export interface ThemeConfig {
  name: string;
  type: 'light' | 'dark';
  colors: ThemeColors;
}

// 亮色主题
export const lightTheme: ThemeConfig = {
  name: 'Light',
  type: 'light',
  colors: {
    background: '#ffffff',
    surface: '#f5f5f5',
    surfaceHover: '#e8e8e8',
    text: '#333333',
    textSecondary: '#666666',
    textMuted: '#999999',
    border: '#e0e0e0',
    divider: '#eeeeee',
    primary: '#0066cc',
    primaryHover: '#0052a3',
    selection: '#b3d7ff',
    highlight: '#fff3cd',
    cursor: '#333333',
    heading: '#1a1a1a',
    link: '#0066cc',
    linkHover: '#0052a3',
    code: '#d32f2f',
    codeBackground: '#f5f5f5',
    blockquote: '#666666',
    blockquoteBorder: '#e0e0e0',
  },
};

// 暗色主题
export const darkTheme: ThemeConfig = {
  name: 'Dark',
  type: 'dark',
  colors: {
    background: '#1e1e1e',
    surface: '#252526',
    surfaceHover: '#2a2d2e',
    text: '#d4d4d4',
    textSecondary: '#a0a0a0',
    textMuted: '#808080',
    border: '#3c3c3c',
    divider: '#3e3e42',
    primary: '#007acc',
    primaryHover: '#0098ff',
    selection: '#264f78',
    highlight: '#613214',
    cursor: '#d4d4d4',
    heading: '#e0e0e0',
    link: '#4daafc',
    linkHover: '#6cb8ff',
    code: '#f44747',
    codeBackground: '#2d2d2d',
    blockquote: '#a0a0a0',
    blockquoteBorder: '#3c3c3c',
  },
};

// VS Code 主题映射
export const mapVSCodeTheme = (vscodeTheme: string): ThemeType => {
  if (vscodeTheme.includes('dark')) return 'dark';
  if (vscodeTheme.includes('light')) return 'light';
  return 'auto';
};
```

### useTheme Hook

```typescript
// composables/useTheme.ts

import { ref, computed, watch, onMounted } from 'vue';
import type { ThemeConfig } from '../shared/themeConfig';
import { lightTheme, darkTheme, mapVSCodeTheme } from '../shared/themeConfig';
import { useVSCode } from './useVSCode';

export type ThemeType = 'light' | 'dark' | 'auto';

export interface UseThemeOptions {
  defaultTheme?: ThemeType;
  enableVSSync?: boolean;
}

export interface UseThemeReturn {
  theme: Ref<ThemeType>;
  effectiveTheme: ComputedRef<'light' | 'dark'>;
  currentConfig: ComputedRef<ThemeConfig>;
  setTheme: (theme: ThemeType) => void;
  toggleTheme: () => void;
  syncWithVSCode: () => void;
  applyTheme: () => void;
}

export const useTheme = (options: UseThemeOptions = {}): UseThemeReturn => {
  const { defaultTheme = 'auto', enableVSSync = true } = options;
  const { onMessage, postMessage } = useVSCode();

  // 主题状态
  const theme = ref<ThemeType>(defaultTheme);

  // 系统主题偏好
  const systemPrefersDark = ref(false);

  // 计算实际生效的主题
  const effectiveTheme = computed<'light' | 'dark'>(() => {
    if (theme.value === 'auto') {
      return systemPrefersDark.value ? 'dark' : 'light';
    }
    return theme.value;
  });

  // 当前主题配置
  const currentConfig = computed<ThemeConfig>(() => {
    return effectiveTheme.value === 'dark' ? darkTheme : lightTheme;
  });

  // 监听系统主题变化
  let mediaQuery: MediaQueryList | null = null;

  onMounted(() => {
    if (typeof window !== 'undefined') {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      systemPrefersDark.value = mediaQuery.matches;

      mediaQuery.addEventListener('change', (e) => {
        systemPrefersDark.value = e.matches;
        if (theme.value === 'auto') {
          applyTheme();
        }
      });
    }

    // 监听 VS Code 主题变化
    if (enableVSSync) {
      const unsubscribe = onMessage((message) => {
        if (message.type === 'THEME_CHANGE') {
          const vsTheme = message.payload.theme as string;
          const mappedTheme = mapVSCodeTheme(vsTheme);
          if (mappedTheme !== 'auto') {
            theme.value = mappedTheme;
            applyTheme();
          }
        }
      });

      // 初始同步
      syncWithVSCode();

      return () => {
        unsubscribe();
      };
    }
  });

  // 应用主题到 DOM
  const applyTheme = () => {
    const config = currentConfig.value;
    const root = document.documentElement;

    // 设置 CSS 变量
    Object.entries(config.colors).forEach(([key, value]) => {
      root.style.setProperty(`--markly-${key}`, value);
    });

    // 设置 data-theme 属性
    root.setAttribute('data-theme', effectiveTheme.value);

    // 通知 VS Code
    postMessage({
      type: 'THEME_APPLIED',
      payload: { theme: effectiveTheme.value },
    });
  };

  // 设置主题
  const setTheme = (newTheme: ThemeType) => {
    theme.value = newTheme;
    applyTheme();
  };

  // 切换主题
  const toggleTheme = () => {
    const themes: ThemeType[] = ['light', 'dark', 'auto'];
    const currentIndex = themes.indexOf(theme.value);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  // 同步 VS Code 主题
  const syncWithVSCode = () => {
    postMessage({
      type: 'GET_THEME',
    });
  };

  // 监听主题变化自动应用
  watch(effectiveTheme, applyTheme, { immediate: true });

  return {
    theme,
    effectiveTheme,
    currentConfig,
    setTheme,
    toggleTheme,
    syncWithVSCode,
    applyTheme,
  };
};
```

### CSS 变量应用

```css
/* styles/theme.css */

:root {
  /* 默认亮色主题变量 */
  --markly-background: #ffffff;
  --markly-surface: #f5f5f5;
  --markly-surfaceHover: #e8e8e8;
  --markly-text: #333333;
  --markly-textSecondary: #666666;
  --markly-textMuted: #999999;
  --markly-border: #e0e0e0;
  --markly-divider: #eeeeee;
  --markly-primary: #0066cc;
  --markly-primaryHover: #0052a3;
  --markly-selection: #b3d7ff;
  --markly-highlight: #fff3cd;
  --markly-cursor: #333333;
  --markly-heading: #1a1a1a;
  --markly-link: #0066cc;
  --markly-linkHover: #0052a3;
  --markly-code: #d32f2f;
  --markly-codeBackground: #f5f5f5;
  --markly-blockquote: #666666;
  --markly-blockquoteBorder: #e0e0e0;
}

[data-theme="dark"] {
  --markly-background: #1e1e1e;
  --markly-surface: #252526;
  --markly-surfaceHover: #2a2d2e;
  --markly-text: #d4d4d4;
  --markly-textSecondary: #a0a0a0;
  --markly-textMuted: #808080;
  --markly-border: #3c3c3c;
  --markly-divider: #3e3e42;
  --markly-primary: #007acc;
  --markly-primaryHover: #0098ff;
  --markly-selection: #264f78;
  --markly-highlight: #613214;
  --markly-cursor: #d4d4d4;
  --markly-heading: #e0e0e0;
  --markly-link: #4daafc;
  --markly-linkHover: #6cb8ff;
  --markly-code: #f44747;
  --markly-codeBackground: #2d2d2d;
  --markly-blockquote: #a0a0a0;
  --markly-blockquoteBorder: #3c3c3c;
}

/* 编辑器样式使用 CSS 变量 */
.cm-editor {
  background-color: var(--markly-background);
  color: var(--markly-text);
}

.cm-editor .cm-content {
  caret-color: var(--markly-cursor);
}

.cm-editor .cm-selectionBackground {
  background-color: var(--markly-selection);
}

/* 装饰器样式 */
.cm-heading {
  color: var(--markly-heading);
}

.cm-link {
  color: var(--markly-link);
}

.cm-link:hover {
  color: var(--markly-linkHover);
}

.cm-code {
  color: var(--markly-code);
  background-color: var(--markly-codeBackground);
}

.cm-blockquote {
  color: var(--markly-blockquote);
  border-left-color: var(--markly-blockquoteBorder);
}
```

---

## 接口定义

### 对外接口清单

| 接口编号 | 接口名称 | 类型 | 路径 | 对应PRD |
|---------|---------|------|------|---------|
| API-032 | useTheme | Hook | composables/useTheme.ts | FR-013 |
| API-033 | ThemeProvider | Component | components/ThemeProvider.vue | FR-013 |
| API-034 | themeConfig | Config | shared/themeConfig.ts | FR-013 |

### 接口详细定义

#### API-032: useTheme

**对应PRD**: FR-013

**接口定义**:
```typescript
interface UseThemeReturn {
  theme: Ref<ThemeType>;                    // 当前主题设置
  effectiveTheme: ComputedRef<'light' | 'dark'>;  // 实际生效主题
  currentConfig: ComputedRef<ThemeConfig>;  // 当前主题配置
  setTheme: (theme: ThemeType) => void;     // 设置主题
  toggleTheme: () => void;                  // 切换主题
  syncWithVSCode: () => void;               // 同步 VS Code 主题
  applyTheme: () => void;                   // 应用主题到 DOM
}
```

---

## 数据结构

### DATA-004: ThemeConfig

**对应PRD**: FR-013

```typescript
interface ThemeConfig {
  name: string;           // 主题名称
  type: 'light' | 'dark'; // 主题类型
  colors: ThemeColors;    // 颜色配置
}

interface ThemeColors {
  background: string;     // 背景色
  surface: string;        // 表面色
  text: string;           // 主文字色
  textSecondary: string;  // 次要文字色
  primary: string;        // 主色调
  selection: string;      // 选区色
  // ... 其他颜色
}
```

**字段规约**:
| 字段名 | PRD属性 | 类型 | 约束 | 说明 |
|-------|---------|------|------|------|
| name | - | string | 非空 | 主题名称 |
| type | - | enum | light/dark | 主题类型 |
| colors | - | object | 必填 | 颜色配置对象 |

---

## 边界条件

### BOUND-049: 系统主题变化

**对应PRD**: AC-013-02

**边界描述**:
- 当系统主题偏好变化时，自动主题应跟随变化

**处理逻辑**:
```typescript
onMounted(() => {
  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', (e) => {
    systemPrefersDark.value = e.matches;
    if (theme.value === 'auto') {
      applyTheme();
    }
  });
});
```

### BOUND-050: VS Code 主题同步

**对应PRD**: AC-013-03

**边界描述**:
- VS Code 主题变化时应自动同步到编辑器

**处理逻辑**:
```typescript
const unsubscribe = onMessage((message) => {
  if (message.type === 'THEME_CHANGE') {
    const vsTheme = message.payload.theme as string;
    const mappedTheme = mapVSCodeTheme(vsTheme);
    theme.value = mappedTheme;
    applyTheme();
  }
});
```

---

## 实现文件

| 文件路径 | 职责 |
|---------|------|
| composables/useTheme.ts | 主题管理 Hook |
| shared/themeConfig.ts | 主题配置定义 |
| components/ThemeProvider.vue | 主题提供者组件 |
| styles/theme.css | CSS 变量定义 |

---

## 覆盖映射

### PRD需求覆盖情况

| PRD类型 | PRD编号 | 架构元素 | 覆盖状态 |
|---------|---------|---------|---------|
| 功能需求 | FR-013 | useTheme, themeConfig | ✅ |
| 用户故事 | US-002 | API-032~034 | ✅ |
| 验收标准 | AC-013-01 | setTheme | ✅ |
| 验收标准 | AC-013-02 | 系统主题监听 | ✅ |
| 验收标准 | AC-013-03 | syncWithVSCode | ✅ |

---

## 变更历史

| 版本 | 日期 | 变更内容 | 作者 |
|-----|------|---------|------|
| 1.0 | 2026-03-18 | 初始版本 | AI |
