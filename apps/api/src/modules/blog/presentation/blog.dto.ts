import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { oneLine, trim } from '../../../shared/http/transforms.js';
import { normalizeTags, TAG_MAX, VISIBILITIES, type Visibility } from '../domain/blog.js';

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
}

export class AccessRequestDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  message?: string;
}

export class ApproveDto {
  // post 는 그 글만, all 은 허락받은 사람만 보는 글 전부
  @IsIn(['post', 'all'])
  scope: 'post' | 'all';
}
