/**
 * 表格边上的加行/加列、选中行/列。
 * 光标停在单元格里不再出整表选中框；只有指针靠近表格边缘时才出现操作。
 */

export const TABLE_EDGE_GUTTER_PX = 22;
/** 交界处多近算「两行/两列之间」，用来放添加按钮 */
export const TABLE_EDGE_MAX_SNAP_PX = 8;
/** 行/列中间至少留出这么宽的头部区域，避免矮行被交界吃掉、点不到选中 */
export const TABLE_EDGE_MIN_HEAD_PX = 14;
/** 贴着表格边框内侧多少像素仍算头部，方便沿着边点 */
export const TABLE_EDGE_INNER_PX = 4;

export type TableEdgeHover =
  | { axis: 'row'; kind: 'gap'; index: number }
  | { axis: 'row'; kind: 'head'; index: number }
  | { axis: 'col'; kind: 'gap'; index: number }
  | { axis: 'col'; kind: 'head'; index: number };

export type TableSelectionBand = {
  axis: 'row' | 'col';
  /** 含首尾 */
  from: number;
  to: number;
};

type AxisHit = { kind: 'gap' | 'head'; index: number };

function boundarySnap(edges: number[], index: number, maxSnap: number, minHead: number): number {
  const prev = index > 0 ? edges[index] - edges[index - 1] : Number.POSITIVE_INFINITY;
  const next = index < edges.length - 1 ? edges[index + 1] - edges[index] : Number.POSITIVE_INFINITY;
  const room = Math.min(prev, next);
  if (!Number.isFinite(room)) return maxSnap;
  const allowed = (room - minHead) / 2;
  if (allowed >= 1) return Math.min(maxSnap, allowed);
  return Math.min(maxSnap, Math.max(2, room * 0.22));
}

/** 沿一条边把指针分成「交界」或「这一行/列的头部」。交界优先，但会给头部留出中间一段。 */
export function classifyEdgeAxis(
  pos: number,
  edges: number[],
  maxSnap = TABLE_EDGE_MAX_SNAP_PX,
  minHead = TABLE_EDGE_MIN_HEAD_PX
): AxisHit | null {
  if (edges.length < 2) return null;
  const startSnap = boundarySnap(edges, 0, maxSnap, minHead);
  const endSnap = boundarySnap(edges, edges.length - 1, maxSnap, minHead);
  const first = edges[0];
  const last = edges[edges.length - 1];
  if (pos < first - startSnap || pos > last + endSnap) return null;

  let bestGap = -1;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < edges.length; i++) {
    const snap = boundarySnap(edges, i, maxSnap, minHead);
    const dist = Math.abs(pos - edges[i]);
    if (dist <= snap + 0.01 && dist < bestDist) {
      bestDist = dist;
      bestGap = i;
    }
  }
  if (bestGap >= 0) return { kind: 'gap', index: bestGap };

  const n = edges.length - 1;
  for (let i = 0; i < n; i++) {
    if (pos >= edges[i] && pos < edges[i + 1]) return { kind: 'head', index: i };
  }
  if (pos === last) return { kind: 'gap', index: n };
  return null;
}

/**
 * 指针相对表格左上角的坐标。
 * 左边一条是行：交界处加行，行的中段是行头（点选）。
 * 上边一条是列。表格内部和左上外角不出现按钮。
 */
export function classifyTableEdgeHover(args: {
  x: number;
  y: number;
  rowEdges: number[];
  colEdges: number[];
  gutter?: number;
  inner?: number;
  maxSnap?: number;
  minHead?: number;
}): TableEdgeHover | null {
  const gutter = args.gutter ?? TABLE_EDGE_GUTTER_PX;
  const inner = args.inner ?? TABLE_EDGE_INNER_PX;
  const maxSnap = args.maxSnap ?? TABLE_EDGE_MAX_SNAP_PX;
  const minHead = args.minHead ?? TABLE_EDGE_MIN_HEAD_PX;
  const { rowEdges, colEdges, x, y } = args;
  if (rowEdges.length < 2 || colEdges.length < 2) return null;

  const rowStartSnap = boundarySnap(rowEdges, 0, maxSnap, minHead);
  const rowEndSnap = boundarySnap(rowEdges, rowEdges.length - 1, maxSnap, minHead);
  const colStartSnap = boundarySnap(colEdges, 0, maxSnap, minHead);
  const colEndSnap = boundarySnap(colEdges, colEdges.length - 1, maxSnap, minHead);

  const inRowLane = x >= -gutter && x <= inner && y >= rowEdges[0] - rowStartSnap && y <= rowEdges[rowEdges.length - 1] + rowEndSnap;
  const inColLane = y >= -gutter && y <= inner && x >= colEdges[0] - colStartSnap && x <= colEdges[colEdges.length - 1] + colEndSnap;

  // 左上角外侧：既不是行头也不是列头
  if (x < -0.5 && y < -0.5 && inRowLane && inColLane) return null;

  let use: 'row' | 'col' | null = null;
  if (inRowLane && inColLane) {
    const leftness = inner - x;
    const topness = inner - y;
    use = leftness >= topness ? 'row' : 'col';
  } else if (inRowLane) use = 'row';
  else if (inColLane) use = 'col';
  if (!use) return null;

  if (use === 'row') {
    const hit = classifyEdgeAxis(y, rowEdges, maxSnap, minHead);
    return hit ? { axis: 'row', kind: hit.kind, index: hit.index } : null;
  }
  const hit = classifyEdgeAxis(x, colEdges, maxSnap, minHead);
  return hit ? { axis: 'col', kind: hit.kind, index: hit.index } : null;
}

