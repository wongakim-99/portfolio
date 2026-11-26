'use client';

import { TextSelection } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type RefObject } from 'react';
import { cx } from '@shared/lib';

// 노션처럼 표에 마우스를 올리면 나오는 손잡이
// 줄 왼쪽, 칸 위 손잡이를 누르면 넣기와 지우기 메뉴가 열리고, 오른쪽 끝과 아래쪽 막대를 누르면 칸과 줄을 끝에 하나 더함
// 마우스가 없는 터치 화면에서는 커서를 표에 두면 도구 막대에 나오는 표 단추를 씀

// 손잡이와 막대가 표 밖에 있어서, 표에서 이만큼 벗어나도 손잡이를 남겨 둠
const REACH = 36;

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Hover {
  table: HTMLTableElement;
  row: number;
  col: number;
}

interface View extends Hover {
  /** 보이는 표. 종이보다 넓어 옆으로 밀어 보는 중이면 보이는 부분까지 */
  box: Box;
  rowBox: Box;
  colBox: Box;
}

type Action = 'rowAbove' | 'rowBelow' | 'rowEnd' | 'rowDelete' | 'colLeft' | 'colRight' | 'colEnd' | 'colDelete' | 'tableDelete';

const ROW_MENU: [Action, string][] = [['rowAbove', '위에 줄 넣기'], ['rowBelow', '아래에 줄 넣기'], ['rowDelete', '이 줄 지우기']];
const COL_MENU: [Action, string][] = [['colLeft', '왼쪽에 칸 넣기'], ['colRight', '오른쪽에 칸 넣기'], ['colDelete', '이 칸 지우기']];

const relative = (left: number, top: number, width: number, height: number, host: DOMRect): Box => ({
  left: left - host.left,
  top: top - host.top,
  width,
  height,
});

// 지금 표와 고른 줄, 칸의 자리를 편집기 상자 기준으로 잼. 표가 바뀌어 그 줄, 칸이 없어졌으면 null
function measure(host: HTMLElement, hover: Hover): View | null {
  const cell = hover.table.rows[hover.row]?.cells[hover.col];
  if (!hover.table.isConnected || !cell) return null;
  const hostRect = host.getBoundingClientRect();
  const table = hover.table.getBoundingClientRect();
  const frame = (hover.table.parentElement ?? hover.table).getBoundingClientRect();
  const left = Math.max(table.left, frame.left);
  const width = Math.min(table.right, frame.right) - left;
  const at = cell.getBoundingClientRect();
  return {
    ...hover,
    box: relative(left, table.top, width, table.height, hostRect),
    rowBox: relative(left, at.top, width, at.height, hostRect),
    colBox: relative(at.left, table.top, at.width, table.height, hostRect),
  };
}

// 고른 칸에 커서를 두고 표 명령을 부름. 마지막 남은 줄이나 칸을 지우면 표를 지움 (노션과 같게)
function act(editor: Editor, { table, row, col }: Hover, action: Action) {
  const rows = table.rows;
  const lastRow = rows[rows.length - 1];
  const firstRow = rows[0];
  const target =
    action === 'rowEnd' ? lastRow?.cells[0] : action === 'colEnd' ? firstRow?.cells[firstRow.cells.length - 1] : rows[row]?.cells[col];
  if (!target) return;
  const pos = editor.view.posAtDOM(target, 0);
  const chain = editor
    .chain()
    .focus()
    .command(({ tr }) => {
      tr.setSelection(TextSelection.near(tr.doc.resolve(pos)));
      return true;
    });
  const only = (action === 'rowDelete' && rows.length === 1) || (action === 'colDelete' && (firstRow?.cells.length ?? 0) === 1);
  if (only || action === 'tableDelete') chain.deleteTable().run();
  else if (action === 'rowAbove') chain.addRowBefore().run();
  else if (action === 'rowBelow' || action === 'rowEnd') chain.addRowAfter().run();
  else if (action === 'rowDelete') chain.deleteRow().run();
  else if (action === 'colLeft') chain.addColumnBefore().run();
  else if (action === 'colRight' || action === 'colEnd') chain.addColumnAfter().run();
  else chain.deleteColumn().run();
}

// 노션의 끌기 손잡이처럼 점 여섯 개. 줄 손잡이는 세로로, 칸 손잡이는 가로로 놓음
function Grip({ along }: { along: 'row' | 'col' }) {
  const dots = [0, 1, 2].flatMap((i) => [0, 1].map((j) => (along === 'row' ? [4 + j * 4, 3 + i * 5] : [3 + i * 5, 4 + j * 4])));
  return (
    <svg viewBox={along === 'row' ? '0 0 12 16' : '0 0 16 12'} aria-hidden="true">
      {dots.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.3" />
      ))}
    </svg>
  );
}

// 손잡이를 눌러도 편집기 커서가 빠져나가지 않게 함
const keepFocus = (event: ReactMouseEvent) => event.preventDefault();

