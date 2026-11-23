// 피드 글에 붙는 사진과 유튜브 썸네일. 둘 다 사진 저장소(MinIO)에 두고 API 가 내보냄
// 사진은 feed/ 아래 무작위 파일 이름, 썸네일은 youtube/ 아래 영상 ID 로 한 번 받아 두고 다시 쓰지 않음

export const FEED_IMAGE_FILE = /^[a-f\d]{24}\.(?:jpg|png|webp)$/;
/** 브라우저가 긴 변 1600px WebP 로 줄여 올리므로 보통 수백 KB. 원본을 그대로 보내도 여기까지는 받음 */
export const FEED_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export const FEED_IMAGE_MAX_SIDE = 4096;
export const FEED_IMAGE_TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;
/** 글에 붙지 않은 채 이만큼 지난 사진은 쓰다 만 글의 것으로 보고 지움 */
export const ORPHAN_AGE_MS = 24 * 60 * 60_000;

export const feedImageKey = (file: string) => `feed/${file}`;
export const feedImageUrl = (file: string) => `/api/community/images/${file}`;

/** 유튜브 썸네일은 방문자 브라우저가 유튜브에 직접 가지 않도록 API 가 받아 둔 것을 내보냄 */
export const videoThumbnailKey = (id: string) => `youtube/${id}.jpg`;
export const videoThumbnailUrl = (id: string) => `/api/community/videos/${id}/thumbnail`;
/** 썸네일 한 장의 최대 크기. 유튜브 hqdefault 는 보통 30KB 안팎 */
export const VIDEO_THUMBNAIL_MAX_BYTES = 1024 * 1024;
