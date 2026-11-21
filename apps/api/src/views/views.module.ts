import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ViewCounter, ViewCounterSchema } from './schemas/view-counter.schema.js';
import { ViewVisitor, ViewVisitorSchema } from './schemas/view-visitor.schema.js';
import { ViewsController } from './views.controller.js';
import { ViewsService } from './views.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ViewCounter.name, schema: ViewCounterSchema },
      { name: ViewVisitor.name, schema: ViewVisitorSchema },
    ]),
  ],
  controllers: [ViewsController],
  providers: [ViewsService],
})
export class ViewsModule {}