/** 整行或整列的选区。局部单元格选区返回 null，避免编辑正文时冒出删除按钮。 */
export function tableSelectionBand(rect: {
  left: number;
  right: number;
  top: number;
  bottom: number;
  mapWidth: number;
  mapHeight: number;
}): TableSelectionBand | null {
  const rowCount = rect.bottom - rect.top;
  const colCount = rect.right - rect.left;
  if (rowCount < 1 || colCount < 1) return null;
  const fullWidth = rect.left === 0 && rect.right === rect.mapWidth;
  const fullHeight = rect.top === 0 && rect.bottom === rect.mapHeight;
  if (fullWidth && rect.mapWidth > 0) {
    return { axis: 'row', from: rect.top, to: rect.bottom - 1 };
  }
  if (fullHeight && rect.mapHeight > 0) {
    return { axis: 'col', from: rect.left, to: rect.right - 1 };
  }
  return null;
}

export function bandCoversEntireAxis(band: TableSelectionBand, mapWidth: number, mapHeight: number): boolean {
  if (band.axis === 'row') return band.from === 0 && band.to === mapHeight - 1;
  return band.from === 0 && band.to === mapWidth - 1;
}

/** 拖过交界时，落到交界「下面/右边」那一行或列；最后一条交界落在末行/末列。 */
export function indexForGapDrag(gap: number, count: number): number {
  if (count <= 0) return 0;
  if (gap <= 0) return 0;
  if (gap >= count) return count - 1;
  return gap;
}

export type TableClientRect = { left: number; top: number; right: number; bottom: number };

/** 指针落在哪张表的扩展边上。重叠时取面积更小的（嵌套表取里层）。找不到返回 -1。 */
export function pickNearestTableIndex(rects: TableClientRect[], x: number, y: number, pad: number): number {
  let best = -1;
  let bestDist = Number.POSITIVE_INFINITY;
  let bestArea = Number.POSITIVE_INFINITY;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (x < r.left - pad || x > r.right + pad || y < r.top - pad || y > r.bottom + pad) continue;
    const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
    const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
    const dist = dx + dy;
    const area = Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top);
    if (dist < bestDist - 0.01 || (Math.abs(dist - bestDist) <= 0.01 && area < bestArea)) {
      best = i;
      bestDist = dist;
      bestArea = area;
    }
  }
  return best;
}

export type MeasuredTableEdges = {
  rowEdges: number[];
  colEdges: number[];
  width: number;
  height: number;
};

/** 用表格 DOM 的行和单元格边界量出相对表格左上角的交界位置。 */
export function measureTableEdges(table: HTMLTableElement): MeasuredTableEdges | null {
  const rows = Array.from(table.rows);
  if (!rows.length) return null;
  const tableRect = table.getBoundingClientRect();
  const rowEdges = [0];
  for (const tr of rows) {
    const r = tr.getBoundingClientRect();
    rowEdges.push(r.bottom - tableRect.top);
  }
  const xs = new Set<number>([0, Math.round(tableRect.width)]);
  for (const tr of rows) {
    for (const cell of Array.from(tr.cells)) {
      const r = cell.getBoundingClientRect();
      xs.add(Math.round(r.left - tableRect.left));
      xs.add(Math.round(r.right - tableRect.left));
    }
  }
  const colEdges = Array.from(xs).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (rowEdges.length < 2 || colEdges.length < 2) return null;
  return {
    rowEdges,
    colEdges,
    width: tableRect.width,
    height: tableRect.height,
  };
}
