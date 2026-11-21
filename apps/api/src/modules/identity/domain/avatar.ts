// 프로필 사진. 바꿀 때마다 새 파일 이름을 써서 브라우저가 오래 캐시해도 됨
export const AVATAR_FILE = /^[a-f\d]{24}-[a-f\d]{16}\.(?:jpg|png|webp)$/;
export const AVATAR_MAX_SIDE = 2048;
export const AVATAR_TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;

export const avatarKey = (file: string) => `avatars/${file}`;

export function avatarUrl(file?: string | null): string | null {
  return file ? `/api/community/avatars/${file}` : null;
}
