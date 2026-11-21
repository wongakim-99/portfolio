import { Injectable } from '@nestjs/common';
import { ModerationService } from '../../feed/index.js';
import { MessagesService } from '../../messages/index.js';

// 관리실 버튼 옆 배지: 새 쪽지 수와 처리할 신고 수. 여러 영역의 숫자를 모으기만 함
@Injectable()
export class AdminSummaryService {
  constructor(
    private readonly messages: MessagesService,
    private readonly moderation: ModerationService,
  ) {}

  async summary() {
    const [unreadMessages, reports] = await Promise.all([this.messages.unreadCount(), this.moderation.reportCount()]);
    return { unreadMessages, reports };
  }
}
