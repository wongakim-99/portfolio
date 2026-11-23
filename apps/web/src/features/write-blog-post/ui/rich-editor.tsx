'use client';

import { TextSelection } from '@tiptap/pm/state';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { errorMessage } from '@shared/api';
import { cx, isImage, prepareImage } from '@shared/lib';
import type { Status } from '@shared/ui';
import { BLOG_LIMITS, CALLOUT_EMOJI, uploadBlogImage } from '@entities/blog-post';
import { editorExtensions } from '../lib/editor-extensions';
import { htmlToMarkdown, looksStructured } from '../lib/html-to-markdown';
import { looksLikeMarkdown, vscodeLanguage } from '../lib/paste-kind';

type Tool = { label: string; hint: string; active?: (editor: Editor) => boolean; run: (editor: Editor) => void };

const focus = (editor: Editor) => editor.chain().focus();

// 콜아웃: 인용으로 감싸고 첫 줄 앞에 💡 를 붙임. 이미 이모지로 시작하면 그대로 둠
function toggleCallout(editor: Editor) {
  focus(editor)
    .command(({ tr, commands }) => {
      if (!editor.isActive('blockquote')) commands.wrapIn('blockquote');
      const { $from } = tr.selection;
      if (!CALLOUT_EMOJI.test($from.parent.textContent)) tr.insertText('💡 ', $from.start());
      return true;
    })
    .run();
}

// 도구 막대. 무리마다 사이를 띄움. 같은 일을 마크다운으로 바로 칠 수도 있어서 hint 에 적어 둠
const TOOLS: Tool[][] = [
  [1, 2, 3].map((level) => ({
    label: `제목${level}`,
    hint: `${'#'.repeat(level)} 와 띄어쓰기`,
    active: (editor: Editor) => editor.isActive('heading', { level }),
    run: (editor: Editor) => focus(editor).toggleHeading({ level: level as 1 | 2 | 3 }).run(),
  })),
  [
    { label: '굵게', hint: '**굵게** (⌘B)', active: (e) => e.isActive('bold'), run: (e) => focus(e).toggleBold().run() },
    { label: '기울임', hint: '*기울임* (⌘I)', active: (e) => e.isActive('italic'), run: (e) => focus(e).toggleItalic().run() },
    { label: '취소선', hint: '~~취소선~~ (⌘⇧S)', active: (e) => e.isActive('strike'), run: (e) => focus(e).toggleStrike().run() },
    { label: '코드', hint: '`인라인 코드` (⌘E)', active: (e) => e.isActive('code'), run: (e) => focus(e).toggleCode().run() },
  ],
  [
    { label: '인용', hint: '> 와 띄어쓰기', active: (e) => e.isActive('blockquote'), run: (e) => focus(e).toggleBlockquote().run() },
    { label: '콜아웃', hint: '> 💡 노션 콜아웃', run: toggleCallout },
    { label: '목록', hint: '- 와 띄어쓰기', active: (e) => e.isActive('bulletList'), run: (e) => focus(e).toggleBulletList().run() },
    { label: '번호', hint: '1. 과 띄어쓰기', active: (e) => e.isActive('orderedList'), run: (e) => focus(e).toggleOrderedList().run() },
    { label: '할 일', hint: '[ ] 와 띄어쓰기', active: (e) => e.isActive('taskList'), run: (e) => focus(e).toggleTaskList().run() },
  ],
  [
    { label: '코드 블록', hint: '```ts 와 띄어쓰기', active: (e) => e.isActive('codeBlock'), run: (e) => focus(e).toggleCodeBlock().run() },
    { label: '표', hint: '3줄 2칸 표', run: (e) => focus(e).insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run() },
    { label: '구분선', hint: '--- 를 치고 Enter', run: (e) => focus(e).setHorizontalRule().run() },
  ],
];
const ALL_TOOLS = TOOLS.flat();

// 표 안에 있을 때만 보이는 도구
const TABLE_TOOLS: Tool[] = [
  { label: '줄 추가', hint: '아래에 줄 추가', run: (e) => focus(e).addRowAfter().run() },
  { label: '칸 추가', hint: '오른쪽에 칸 추가', run: (e) => focus(e).addColumnAfter().run() },
  { label: '줄 지우기', hint: '이 줄 지우기', run: (e) => focus(e).deleteRow().run() },
  { label: '칸 지우기', hint: '이 칸 지우기', run: (e) => focus(e).deleteColumn().run() },
  { label: '표 지우기', hint: '표 전체 지우기', run: (e) => focus(e).deleteTable().run() },
];

