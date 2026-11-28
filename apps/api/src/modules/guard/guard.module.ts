import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IdentityModule } from '../identity/index.js';
import { GuardService } from './application/guard.service.js';
import { GuardBlocklist, GuardStore } from './domain/guard.js';
import { FileGuardBlocklist } from './infrastructure/file-guard-blocklist.js';
import { GuardBan, GuardBanSchema, GuardEvent, GuardEventSchema } from './infrastructure/guard.schemas.js';
import { MongoGuardStore } from './infrastructure/mongo-guard.store.js';
import { GuardAdminController, GuardTrapController } from './presentation/guard.controllers.js';

// 봇 방어 영역: 털기 주소 덫, 횟수 초과와 로그인 실패 세기, 자동 차단, 관리 패널 IP 차단 목록, 관리실 '이상 징후' (/api/guard, /api/community/admin/guard)
@Module({
  imports: [
    IdentityModule,
    MongooseModule.forFeature([
      { name: GuardEvent.name, schema: GuardEventSchema },
      { name: GuardBan.name, schema: GuardBanSchema },
    ]),
  ],
  controllers: [GuardTrapController, GuardAdminController],
  providers: [GuardService, { provide: GuardStore, useClass: MongoGuardStore }, { provide: GuardBlocklist, useClass: FileGuardBlocklist }],
  exports: [GuardService],
})
export class GuardModule {}
