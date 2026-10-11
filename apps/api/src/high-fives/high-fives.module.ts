import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HighFivesController } from './high-fives.controller.js';
import { HighFivesService } from './high-fives.service.js';
import { HighFiveCounter, HighFiveCounterSchema } from './schemas/high-five-counter.schema.js';
import { HighFiveMark, HighFiveMarkSchema } from './schemas/high-five-mark.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HighFiveCounter.name, schema: HighFiveCounterSchema },
      { name: HighFiveMark.name, schema: HighFiveMarkSchema },
    ]),
  ],
  controllers: [HighFivesController],
  providers: [HighFivesService],
})
export class HighFivesModule {}
