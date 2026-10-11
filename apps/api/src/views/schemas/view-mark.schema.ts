import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export const VIEW_DEDUPE_SECONDS = 30 * 60;

// 같은 방문자의 새로고침을 한 번으로 세기 위한 표식. TTL 인덱스로 30분 뒤 자동 삭제
@Schema({ collection: 'view_marks', versionKey: false })
export class ViewMark {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: Date, default: () => new Date(), expires: VIEW_DEDUPE_SECONDS })
  createdAt: Date;
}

export const ViewMarkSchema = SchemaFactory.createForClass(ViewMark);
