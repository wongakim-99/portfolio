import { Injectable } from '@nestjs/common';
import { imageInfo } from '../../../shared/domain/image-info.js';
import { VIDEO_THUMBNAIL_MAX_BYTES } from '../domain/feed-media.js';
import { YOUTUBE_ID } from '../domain/feed.js';
import { VideoSource } from '../domain/feed.ports.js';

// 유튜브에서 영상 제목, 채널(oEmbed, 키 없이 씀)과 썸네일을 읽음. 주소는 정해 둔 두 곳뿐이고 영상 ID 는 11자만 받아서
// 방문자가 넣은 주소로 서버가 아무 데나 요청하지 않음. 돌아가는 주소(리다이렉트)도 따라가지 않음
const OEMBED_URL = 'https://www.youtube.com/oembed';
const THUMBNAIL_URL = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
const TIMEOUT_MS = 5000;
const META_MAX_BYTES = 64 * 1024;

// 응답을 끝까지 받되 한도를 넘으면 그만 받음
async function readLimited(response: Response, max: number): Promise<Buffer | null> {
  const length = Number(response.headers.get('content-length'));
  if (length > max) {
    await response.body?.cancel();
    return null;
  }
  const body = Buffer.from(await response.arrayBuffer());
  return body.length > max ? null : body;
}

@Injectable()
export class YoutubeVideoSource extends VideoSource {
  async meta(id: string) {
    if (!YOUTUBE_ID.test(id)) return null;
    const query = new URLSearchParams({ url: `https://www.youtube.com/watch?v=${id}`, format: 'json' });
    try {
      const response = await fetch(`${OEMBED_URL}?${query}`, { redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!response.ok) {
        await response.body?.cancel();
        return null;
      }
      const body = await readLimited(response, META_MAX_BYTES);
      const data = body && (JSON.parse(body.toString('utf8')) as { title?: unknown; author_name?: unknown });
      if (!data || typeof data.title !== 'string') return null;
      return { title: data.title.slice(0, 200), author: typeof data.author_name === 'string' ? data.author_name.slice(0, 100) : '' };
    } catch {
      return null;
    }
  }

  async thumbnail(id: string) {
    if (!YOUTUBE_ID.test(id)) return null;
    try {
      const response = await fetch(THUMBNAIL_URL(id), { redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!response.ok) {
        await response.body?.cancel();
        return null;
      }
      const body = await readLimited(response, VIDEO_THUMBNAIL_MAX_BYTES);
      // 받은 파일이 정말 JPG 인지 내용으로 다시 확인함
      return body && imageInfo(body)?.type === 'image/jpeg' ? body : null;
    } catch {
      return null;
    }
  }
}
