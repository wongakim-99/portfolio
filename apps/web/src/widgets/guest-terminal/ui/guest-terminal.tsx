'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { download } from '@shared/lib';
import { Dialog } from '@shared/ui';
import { giveHighFive } from '@features/high-five';
import { closeTerminal, openTerminal, useTerminalOpen } from '@features/open-terminal';
import { toggleTheme } from '@features/theme-toggle';
import { christmasCountdown, isChristmasSeason } from '../lib/christmas-tree';
import { complete, runCommand, type Output, type Part, type TerminalContext } from '../model/commands';
import { dirForPathname, displayPath, pageOf, type FsPath } from '../model/filesystem';
import { ChristmasTree } from './christmas-tree';
import './guest-terminal.css';

interface Line {
  id: number;
  parts: Part[];
}

const toParts = (output: Output, tone?: Part['tone']): Part[] => (typeof output === 'string' ? [{ text: output, tone }] : output);
const promptOf = (cwd: FsPath) => `guest@gawon-dev:${displayPath(cwd)}$`;

// 숨은 터미널. app/layout.tsx 에 하나만 두고 어느 페이지에서든 상단 버튼이나 ` 키로 엶
// 페이지를 옮겨도 그대로 남아 있어서, 다시 열면 지난 기록과 지금 위치(~/portfolio 등)가 이어짐
export function GuestTerminal() {
  const router = useRouter();
  const pathname = usePathname();
  const open = useTerminalOpen();
  const [cwd, setCwd] = useState<FsPath>(() => dirForPathname(pathname));
  const [previousCwd, setPreviousCwd] = useState<FsPath | null>(null);
  const [seenPathname, setSeenPathname] = useState(pathname);
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState('');
  const [treeOn, setTreeOn] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const historyIndex = useRef(0);
  const lineId = useRef(0);
  const greeted = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 링크를 눌러 다른 페이지로 가면 위치도 그 페이지의 디렉터리로 맞춤. cd 로 온 곳이면 그대로 둠
  if (pathname !== seenPathname) {
    setSeenPathname(pathname);
    if (pageOf(cwd) !== pathname) setCwd(dirForPathname(pathname));
  }

  const write = (parts: Part[]) => setLines((list) => [...list, { id: ++lineId.current, parts }]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [lines]);

  useEffect(() => {
    if (!open) return;
    if (!greeted.current) {
      greeted.current = true;
      const hello: Part[] = [{ text: 'gawon-dev 에 오신 걸 환영해요. help 를 입력하면 쓸 수 있는 명령이 나와요.', tone: 'ok' }];
      if (isChristmasSeason()) hello.push({ text: '\n12월이니까 tree 도 한번 입력해 보세요.', tone: 'dim' });
      setLines((list) => [...list, { id: ++lineId.current, parts: hello }]);
    }
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const typing = event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]');
      if (event.key === '`' && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        openTerminal();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // 닫기 버튼, 바깥 클릭, exit. 트리가 돌고 있었으면 같이 끔
  function close() {
    setTreeOn(false);
    closeTerminal();
  }

  function stopTree() {
    setTreeOn(false);
    write([{ text: christmasCountdown(), tone: 'ok' }]);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  const context: TerminalContext = {
    cwd,
    previousCwd,
    changeDir: (path) => {
      setPreviousCwd(cwd);
      setCwd(path);
      const page = pageOf(path);
      if (page !== pathname) {
        router.push(page);
        closeTerminal();
      }
    },
    show: (href) => {
      router.push(href);
      closeTerminal();
    },
    download,
    history,
    highFive: giveHighFive,
    toggleLamp: toggleTheme,
    startTree: () => setTreeOn(true),
    clear: () => setLines([]),
    close,
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const line = input;
    setInput('');
    write([{ text: `${promptOf(cwd)} ${line}`, tone: 'cmd' }]);
    if (line.trim()) {
      setHistory((list) => [...list, line]);
      historyIndex.current = history.length + 1;
    }
    const result = await runCommand(line, { ...context, history: [...history, line] });
    if (!result) return;
    const parts = toParts(result.output, result.known ? undefined : 'dim');
    if (parts.some((part) => part.text)) write(parts);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowUp' && historyIndex.current > 0) {
      event.preventDefault();
      setInput(history[--historyIndex.current] ?? '');
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      historyIndex.current = Math.min(historyIndex.current + 1, history.length);
      setInput(history[historyIndex.current] ?? '');
    } else if (event.key === 'Tab') {
      event.preventDefault();
      const { value, candidates } = complete(input, cwd);
      setInput(value);
      if (candidates.length > 1) write([{ text: candidates.join('  '), tone: 'dim' }]);
    } else if (event.ctrlKey && event.key === 'c') {
      event.preventDefault();
      write([{ text: `${promptOf(cwd)} ${input}^C`, tone: 'cmd' }]);
      setInput('');
    } else if (event.ctrlKey && event.key === 'l') {
      event.preventDefault();
      setLines([]);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      // 트리가 도는 중에 Esc 를 누르면 터미널은 두고 트리만 끔
      onCancel={(event) => {
        if (!treeOn) return;
        event.preventDefault();
        stopTree();
      }}
      className="term"
      labelledBy="term-title"
    >
      <div className="term-bar">
        <span id="term-title">guest@gawon-dev: {displayPath(cwd)}</span>
        <button className="term-close" type="button" onClick={close}>
          닫기
        </button>
      </div>
      <div className="term-body" ref={bodyRef}>
        {treeOn ? (
          <ChristmasTree onExit={stopTree} />
        ) : (
          <>
            <div className="term-out" aria-live="polite">
              {lines.map((line) => (
                <div key={line.id}>
                  {line.parts.map((part, index) => (
                    <span key={index} className={part.tone ? `t-${part.tone}` : undefined}>
                      {part.text}
                    </span>
                  ))}
                </div>
              ))}
            </div>
            <form className="term-line" onSubmit={submit}>
              <label htmlFor="term-input" className="term-prompt">
                {promptOf(cwd)}
              </label>
              <input
                ref={inputRef}
                id="term-input"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={onKeyDown}
              />
            </form>
          </>
        )}
      </div>
    </Dialog>
  );
}
