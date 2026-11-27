import { Extension, InputRule, mergeAttributes, type JSONContent } from '@tiptap/core';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { Heading } from '@tiptap/extension-heading';
import { Image } from '@tiptap/extension-image';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { renderTableToMarkdown, Table, TableKit } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { CellSelection, TableMap } from '@tiptap/pm/tables';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { StarterKit } from '@tiptap/starter-kit';
import { common, createLowlight } from 'lowlight';
import { CALLOUT_EMOJI, parseTableWidths, tableWidthsComment } from '@entities/blog-post';
import { MAX_SIZED_COLS, paintWidths } from './table-widths';

// 노션처럼 쓰는 블로그 편집기(Tiptap)의 확장 모음. 화면에서는 바로 모양이 바뀌고, 저장은 지금처럼 마크다운으로 함
// 읽는 화면(BlogMarkdown)과 같은 .md 스타일을 입혀서 쓰는 모양이 올린 모양과 같게 보임

// 읽는 화면은 본문 # 을 글 제목 아래 단계로 그리므로 편집기도 같은 크기 class(md-h1..)를 붙임
const BlogHeading = Heading.extend({
  renderHTML({ node, HTMLAttributes }) {
    const level = node.attrs.level as number;
    return [`h${level}`, mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { class: `md-h${level}` }), 0];
  },
});

// 올리는 중인 사진은 브라우저 안 임시 주소(blob:)로 먼저 보여 주고, 다 올라가면 진짜 주소로 바꿈
// 임시 사진은 마크다운에 남기지 않아서 임시 저장 글이나 올린 글에 깨진 주소가 들어가지 않음
const BlogImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      uploadId: {
        default: null,
        parseHTML: () => null,
        renderHTML: (attributes: { uploadId?: string | null }) => (attributes.uploadId ? { 'data-uploading': 'true' } : {}),
      },
    };
  },
  renderMarkdown: (node: JSONContent) => {
    const { src, alt, title, uploadId } = (node.attrs ?? {}) as Record<string, string | null | undefined>;
    if (uploadId || !src) return '';
    const label = (alt ?? '').replace(/[[\]]/g, '');
    return title ? `![${label}](${src} "${title.replace(/"/g, '')}")` : `![${label}](${src})`;
  },
});

// 이모지로 시작하는 인용(> 💡 ...)은 읽는 화면처럼 포스트잇 상자로 보이게 class 만 붙임. 저장되는 마크다운은 그대로 인용
const CalloutLook = Extension.create({
  name: 'calloutLook',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('calloutLook'),
        props: {
          decorations(state) {
            const found: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (node.type.name !== 'blockquote') return true;
              if (CALLOUT_EMOJI.test(node.firstChild?.textContent ?? '')) {
                found.push(Decoration.node(pos, pos + node.nodeSize, { class: 'md-callout-live' }));
              }
              return true;
            });
            return DecorationSet.create(state.doc, found);
          },
        },
      }),
    ];
  },
});

// [글](주소) 를 다 치면 바로 링크로 바꿈. 주소는 http(s), mailto, 사이트 안 주소만
const SAFE_HREF = /^(?:https?:\/\/|mailto:|\/|#)/i;
const MarkdownLink = Extension.create({
  name: 'markdownLink',
  addInputRules() {
    return [
      new InputRule({
        find: /(?:^|[^!])\[([^\]]+)\]\(([^)\s]+)\)$/,
        handler: ({ state, range, match }) => {
          const link = state.schema.marks.link;
          const [whole, text, href] = match;
          if (!link || !whole || !text || !href || !SAFE_HREF.test(href)) return null;
          const from = range.from + (whole.startsWith('[') ? 0 : 1);
          state.tr.replaceWith(from, range.to, state.schema.text(text, [link.create({ href })])).removeStoredMark(link);
        },
      }),
    ];
  },
});

