import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { VISIBILITIES, type Visibility } from './blog.schemas.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const oneLine = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);

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