/** host 는 편집기를 감싼 상자(.md-editor). 손잡이를 그 안에 절대 위치로 띄움 */
export function TableControls({ editor, host }: { editor: Editor | null; host: RefObject<HTMLDivElement | null> }) {
  const [view, setView] = useState<View | null>(null);
  const [menu, setMenu] = useState<'row' | 'col' | null>(null);
  const menuOpen = useRef(false);

  useEffect(() => {
    menuOpen.current = menu !== null;
  }, [menu]);

  // 마우스가 있는 칸을 따라 손잡이를 옮기고, 글을 고치거나 표를 옆으로 밀면 자리를 다시 잼
  useEffect(() => {
    const root = host.current;
    if (!root || !editor) return;
    let current: Hover | null = null;
    const show = (next: Hover | null) => {
      current = next;
      const measured = next && measure(root, next);
      if (!measured) current = null;
      setView(measured);
      if (!measured) setMenu(null);
    };
    const onMove = (event: MouseEvent) => {
      if (menuOpen.current) return;
      const target = event.target as Element;
      if (target.closest('.md-table-ctl')) return;
      const cell = target.closest<HTMLTableCellElement>('.md-live td, .md-live th');
      const table = cell?.closest('table');
      if (cell && table) {
        const row = (cell.parentElement as HTMLTableRowElement).rowIndex;
        if (current?.table !== table || current.row !== row || current.col !== cell.cellIndex) show({ table, row, col: cell.cellIndex });
        return;
      }
      if (!current) return;
      const r = current.table.getBoundingClientRect();
      const near = event.clientX > r.left - REACH && event.clientX < r.right + REACH && event.clientY > r.top - REACH && event.clientY < r.bottom + REACH;
      if (!near) show(null);
    };
    const onLeave = () => {
      if (!menuOpen.current) show(null);
    };
    const remeasure = () => {
      if (current) show(current);
    };
    root.addEventListener('mousemove', onMove);
    root.addEventListener('mouseleave', onLeave);
    // 표 상자의 가로 밀기는 위로 올라오지 않아서 붙잡는 단계에서 들음
    root.addEventListener('scroll', remeasure, true);
    window.addEventListener('resize', remeasure);
    editor.on('update', remeasure);
    return () => {
      root.removeEventListener('mousemove', onMove);
      root.removeEventListener('mouseleave', onLeave);
      root.removeEventListener('scroll', remeasure, true);
      window.removeEventListener('resize', remeasure);
      editor.off('update', remeasure);
    };
  }, [editor, host]);

  // 메뉴 밖을 누르거나 Esc 를 누르면 메뉴를 닫음
  useEffect(() => {
    if (!menu) return;
    const onDown = (event: MouseEvent) => {
      if (!(event.target as Element).closest('.md-table-menu, .md-table-grip')) setMenu(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  if (!editor || !view) return null;
  const { box, rowBox, colBox } = view;
  const run = (action: Action) => {
    setMenu(null);
    act(editor, view, action);
  };
  const items = menu === 'row' ? ROW_MENU : COL_MENU;
  const menuAt = menu === 'row' ? { left: box.left - 4, top: rowBox.top + rowBox.height / 2 + 14 } : { left: colBox.left + colBox.width / 2 - 8, top: box.top + 12 };

  return (
    <div className="md-table-ctl">
      <button
        type="button"
        className={cx('md-table-grip', 'is-col', menu === 'col' && 'is-open')}
        style={{ left: colBox.left + colBox.width / 2, top: box.top }}
        aria-label="이 칸 메뉴 열기"
        aria-haspopup="menu"
        aria-expanded={menu === 'col'}
        onMouseDown={keepFocus}
        onClick={() => setMenu(menu === 'col' ? null : 'col')}
      >
        <Grip along="col" />
      </button>
      <button
        type="button"
        className={cx('md-table-grip', 'is-row', menu === 'row' && 'is-open')}
        style={{ left: box.left, top: rowBox.top + rowBox.height / 2 }}
        aria-label="이 줄 메뉴 열기"
        aria-haspopup="menu"
        aria-expanded={menu === 'row'}
        onMouseDown={keepFocus}
        onClick={() => setMenu(menu === 'row' ? null : 'row')}
      >
        <Grip along="row" />
      </button>
      <button
        type="button"
        className="md-table-add is-col"
        style={{ left: box.left + box.width + 6, top: box.top, height: box.height }}
        title="오른쪽 끝에 칸 추가"
        aria-label="오른쪽 끝에 칸 추가"
        onMouseDown={keepFocus}
        onClick={() => run('colEnd')}
      >
        +
      </button>
      <button
        type="button"
        className="md-table-add is-row"
        style={{ left: box.left, top: box.top + box.height + 6, width: box.width }}
        title="맨 아래에 줄 추가"
        aria-label="맨 아래에 줄 추가"
        onMouseDown={keepFocus}
        onClick={() => run('rowEnd')}
      >
        +
      </button>
      {menu && (
        <div className="md-table-menu" role="menu" style={menuAt}>
          {items.map(([action, label]) => (
            <button key={action} type="button" role="menuitem" className={cx(action.endsWith('Delete') && 'is-danger')} onMouseDown={keepFocus} onClick={() => run(action)}>
              {label}
            </button>
          ))}
          <hr />
          <button type="button" role="menuitem" className="is-danger" onMouseDown={keepFocus} onClick={() => run('tableDelete')}>
            표 지우기
          </button>
        </div>
      )}
    </div>
  );
}
