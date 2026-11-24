import {
  BadRequestException, Injectable, NotFoundException, PayloadTooLargeException, ServiceUnavailableException, UnsupportedMediaTypeException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Readable } from 'node:stream';
import { imageInfo } from '../../../shared/domain/image-info.js';
import { ObjectStorage } from '../../../shared/infrastructure/storage/object-storage.js';
import { BlogDraftRepository, BlogImageRepository } from '../domain/blog.ports.js';
import {
  BLOG_IMAGE_FILE, BLOG_IMAGE_MAX_BYTES, BLOG_IMAGE_MAX_SIDE, blogImageKey, blogImageUrl, imagesIn, ORPHAN_AGE_MS,
} from '../domain/blog-image.js';

// 블로그 글에 넣는 사진. 주인장이 올리고, 글을 저장할 때 본문과 표지에 남은 사진만 그 글에 붙여 둠
// 글에서 빠진 사진, 지운 글의 사진, 쓰다 버린 글의 오래된 사진은 사진 저장소에서도 지움. 임시 글에 든 사진은 남김
@Injectable()
export class BlogImagesService {
  constructor(
    private readonly images: BlogImageRepository,
    private readonly drafts: BlogDraftRepository,
    private readonly storage: ObjectStorage,
  ) {}

  // 파일 내용으로 형식과 크기를 확인함. 확장자나 Content-Type 은 믿지 않음
  async upload(body: unknown) {
    if (!this.storage.ready) throw new ServiceUnavailableException('사진 저장소를 준비 중입니다.');
    if (!Buffer.isBuffer(body)) throw new UnsupportedMediaTypeException('JPG, PNG, WebP 사진만 올릴 수 있습니다.');
    if (body.length > BLOG_IMAGE_MAX_BYTES) throw new PayloadTooLargeException('사진은 5MB 까지 올릴 수 있습니다.');
    const image = imageInfo(body);
    if (!image) throw new UnsupportedMediaTypeException('JPG, PNG, WebP 사진만 올릴 수 있습니다.');
    if (image.width < 1 || image.height < 1 || image.width > BLOG_IMAGE_MAX_SIDE || image.height > BLOG_IMAGE_MAX_SIDE) {
      throw new BadRequestException(`가로와 세로가 ${BLOG_IMAGE_MAX_SIDE}px 이하인 사진을 올려 주세요.`);
    }
    const file = `${randomBytes(12).toString('hex')}.${image.ext}`;
    await this.storage.put(blogImageKey(file), body, image.type);
    await this.images.create({ file, size: body.length });
    // 올릴 때마다 쓰다 만 글의 오래된 사진을 치움. 못 치워도 다음에 다시 함
    this.sweep().catch(() => {});
    return { file, url: blogImageUrl(file), width: image.width, height: image.height };
  }

  read(file: string): Promise<Readable> {
    if (!BLOG_IMAGE_FILE.test(file)) throw new NotFoundException('사진을 찾을 수 없습니다.');
    return this.storage.get(blogImageKey(file));
  }

  /** 글을 저장한 뒤 부름. 본문과 표지에 있는 사진은 이 글에 붙이고, 이 글에서 빠진 사진은 지움 */
  async syncPost(postId: string, body: string, cover: string | null): Promise<void> {
    const used = imagesIn(body, cover);
    await this.images.attach(used, postId);
    const keep = new Set(used);
    await this.discard((await this.images.filesForPost(postId)).filter((file) => !keep.has(file)));
  }

  async removeForPost(postId: string): Promise<void> {
    await this.discard(await this.images.filesForPost(postId));
  }

  private async sweep(): Promise<void> {
    const kept = (await this.drafts.contents()).flatMap((draft) => imagesIn(draft.body, draft.cover));
    await this.discard(await this.images.orphans(new Date(Date.now() - ORPHAN_AGE_MS), kept));
  }

  // 저장소에서 먼저 지우고 기록을 지움. 저장소에서 못 지운 사진은 기록이 남아 다음에 다시 지움
  private async discard(files: string[]): Promise<void> {
    if (!files.length || !this.storage.ready) return;
    const removed: string[] = [];
    for (const file of files) {
      try {
        await this.storage.remove(blogImageKey(file));
        removed.push(file);
      } catch (error) {
        if (error instanceof NotFoundException) removed.push(file);
      }
    }
    await this.images.delete(removed);
  }
}