// 표 키보드. 노션처럼 표 바로 아래 줄 맨 앞에서 Backspace 를 누르면 표 전체를 고르고, 한 번 더 누르면 표를 지움
// 두 번째는 TableKit 의 '모든 칸을 고르면 표를 지움'이 맡음. 그냥 두면 표는 앞 줄과 합쳐지지 않아 아무 일도 안 일어남
const TableKeys = Extension.create({
  name: 'tableKeys',
  // TableKit 과 다른 Backspace 처리(목록, 인용 풀기 등)보다 먼저 봄. 해당하지 않으면 그냥 넘김
  priority: 1000,
  addKeyboardShortcuts() {
    return {
      // 마지막 칸에서 Tab 을 눌러도 줄을 새로 만들지 않고 그 자리에 둠. 줄은 + 막대나 메뉴로만 더함
      Tab: ({ editor }) => {
        const { $head } = editor.state.selection;
        for (let depth = $head.depth; depth > 2; depth -= 1) {
          const name = $head.node(depth).type.name;
          if (name !== 'tableCell' && name !== 'tableHeader') continue;
          return $head.index(depth - 1) === $head.node(depth - 1).childCount - 1 && $head.index(depth - 2) === $head.node(depth - 2).childCount - 1;
        }
        return false;
      },
      Backspace: ({ editor }) => {
        const { selection } = editor.state;
        const { $from } = selection;
        if (!selection.empty || $from.parentOffset !== 0 || !$from.parent.isTextblock) return false;
        const blockStart = $from.before();
        const table = editor.state.doc.resolve(blockStart).nodeBefore;
        if (table?.type.name !== 'table') return false;
        const map = TableMap.get(table);
        const inside = blockStart - table.nodeSize + 1;
        return editor.commands.command(({ tr }) => {
          tr.setSelection(CellSelection.create(tr.doc, inside + map.map[0]!, inside + map.map[map.map.length - 1]!));
          return true;
        });
      },
    };
  },
});

// 표 칸 너비. 칸 경계를 끌어 정한 표(widths 속성)는 그 px 너비로 그림
// 정하지 않은 표는 쉬고 있을 때 올린 글처럼 내용 길이에 맞추고, 커서가 든 동안은 그 너비로 묶어 둠
// 묶지 않으면 글자를 칠 때마다 칸이 넓어지고 옆 칸이 줄어 듦. 커서가 표를 떠나거나 줄, 칸 수가 바뀌면 다시 맞춤
// 너비는 표 상자(.tableWrapper, Tiptap TableView 가 그리고 편집기는 바뀜을 무시함)의 CSS 변수로만 그려서 문서는 그대로
function fitTable(wrapper: HTMLElement, table: HTMLTableElement, cols: number): boolean {
  delete wrapper.dataset.cols;
  const total = table.getBoundingClientRect().width;
  // 마크다운 칸으로 바꿔 둔 동안처럼 숨어 있으면 잴 수 없으니 자동 너비로 둠
  if (!total || !cols) return false;
  const widths = [...table.rows[0]!.cells].map((cell) => `${(cell.getBoundingClientRect().width / total) * 100}%`);
  // 종이보다 넓은 표는 그 너비 그대로 옆으로 밀어 봄
  paintWidths(wrapper, widths, total > wrapper.clientWidth + 1 ? `${total}px` : '100%');
  return true;
}

const TableFit = Extension.create({
  name: 'tableFit',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('tableFit'),
        view: (view) => {
          // 자동 너비 표를 마지막으로 맞춘 때의 줄 수, 칸 수, 글. 쉬고 있는 표는 이게 바뀐 때만 다시 잼
          const fitted = new WeakMap<HTMLElement, string>();
          const sync = () => {
            const at = view.domAtPos(view.state.selection.from).node;
            const active = (at instanceof Element ? at : at.parentElement)?.closest('.tableWrapper');
            view.state.doc.descendants((node, pos) => {
              if (node.type.name !== 'table') return true;
              const wrapper = view.nodeDOM(pos);
              const table = wrapper instanceof HTMLElement ? wrapper.querySelector('table') : null;
              if (!(wrapper instanceof HTMLElement) || !table) return false;
              const cols = table.rows[0]?.cells.length ?? 0;
              if (cols > MAX_SIZED_COLS) {
                delete wrapper.dataset.cols;
                return false;
              }
              const widths = node.attrs.widths as number[] | null;
              if (widths?.length === cols) {
                const key = widths.join(' ');
                if (wrapper.dataset.sized !== key) {
                  paintWidths(wrapper, widths.map((width) => `${width}px`), `${widths.reduce((sum, width) => sum + width, 0)}px`);
                  wrapper.dataset.sized = key;
                }
                return false;
              }
              // 너비를 지웠으면(자동 너비) 처음부터 다시 맞춤
              if (wrapper.dataset.sized) {
                delete wrapper.dataset.sized;
                delete wrapper.dataset.cols;
              }
              const sameShape = Number(wrapper.dataset.cols) === cols;
              if (wrapper === active && sameShape) return false;
              const look = `${table.rows.length}:${cols}:${table.textContent}`;
              if (sameShape && fitted.get(wrapper) === look) return false;
              if (fitTable(wrapper, table, cols)) fitted.set(wrapper, look);
              return false;
            });
          };
          sync();
          return { update: sync };
        },
      }),
    ];
  },
});

