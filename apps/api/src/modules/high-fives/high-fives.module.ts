import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HighFivesService } from './application/high-fives.service.js';
import { HighFiveRepository } from './domain/high-five.js';
import { HighFiveCounter, HighFiveCounterSchema } from './infrastructure/high-five-counter.schema.js';
import { HighFiveMark, HighFiveMarkSchema } from './infrastructure/high-five-mark.schema.js';
import { MongoHighFiveRepository } from './infrastructure/mongo-high-five.repository.js';
import { HighFivesController } from './presentation/high-fives.controller.js';

// 하이파이브 영역: 홈의 하이파이브 누적 수 (/api/high-fives)
@Module({
  imports: [MongooseModule.forFeature([
    { name: HighFiveCounter.name, schema: HighFiveCounterSchema },
    { name: HighFiveMark.name, schema: HighFiveMarkSchema },
  ])],
  controllers: [HighFivesController],
  providers: [HighFivesService, { provide: HighFiveRepository, useClass: MongoHighFiveRepository }],
})
export class HighFivesModule {}
