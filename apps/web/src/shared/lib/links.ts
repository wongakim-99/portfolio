// 회원이 쓴 글 속 링크. 화면에서 글자는 그대로 두고 http(s) 주소만 링크로 바꿈 (HTML 로 해석하지 않음)

// 주소 끝에 붙은 문장부호(마침표, 쉼표, 닫는 괄호 등)는 링크에서 뺌
const URL_PATTERN = /https?:\/\/[^\s<>"'`]+[^\s<>"'`.,;:!?)\]}]/g;

export type LinkPart = { text: string; href?: string };

/** 글을 글자 조각과 링크 조각으로 나눔 */
export function linkParts(text: string): LinkPart[] {
  const parts: LinkPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    parts.push({ text: match[0], href: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

// 유튜브 영상 주소: watch?v=, youtu.be/, shorts/, live/, embed/. 영상 ID 는 11자 (API 의 feed/domain/feed.ts 와 같은 규칙)
const YOUTUBE = /https?:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?(?:[^\s#]*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([\w-]{11})(?![\w-])/;

/** 글 속 첫 유튜브 영상 ID. 없으면 null */
export const youtubeIdIn = (text: string): string | null => YOUTUBE.exec(text)?.[1] ?? null;

/** 링크 칸에 넣은 주소를 카드 모양으로. http(s) 주소가 아니면 null (API 의 linkView 와 같은 모양) */
export function linkPreview(value: string): { url: string; host: string } | null {
  const url = value.trim();
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const { host } = new URL(url);
    return host.includes('.') ? { url, host: host.replace(/^www\./, '') } : null;
  } catch {
    return null;
  }
}
