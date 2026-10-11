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

  createdAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ createdAt: -1 });
