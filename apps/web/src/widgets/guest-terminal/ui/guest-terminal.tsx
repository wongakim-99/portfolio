'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { routes } from '@shared/config';
import { download, prefersReducedMotion } from '@shared/lib';
import { Dialog } from '@shared/ui';
import { toggleTheme } from '@features/theme-toggle';
import { PORTFOLIO_PDF } from '@entities/portfolio';
import type { ServerSnapshot } from '@entities/server-status';
import { complete, isPortfolioSection, runCommand, type TerminalContext } from '../model/commands';
import './guest-terminal.css';

interface Line {
  id: number;
  text: string;
  tone: '' | 't-cmd' | 't-dim' | 't-ok';
}

interface GuestTerminalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** neofetch, uptime 이 쓰는 서버 상태. 마지막 요청이 실패했으면 null */
  server: ServerSnapshot | null;
  onHighFive: () => void;
}

const PROMPT = 'guest@gawon-dev:~$';

// 숨은 터미널. ` 키나 아래쪽 버튼으로 열기
export function GuestTerminal({ open, onOpenChange, server, onHighFive }: GuestTerminalProps) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState('');
  const lineId = useRef(0);
  const greeted = useRef(false);
  const history = useRef<string[]>([]);
  const historyIndex = useRef(0);
  const latestServer = useRef(server);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    latestServer.current = server;
  }, [server]);

  const write = useCallback((text: string, tone: Line['tone'] = '') => {
    setLines((list) => [...list, { id: ++lineId.current, text, tone }]);
  }, []);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [lines]);

  useEffect(() => {
    if (!open) return;
    if (!greeted.current) {
      greeted.current = true;
      write('gawon-dev 에 오신 걸 환영해요. help 를 입력하면 쓸 수 있는 명령이 나와요.', 't-ok');
    }
    inputRef.current?.focus();
  }, [open, write]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const typing = event.target instanceof Element && event.target.closest('input, textarea, [contenteditable]');
      if (event.key === '`' && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        onOpenChange(true);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onOpenChange]);

  const context: TerminalContext = {
    server: () => latestServer.current,
    highFive: onHighFive,
    toggleLamp: toggleTheme,
    downloadPdf: () => download(PORTFOLIO_PDF.href, PORTFOLIO_PDF.filename),
    go: (section) => {
      onOpenChange(false);
      if (isPortfolioSection(section)) router.push(`${routes.portfolio}#${section}`);
      else document.getElementById(section)?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    },
    clear: () => setLines([]),
    close: () => onOpenChange(false),
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const line = input;
    setInput('');
    write(`${PROMPT} ${line}`, 't-cmd');
    if (line.trim()) {
      history.current.push(line);
      historyIndex.current = history.current.length;
    }
    const result = await runCommand(line, context);
    if (result?.text) write(result.text, result.known ? '' : 't-dim');
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowUp' && historyIndex.current > 0) {
      event.preventDefault();
      setInput(history.current[--historyIndex.current] ?? '');
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      historyIndex.current = Math.min(historyIndex.current + 1, history.current.length);
      setInput(history.current[historyIndex.current] ?? '');
    } else if (event.key === 'Tab') {
      event.preventDefault();
      setInput(complete(input));
    }
  }

  return (
    <Dialog open={open} onClose={() => onOpenChange(false)} className="term" labelledBy="term-title">
      <div className="term-bar">
        <span id="term-title">guest@gawon-dev: ~</span>
        <button className="term-close" type="button" onClick={() => onOpenChange(false)}>
          닫기
        </button>
      </div>
      <div className="term-body" ref={bodyRef}>
        <div className="term-out" aria-live="polite">
          {lines.map((line) => (
            <div key={line.id} className={line.tone || undefined}>
              {line.text}
            </div>
          ))}
        </div>
        <form className="term-line" onSubmit={submit}>
          <label htmlFor="term-input" className="term-prompt">
            {PROMPT}
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
      </div>
    </Dialog>
  );
}
