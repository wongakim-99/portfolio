import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VisitsService } from './application/visits.service.js';
import { VisitRepository } from './domain/visit.js';
import { MongoVisitRepository } from './infrastructure/mongo-visit.repository.js';
import { ViewCounter, ViewCounterSchema } from './infrastructure/view-counter.schema.js';
import { ViewVisitor, ViewVisitorSchema } from './infrastructure/view-visitor.schema.js';
import { VisitsController } from './presentation/visits.controller.js';

// 방문 수 영역: 홈의 누적 방문 수 (/api/views)
@Module({
  imports: [MongooseModule.forFeature([
    { name: ViewCounter.name, schema: ViewCounterSchema },
    { name: ViewVisitor.name, schema: ViewVisitorSchema },
  ])],
  controllers: [VisitsController],
  providers: [VisitsService, { provide: VisitRepository, useClass: MongoVisitRepository }],
})
export class VisitsModule {}
