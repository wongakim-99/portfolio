import {
  BadRequestException, Injectable, NotFoundException, PayloadTooLargeException, ServiceUnavailableException, UnsupportedMediaTypeException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { imageInfo } from '../../../shared/domain/image-info.js';
import { ObjectStorage } from '../../../shared/infrastructure/storage/object-storage.js';
import {
  FEED_IMAGE_FILE, FEED_IMAGE_MAX_BYTES, FEED_IMAGE_MAX_SIDE, feedImageKey, feedImageUrl, ORPHAN_AGE_MS, videoThumbnailKey, videoThumbnailUrl,
} from '../domain/feed-media.js';
import { YOUTUBE_ID, youtubeIdIn, type FeedVideo } from '../domain/feed.js';
import { FeedImageRepository, VideoCache, VideoSource } from '../domain/feed.ports.js';

const PHOTO_MISSING = '사진을 찾을 수 없습니다.';

/** 화면에 내보내는 사진과 영상 모양 */
export const photoView = (file: string) => ({ file, url: feedImageUrl(file) });
export const videoView = (video: FeedVideo | null) => video && { ...video, thumbnail: videoThumbnailUrl(video.id) };

// 피드 글의 사진과 유튜브 미리보기
// 사진: 회원이 올리고, 글을 저장할 때 그 글에 붙임. 글에서 뺀 사진, 지운 글의 사진, 하루 지나도 글에 안 붙은 사진은 저장소에서도 지움
// 유튜브: 제목과 채널은 한 번 읽어 DB 에, 썸네일은 한 번 받아 사진 저장소에 두고 다시 씀. 방문자 브라우저는 유튜브에 가지 않음
@Injectable()
export class FeedMediaService {
  constructor(
    private readonly images: FeedImageRepository,
    private readonly storage: ObjectStorage,
    private readonly videos: VideoCache,
    private readonly source: VideoSource,
  ) {}

  // 파일 내용으로 형식과 크기를 확인함. 확장자나 Content-Type 은 믿지 않음
  async uploadImage(body: unknown, ownerId: string) {
    if (!this.storage.ready) throw new ServiceUnavailableException('사진 저장소를 준비 중입니다.');
    if (!Buffer.isBuffer(body)) throw new UnsupportedMediaTypeException('JPG, PNG, WebP 사진만 올릴 수 있습니다.');
    if (body.length > FEED_IMAGE_MAX_BYTES) throw new PayloadTooLargeException('사진은 3MB 까지 올릴 수 있습니다.');
    const image = imageInfo(body);
    if (!image) throw new UnsupportedMediaTypeException('JPG, PNG, WebP 사진만 올릴 수 있습니다.');
    if (image.width < 1 || image.height < 1 || image.width > FEED_IMAGE_MAX_SIDE || image.height > FEED_IMAGE_MAX_SIDE) {
      throw new BadRequestException(`가로와 세로가 ${FEED_IMAGE_MAX_SIDE}px 이하인 사진을 올려 주세요.`);
    }
    const file = `${randomBytes(12).toString('hex')}.${image.ext}`;
    await this.storage.put(feedImageKey(file), body, image.type);
    await this.images.create({ file, size: body.length, ownerId });
    // 올릴 때마다 쓰다 만 글의 오래된 사진을 치움. 못 치워도 다음에 다시 함
    this.sweep().catch(() => {});
    return { ...photoView(file), width: image.width, height: image.height };
  }

  readImage(file: string): Promise<Readable> {
    if (!FEED_IMAGE_FILE.test(file)) throw new NotFoundException(PHOTO_MISSING);
    return this.storage.get(feedImageKey(file));
  }

  /** 글에 고른 사진을 붙임. 내가 올렸고 아직 다른 글에 붙지 않은 사진만 붙고, 붙은 사진을 고른 순서대로 돌려줌 */
  attach(postId: string, files: string[], ownerId: string): Promise<string[]> {
    return this.images.attach(files, postId, ownerId);
  }

  /** 글을 저장한 뒤 부름. 이 글에 붙어 있던 사진 가운데 keep 에 없는 것은 저장소에서도 지움 */
  async prune(postId: string, keep: string[]): Promise<void> {
    const kept = new Set(keep);
    await this.discard((await this.images.filesForPost(postId)).filter((file) => !kept.has(file)));
  }

  async removeForPost(postId: string): Promise<void> {
    await this.discard(await this.images.filesForPost(postId));
  }

  /** 글 속 첫 유튜브 링크의 미리보기. 링크가 없으면 null, 유튜브에서 제목을 못 읽으면 제목 없이 */
  async videoFor(text: string): Promise<FeedVideo | null> {
    const id = youtubeIdIn(text);
    if (!id) return null;
    return { id, ...((await this.video(id)) ?? { title: null, author: null }) };
  }

  /** 영상 제목과 채널. 처음 묻는 영상만 유튜브에서 읽고, 읽은 것은 DB 에 남겨 다시 씀 */
  async video(id: string): Promise<{ title: string | null; author: string | null } | null> {
    if (!YOUTUBE_ID.test(id)) return null;
    const cached = await this.videos.find(id);
    if (cached) return cached;
    const meta = await this.source.meta(id);
    if (!meta) return null;
    await this.videos.save(id, meta);
    return meta;
  }

  /** 썸네일. 미리보기나 글로 한 번이라도 확인한 영상만 내보내서, 아무 ID 로 서버가 유튜브를 부르게 하지 못함 */
  async thumbnail(id: string): Promise<Readable> {
    if (!YOUTUBE_ID.test(id) || !(await this.videos.find(id))) throw new NotFoundException(PHOTO_MISSING);
    if (this.storage.ready) {
      try {
        return await this.storage.get(videoThumbnailKey(id));
      } catch (error) {
        if (!(error instanceof NotFoundException)) throw error;
      }
    }
    const image = await this.source.thumbnail(id);
    if (!image) throw new NotFoundException(PHOTO_MISSING);
    if (this.storage.ready) await this.storage.put(videoThumbnailKey(id), image, 'image/jpeg').catch(() => {});
    return Readable.from([image]);
  }

  private async sweep(): Promise<void> {
    await this.discard(await this.images.orphans(new Date(Date.now() - ORPHAN_AGE_MS)));
  }

  // 저장소에서 먼저 지우고 기록을 지움. 저장소에서 못 지운 사진은 기록이 남아 다음에 다시 지움
  private async discard(files: string[]): Promise<void> {
    if (!files.length || !this.storage.ready) return;
    const removed: string[] = [];
    for (const file of files) {
      try {
        await this.storage.remove(feedImageKey(file));
        removed.push(file);
      } catch (error) {
        if (error instanceof NotFoundException) removed.push(file);
      }
    }
    await this.images.delete(removed);
  }
}
