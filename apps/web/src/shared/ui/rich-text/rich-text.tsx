import { linkParts } from '@shared/lib';

/** 회원이 쓴 글. 줄바꿈은 쓴 그대로 두고 http(s) 주소만 새 탭 링크로 바꿈. 글은 React 글자 노드로만 그림 */
export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <p className={className}>
      {linkParts(text).map((part, index) =>
        part.href ? (
          <a key={index} href={part.href} target="_blank" rel="noopener noreferrer nofollow ugc">
            {part.text}
          </a>
        ) : (
          part.text
        ),
      )}
    </p>
  );
}
