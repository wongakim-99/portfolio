import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsString, Length, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const oneLine = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);

export class RegisterDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(120)
  email: string;

  @Transform(oneLine)
  @IsString()
  @Length(2, 30)
  name: string;

  @IsString()
  @Length(12, 128)
  password: string;
}

export class LoginDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(120)
  email: string;

  @IsString()
  @Length(1, 128)
  password: string;
}

export class ChangePasswordDto {
  @IsString()
  @Length(1, 128)
  currentPassword: string;

  @IsString()
  @Length(12, 128)
  newPassword: string;
}

export class EmailDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(120)
  email: string;
}

export class TokenDto {
  @IsString()
  @Length(43, 43)
  token: string;
}

export class ResetPasswordDto extends TokenDto {
  @IsString()
  @Length(12, 128)
  newPassword: string;
}

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
  @IsEnum(['post', 'comment'])
  targetType: 'post' | 'comment';

  @IsString()
  @Length(24, 24)
  targetId: string;

  @IsEnum(['spam', 'abuse', 'other'])
  reason: 'spam' | 'abuse' | 'other';
}
