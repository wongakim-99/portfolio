import { Body, Controller, Get, Header, Patch, Req } from '@nestjs/common';
import type { Request } from 'express';
import { jsonOnly } from '../../../shared/http/json-only.js';
import { assertSameOrigin } from '../../../shared/http/same-origin.js';
import { MemberAdminService } from '../application/member-admin.service.js';
import { CurrentUser } from './current-user.js';
import { MemberRoleDto } from './identity.dto.js';
import { RequirePermission } from './permission.guard.js';

// 관리실 회원 칸. 목록은 관리자와 주인장(members:read), 역할 바꾸기는 주인장만(members:role)
// 이메일이 들어 있어서 브라우저와 앞단 어디에도 캐시하지 않음
@Controller('community/admin/members')
export class MembersAdminController {
  constructor(
    private readonly members: MemberAdminService,
    private readonly currentUser: CurrentUser,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @RequirePermission('members:read')
  list() {
    return this.members.roster();
  }

  // ADMIN_TOKEN 만으로는 누가 바꿨는지 알 수 없어서 로그인한 주인장 세션이 있어야 함
  @Patch(':id/role')
  @RequirePermission('members:role')
  async setRole(@Body() dto: MemberRoleDto, @Req() req: Request) {
    assertSameOrigin(req);
    jsonOnly(req);
    const actor = await this.currentUser.require(req, '로그인한 주인장만 역할을 바꿀 수 있습니다.');
    return { member: await this.members.setRole(actor, req.params.id as string, dto.role) };
  }
}
