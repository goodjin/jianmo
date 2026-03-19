/**
 * useEditor Hook 单元测试
 * @module composables/__tests__/useEditor
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { useEditor } from '../useEditor';

// Mock CodeMirror DOM APIs
Object.defineProperty(window, 'getComputedStyle', {
  value: () => ({
    getPropertyValue: () => '',
  }),
});

describe('useEditor', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.height = '100px';
    container.style.width = '100px';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('创建和销毁', () => {
    it('应该创建编辑器实例', () => {
      const { createEditor, view } = useEditor();

      createEditor(container);

      expect(view.value).not.toBeNull();
    });

    it('应该销毁编辑器实例', () => {
      const { createEditor, destroy, view } = useEditor();

      createEditor(container);
      destroy();

      expect(view.value).toBeNull();
    });
  });

  describe('模式切换', () => {
    it('应该切换编辑模式', () => {
      const { createEditor, switchMode, mode } = useEditor();

      createEditor(container);
      switchMode('source');

      expect(mode.value).toBe('source');
    });

    it('应该触发模式变化回调', () => {
      const onModeChange = vi.fn();
      const { createEditor, switchMode } = useEditor({
        onModeChange,
      });

      createEditor(container);
      switchMode('split');

      expect(onModeChange).toHaveBeenCalledWith('split');
    });

    it('相同模式不应该触发更新', () => {
      const { createEditor, switchMode, mode } = useEditor({
        initialMode: 'ir',
      });

      createEditor(container);
      switchMode('ir');

      expect(mode.value).toBe('ir');
    });
  });

  describe('内容操作', () => {
    it('应该获取编辑器内容', () => {
      const { createEditor, getContent } = useEditor({
        initialContent: '# Hello World',
      });

      createEditor(container);

      expect(getContent()).toBe('# Hello World');
    });

    it('应该设置编辑器内容', async () => {
      const { createEditor, setContent, getContent } = useEditor();

      createEditor(container);
      setContent('# New Content');
      await nextTick();

      expect(getContent()).toBe('# New Content');
    });

    it('内容计算属性应该同步', async () => {
      const { createEditor, setContent, content } = useEditor();

      createEditor(container);
      setContent('# Test');
      await nextTick();

      expect(content.value).toBe('# Test');
    });
  });

  describe('撤销重做', () => {
    it('应该有撤销方法', () => {
      const { createEditor, undo } = useEditor();

      createEditor(container);

      expect(typeof undo).toBe('function');
      expect(() => undo()).not.toThrow();
    });

    it('应该有重做方法', () => {
      const { createEditor, redo } = useEditor();

      createEditor(container);

      expect(typeof redo).toBe('function');
      expect(() => redo()).not.toThrow();
    });

    it('应该有可撤销计算属性', () => {
      const { createEditor, canUndo } = useEditor();

      createEditor(container);

      expect(typeof canUndo.value).toBe('boolean');
    });

    it('应该有可重做计算属性', () => {
      const { createEditor, canRedo } = useEditor();

      createEditor(container);

      expect(typeof canRedo.value).toBe('boolean');
    });
  });

  describe('边界条件', () => {
    it('未创建时不应该报错', () => {
      const { getContent, setContent, undo, redo } = useEditor();

      expect(() => getContent()).not.toThrow();
      expect(() => setContent('test')).not.toThrow();
      expect(() => undo()).not.toThrow();
      expect(() => redo()).not.toThrow();
    });

    it('销毁后不应该报错', () => {
      const { createEditor, destroy, getContent } = useEditor();

      createEditor(container);
      destroy();

      expect(() => getContent()).not.toThrow();
    });
  });
});