// 붙여넣은 사진의 파일 이름이 뜻 없는 이름이면 설명(alt)을 비워 둠
const GENERIC_NAME = /^(?:image|img|photo|screenshot|스크린샷|화면 캡처|kakaotalk|dsc|pxl)[\s_\-\d.]*/i;
const altOf = (file: File) => {
  const name = file.name.replace(/\.[^.]+$/, '').trim();
  return !name || GENERIC_NAME.test(name) ? '' : name;
};

// 주소만 적으면 https 를 붙임. 사이트 안 주소(/..., #...)와 mailto 는 그대로
const normalizeHref = (href: string) => (/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(href) ? href : `https://${href}`);

// 진짜 주소의 사진을 미리 받아 둔 뒤에 바꿔서, 임시 사진에서 바뀔 때 깜빡이지 않게 함
const preload = (src: string) =>
  new Promise<void>((resolve) => {
    const image = new window.Image();
    image.onload = image.onerror = () => resolve();
    image.src = src;
  });

// 올리는 중인 사진을 찾아 진짜 주소로 바꾸거나(src) 지움(null). 되돌리기(⌘Z) 기록에는 남기지 않음
function finishUpload(editor: Editor, uploadId: string, src: string | null) {
  if (editor.isDestroyed) return;
  const { state, view } = editor;
  const hits: { pos: number; size: number; attrs: Record<string, unknown> }[] = [];
  state.doc.descendants((node, pos) => {
    if (node.type.name === 'image' && node.attrs.uploadId === uploadId) hits.push({ pos, size: node.nodeSize, attrs: node.attrs });
    return hits.length === 0;
  });
  // 올리는 동안 사진을 지웠으면 할 일 없음 (올라간 파일은 서버가 7일 뒤 치움)
  const hit = hits[0];
  if (!hit) return;
  const tr = state.tr.setMeta('addToHistory', false);
  if (src) tr.setNodeMarkup(hit.pos, undefined, { ...hit.attrs, src, uploadId: null });
  else tr.delete(hit.pos, hit.pos + hit.size);
  view.dispatch(tr);
}

interface EditorActions {
  change: (body: string) => void;
  addImages: (files: File[], at?: number) => void;
  paste: (event: ClipboardEvent) => boolean;
  openLink: () => void;
}

interface RichEditorProps {
  value: string;
  onChange: (body: string) => void;
  /** 올리는 중인 사진 수. 0 이 아니면 저장을 막음 */
  uploading: number;
  onUploading: (delta: number) => void;
  onStatus: (status: Status) => void;
}

