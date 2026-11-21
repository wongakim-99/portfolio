import { Module } from '@nestjs/common';
import { FeedModule } from '../feed/index.js';
import { IdentityModule } from '../identity/index.js';
import { MessagesModule } from '../messages/index.js';
import { AdminSummaryService } from './application/admin-summary.service.js';
import { AdminSummaryController } from './presentation/admin-summary.controller.js';

// 관리실 요약: 여러 영역의 숫자를 한 번에 모아 주는 곳. 자기 데이터는 없음
@Module({
  imports: [IdentityModule, FeedModule, MessagesModule],
  controllers: [AdminSummaryController],
  providers: [AdminSummaryService],
})
export class BackofficeModule {}
