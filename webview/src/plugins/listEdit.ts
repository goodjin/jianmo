import { keymap } from '@milkdown/prose/keymap';
import { liftListItem, sinkListItem, splitListItem } from '@milkdown/prose/schema-list';
import { InputRule, wrappingInputRule } from '@milkdown/prose/inputrules';
import type { Ctx } from '@milkdown/ctx';

// 创建引用块的 input rule
// 输入 > 自动转换为引用块
function blockquoteInputRule(ctx: Ctx) {
  return wrappingInputRule(
    /^>\s$/,
    ctx.get('schema').nodes.blockquote
  );
}

// 创建任务清单的 input rule
// 输入 - [ ] 或 * [ ] 自动创建任务项
function taskListInputRule(ctx: Ctx) {
  const schema = ctx.get('schema');
  
  // 检查是否存在 task_list_item 节点（通过 extendListItemSchemaForTask）
  if (!schema.nodes.list_item) {
    return null;
  }
  
  // 匹配 - [ ] 或 * [ ] 或 - [x] 等
  return new InputRule(/^[-*]\s\[\s?\]\s$/, (state, _match, start, end) => {
    const tr = state.tr;
    
    // 删除输入的内容（- [ ]）
    tr.delete(start - 2, end);
    
    // 获取当前位置
    const pos = start - 2;
    
    // 将当前位置的列表项转换为任务列表项
    const $pos = tr.doc.resolve(pos);
    let depth = 0;
    let node = $pos.node(depth);
    
    // 找到 list_item
    while (node && node.type.name !== 'list_item') {
      depth--;
      node = $pos.node(depth);
    }
    
    if (node) {
      const finPos = $pos.before(depth);
      tr.setNodeMarkup(finPos, void 0, {
        ...node.attrs,
        checked: false,
      });
    }
    
    return tr;
  });
}

// 创建自定义 keymap
function createKeymap(ctx: Ctx) {
  const schema = ctx.get('schema');
  
  return keymap({
    // Enter 在列表中续写（splitListItem）
    'Enter': (state, dispatch) => {
      // 尝试使用 splitListItem 命令
      const listItem = schema.nodes.list_item;
      if (listItem) {
        return splitListItem(listItem)(state, dispatch);
      }
      return false;
    },
    
    // Tab 缩进列表项
    'Tab': (state, dispatch) => {
      const listItem = schema.nodes.list_item;
      if (listItem) {
        return sinkListItem(listItem)(state, dispatch);
      }
      return false;
    },
    
    // Shift+Tab 取消缩进列表项
    'Shift-Tab': (state, dispatch) => {
      const listItem = schema.nodes.list_item;
      if (listItem) {
        return liftListItem(listItem)(state, dispatch);
      }
      return false;
    },
  });
}

// 导出插件
export const listEdit = (ctx: Ctx) => {
  // 添加 input rules
  const rules: InputRule[] = [];
  
  // 添加引用块 input rule
  rules.push(blockquoteInputRule(ctx));
  
  // 添加任务清单 input rule
  const taskRule = taskListInputRule(ctx);
  if (taskRule) {
    rules.push(taskRule);
  }
  
  ctx.get('inputRulesCtx').add((prev) => [...prev, ...rules]);
  
  // 添加 keymap
  ctx.get('keymapCtx').add((prev) => [...prev, createKeymap(ctx)]);
};
