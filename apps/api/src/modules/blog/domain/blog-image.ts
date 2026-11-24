// 블로그 사진과 본문 마크다운. 사진은 사진 저장소(MinIO)의 blog/ 아래에 두고 API 가 /api/blog/images/<파일> 로 내보냄
// 파일 이름은 무작위라 주소를 모르면 볼 수 없음. 잠긴 글의 사진도 본문을 못 받는 사람은 주소를 알 길이 없음

export const BLOG_IMAGE_FILE = /^[a-f\d]{24}\.(?:jpg|png|webp)$/;
/** 브라우저가 줄여서 올리므로 보통 1MB 안팎. 원본을 그대로 올려도 여기까지는 받음 */
export const BLOG_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const BLOG_IMAGE_MAX_SIDE = 4096;
export const BLOG_IMAGE_TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;
/** 글에 붙지 않은 채 이만큼 지난 사진은 쓰다 버린 글의 것으로 보고 지움. 서버 임시 글에 든 사진은 빼고 셈 */
export const ORPHAN_AGE_MS = 7 * 24 * 60 * 60_000;

export const blogImageKey = (file: string) => `blog/${file}`;
export const blogImageUrl = (file: string) => `/api/blog/images/${file}`;

const IMAGE_URL = /\/api\/blog\/images\/([a-f\d]{24}\.(?:jpg|png|webp))/g;

/** 본문과 표지에서 쓰는 블로그 사진 파일. 나온 순서대로, 겹치지 않게 */
export function imagesIn(body: string, cover: string | null = null): string[] {
  const files = [...body.matchAll(IMAGE_URL)].map((match) => match[1]!);
  return [...new Set(cover ? [cover, ...files] : files)];
}

/** 본문에 처음 나오는 블로그 사진. 표지를 따로 고르지 않은 글의 썸네일로 씀 */
export const firstImage = (body: string): string | null => imagesIn(body)[0] ?? null;

const ENTITIES: Record<string, string> = { nbsp: ' ', lt: '<', gt: '>', amp: '&', quot: '"', '#39': "'" };

// 목록 미리보기와 읽는 시간에 쓸 글자만 남김. 마크다운 기호, 사진, 코드 울타리, 링크 주소를 걷어냄
export function plainText(markdown: string): string {
  return markdown
    .replace(/```[^\n]*\n([\s\S]*?)```/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/gm, '')
    .replace(/^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{0,}:?\s*$/gm, ' ')
    .replace(/\|/g, ' ')
    .replace(/^\s*(?:---|\*\*\*|___)\s*$/gm, ' ')
    .replace(/(\*\*|__|~~|`)/g, '')
    // *기울임* 은 뒤에 조사나 문장부호가 붙어도 기울임 (_기울임_ 은 낱말 경계에서만)
    .replace(/\*(?![\s*])([^*\n]*?[^\s*\\])\*/g, '$1')
    .replace(/(^|[^\p{L}\p{N}_])_(?![\s_])([^_\n]*?[^\s_])_(?![\p{L}\p{N}_])/gu, '$1$2')
    // 편집기가 글자 그대로 쓴 기호(\*)와 빈 줄(&nbsp;) 같은 표기를 글자로 되돌림
    .replace(/\\([\\`*_{}[\]()#+\-.!|~>])/g, '$1')
    .replace(/&(nbsp|lt|gt|amp|quot|#39);/g, (_entity, name: string) => ENTITIES[name] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
