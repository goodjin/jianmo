/**
 * E2E bridge contract (M10-3)
 *
 * 原则：bridge 只暴露“UI 测试必须、且难以用真实 DOM 操作稳定完成”的最小表面积。
 * 任何新增 key 都应该同时带对应测试用例，否则视为不合入。
 */

export const MARKLY_E2E_BRIDGE_KEYS = [
  // 基础：内容/模式/撤销重做
  'getContent',
  'setContent',
  'switchMode',
  'getEditorMode',
  'undo',
  'redo',
  'undoCmd',
  'redoCmd',
  'getUndoDepth',
  'getRedoDepth',
  'replaceAll',
  'getSelectionAnchor',
  'setSelectionAnchor',
  'applyFormat',
  'insertNode',
  'getZoom',

  // 诊断
  'getDiagnostics',
  'isRichDocumentPainted',
  'getRichPmSelection',

  // Rich 表格：关键且稳定性敏感（避免 stale element）
  'runRichTableOp',
  'simulateRichTablePaste',
  'setRichTableCellSelection',
  'e2eSelectFirstTableBodyCell',
  'e2eSetCellSelectionInFirstTable',

  // Rich 列表/Tab：在 E2E 下 DOM 键盘事件易 flaky
  'runRichFormat',
  'e2eSelectListItemText',
  'e2ePressTab',
  'e2eIndentListItem',
  'e2eOutdentListItem',
] as const;

export type MarklyE2EBridgeKey = (typeof MARKLY_E2E_BRIDGE_KEYS)[number];

