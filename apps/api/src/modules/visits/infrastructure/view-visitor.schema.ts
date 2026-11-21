import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

// 한 번 센 방문자 표식. _id 는 '페이지:IP 해시' 이고 지우지 않으므로 같은 IP 는 평생 한 번만 셈
// (2026-11 까지는 view_marks 에 30분짜리 표식을 두고 다시 오면 또 셌음. 그때까지의 수는 view_counters 에 그대로 이어짐)
@Schema({ collection: 'view_visitors', versionKey: false })
export class ViewVisitor {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: Date, default: () => new Date() })
  firstSeenAt: Date;
}

export const ViewVisitorSchema = SchemaFactory.createForClass(ViewVisitor);
