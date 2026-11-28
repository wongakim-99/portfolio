import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { GUARD_KINDS, KEEP_EVENT_DAYS, type GuardKind } from '../domain/guard.js';

// 봇 방어 기록. IP 는 salt 섞은 해시와 끝을 가린 주소만 남김

@Schema({ collection: 'guard_events', versionKey: false })
export class GuardEvent {
  @Prop({ type: Date, required: true })
  at: Date;

  @Prop({ type: String, required: true, enum: GUARD_KINDS })
  kind: GuardKind;

  @Prop({ type: String, required: true })
  ipHash: string;

  @Prop({ type: String, required: true })
  ip: string;

  @Prop({ type: String, default: '' })
  method: string;

  @Prop({ type: String, default: '' })
  path: string;

  @Prop({ type: String, default: '' })
  agent: string;
}

export const GuardEventSchema = SchemaFactory.createForClass(GuardEvent);
// 30일이 지나면 Mongo 가 지움
GuardEventSchema.index({ at: 1 }, { expireAfterSeconds: KEEP_EVENT_DAYS * 86_400 });

@Schema({ collection: 'guard_bans', versionKey: false })
export class GuardBan {
  @Prop({ type: String, required: true })
  ipHash: string;

  @Prop({ type: String, required: true })
  ip: string;

  @Prop({ type: String, required: true, enum: GUARD_KINDS })
  kind: GuardKind;

  @Prop({ type: String, required: true })
  reason: string;

  @Prop({ type: Date, required: true })
  since: Date;

  @Prop({ type: Date, required: true })
  until: Date;

  @Prop({ type: Number, default: 0 })
  blocked: number;
}

export const GuardBanSchema = SchemaFactory.createForClass(GuardBan);
// 풀린 뒤 7일 동안만 남김
GuardBanSchema.index({ until: 1 }, { expireAfterSeconds: 7 * 86_400 });
GuardBanSchema.index({ ipHash: 1, until: -1 });
