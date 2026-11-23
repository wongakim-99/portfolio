import './link-card.css';

export interface LinkPreview {
  url: string;
  /** 사이트 이름 (앞의 www. 는 뺌) */
  host: string;
}

/** 글에 따로 붙인 링크. 서버가 남의 사이트를 읽어 오지 않으므로 사이트 이름과 주소만 쪽지처럼 보여 줌. 누르면 새 탭 */
export function LinkCard({ link }: { link: LinkPreview }) {
  const rest = link.url.replace(/^https?:\/\/(?:www\.)?/, '').slice(link.host.length) || '/';
  return (
    <a className="link-card" href={link.url} target="_blank" rel="noopener noreferrer nofollow ugc">
      <svg className="link-card-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
        <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
      </svg>
      <span className="link-card-text">
        <b>{link.host}</b>
        <span>{rest}</span>
      </span>
      <svg className="link-card-go" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 17 17 7M9 7h8v8" />
      </svg>
    </a>
  );
}
