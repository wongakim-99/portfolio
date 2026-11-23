import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsMongoId, IsOptional, IsString, IsUrl, Length, Matches, MaxLength, ValidateIf } from 'class-validator';
import { oneLine, trim } from '../../../shared/http/transforms.js';
import { FEED_IMAGE_FILE } from '../domain/feed-media.js';
import { POST_PHOTOS_MAX, REPORT_REASONS, REPORT_TARGETS, type ReportReason, type ReportTarget } from '../domain/feed.js';

// 글 길이 제한. 피드 글쓰기 화면(apps/web/src/entities/post)도 같은 값을 씀
// 글은 500자, 사진 4장, 링크 하나(글, 사진, 링크 가운데 하나만 있어도 됨). 제목은 예전 긴 글을 고칠 때만 옴 (domain/feed.ts 의 postProblem)
export class WritePostDto {
  @IsOptional()
  @Transform(oneLine)
  @IsString()
  @ValidateIf((dto: WritePostDto) => Boolean(dto.title))
  @Length(5, 120)
  title?: string;

  @Transform(trim)
  @IsString()
  @MaxLength(20_000)
  body: string;

  // 본문과 따로 붙인 링크. http, https 주소만
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  @ValidateIf((dto: WritePostDto) => Boolean(dto.link))
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }, { message: '링크는 http:// 나 https:// 로 시작하는 주소로 넣어 주세요.' })
  link?: string;

  // 이 회원이 피드에 올린 사진 파일 이름
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(POST_PHOTOS_MAX)
  @Matches(FEED_IMAGE_FILE, { each: true })
  photos?: string[];
}

export class WriteCommentDto {
  @Transform(trim)
  @IsString()
  @Length(1, 2_000)
  body: string;

  // 답글에 다는 답글이면 그 답글 ID
  @IsOptional()
  @IsMongoId()
  parentId?: string;
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
