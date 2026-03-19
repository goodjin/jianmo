/**
 * useTheme Hook 单元测试
 * @module composables/__tests__/useTheme
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { useTheme } from '../useTheme';
import { lightTheme, darkTheme } from '../../shared/themeConfig';

// Mock useVSCode
vi.mock('../useVSCode', () => ({
  useVSCode: () => ({
    onMessage: vi.fn(() => vi.fn()), // 返回取消订阅函数
    postMessage: vi.fn(),
  }),
}));

describe('useTheme', () => {
  let matchMediaMock: any;

  beforeEach(() => {
    // Mock matchMedia
    matchMediaMock = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('matchMedia', vi.fn(() => matchMediaMock));

    // Mock document
    vi.stubGlobal('document', {
      documentElement: {
        style: { setProperty: vi.fn() },
        setAttribute: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('初始化', () => {
    it('应该使用默认主题 auto', () => {
      const { theme } = useTheme();
      expect(theme.value).toBe('auto');
    });

    it('应该接受自定义默认主题', () => {
      const { theme } = useTheme({ defaultTheme: 'dark' });
      expect(theme.value).toBe('dark');
    });

    it('系统主题监听只在组件挂载后触发（onMounted）', () => {
      // onMounted 在测试环境不触发，所以 effectiveTheme 初始为 light（默认）
      matchMediaMock.matches = true;
      const { effectiveTheme } = useTheme({ defaultTheme: 'auto' });
      // 因为 onMounted 不执行，systemPrefersDark 保持初始值 false
      expect(effectiveTheme.value).toBe('light');
    });
  });

  describe('effectiveTheme', () => {
    it('auto 模式下默认返回 light（系统偏好检测在 onMounted 中）', () => {
      matchMediaMock.matches = false;
      const { effectiveTheme } = useTheme({ defaultTheme: 'auto' });

      expect(effectiveTheme.value).toBe('light');
    });

    it('auto 模式下通过 setTheme 切换', () => {
      const { theme, effectiveTheme, setTheme } = useTheme({ defaultTheme: 'auto' });

      setTheme('dark');
      expect(effectiveTheme.value).toBe('dark');
    });

    it('明确设置 light 应该返回 light', () => {
      const { theme, effectiveTheme } = useTheme({ defaultTheme: 'light' });

      expect(theme.value).toBe('light');
      expect(effectiveTheme.value).toBe('light');
    });

    it('明确设置 dark 应该返回 dark', () => {
      const { theme, effectiveTheme } = useTheme({ defaultTheme: 'dark' });

      expect(theme.value).toBe('dark');
      expect(effectiveTheme.value).toBe('dark');
    });
  });

  describe('currentConfig', () => {
    it('light 主题应该返回 lightTheme 配置', () => {
      const { currentConfig } = useTheme({ defaultTheme: 'light' });

      expect(currentConfig.value).toEqual(lightTheme);
    });

    it('dark 主题应该返回 darkTheme 配置', () => {
      const { currentConfig } = useTheme({ defaultTheme: 'dark' });

      expect(currentConfig.value).toEqual(darkTheme);
    });
  });

  describe('setTheme', () => {
    it('应该能够设置主题', () => {
      const { theme, setTheme } = useTheme({ defaultTheme: 'light' });

      setTheme('dark');

      expect(theme.value).toBe('dark');
    });

    it('应该能够设置为 auto', () => {
      const { theme, setTheme } = useTheme({ defaultTheme: 'light' });

      setTheme('auto');

      expect(theme.value).toBe('auto');
    });
  });

  describe('toggleTheme', () => {
    it('应该按 light -> dark -> auto -> light 循环', () => {
      const { theme, toggleTheme } = useTheme({ defaultTheme: 'light' });

      expect(theme.value).toBe('light');

      toggleTheme();
      expect(theme.value).toBe('dark');

      toggleTheme();
      expect(theme.value).toBe('auto');

      toggleTheme();
      expect(theme.value).toBe('light');
    });
  });

  describe('DOM 操作', () => {
    it('应该设置 CSS 变量', async () => {
      const { setTheme } = useTheme({ defaultTheme: 'light' });

      await nextTick();

      const setProperty = document.documentElement.style.setProperty;
      expect(setProperty).toHaveBeenCalled();
      expect(setProperty).toHaveBeenCalledWith('--markly-background', expect.any(String));
    });

    it('应该设置 data-theme 属性', async () => {
      const { setTheme } = useTheme({ defaultTheme: 'dark' });

      await nextTick();

      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
    });
  });

  describe('系统主题监听', () => {
    it('系统主题监听在 onMounted 中注册（测试环境不触发）', () => {
      // onMounted 在测试环境不执行，matchMedia 监听不会注册
      useTheme({ defaultTheme: 'auto' });
      // 验证 hook 可以正常初始化
      expect(matchMediaMock.addEventListener).not.toHaveBeenCalled();
    });
  });
});
