'use client';

import { toggleTheme, useDarkTheme } from '../model/theme';
import './lamp-button.css';

export function LampButton() {
  const dark = useDarkTheme();
  return (
    <button className="lamp" type="button" aria-pressed={!dark} onClick={toggleTheme}>
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path className="lamp-shade" d="M9 4h10l5 9H4z" />
        <path className="lamp-arm" d="M14 13v8l-5 6m5-6 6 6M6 28h16" />
        <circle className="lamp-bulb" cx="14" cy="15" r="2.2" />
      </svg>
      <span className="lamp-text">{dark ? '스탠드 켜기' : '스탠드 끄기'}</span>
    </button>
  );
}
