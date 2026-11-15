import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsIn, IsString, Length, MaxLength } from 'class-validator';
import { ROLES, type Role } from './community-roles.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const oneLine = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);
// 새 비밀번호 길이. 페이지의 minlength 와 안내 문구(community.html)도 같은 값을 씀
const PASSWORD_MIN = 10;
const PASSWORD_MAX = 128;

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
  @Length(PASSWORD_MIN, PASSWORD_MAX)
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
  @Length(PASSWORD_MIN, PASSWORD_MAX)
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
  @Length(PASSWORD_MIN, PASSWORD_MAX)
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

export class RoleDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(120)
  email: string;

  @IsIn(ROLES)
  role: Role;
}

export class ProfileDto {
  @Transform(oneLine)
  @IsString()
  @Length(2, 30)
  name: string;

  @Transform(trim)
  @IsString()
  @MaxLength(300)
  bio: string;
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
