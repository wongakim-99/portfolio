import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

// 방문자별 하루 하이파이브 수. _id 는 '방문자해시:날짜', 이틀 뒤 TTL 인덱스로 삭제
@Schema({ collection: 'high_five_marks', versionKey: false })
export class HighFiveMark {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: Number, default: 0 })
  count: number;

  @Prop({ type: Date, default: () => new Date(), expires: 2 * 24 * 60 * 60 })
  createdAt: Date;
}

export const HighFiveMarkSchema = SchemaFactory.createForClass(HighFiveMark);
