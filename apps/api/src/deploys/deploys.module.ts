import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DeploysController } from './deploys.controller.js';
import { DeploysService } from './deploys.service.js';
import { Deploy, DeploySchema } from './schemas/deploy.schema.js';

@Module({
  imports: [MongooseModule.forFeature([{ name: Deploy.name, schema: DeploySchema }])],
  controllers: [DeploysController],
  providers: [DeploysService],
})
export class DeploysModule {}
