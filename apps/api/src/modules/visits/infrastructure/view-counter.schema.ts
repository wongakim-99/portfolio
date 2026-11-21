import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

// 페이지별 누적 방문 수. _id 가 페이지 키('home')
@Schema({ collection: 'view_counters', versionKey: false })
export class ViewCounter {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: Number, default: 0 })
  total: number;
}

export const ViewCounterSchema = SchemaFactory.createForClass(ViewCounter);
