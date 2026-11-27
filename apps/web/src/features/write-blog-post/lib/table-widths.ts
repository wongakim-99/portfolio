import type { Node as PmNode, ResolvedPos } from '@tiptap/pm/model';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { isInTable, selectedRect } from '@tiptap/pm/tables';
import type { Editor } from '@tiptap/react';

// 칸 경계를 끌어 정한 표 칸 너비(px). 표 노드의 widths 속성에 두고, 마크다운에는 표 위 주석으로 남김 (entities/blog-post 의 table-widths)
// 한 번도 끌지 않은 표는 widths 가 null 이라 내용에 맞춘 자동 너비

/** 칸을 하나 더할 때 새 칸 너비 */
export const NEW_COL_WIDTH = 140;
/** 끌어서 줄일 수 있는 가장 좁은 칸 */
export const MIN_COL_WIDTH = 60;
/** blog-post-form.css 에 칸 너비 규칙(--col-1..12)을 둔 칸 수. 이보다 많은 표는 너비를 묶지 않음 */
export const MAX_SIZED_COLS = 12;

export type WidthsChange = { insert: number } | { remove: [from: number, to: number] };

/** 칸을 넣거나 지운 만큼 너비 목록도 맞춤. 너비를 정하지 않은 표(null)는 그대로 */
export function reshapeWidths(widths: number[] | null, change: WidthsChange): number[] | null {
  if (!widths) return null;
  if ('insert' in change) return [...widths.slice(0, change.insert), NEW_COL_WIDTH, ...widths.slice(change.insert)];
  const [from, to] = change.remove;
  const left = [...widths.slice(0, from), ...widths.slice(to)];
  return left.length ? left : null;
}

function tableAround($pos: ResolvedPos): { pos: number; node: PmNode } | null {
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth);
    if (node.type.name === 'table') return { pos: $pos.before(depth), node };
  }
  return null;
}

function setWidths(tr: Transaction, $pos: ResolvedPos, widths: (current: number[] | null) => number[] | null) {
  const table = tableAround($pos);
  if (!table) return;
  const next = widths((table.node.attrs.widths as number[] | null) ?? null);
  tr.setNodeMarkup(table.pos, undefined, { ...table.node.attrs, widths: next });
}

/** 커서가 든 표의 칸을 넣거나 지운 뒤에 붙이는 명령. 표 명령과 한 거래로 묶어 되돌리기도 같이 됨 */
export const reshapeTableWidths =
  (change: WidthsChange | null) =>
  ({ tr }: { tr: Transaction }) => {
    if (change) setWidths(tr, tr.selection.$from, (current) => reshapeWidths(current, change));
    return true;
  };

/** 지금 고른 칸들의 칸 범위. 도구 막대의 칸 추가, 지우기가 어디에 일어나는지 알려고 씀 */
export function selectedColumns(state: EditorState): { left: number; right: number } | null {
  if (!isInTable(state)) return null;
  const rect = selectedRect(state);
  return { left: rect.left, right: rect.right };
}

/** 표 DOM 에 칸 너비를 정해 넣음(null 이면 자동 너비로 돌림). 손잡이를 놓았을 때와 '자동 너비'에서 씀 */
export function commitTableWidths(editor: Editor, table: HTMLTableElement, widths: number[] | null) {
  const cell = table.rows[0]?.cells[0];
  if (!cell) return;
  const pos = editor.view.posAtDOM(cell, 0);
  editor
    .chain()
    .command(({ tr }) => {
      setWidths(tr, tr.doc.resolve(pos), () => widths && widths.map((width) => Math.round(width)));
      return true;
    })
    .run();
}

/** 표 상자(.tableWrapper)의 CSS 변수로 칸 너비를 그림. 편집기는 이 상자의 바뀜을 무시해서 문서는 그대로 */
export function paintWidths(wrapper: HTMLElement, widths: string[], tableWidth: string) {
  widths.forEach((width, i) => wrapper.style.setProperty(`--col-${i + 1}`, width));
  wrapper.style.setProperty('--table-width', tableWidth);
  wrapper.dataset.cols = String(widths.length);
}
