import { Injectable } from '@nestjs/common';
import { videoThumbnailUrl } from '../domain/feed-media.js';
import { youtubeIdsIn, type FeedVideo } from '../domain/feed.js';
import { VideoCache } from '../domain/feed.ports.js';
import { FeedMediaService } from './feed-media.service.js';

/** 글 속 유튜브 영상 하나의 미리보기. thumbnail 은 우리 API 가 받아 둔 썸네일 주소 */
export type VideoPreview = FeedVideo & { thumbnail: string };

// 글 하나에서 미리보기로 보여 줄 영상 수. 저장할 때 유튜브를 이만큼까지만 부름
const MAX_VIDEOS = 10;

// 다른 영역(블로그)이 글 속 유튜브 링크를 피드와 같은 카드로 보여 줄 때 쓰는 창구. 제목, 채널, 썸네일은 피드와 같은 캐시를 씀
// 유튜브는 글을 저장할 때만 부르고, 글을 읽을 때는 이미 확인한 영상만 꺼냄. 죽은 링크가 글 읽기를 늦추지 않게
@Injectable()
export class VideoPreviews {
  constructor(
    private readonly media: FeedMediaService,
    private readonly cache: VideoCache,
  ) {}

  /** 글을 저장할 때 부름. 처음 보는 영상만 유튜브에서 제목을 읽어 둠. 못 읽어도 글 저장은 그대로 */
  async remember(text: string): Promise<void> {
    await Promise.all(youtubeIdsIn(text, MAX_VIDEOS).map((id) => this.media.video(id).catch(() => null)));
  }

  /** 글 속 영상 가운데 확인해 둔 것만. 유튜브는 부르지 않음 */
  async known(text: string): Promise<VideoPreview[]> {
    const found = await Promise.all(youtubeIdsIn(text, MAX_VIDEOS).map(async (id) => {
      const meta = await this.cache.find(id);
      return meta && { id, title: meta.title, author: meta.author, thumbnail: videoThumbnailUrl(id) };
    }));
    return found.filter((video) => video !== null);
  }
}
