import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv, type Env } from './config/env.js';
import { BackofficeModule } from './modules/backoffice/index.js';
import { BlogModule } from './modules/blog/index.js';
import { DeploysModule } from './modules/deploys/index.js';
import { FeedModule } from './modules/feed/index.js';
import { HighFivesModule } from './modules/high-fives/index.js';
import { IdentityModule } from './modules/identity/index.js';
import { MessagesModule } from './modules/messages/index.js';
import { OpsModule } from './modules/ops/index.js';
import { VisitsModule } from './modules/visits/index.js';
import { EventsModule } from './shared/events/events.module.js';
import { MailModule } from './shared/infrastructure/mail/mail.module.js';
import { StorageModule } from './shared/infrastructure/storage/storage.module.js';
import { TelemetryModule } from './shared/infrastructure/telemetry/telemetry.module.js';

// 영역(modules/*)마다 domain, application, infrastructure, presentation 으로 나눔 (CLAUDE.md '백엔드 구조')
// shared 는 여러 영역이 같이 쓰는 기술 조각: 메일, 사진 저장소, 텔레메트리, 영역 사이 이벤트
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
    // 기본: IP 당 1분 60회. 쓰기는 컨트롤러에서 더 좁힘
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    TelemetryModule,
    EventsModule,
    MailModule,
    StorageModule,
    OpsModule,
    VisitsModule,
    HighFivesModule,
    MessagesModule,
    DeploysModule,
    IdentityModule,
    FeedModule,
    BlogModule,
    BackofficeModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
