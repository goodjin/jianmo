const fs = require('fs');
let content = fs.readFileSync('src/composables/__tests__/useTheme.test.ts', 'utf-8');

// Fix 1
content = content.replace(
  /系统主题监听只在组件挂载后触发（onMounted）[\s\S]*?\}\);/g,
  `系统主题监听会在组件挂载后触发（onMounted）', () => {
      // 通过 withSetup 模拟挂载，所以 onMounted 会执行
      matchMediaMock.matches = true;
      const { result: { effectiveTheme } } = withSetup(() => useTheme({ defaultTheme: 'auto' }));
      // 由于 onMounted 执行且 matches=true，effectiveTheme 应该是 dark
      expect(effectiveTheme.value).toBe('dark');
    });`
);

// Fix 2
content = content.replace(
  /系统主题监听在 onMounted 中注册（测试环境不触发）[\s\S]*?\}\);/g,
  `系统主题监听会在 onMounted 中注册', () => {
      withSetup(() => useTheme({ defaultTheme: 'auto' }));
      // 验证 addEventListener 被调用
      expect(matchMediaMock.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });`
);

fs.writeFileSync('src/composables/__tests__/useTheme.test.ts', content);
