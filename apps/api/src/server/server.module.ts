import { Module } from '@nestjs/common';
import { ServerController } from './server.controller.js';
import { ServerService } from './server.service.js';

@Module({ controllers: [ServerController], providers: [ServerService] })
export class ServerModule {}
