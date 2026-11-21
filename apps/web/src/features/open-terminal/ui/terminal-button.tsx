'use client';

import { openTerminal } from '../model/terminal-open';
import './terminal-button.css';

/** 상단 바의 작은 터미널 창 모양 버튼. 키보드에서는 ` 키로도 열림 */
export function TerminalButton() {
  return (
    <button className="terminal-pill" type="button" onClick={openTerminal} aria-label="터미널 열기" aria-keyshortcuts="`">
      <span className="terminal-pill-glyph" aria-hidden="true">
        &gt;<i />
      </span>
      <span className="terminal-pill-text">터미널</span>
      <kbd aria-hidden="true">`</kbd>
    </button>
  );
}
