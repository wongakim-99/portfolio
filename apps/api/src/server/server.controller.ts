import { Controller, Get } from '@nestjs/common';
import { ServerService } from './server.service.js';

@Controller('server')
export class ServerController {
  constructor(private readonly server: ServerService) {}

  @Get()
  status() {
    return this.server.status();
  }
}
