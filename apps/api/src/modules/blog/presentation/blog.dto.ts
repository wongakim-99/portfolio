import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsMongoId, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { oneLine, trim } from '../../../shared/http/transforms.js';
import { normalizeTags, ROOM_MAX, ROOM_NAME_MAX, TAG_MAX, VISIBILITIES, type Visibility } from '../domain/blog.js';
import { BLOG_IMAGE_FILE } from '../domain/blog-image.js';
import { PROOF_MAX, PROOF_PROBLEM_IDS } from '../domain/proof.js';
import { MINUTES_MAX } from '../domain/writing.js';

const tagList = ({ value }: { value: unknown }) => (Array.isArray(value) ? normalizeTags(value) : value);

// 글 길이 제한. 블로그 글쓰기 페이지(apps/web/src/entities/blog-post)도 같은 값을 씀
export class WriteBlogPostDto {
  @Transform(oneLine)
  @IsString()
  @Length(2, 120)
  title: string;

  @Transform(trim)
  @IsString()
  @Length(1, 50_000)
  body: string;

  @IsIn(VISIBILITIES)
  visibility: Visibility;

  @IsOptional()
  @Transform(tagList)
  @IsArray()
  @ArrayMaxSize(TAG_MAX)
  @IsString({ each: true })
  @Length(1, 20, { each: true })
  tags?: string[];

  // 이 블로그에 올린 사진 파일 이름만. null 이면 표지를 빼고 본문 첫 사진을 씀
  @IsOptional()
  @Matches(BLOG_IMAGE_FILE)
  cover?: string | null;

  // 글이 들 방. null 이면 방 밖. 보내지 않으면 고칠 때 원래 방을 그대로 둠
  @IsOptional()
  @IsMongoId()
  roomId?: string | null;
}

// 임시저장. 쓰는 중이라 제목, 본문이 비어도 받고 길이 한도만 글과 같게 봄
export class BlogDraftDto {
  @Transform(oneLine)
  @IsString()
  @MaxLength(120)
  title: string;

  @IsString()
  @MaxLength(50_000)
  body: string;

  @IsIn(VISIBILITIES)
  visibility: Visibility;

  @IsOptional()
  @Transform(tagList)
  @IsArray()
  @ArrayMaxSize(TAG_MAX)
  @IsString({ each: true })
  @Length(1, 20, { each: true })
  tags?: string[];

  @IsOptional()
  @Matches(BLOG_IMAGE_FILE)
  cover?: string | null;

  @IsOptional()
  @IsMongoId()
  roomId?: string | null;
}

// 책상 달력의 쓴 시간. 글쓰기 화면이 글을 고친 분(UTC 분)을 모아 보냄. 받을 수 있는 때인지는 서비스가 거름
export class WritingMinutesDto {
  @IsArray()
  @ArrayMaxSize(MINUTES_MAX)
  @IsInt({ each: true })
  minutes: number[];
}

export class RoomNameDto {
  @Transform(oneLine)
  @IsString()
  @Length(1, ROOM_NAME_MAX)
  name: string;
}

export class RoomOrderDto {
  @IsArray()
  @ArrayMaxSize(ROOM_MAX)
  @IsMongoId({ each: true })
  ids: string[];
}

class RoomAssignment {
  @IsMongoId()
  postId: string;

  @IsMongoId()
  roomId: string;
}

// 주인장이 확인한 AI 추천을 한 번에 넣음
export class RoomAssignDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RoomAssignment)
  assignments: RoomAssignment[];
}

// 글쓰기 화면의 'AI 추천'. 저장 전 글이라 길이만 봄
export class RoomDraftDto {
  @Transform(oneLine)
  @IsString()
  @Length(0, 120)
  title: string;

  @IsString()
  @MaxLength(50_000)
  body: string;

  @IsOptional()
  @Transform(tagList)
  @IsArray()
  @ArrayMaxSize(TAG_MAX)
  @IsString({ each: true })
  tags?: string[];
}

export class AccessRequestDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  message?: string;
}

// 잠긴 글의 증명 제출. problem 은 화면 문제지의 id
export class ProofDto {
  @IsIn(PROOF_PROBLEM_IDS)
  problem: string;

  @Transform(trim)
  @IsString()
  @Length(1, PROOF_MAX)
  proof: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  attempt?: number;
}

export class ApproveDto {
  // post 는 그 글만, all 은 허락받은 사람만 보는 글 전부
  @IsIn(['post', 'all'])
  scope: 'post' | 'all';
}
