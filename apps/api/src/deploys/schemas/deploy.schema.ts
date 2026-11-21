import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export const DEPLOY_RESULTS = ['success', 'rolled-back'] as const;
export type DeployResult = (typeof DEPLOY_RESULTS)[number];

// 홈서버 배포 기록 한 건. deploy/deploy.sh 가 배포를 마칠 때마다 남기고, 홈의 영수증과 숨은 터미널의 git log 가 읽음
@Schema({ collection: 'deploys', versionKey: false })
export class Deploy {
  /** 커밋 앞 7자 */
  @Prop({ type: String, required: true })
  commit: string;

  /** 커밋 제목 한 줄 */
  @Prop({ type: String, required: true })
  subject: string;

  @Prop({ type: Date, required: true })
  deployedAt: Date;

  /** deploy.sh 가 이미지를 만들고 교체해 확인까지 마치는 데 걸린 시간 */
  @Prop({ type: Number, required: true })
  durationSec: number;

  @Prop({ type: String, enum: DEPLOY_RESULTS, required: true })
  result: DeployResult;
}

export const DeploySchema = SchemaFactory.createForClass(Deploy);
// 같은 기록을 두 번 보내도(지난 배포를 다시 채워 넣을 때 등) 한 건만 남음
DeploySchema.index({ commit: 1, deployedAt: 1 }, { unique: true });
DeploySchema.index({ deployedAt: -1 });
