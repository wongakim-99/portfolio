import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { SkipThrottle } from '@nestjs/throttler';
import type { Connection } from 'mongoose';

@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  // 배포 스크립트가 이 응답으로 새 버전이 떴는지 판단함
  @Get()
  async check() {
    const db = await this.pingDb();
    const body = { status: db === 'up' ? 'ok' : 'error', db, uptime: Math.round(process.uptime()) };
    if (db !== 'up') {
      throw new ServiceUnavailableException(body);
    }
    return body;
  }

  private async pingDb(): Promise<'up' | 'down'> {
    try {
      await this.connection.db?.admin().ping();
      return this.connection.db ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }
}
