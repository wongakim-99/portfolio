// 올라온 파일의 앞부분만 읽어 형식과 가로세로 크기를 알아냄. 확장자나 Content-Type 은 믿지 않음
// 크기를 미리 보는 건 작은 파일로 아주 큰 그림을 만들어 보는 사람의 브라우저를 멈추게 하는 걸 막으려는 것
export type ImageInfo = { type: 'image/jpeg' | 'image/png' | 'image/webp'; ext: 'jpg' | 'png' | 'webp'; width: number; height: number };

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function png(data: Buffer): ImageInfo | null {
  if (data.length < 24 || !data.subarray(0, 8).equals(PNG_SIGNATURE) || data.toString('latin1', 12, 16) !== 'IHDR') return null;
  return { type: 'image/png', ext: 'png', width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

function jpeg(data: Buffer): ImageInfo | null {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < data.length) {
    if (data[offset] !== 0xff) return null;
    const marker = data[offset + 1];
    if (marker === 0xff) { offset += 1; continue; }
    const length = data.readUInt16BE(offset + 2);
    // SOF0~SOF15 중 DHT(C4), JPG(C8), DAC(CC) 를 뺀 것이 크기를 담은 프레임 머리
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { type: 'image/jpeg', ext: 'jpg', width: data.readUInt16BE(offset + 7), height: data.readUInt16BE(offset + 5) };
    }
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}

function webp(data: Buffer): ImageInfo | null {
  if (data.length < 30 || data.toString('latin1', 0, 4) !== 'RIFF' || data.toString('latin1', 8, 12) !== 'WEBP') return null;
  const chunk = data.toString('latin1', 12, 16);
  const info = (width: number, height: number): ImageInfo => ({ type: 'image/webp', ext: 'webp', width, height });
  if (chunk === 'VP8 ') return info(data.readUInt16LE(26) & 0x3fff, data.readUInt16LE(28) & 0x3fff);
  if (chunk === 'VP8L') {
    const bits = data.readUInt32LE(21);
    return info((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
  }
  if (chunk === 'VP8X') return info(data.readUIntLE(24, 3) + 1, data.readUIntLE(27, 3) + 1);
  return null;
}

export function imageInfo(data: Buffer): ImageInfo | null {
  return png(data) ?? jpeg(data) ?? webp(data);
}
