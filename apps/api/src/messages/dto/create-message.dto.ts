import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateMessageDto {
  @Transform(trim)
  @IsString()
  @Length(1, 40)
  name: string;

  // 빈 칸으로 보내면 없는 것으로 봄
  @Transform(({ value }) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined))
  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;

  @Transform(trim)
  @IsString()
  @Length(5, 2000)
  message: string;

  // 사람 눈에는 안 보이는 칸(honeypot). 봇이 채우면 저장하지 않음
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
