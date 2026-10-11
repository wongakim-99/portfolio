import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ViewCounter, ViewCounterSchema } from './schemas/view-counter.schema.js';
import { ViewMark, ViewMarkSchema } from './schemas/view-mark.schema.js';
import { ViewsController } from './views.controller.js';
import { ViewsService } from './views.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ViewCounter.name, schema: ViewCounterSchema },
      { name: ViewMark.name, schema: ViewMarkSchema },
    ]),
  ],
  controllers: [ViewsController],
  providers: [ViewsService],
})
export class ViewsModule {}
