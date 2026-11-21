// 고른 사진을 가운데 기준 정사각형으로 잘라 512px 이하로 다시 그림
// 다시 그리면서 촬영 위치 같은 사진 속 정보(EXIF)는 빠지고 파일도 작아짐

const MAX_SIDE = 512;

function loadImage(file: Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이 사진은 열 수 없습니다. JPG나 PNG 사진으로 골라 주세요.'));
    };
    image.src = url;
  });
}

/** WebP 로 만들고, 브라우저가 WebP 를 못 만들면 JPG 로 만듦. 실패하면 null */
export async function squarePhoto(file: Blob): Promise<Blob | null> {
  const image = await loadImage(file);
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  const size = Math.min(MAX_SIDE, side);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size, size);
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, size, size);
  const encode = (type: string, quality: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  const webp = await encode('image/webp', 0.86);
  return webp?.type === 'image/webp' ? webp : encode('image/jpeg', 0.88);
}
