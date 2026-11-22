// 블로그에 올릴 사진을 브라우저에서 다시 그림. 긴 쪽을 2000px 이하로 줄이고 WebP(안 되면 JPEG)로 구워서
// 촬영 위치 같은 사진 속 정보(EXIF)가 빠지고, 휴대폰 원본 사진도 1MB 안팎이 됨
const MAX_SIDE = 2000;
const QUALITY = 0.86;

const toBlob = (canvas: HTMLCanvasElement, type: string) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY));

export async function prepareImage(file: Blob): Promise<Blob> {
  // 사진에 적힌 회전 정보대로 똑바로 세워서 그림
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const webp = await toBlob(canvas, 'image/webp');
  if (webp?.type === 'image/webp') return webp;
  // WebP 로 못 굽는 브라우저는 JPEG. 투명한 곳은 검게 나오지 않게 흰 바탕을 먼저 깔아 둠
  const flat = document.createElement('canvas');
  flat.width = canvas.width;
  flat.height = canvas.height;
  const context = flat.getContext('2d')!;
  context.fillStyle = '#fff';
  context.fillRect(0, 0, flat.width, flat.height);
  context.drawImage(canvas, 0, 0);
  const jpeg = await toBlob(flat, 'image/jpeg');
  if (!jpeg) throw new Error('사진을 읽지 못했습니다.');
  return jpeg;
}

export const isImage = (file: File) => /^image\/(?:jpeg|png|webp|gif|heic|heif|avif|bmp)$/.test(file.type);
