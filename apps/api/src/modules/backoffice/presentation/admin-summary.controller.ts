import { Controller, Get, Header } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { RequirePermission } from '../../identity/index.js';
import { AdminSummaryService } from '../application/admin-summary.service.js';

@Controller('community/admin/summary')
export class AdminSummaryController {
  constructor(private readonly summary: AdminSummaryService) {}

  @Get()
  @SkipThrottle()
  @Header('Cache-Control', 'private, no-store')
  @RequirePermission('messages:read')
  get() {
    return this.summary.summary();
  }
}
