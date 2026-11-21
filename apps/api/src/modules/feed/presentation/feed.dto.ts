import { Transform } from 'class-transformer';
import { IsEnum, IsString, Length } from 'class-validator';
import { oneLine, trim } from '../../../shared/http/transforms.js';
import { REPORT_REASONS, REPORT_TARGETS, type ReportReason, type ReportTarget } from '../domain/feed.js';

// 글 길이 제한. 피드 글쓰기 페이지(apps/web/src/entities/post)도 같은 값을 씀
export class WritePostDto {
  @Transform(oneLine)
  @IsString()
  @Length(5, 120)
  title: string;

  @Transform(trim)
  @IsString()
  @Length(20, 20_000)
  body: string;
}

export class WriteCommentDto {
  @Transform(trim)
  @IsString()
  @Length(2, 2_000)
  body: string;
}

export class ReportDto {
  @IsEnum(REPORT_TARGETS)
  targetType: ReportTarget;

  @IsString()
  @Length(24, 24)
  targetId: string;

  @IsEnum(REPORT_REASONS)
  reason: ReportReason;
}
