import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { VISIBILITIES, type Visibility } from './blog.schemas.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const oneLine = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);
// 앞의 # 과 양끝 공백을 떼고, 빈 것과 (대소문자만 다른 것까지) 겹치는 것은 하나만 남김
const tagList = ({ value }: { value: unknown }) => {
  if (!Array.isArray(value)) return value;
  const seen = new Set<string>();
  return value
    .map((tag) => (typeof tag === 'string' ? tag.replace(/^#+/, '').trim().replace(/\s+/g, ' ') : tag))
    .filter((tag) => {
      if (typeof tag !== 'string') return true;
      const key = tag.toLowerCase();
      if (!tag || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

export const TAG_MAX = 8;

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
