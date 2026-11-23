import { Body, Controller, Delete, Get, Header, HttpCode, Patch, Post, Put, Req } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { jsonOnly } from '../../../shared/http/json-only.js';
import { assertSameOrigin } from '../../../shared/http/same-origin.js';
import { RequirePermission } from '../../identity/index.js';
import { BlogAccessService } from '../application/blog-access.service.js';
import { BlogRoomsService } from '../application/blog-rooms.service.js';
import { ProofGradingService } from '../application/proof-grading.service.js';
import { ApproveDto, RoomAssignDto, RoomDraftDto, RoomNameDto, RoomOrderDto } from './blog.dto.js';

// 관리실의 블로그 열람 요청과 허락 명단, 오늘 증명 채점 사용량 (blog:grant), 블로그 방 (blog:write)
@Controller('blog/admin')
export class BlogAdminController {
  constructor(
    private readonly access: BlogAccessService,
    private readonly proofs: ProofGradingService,
    private readonly rooms: BlogRoomsService,
  ) {}

  @Get('rooms')
  @SkipThrottle()
  @Header('Cache-Control', 'private, no-store')
  @RequirePermission('blog:write')
  async roomOverview() {
    return this.rooms.overview();
  }

  @Post('rooms')
  @RequirePermission('blog:write')
  async createRoom(@Body() dto: RoomNameDto, @Req() req: Request) {
    assertSameOrigin(req);
    jsonOnly(req);
    return { room: await this.rooms.create(dto.name) };
  }

  @Patch('rooms/:id')
  @HttpCode(204)
  @RequirePermission('blog:write')
  async renameRoom(@Body() dto: RoomNameDto, @Req() req: Request) {
    assertSameOrigin(req);
    jsonOnly(req);
    await this.rooms.rename(req.params.id as string, dto.name);
  }

  @Put('rooms/order')
  @HttpCode(204)
  @RequirePermission('blog:write')
  async reorderRooms(@Body() dto: RoomOrderDto, @Req() req: Request) {
    assertSameOrigin(req);
    jsonOnly(req);
    await this.rooms.reorder(dto.ids);
  }

  @Delete('rooms/:id')
  @HttpCode(204)
  @RequirePermission('blog:write')
  async removeRoom(@Req() req: Request) {
    assertSameOrigin(req);
    await this.rooms.remove(req.params.id as string);
  }

  // 방이 없는 글마다 AI 가 고른 방. 저장은 하지 않음. 바깥 AI 를 부르므로 한 시간에 몇 번만
  @Post('rooms/suggest')
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @RequirePermission('blog:write')
  async suggestRooms(@Req() req: Request) {
    assertSameOrigin(req);
    return this.rooms.suggestForUnsorted();
  }

  // 글쓰기 화면의 'AI 추천'
  @Post('rooms/suggest-draft')
  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  @RequirePermission('blog:write')
  async suggestDraftRoom(@Body() dto: RoomDraftDto, @Req() req: Request) {
    assertSameOrigin(req);
    jsonOnly(req);
    return this.rooms.suggestForDraft(dto);
  }

  // 주인장이 확인한 추천을 글에 넣음
  @Post('rooms/assign')
  @RequirePermission('blog:write')
  async assignRooms(@Body() dto: RoomAssignDto, @Req() req: Request) {
    assertSameOrigin(req);
    jsonOnly(req);
    return this.rooms.assign(dto.assignments);
  }

  @Get('proof-usage')
  @SkipThrottle()
  @Header('Cache-Control', 'private, no-store')
  @RequirePermission('blog:grant')
  async proofUsage() {
    return this.proofs.today();
  }

  @Get('requests')
  @SkipThrottle()
  @Header('Cache-Control', 'private, no-store')
  @RequirePermission('blog:grant')
  async requests() {
    return { requests: await this.access.pendingRequests() };
  }

  @Post('requests/:id/approve')
  @HttpCode(204)
  @RequirePermission('blog:grant')
  async approve(@Body() dto: ApproveDto, @Req() req: Request) {
    assertSameOrigin(req);
    jsonOnly(req);
    await this.access.approve(req.params.id as string, dto.scope);
  }

  @Post('requests/:id/reject')
  @HttpCode(204)
  @RequirePermission('blog:grant')
  async reject(@Req() req: Request) {
    assertSameOrigin(req);
    await this.access.reject(req.params.id as string);
  }

  @Get('grants')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermission('blog:grant')
  async grants() {
    return { grants: await this.access.grantList() };
  }

  @Delete('grants/:id')
  @HttpCode(204)
  @RequirePermission('blog:grant')
  async revoke(@Req() req: Request) {
    assertSameOrigin(req);
    await this.access.revoke(req.params.id as string);
  }
}
