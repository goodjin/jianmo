/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';
import { MARKLY_E2E_BRIDGE_KEYS } from '../e2eBridgeContract';

describe('M10-3 E2E bridge contract', () => {
  it('bridge key list is stable (whitelist only)', () => {
    // 这是一条“契约门禁”：任何新增/删除 key 必须显式改动本名单并通过 code review。
    expect([...MARKLY_E2E_BRIDGE_KEYS]).toEqual([
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
      'getDiagnostics',
      'isRichDocumentPainted',
      'getRichPmSelection',
      'runRichTableOp',
      'simulateRichTablePaste',
      'setRichTableCellSelection',
      'e2eSelectFirstTableBodyCell',
      'e2eSetCellSelectionInFirstTable',
      'runRichFormat',
      'e2eSelectListItemText',
      'e2ePressTab',
      'e2eIndentListItem',
      'e2eOutdentListItem',
    ]);
  });
});

