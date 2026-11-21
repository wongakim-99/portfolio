import { Fragment } from 'react';
import type { RichText as RichTextValue } from '../model/content';

export function RichText({ value }: { value: RichTextValue }) {
  if (typeof value === 'string') return value;
  return value.map((part, index) => {
    if (typeof part === 'string') return <Fragment key={index}>{part}</Fragment>;
    if ('mark' in part) return <mark key={index}>{part.mark}</mark>;
    return (
      <span key={index} className="pen">
        {part.pen}
      </span>
    );
  });
}

