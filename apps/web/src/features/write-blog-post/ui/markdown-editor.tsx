'use client';

import { useLayoutEffect, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from 'react';
import { errorMessage } from '@shared/api';
import { cx } from '@shared/lib';
import type { Status } from '@shared/ui';
import { BLOG_LIMITS, BlogMarkdown, uploadBlogImage } from '@entities/blog-post';
import { htmlToMarkdown, looksStructured } from '../lib/html-to-markdown';
import { continueList, insertBlock, prefixLines, wrap, type Edit } from '../lib/markdown-edit';
import { isImage, prepareImage } from '../lib/prepare-image';

type Tool = { label: string; hint: string; run: (text: string, start: number, end: number) => Edit };

const TABLE = '| 항목 | 내용 |\n| --- | --- |\n|  |  |';
// 도구 막대. 무리마다 사이를 띄움. 단축키가 있는 것은 hint 에 적음
const TOOLS: Tool[][] = [
  [
    { label: '제목1', hint: '# 큰 제목', run: (t, s, e) => prefixLines(t, s, e, '# ') },
    { label: '제목2', hint: '## 제목', run: (t, s, e) => prefixLines(t, s, e, '## ') },
    { label: '제목3', hint: '### 작은 제목', run: (t, s, e) => prefixLines(t, s, e, '### ') },
  ],
  [
    { label: '굵게', hint: '**굵게** (⌘B)', run: (t, s, e) => wrap(t, s, e, '**', '**', '굵은 글') },
    { label: '기울임', hint: '*기울임* (⌘I)', run: (t, s, e) => wrap(t, s, e, '*', '*', '기울인 글') },
    { label: '취소선', hint: '~~취소선~~', run: (t, s, e) => wrap(t, s, e, '~~', '~~', '지운 글') },
    { label: '코드', hint: '`인라인 코드` (⌘E)', run: (t, s, e) => wrap(t, s, e, '`', '`', 'code') },
    { label: '링크', hint: '[글](주소) (⌘K)', run: (t, s, e) => wrap(t, s, e, '[', '](https://)', '링크 글') },
  ],
  [
    { label: '인용', hint: '> 인용', run: (t, s, e) => prefixLines(t, s, e, '> ') },
    { label: '콜아웃', hint: '> 💡 노션 콜아웃', run: (t, s, e) => prefixLines(t, s, e, '> 💡 ') },
    { label: '목록', hint: '- 목록', run: (t, s, e) => prefixLines(t, s, e, '- ') },
    { label: '번호', hint: '1. 번호 목록', run: (t, s, e) => prefixLines(t, s, e, '1. ') },
    { label: '할 일', hint: '- [ ] 체크리스트', run: (t, s, e) => prefixLines(t, s, e, '- [ ] ') },
  ],
  [
    { label: '코드 블록', hint: '```언어 코드 블록', run: (t, s) => insertBlock(t, s, '```ts\n\n```', 6) },
    { label: '표', hint: '| 표 |', run: (t, s) => insertBlock(t, s, TABLE, 2) },
    { label: '구분선', hint: '---', run: (t, s) => insertBlock(t, s, '---') },
  ],
];

const SHORTCUTS: Record<string, Tool['run']> = {
  b: TOOLS[1]![0]!.run,
  i: TOOLS[1]![1]!.run,
  e: TOOLS[1]![3]!.run,
  k: TOOLS[1]![4]!.run,
};

// 붙여넣은 사진의 파일 이름이 뜻 없는 이름이면 설명(alt)을 비워 둠
const GENERIC_NAME = /^(?:image|img|photo|screenshot|스크린샷|화면 캡처|kakaotalk|dsc|pxl)[\s_\-\d.]*/i;
const altOf = (file: File) => {
  const name = file.name.replace(/\.[^.]+$/, '').trim();
  return !name || GENERIC_NAME.test(name) ? '' : name.replace(/[[\]]/g, '');
};

interface MarkdownEditorProps {
  value: string;
  /** 사진을 올리는 동안 다른 곳을 고쳐도 덮어쓰지 않게 늘 지금 본문을 받아 고침 */
  onChange: (update: (body: string) => string) => void;
  onStatus: (status: Status) => void;
}

/** 블로그 본문 편집기: 마크다운 도구 막대, 쓰기와 미리보기, 사진 올리기(버튼, 붙여넣기, 끌어다 놓기), 노션 붙여넣기 */
export function MarkdownEditor({ value, onChange, onStatus }: MarkdownEditorProps) {
  const area = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const pending = useRef<{ start: number; end: number } | null>(null);
  const uploads = useRef(0);
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [uploading, setUploading] = useState(0);
  const [dropping, setDropping] = useState(false);

  // 도구로 글을 고친 뒤 커서와 고른 범위를 되돌려 놓음
  useLayoutEffect(() => {
    const el = area.current;
    const range = pending.current;
    if (!el || !range) return;
    pending.current = null;
    el.focus();
    el.setSelectionRange(range.start, range.end);
  }, [value, mode]);

  function apply(run: Tool['run']) {
    const el = area.current;
    if (!el) return;
    const edit = run(el.value, el.selectionStart, el.selectionEnd);
    pending.current = { start: edit.start, end: edit.end };
    onChange(() => edit.text);
  }

  // 자리 글을 먼저 넣고, 사진을 줄여 올린 뒤 그 자리를 진짜 주소로 바꿈. 여러 장이면 같이 올림
  async function addImages(files: File[]) {
    const images = files.filter(isImage);
    if (!images.length) {
      onStatus({ message: 'JPG, PNG, WebP 같은 사진만 올릴 수 있습니다.', tone: 'error' });
      return;
    }
    if (mode !== 'write') setMode('write');
    const tokens = images.map(() => {
      uploads.current += 1;
      return `![사진 올리는 중 ${uploads.current}]()`;
    });
    // 고른 범위가 있으면 그 뒤에 넣음 (고른 글을 덮어쓰지 않게)
    apply((text, _start, end) => insertBlock(text, end, tokens.join('\n\n')));
    setUploading((count) => count + images.length);
    await Promise.all(
      images.map(async (file, index) => {
        const token = tokens[index]!;
        try {
          const { image } = await uploadBlogImage(await prepareImage(file));
          onChange((body) => body.replace(token, `![${altOf(file)}](${image.url})`));
        } catch (error) {
          onChange((body) => body.replace(token, '').replace(/\n{3,}/g, '\n\n'));
          onStatus({ message: `${file.name || '사진'}: ${errorMessage(error)}`, tone: 'error' });
        } finally {
          setUploading((count) => count - 1);
        }
      }),
    );
  }

  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // 한글을 조합하는 중에 누른 Enter 는 글자 확정이라 건드리지 않음
    if (event.nativeEvent.isComposing) return;
    const shortcut = (event.metaKey || event.ctrlKey) && !event.altKey ? SHORTCUTS[event.key.toLowerCase()] : undefined;
    if (shortcut) {
      event.preventDefault();
      apply(shortcut);
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
      const el = event.currentTarget;
      if (el.selectionStart !== el.selectionEnd) return;
      const edit = continueList(el.value, el.selectionStart);
      if (!edit) return;
      event.preventDefault();
      pending.current = { start: edit.start, end: edit.end };
      onChange(() => edit.text);
    }
  }

  function paste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = [...event.clipboardData.files];
    if (files.some(isImage)) {
      event.preventDefault();
      void addImages(files);
      return;
    }
    const html = event.clipboardData.getData('text/html');
    // VS Code 같은 편집기는 색만 입힌 HTML 을 같이 보내므로 그때는 평소처럼 글자로 붙임
    if (!html || event.clipboardData.types.includes('vscode-editor-data') || !looksStructured(html)) return;
    event.preventDefault();
    const plain = event.clipboardData.getData('text/plain');
    const el = event.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const put = (text: string) => {
      pending.current = { start: start + text.length, end: start + text.length };
      onChange((body) => body.slice(0, start) + text + body.slice(end));
    };
    htmlToMarkdown(html).then(
      ({ markdown, dropped }) => {
        put(markdown);
        onStatus(
          dropped
            ? { message: `노션 사진 ${dropped}장은 주소가 곧 막혀서 빼 두었어요. 표시한 자리에 사진을 다시 올려 주세요.`, tone: 'error' }
            : { message: '붙여 넣은 글을 마크다운으로 바꿨어요.', tone: 'ok' },
        );
      },
      () => put(plain),
    );
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    setDropping(false);
    const files = [...event.dataTransfer.files];
    if (!files.length) return;
    event.preventDefault();
    void addImages(files);
  }

  return (
    <div
      className={cx('md-editor', dropping && 'is-dropping')}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        setDropping(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropping(false);
      }}
      onDrop={drop}
    >
      <div className="md-toolbar">
        <div className="md-modes" role="tablist" aria-label="쓰기와 미리보기">
          {(['write', 'preview'] as const).map((item) => (
            <button key={item} type="button" role="tab" aria-selected={mode === item} className={cx('md-mode', mode === item && 'is-active')} onClick={() => setMode(item)}>
              {item === 'write' ? '쓰기' : '미리보기'}
            </button>
          ))}
        </div>
        {mode === 'write' && (
          <div className="md-tools" role="toolbar" aria-label="마크다운 도구">
            {TOOLS.map((group) => (
              <span key={group[0]!.label} className="md-tool-group">
                {group.map((tool) => (
                  <button key={tool.label} type="button" className="md-tool" title={tool.hint} onMouseDown={(event) => event.preventDefault()} onClick={() => apply(tool.run)}>
                    {tool.label}
                  </button>
                ))}
              </span>
            ))}
            <span className="md-tool-group">
              <button type="button" className="md-tool md-tool-photo" title="사진 올리기 (붙여넣기, 끌어다 놓기도 됨)" onClick={() => picker.current?.click()}>
                사진
              </button>
            </span>
          </div>
        )}
        {uploading > 0 && <span className="md-uploading">사진 {uploading}장 올리는 중</span>}
      </div>

      <label className="sr" htmlFor="blog-body">
        본문
      </label>
      <textarea
        ref={area}
        id="blog-body"
        className="blog-form-body"
        name="body"
        required
        hidden={mode !== 'write'}
        minLength={BLOG_LIMITS.bodyMin}
        maxLength={BLOG_LIMITS.bodyMax}
        rows={18}
        placeholder={'이야기를 적어 보세요.\n\n# 제목, **굵게**, - 목록, > 💡 콜아웃, ```코드``` 같은 마크다운을 쓸 수 있어요.\n사진은 붙여넣거나 끌어다 놓으면 올라가고, 노션 글을 복사해 붙이면 마크다운으로 바뀝니다.'}
        value={value}
        onChange={(event) => {
          const next = event.target.value;
          onChange(() => next);
        }}
        onKeyDown={keyDown}
        onPaste={paste}
      />
      {mode === 'preview' && (
        <div className="md-preview">{value.trim() ? <BlogMarkdown source={value} /> : <p className="community-empty">미리 볼 글이 없습니다.</p>}</div>
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
