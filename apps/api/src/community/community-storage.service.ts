import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Client } from 'minio';
import { performance } from 'node:perf_hooks';
import type { Readable } from 'node:stream';
import { TelemetryService } from '../telemetry/telemetry.service.js';

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
  private healthCache?: { at: number; value: Promise<{ up: boolean; ms: number }> };

  constructor(private readonly telemetry: TelemetryService) {}

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

  // 관리실 토폴로지에 api 와 minio 사이 작업으로 보임
  private async timed<T>(label: string, run: () => Promise<T>): Promise<T> {
    const started = performance.now();
    try {
      const value = await run();
      this.telemetry.record('storage', label, performance.now() - started);
      return value;
    } catch (error) {
      const missing = typeof error === 'object' && error !== null && 'code' in error && error.code === 'NoSuchKey';
      this.telemetry.record('storage', label, performance.now() - started, missing ? 404 : 500);
      if (missing) throw new NotFoundException('사진을 찾을 수 없습니다.');
      throw error;
    }
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.timed('PUT', () => this.store.putObject(this.bucket, key, body, body.length, { 'Content-Type': contentType }));
  }

  get(key: string): Promise<Readable> {
    return this.timed('GET', () => this.store.getObject(this.bucket, key));
  }

  async remove(key: string): Promise<void> {
    await this.timed('DELETE', () => this.store.removeObject(this.bucket, key));
  }

  // MinIO 가 살아 있는지. 관리실이 2초마다 묻더라도 10초에 한 번만 실제로 확인함
  health(): Promise<{ up: boolean; ms: number }> | null {
    if (!this.ready) return null;
    if (!this.healthCache || Date.now() - this.healthCache.at > 10_000) {
      const started = performance.now();
      const done = (up: boolean) => ({ up, ms: Math.round(performance.now() - started) });
      this.healthCache = {
        at: Date.now(),
        value: fetch(new URL('/minio/health/live', this.endpoint), { signal: AbortSignal.timeout(2_000) })
          .then((response) => done(response.ok), () => done(false)),
      };
    }
    return this.healthCache.value;
  }
}
