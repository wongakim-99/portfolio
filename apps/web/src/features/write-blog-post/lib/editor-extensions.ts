import { Extension, InputRule, mergeAttributes, type JSONContent } from '@tiptap/core';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { Heading } from '@tiptap/extension-heading';
import { Image } from '@tiptap/extension-image';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { CellSelection, TableMap } from '@tiptap/pm/tables';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { StarterKit } from '@tiptap/starter-kit';
import { common, createLowlight } from 'lowlight';
import { CALLOUT_EMOJI } from '@entities/blog-post';

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

// 노션처럼 표 바로 아래 줄 맨 앞에서 Backspace 를 누르면 표 전체를 고르고, 한 번 더 누르면 표를 지움
// 두 번째는 TableKit 의 '모든 칸을 고르면 표를 지움'이 맡음. 그냥 두면 표는 앞 줄과 합쳐지지 않아 아무 일도 안 일어남
const TableBackspace = Extension.create({
  name: 'tableBackspace',
  // 다른 Backspace 처리(목록, 인용 풀기 등)보다 먼저 봄. 표 바로 아래가 아니면 그냥 넘김
  priority: 1000,
  addKeyboardShortcuts() {
    return {
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
    TableKit.configure({ table: { resizable: false } }),
    TableBackspace,
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
