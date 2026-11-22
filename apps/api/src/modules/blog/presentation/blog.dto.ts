import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { oneLine, trim } from '../../../shared/http/transforms.js';
import { normalizeTags, TAG_MAX, VISIBILITIES, type Visibility } from '../domain/blog.js';
import { BLOG_IMAGE_FILE } from '../domain/blog-image.js';
import { PROOF_MAX, PROOF_PROBLEM_IDS } from '../domain/proof.js';

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
