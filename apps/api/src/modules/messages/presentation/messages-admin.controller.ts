import { Controller, Delete, Get, Header, HttpCode, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { assertSameOrigin } from '../../../shared/http/same-origin.js';
import { RequirePermission } from '../../identity/index.js';
import { MessagesService } from '../application/messages.service.js';

// 관리실 쪽지함. 관리자 세션이나 서버의 ADMIN_TOKEN 으로 씀
@Controller('community/admin/messages')
export class MessagesAdminController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @RequirePermission('messages:read')
  async inbox(@Query('before') before?: string) {
    return { ...(await this.messages.inbox(before)), unread: await this.messages.unreadCount() };
  }

  // 쪽지함을 열면 그때까지 온 쪽지를 읽은 것으로 바꿈
  @Post('read')
  @HttpCode(204)
  @RequirePermission('messages:read')
  async markRead(@Req() req: Request) {
    assertSameOrigin(req);
    await this.messages.markAllRead();
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('messages:delete')
  async remove(@Req() req: Request) {
    assertSameOrigin(req);
    await this.messages.remove(req.params.id as string);
  }
}
