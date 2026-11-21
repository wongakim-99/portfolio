'use client';

import { useEffect, useRef, useState } from 'react';
import './copy-email.css';

const LABEL = { idle: '복사', copied: '복사됨', selected: '선택됨' } as const;

/** 메일 주소 링크와 복사 버튼. 클립보드가 막혀 있으면 주소 글자를 선택해 둠 */
export function CopyEmail({ email }: { email: string }) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const [state, setState] = useState<keyof typeof LABEL>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const timer = setTimeout(() => setState('idle'), 1600);
    return () => clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(email);
      setState('copied');
    } catch {
      const selection = getSelection();
      if (linkRef.current && selection) {
        const range = document.createRange();
        range.selectNodeContents(linkRef.current);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      setState('selected');
    }
  }

  return (
    <>
      <a ref={linkRef} href={`mailto:${email}`}>
        {email}
      </a>
      <button className="copy" type="button" onClick={copy}>
        {LABEL[state]}
      </button>
    </>
  );
}
