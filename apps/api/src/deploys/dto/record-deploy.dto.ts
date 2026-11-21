import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';
import { DEPLOY_RESULTS, type DeployResult } from '../schemas/deploy.schema.js';

const oneLine = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);

export class RecordDeployDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @Matches(/^[0-9a-f]{7,40}$/)
  commit: string;

  @Transform(oneLine)
  @IsString()
  @Length(1, 200)
  subject: string;

  @IsInt()
  @Min(0)
  @Max(36_000)
  durationSec: number;

  @IsIn(DEPLOY_RESULTS)
  result: DeployResult;

  /** 지난 배포를 채워 넣을 때만. 없으면 받은 시각 */
  @IsOptional()
  @IsISO8601()
  deployedAt?: string;
}
