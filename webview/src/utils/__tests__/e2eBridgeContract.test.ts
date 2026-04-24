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
      'replaceAll',
      'getSelectionAnchor',
      'setSelectionAnchor',
      'getDiagnostics',
      'isRichDocumentPainted',
      'getRichPmSelection',
      'runRichTableOp',
      'simulateRichTablePaste',
      'e2eSelectFirstTableBodyCell',
      'e2eSetCellSelectionInFirstTable',
      'e2eSelectListItemText',
      'e2ePressTab',
      'e2eIndentListItem',
      'e2eOutdentListItem',
    ]);
  });
});

