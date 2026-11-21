'use client';

import { useState, type KeyboardEvent } from 'react';
import { BLOG_LIMITS } from '@entities/blog-post';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

const clean = (raw: string) => raw.replace(/^#+/, '').trim().replace(/\s+/g, ' ');

/** 태그 입력. Enter 나 쉼표로 붙이고, 빈 칸에서 Backspace 로 마지막 태그를 뗌. 붙은 태그를 누르면 뺌 */
export function TagInput({ tags, onChange }: TagInputProps) {
  const [text, setText] = useState('');
  const full = tags.length >= BLOG_LIMITS.tagMax;

  function add(raw: string) {
    const tag = clean(raw);
    setText('');
    if (!tag || full || tags.some((item) => item.toLowerCase() === tag.toLowerCase())) return;
    onChange([...tags, tag.slice(0, BLOG_LIMITS.tagLength)]);
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    // 한글을 조합하는 중에 누른 Enter 는 글자를 마무리하는 키라서 넘김
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      add(text);
    } else if (event.key === 'Backspace' && !text && tags.length) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div className="tag-input">
      {tags.map((tag) => (
        <button key={tag} className="blog-tag tag-input-chip" type="button" aria-label={`${tag} 태그 빼기`} onClick={() => onChange(tags.filter((item) => item !== tag))}>
          {tag}
          <span aria-hidden="true">×</span>
        </button>
      ))}
      <input
        id="blog-tags"
        value={text}
        maxLength={BLOG_LIMITS.tagLength}
        disabled={full}
        placeholder={full ? `태그는 ${BLOG_LIMITS.tagMax}개까지` : tags.length ? '태그 더하기' : '태그를 쓰고 Enter'}
        autoComplete="off"
        onChange={(event) => (event.target.value.includes(',') ? add(event.target.value.replace(',', '')) : setText(event.target.value))}
        onKeyDown={keyDown}
        onBlur={() => text && add(text)}
      />
    </div>
  );
}
