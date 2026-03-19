/**
 * 主题管理 Hook
 * @module composables/useTheme
 * @description 提供主题状态管理和 VS Code 主题同步
 */

import { ref, computed, watch, onMounted } from 'vue';
import type { Ref, ComputedRef } from 'vue';
import type { ThemeType, ThemeConfig } from '../shared/themeConfig';
import { lightTheme, darkTheme } from '../shared/themeConfig';
import { useVSCode } from './useVSCode';

/**
 * useTheme 选项
 */
export interface UseThemeOptions {
  /** 默认主题 */
  defaultTheme?: ThemeType;
}

/**
 * useTheme 返回接口
 */
export interface UseThemeReturn {
  /** 当前主题设置 */
  theme: Ref<ThemeType>;
  /** 实际生效的主题（auto 会解析为 light/dark） */
  effectiveTheme: ComputedRef<'light' | 'dark'>;
  /** 当前主题配置 */
  currentConfig: ComputedRef<ThemeConfig>;
  /** 设置主题 */
  setTheme: (theme: ThemeType) => void;
  /** 切换主题 */
  toggleTheme: () => void;
}

/**
 * 主题管理 Hook
 * @param options - 配置选项
 * @returns 主题管理接口
 */
export const useTheme = (options: UseThemeOptions = {}): UseThemeReturn => {
  const { defaultTheme = 'auto' } = options;
  const { onMessage } = useVSCode();

  const theme: Ref<ThemeType> = ref(defaultTheme);
  const systemPrefersDark: Ref<boolean> = ref(false);

  /**
   * 实际生效的主题
   */
  const effectiveTheme = computed<'light' | 'dark'>(() => {
    if (theme.value === 'auto') {
      return systemPrefersDark.value ? 'dark' : 'light';
    }
    return theme.value;
  });

  /**
   * 当前主题配置
   */
  const currentConfig = computed<ThemeConfig>(() => {
    return effectiveTheme.value === 'dark' ? darkTheme : lightTheme;
  });

  onMounted(() => {
    // 监听系统主题变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    systemPrefersDark.value = mediaQuery.matches;

    const handleChange = (e: MediaQueryListEvent) => {
      systemPrefersDark.value = e.matches;
    };

    mediaQuery.addEventListener('change', handleChange);

    // 监听 VS Code 主题变化
    const unsubscribe = onMessage((message) => {
      if (message.type === 'THEME_CHANGE') {
        const vsTheme = (message.payload as { theme: string }).theme;
        // 根据 VS Code 主题名称判断是亮色还是暗色
        const isDark =
          vsTheme.toLowerCase().includes('dark') ||
          vsTheme === 'Visual Studio Dark';
        theme.value = isDark ? 'dark' : 'light';
      }
    });

    // 清理函数
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
      unsubscribe();
    };
  });

  /**
   * 应用主题到 DOM
   */
  const applyTheme = () => {
    const root = document.documentElement;
    const config = currentConfig.value;

    Object.entries(config.colors).forEach(([key, value]) => {
      root.style.setProperty(`--markly-${key}`, value);
    });

    root.setAttribute('data-theme', effectiveTheme.value);
  };

  /**
   * 设置主题
   * @param newTheme - 新主题
   */
  const setTheme = (newTheme: ThemeType) => {
    theme.value = newTheme;
  };

  /**
   * 切换主题（light -> dark -> auto -> light）
   */
  const toggleTheme = () => {
    const themes: ThemeType[] = ['light', 'dark', 'auto'];
    const currentIndex = themes.indexOf(theme.value);
    theme.value = themes[(currentIndex + 1) % themes.length];
  };

  // 监听主题变化并自动应用
  watch(effectiveTheme, applyTheme, { immediate: true });

  return {
    theme,
    effectiveTheme,
    currentConfig,
    setTheme,
    toggleTheme,
  };
};

export default useTheme;
