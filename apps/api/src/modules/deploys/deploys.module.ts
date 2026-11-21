import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DeploysService } from './application/deploys.service.js';
import { DeployRepository } from './domain/deploy.js';
import { Deploy, DeploySchema } from './infrastructure/deploy.schema.js';
import { MongoDeployRepository } from './infrastructure/mongo-deploy.repository.js';
import { DeploysController } from './presentation/deploys.controller.js';

// 배포 기록 영역: 홈 영수증과 숨은 터미널 git log (/api/deploys)
@Module({
  imports: [MongooseModule.forFeature([{ name: Deploy.name, schema: DeploySchema }])],
  controllers: [DeploysController],
  providers: [DeploysService, { provide: DeployRepository, useClass: MongoDeployRepository }],
})
export class DeploysModule {}
