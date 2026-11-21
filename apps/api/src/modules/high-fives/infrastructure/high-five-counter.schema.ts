import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

// 받은 하이파이브 누적 수. _id 가 페이지 키('home')
@Schema({ collection: 'high_five_counters', versionKey: false })
export class HighFiveCounter {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: Number, default: 0 })
  total: number;
}

export const HighFiveCounterSchema = SchemaFactory.createForClass(HighFiveCounter);