// 칸 너비(widths)를 단 표. 마크다운에는 표 바로 위 줄에 너비 주석을 같이 쓰고, 읽을 때 주석과 표를 한 덩어리로 읽어 너비를 되살림
const tableTokenizer = Table.config.markdownTokenizer!;
const BlogTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      widths: { default: null, parseHTML: () => null, renderHTML: () => ({}) },
    };
  },
  markdownTokenizer: {
    ...tableTokenizer,
    start: (src: string) => {
      const comment = src.search(/(^|\n)<!--\s*widths:/);
      const table = tableTokenizer.start ? (tableTokenizer.start as (src: string) => number)(src) : -1;
      const at = comment < 0 ? -1 : comment + (src[comment] === '\n' ? 1 : 0);
      return at < 0 ? table : table < 0 ? at : Math.min(at, table);
    },
    tokenize(src, tokens, helper) {
      const firstLine = src.slice(0, src.indexOf('\n') + 1);
      const widths = firstLine ? parseTableWidths(firstLine) : null;
      if (!widths) return tableTokenizer.tokenize(src, tokens, helper);
      // 주석과 표 사이 빈 줄은 건너뜀 (손으로 고친 마크다운이나 예전 꼴)
      const gap = /^(?:[ \t]*\n)*/.exec(src.slice(firstLine.length))![0];
      const rest = src.slice(firstLine.length + gap.length);
      const table = tableTokenizer.tokenize(rest, tokens, helper) ?? helper.blockTokens(rest)[0];
      if (table?.type !== 'table' || !table.raw) return undefined;
      return { ...table, raw: src.slice(0, firstLine.length + gap.length + table.raw.length), widths };
    },
  },
  parseMarkdown(token, helpers) {
    const node = this.parent!(token, helpers) as JSONContent;
    const widths = (token as { widths?: number[] }).widths;
    const cols = node.content?.[0]?.content?.length ?? 0;
    return widths?.length === cols ? { ...node, attrs: { ...node.attrs, widths } } : node;
  },
  renderMarkdown(node, helpers) {
    const table = renderTableToMarkdown(node, helpers);
    const widths = (node.attrs?.widths as number[] | null | undefined) ?? null;
    // 표 마크다운 앞에 붙는 빈 줄을 떼어 주석 바로 다음 줄에 표가 오게 함
    return widths?.length && table ? `${tableWidthsComment(widths)}\n${table.replace(/^\n+/, '')}` : table;
  },
});

const EMPTY_HINT = '이야기를 적어 보세요. # 제목, - 목록, > 💡 콜아웃, ``` 코드처럼 치면 바로 바뀌고, 사진은 붙여넣거나 끌어다 놓으면 올라가요.';
const LINE_HINT = '# 제목, - 목록, > 인용, ``` 코드';

export function editorExtensions() {
  return [
    StarterKit.configure({
      heading: false,
      codeBlock: false,
      // 마크다운에 밑줄이 없어서 뺌
      underline: false,
      link: { openOnClick: false, autolink: true, linkOnPaste: true, defaultProtocol: 'https' },
      dropcursor: { color: 'var(--pen)', width: 2 },
    }),
    BlogHeading.configure({ levels: [1, 2, 3, 4] }),
    CodeBlockLowlight.configure({ lowlight: createLowlight(common), enableTabIndentation: true, tabSize: 2 }),
    TaskList,
    TaskItem.configure({ nested: true }),
    // 표는 칸 너비를 마크다운에 남기는 BlogTable 로 바꿔 끼움
    TableKit.configure({ table: false }),
    BlogTable.configure({ resizable: false }),
    TableKeys,
    TableFit,
    BlogImage.configure({ allowBase64: false }),
    CalloutLook,
    MarkdownLink,
    Placeholder.configure({
      placeholder: ({ editor, node }) => {
        if (node.type.name === 'heading') return `제목 ${node.attrs.level as number}`;
        if (node.type.name !== 'paragraph') return '';
        return editor.isEmpty ? EMPTY_HINT : LINE_HINT;
      },
    }),
    // 예전 줄글처럼 한 줄씩 바꾼 글도 줄바꿈을 살려 읽음 (읽는 화면의 remark-breaks 와 같게)
    Markdown.configure({ markedOptions: { gfm: true, breaks: true } }),
  ];
}