/** 블로그 본문 편집기. 마크다운을 치면 노션처럼 바로 모양이 바뀌고, 사진은 붙여넣기(⌘V), 끌어다 놓기, 단추로 올림. 저장은 마크다운 */
export function RichEditor({ value, onChange, uploading, onUploading, onStatus }: RichEditorProps) {
  const [mode, setMode] = useState<'write' | 'source'>('write');
  const [linkDraft, setLinkDraft] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  // 편집기가 마지막으로 내보낸 마크다운. 바깥(마크다운 칸)에서 바뀐 값만 편집기에 다시 넣음
  const emitted = useRef(value);
  // 편집기 설정은 한 번만 만들어지므로, 붙여넣기 같은 처리는 늘 지금 함수를 부르게 ref 로 넘김
  const actions = useRef<EditorActions>({ change: onChange, addImages: () => {}, paste: () => false, openLink: () => {} });

  const editor = useEditor({
    extensions: editorExtensions(),
    content: value,
    contentType: 'markdown',
    immediatelyRender: false,
    editorProps: {
      attributes: { class: 'md md-live', 'aria-label': '본문', 'aria-multiline': 'true', role: 'textbox' },
      handlePaste: (_view, event) => actions.current.paste(event),
      handleDrop: (view, event, _slice, moved) => {
        const files = [...(event.dataTransfer?.files ?? [])].filter(isImage);
        if (moved || !files.length) return false;
        event.preventDefault();
        actions.current.addImages(files, view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos);
        return true;
      },
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k') {
          event.preventDefault();
          actions.current.openLink();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: current }) => {
      // 끝에 늘 붙는 빈 줄(편집기가 커서 자리로 둠)은 글자 수와 저장에서 뺌
      const markdown = current.getMarkdown().trimEnd();
      emitted.current = markdown;
      actions.current.change(markdown);
    },
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current
        ? { active: ALL_TOOLS.map((tool) => tool.active?.(current) ?? false), table: current.isActive('table'), link: current.isActive('link') }
        : null,
  });

  // 마크다운 칸에서 고친 글을 쓰기 칸으로 돌아올 때 편집기에 다시 넣음
  useEffect(() => {
    if (!editor || mode !== 'write' || value === emitted.current) return;
    emitted.current = value;
    editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false });
  }, [editor, mode, value]);

  // 사진은 고른 자리에 바로 보이고(임시 주소), 줄여 올린 뒤 진짜 주소로 바뀜. 여러 장이면 같이 올림
  async function addImages(files: File[], at?: number) {
    if (!editor) return;
    const images = files.filter(isImage);
    if (!images.length) {
      onStatus({ message: 'JPG, PNG, WebP 같은 사진만 올릴 수 있습니다.', tone: 'error' });
      return;
    }
    if (mode !== 'write') setMode('write');
    const items = images.map((file) => ({ file, id: crypto.randomUUID(), preview: URL.createObjectURL(file) }));
    const nodes = items.map(({ file, id, preview }) => ({ type: 'image', attrs: { src: preview, alt: altOf(file), uploadId: id } }));
    focus(editor)
      .insertContentAt(at ?? { from: editor.state.selection.from, to: editor.state.selection.to }, nodes)
      // 넣은 사진이 고른 상태로 남으면 이어 치는 글자가 사진을 덮어씀. 노션처럼 사진 아래 줄로 커서를 옮김
      .command(({ tr }) => {
        const after = tr.selection.to;
        if (tr.doc.resolve(after).nodeAfter?.type.name !== 'paragraph') tr.insert(after, tr.doc.type.schema.nodes.paragraph!.create());
        tr.setSelection(TextSelection.create(tr.doc, after + 1));
        return true;
      })
      .run();
    onUploading(items.length);
    await Promise.all(
      items.map(async ({ file, id, preview }) => {
        try {
          const { image } = await uploadBlogImage(await prepareImage(file));
          await preload(image.url);
          finishUpload(editor, id, image.url);
        } catch (error) {
          finishUpload(editor, id, null);
          onStatus({ message: `${file.name || '사진'}: ${errorMessage(error)}`, tone: 'error' });
        } finally {
          URL.revokeObjectURL(preview);
          onUploading(-1);
        }
      }),
    );
  }

  // 붙여넣기: 사진 파일은 올리고, 노션 같은 웹 글은 마크다운을 거쳐 넣고, 마크다운 글은 바로 모양을 입힘
  function paste(event: ClipboardEvent): boolean {
    const data = event.clipboardData;
    if (!editor || !data) return false;
    const files = [...data.files].filter(isImage);
    if (files.length) {
      void addImages(files);
      return true;
    }
    const html = data.getData('text/html');
    const text = data.getData('text/plain');
    // 편집기 안에서 복사한 것과 코드 블록 안에 붙이는 것은 편집기가 알아서 함
    if (html.includes('data-pm-slice') || editor.isActive('codeBlock')) return false;
    if (data.types.includes('vscode-editor-data')) {
      if (!text.includes('\n')) return false;
      const language = vscodeLanguage(data.getData('vscode-editor-data'));
      focus(editor).insertContent({ type: 'codeBlock', attrs: { language }, content: [{ type: 'text', text: text.replace(/\n$/, '') }] }).run();
      return true;
    }
    if (html && looksStructured(html)) {
      const { from, to } = editor.state.selection;
      const before = editor.state.doc;
      htmlToMarkdown(html).then(
        ({ markdown, dropped }) => {
          if (editor.isDestroyed) return;
          const range = editor.state.doc === before ? { from, to } : editor.state.selection;
          focus(editor).insertContentAt({ from: range.from, to: range.to }, markdown, { contentType: 'markdown' }).run();
          if (dropped) onStatus({ message: `노션 사진 ${dropped}장은 주소가 곧 막혀서 빼 두었어요. 표시한 자리에 사진을 다시 올려 주세요.`, tone: 'error' });
        },
        () => editor.view.pasteText(text),
      );
      return true;
    }
    if (!html && looksLikeMarkdown(text)) {
      focus(editor).insertContent(text, { contentType: 'markdown' }).run();
      return true;
    }
    return false;
  }

  function openLink() {
    if (!editor) return;
    setLinkDraft((editor.getAttributes('link').href as string | undefined) ?? '');
  }

  function applyLink(event: FormEvent) {
    event.preventDefault();
    if (!editor || linkDraft === null) return;
    const href = linkDraft.trim();
    const chain = focus(editor).extendMarkRange('link');
    if (!href) chain.unsetLink().run();
    else if (editor.state.selection.empty && !editor.isActive('link')) {
      const url = normalizeHref(href);
      chain.insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href: url } }] }).run();
    } else chain.setLink({ href: normalizeHref(href) }).run();
    setLinkDraft(null);
  }

  useLayoutEffect(() => {
    actions.current = { change: onChange, addImages: (files, at) => void addImages(files, at), paste, openLink };
  });

  const pressTool = (tool: Tool) => editor && tool.run(editor);

  return (
    <div
      className={cx('md-editor', dropping && 'is-dropping')}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) setDropping(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropping(false);
      }}
      onDrop={() => setDropping(false)}
    >
      <div className="md-toolbar">
        <div className="md-modes" role="tablist" aria-label="쓰기와 마크다운">
          {(['write', 'source'] as const).map((item) => (
            <button key={item} type="button" role="tab" aria-selected={mode === item} className={cx('md-mode', mode === item && 'is-active')} onClick={() => setMode(item)}>
              {item === 'write' ? '쓰기' : '마크다운'}
            </button>
          ))}
        </div>
        {mode === 'write' && linkDraft === null && (
          <div className="md-tools" role="toolbar" aria-label="글 모양">
            {TOOLS.map((group) => (
              <span key={group[0]!.label} className="md-tool-group">
                {group.map((tool) => {
                  const on = state?.active[ALL_TOOLS.indexOf(tool)] ?? false;
                  return (
                    <button
                      key={tool.label}
                      type="button"
                      className={cx('md-tool', on && 'is-on')}
                      title={tool.hint}
                      aria-pressed={tool.active ? on : undefined}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => pressTool(tool)}
                    >
                      {tool.label}
                    </button>
                  );
                })}
              </span>
            ))}
            <span className="md-tool-group">
              <button type="button" className={cx('md-tool', state?.link && 'is-on')} title="[글](주소) 또는 ⌘K" onMouseDown={(event) => event.preventDefault()} onClick={openLink}>
                링크
              </button>
              <button type="button" className="md-tool md-tool-photo" title="사진 올리기 (⌘V 로 붙여넣기, 끌어다 놓기도 됨)" onClick={() => picker.current?.click()}>
                사진
              </button>
            </span>
            {state?.table && (
              <span className="md-tool-group md-table-tools">
                {TABLE_TOOLS.map((tool) => (
                  <button key={tool.label} type="button" className="md-tool" title={tool.hint} onMouseDown={(event) => event.preventDefault()} onClick={() => pressTool(tool)}>
                    {tool.label}
                  </button>
                ))}
              </span>
            )}
          </div>
        )}
        {mode === 'write' && linkDraft !== null && (
          <form className="md-link-form" onSubmit={applyLink}>
            <input
              autoFocus
              type="text"
              inputMode="url"
              value={linkDraft}
              placeholder="링크 주소를 붙여 넣고 Enter"
              aria-label="링크 주소"
              onChange={(event) => setLinkDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setLinkDraft(null);
                  editor?.commands.focus();
                }
              }}
            />
            <button type="submit" className="md-tool is-on">
              {linkDraft.trim() ? '넣기' : '링크 빼기'}
            </button>
            <button type="button" className="md-tool" onClick={() => { setLinkDraft(null); editor?.commands.focus(); }}>
              그만두기
            </button>
          </form>
        )}
        {uploading > 0 && <span className="md-uploading">사진 {uploading}장 올리는 중</span>}
      </div>

      <EditorContent editor={editor} hidden={mode !== 'write'} />
      {mode === 'source' && (
        <>
          <label className="sr" htmlFor="blog-body">
            본문 마크다운
          </label>
          <textarea
            id="blog-body"
            className="blog-form-body"
            maxLength={BLOG_LIMITS.bodyMax}
            rows={18}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </>
      )}
      <input
        ref={picker}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = '';
          if (files.length) void addImages(files);
        }}
      />
    </div>
  );
}
