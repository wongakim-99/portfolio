import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ collection: 'messages', versionKey: false, timestamps: { createdAt: true, updatedAt: false } })
export class Message {
  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String })
  email?: string;

  @Prop({ type: String, required: true })
  message: string;

  @Prop({ type: String, required: true })
  visitorHash: string;

  @Prop({ type: String })
  userAgent?: string;

  // 관리실에서 처음 본 시각. 예전 쪽지에는 필드가 없고, 없으면 안 읽은 것으로 봄
  @Prop({ type: Date, default: null })
  readAt: Date | null;

  createdAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ createdAt: -1 });
