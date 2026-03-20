/**
 * useEditor Hook 单元测试
 * @module composables/__tests__/useEditor
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { useEditor } from '../useEditor';
import { withSetup } from '../../utils/testUtils';

// Mock CodeMirror DOM APIs
if (typeof Range !== 'undefined') {
  Range.prototype.getClientRects = () => [] as any;
  Range.prototype.getBoundingClientRect = () => ({ right: 0, bottom: 0, left: 0, top: 0, width: 0, height: 0, x: 0, y: 0 } as any);
}
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
      const { result: { createEditor, view }, wrapper } = withSetup(() => useEditor());

      createEditor(container);

      expect(view.value).not.toBeNull();
    });

    it('应该销毁编辑器实例', () => {
      const { result: { createEditor, destroy, view }, wrapper } = withSetup(() => useEditor());

      createEditor(container);
      destroy();

      expect(view.value).toBeNull();
    });
  });

  describe('模式切换', () => {
    it('应该切换编辑模式', () => {
      const { result: { createEditor, switchMode, mode }, wrapper } = withSetup(() => useEditor());

      createEditor(container);
      switchMode('source');

      expect(mode.value).toBe('source');
    });

    it('应该触发模式变化回调', () => {
      const onModeChange = vi.fn();
      const { result: { createEditor, switchMode }, wrapper } = withSetup(() => useEditor({
        onModeChange,
      }));

      createEditor(container);
      switchMode('split');

      expect(onModeChange).toHaveBeenCalledWith('split');
    });

    it('相同模式不应该触发更新', () => {
      const { result: { createEditor, switchMode, mode }, wrapper } = withSetup(() => useEditor({
        initialMode: 'ir',
      }));

      createEditor(container);
      switchMode('ir');

      expect(mode.value).toBe('ir');
    });
  });

  describe('内容操作', () => {
    it('应该获取编辑器内容', () => {
      const { result: { createEditor, getContent }, wrapper } = withSetup(() => useEditor({
        initialContent: '# Hello World',
      }));

      createEditor(container);

      expect(getContent()).toBe('# Hello World');
    });

    it('应该设置编辑器内容', async () => {
      const { result: { createEditor, setContent, getContent }, wrapper } = withSetup(() => useEditor());

      createEditor(container);
      setContent('# New Content');
      await nextTick();

      expect(getContent()).toBe('# New Content');
    });

    it('内容计算属性应该同步', async () => {
      const { result: { createEditor, setContent, content }, wrapper } = withSetup(() => useEditor());

      createEditor(container);
      setContent('# Test');
      await nextTick();

      expect(content.value).toBe('# Test');
    });
  });

  describe('撤销重做', () => {
    it('应该有撤销方法', () => {
      const { result: { createEditor, undo }, wrapper } = withSetup(() => useEditor());

      createEditor(container);

      expect(typeof undo).toBe('function');
      expect(() => undo()).not.toThrow();
    });

    it('应该有重做方法', () => {
      const { result: { createEditor, redo }, wrapper } = withSetup(() => useEditor());

      createEditor(container);

      expect(typeof redo).toBe('function');
      expect(() => redo()).not.toThrow();
    });

    it('应该有可撤销计算属性', () => {
      const { result: { createEditor, canUndo }, wrapper } = withSetup(() => useEditor());

      createEditor(container);

      expect(typeof canUndo.value).toBe('boolean');
    });

    it('应该有可重做计算属性', () => {
      const { result: { createEditor, canRedo }, wrapper } = withSetup(() => useEditor());

      createEditor(container);

      expect(typeof canRedo.value).toBe('boolean');
    });
  });

  describe('格式与插入操作', () => {
    it('应该有 applyFormat 方法并能执行基础格式化', async () => {
      const { result: { createEditor, applyFormat, setContent, getContent }, wrapper } = withSetup(() => useEditor());
      createEditor(container);
      setContent('test');
      await nextTick();

      expect(typeof applyFormat).toBe('function');
      expect(() => applyFormat('bold')).not.toThrow();
      // 这里由于处于测试环境，没有选中文字，applyFormat 默认在光标位置（0）插入 ** 前后缀
      expect(getContent()).toContain('**');
    });

    it('应该有 insertNode 方法并能插入指定内容', async () => {
      const { result: { createEditor, insertNode, getContent }, wrapper } = withSetup(() => useEditor());
      createEditor(container);
      await nextTick();

      expect(typeof insertNode).toBe('function');
      insertNode('link');
      expect(getContent()).toContain('[链接文字](https://example.com)');

      insertNode('image');
      expect(getContent()).toContain('![图片描述](图片地址)');
    });
  });

  describe('边界条件', () => {
    it('未创建时不应该报错', () => {
      const { result: { getContent, setContent, undo, redo }, wrapper } = withSetup(() => useEditor());

      expect(() => getContent()).not.toThrow();
      expect(() => setContent('test')).not.toThrow();
      expect(() => undo()).not.toThrow();
      expect(() => redo()).not.toThrow();
    });

    it('销毁后不应该报错', () => {
      const { result: { createEditor, destroy, getContent }, wrapper } = withSetup(() => useEditor());

      createEditor(container);
      destroy();

      expect(() => getContent()).not.toThrow();
    });
  });
});
