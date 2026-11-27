import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes } from 'mongoose';
import { KEEP_DAYS, type HostMinute, type ProcessMinute, type TrafficMinute } from '../domain/metrics.js';

// 관리실 서버 상태의 1분 줄. 7일이 지나면 Mongo 가 TTL 색인으로 지움
// 재시작한 분은 같은 minute 로 두 줄이 생길 수 있어 고유 색인을 두지 않고, 그래프에서 합쳐 셈
@Schema({ collection: 'ops_minutes', versionKey: false })
export class OpsMinute {
  @Prop({ type: Date, required: true })
  minute: Date;

  @Prop({ type: SchemaTypes.Mixed, required: true })
  traffic: TrafficMinute;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  process: ProcessMinute | null;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  host: HostMinute | null;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  db: { up: boolean; ms: number | null } | null;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  storage: { up: boolean; ms: number } | null;
}

export const OpsMinuteSchema = SchemaFactory.createForClass(OpsMinute);
OpsMinuteSchema.index({ minute: 1 }, { expireAfterSeconds: KEEP_DAYS * 86_400 });
