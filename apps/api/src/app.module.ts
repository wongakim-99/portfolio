import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv, type Env } from './env.js';
import { CommunityModule } from './community/community.module.js';
import { DeploysModule } from './deploys/deploys.module.js';
import { HealthModule } from './health/health.module.js';
import { HighFivesModule } from './high-fives/high-fives.module.js';
import { MessagesModule } from './messages/messages.module.js';
import { ServerModule } from './server/server.module.js';
import { TelemetryModule } from './telemetry/telemetry.module.js';
import { ViewsModule } from './views/views.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        uri: config.get('MONGODB_URI', { infer: true }),
        // 관리실 토폴로지가 DB 명령을 셀 수 있도록 명령 이벤트를 켬 (TelemetryService)
        monitorCommands: true,
      }),
    }),
    // 기본: IP 당 1분 60회. 메시지 작성은 컨트롤러에서 더 좁힘
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    TelemetryModule,
    HealthModule,
    ViewsModule,
    MessagesModule,
    ServerModule,
    HighFivesModule,
    CommunityModule,
    DeploysModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
