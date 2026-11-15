import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Client } from 'minio';
import type { Readable } from 'node:stream';

export const AVATAR_FILE = /^[a-f\d]{24}-[a-f\d]{16}\.(?:jpg|png|webp)$/;

export function avatarUrl(file?: string | null): string | null {
  return file ? `/api/community/avatars/${file}` : null;
}

// 프로필 사진을 넣는 MinIO 버킷. 버킷과 API 전용 계정은 deploy/minio-ensure-bucket.sh 가 만듦
// 버킷은 공개하지 않고, 사진은 API 가 읽어서 내보냄 (GET /api/community/avatars/:file)
@Injectable()
export class CommunityStorageService {
  private readonly endpoint = process.env.MINIO_ENDPOINT;
  private readonly accessKey = process.env.MINIO_ACCESS_KEY;
  private readonly secretKey = process.env.MINIO_SECRET_KEY;
  private readonly bucket = process.env.MINIO_BUCKET || 'community-media';
  readonly ready = Boolean(this.endpoint && this.accessKey && this.secretKey);

  private readonly client = this.ready ? (() => {
    const url = new URL(this.endpoint!);
    return new Client({
      endPoint: url.hostname,
      port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)),
      useSSL: url.protocol === 'https:',
      accessKey: this.accessKey!,
      secretKey: this.secretKey!,
      // 지역을 정해 두면 버킷 위치 조회를 건너뜀. API 계정에는 객체 읽기, 쓰기, 삭제 권한만 있음
      region: 'us-east-1',
    });
  })() : null;

  private get store(): Client {
    if (!this.client) throw new ServiceUnavailableException('사진 저장소를 준비 중입니다.');
    return this.client;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.store.putObject(this.bucket, key, body, body.length, { 'Content-Type': contentType });
  }

  async get(key: string): Promise<Readable> {
    try {
      return await this.store.getObject(this.bucket, key);
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'NoSuchKey') {
        throw new NotFoundException('사진을 찾을 수 없습니다.');
      }
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    await this.store.removeObject(this.bucket, key);
  }
}
