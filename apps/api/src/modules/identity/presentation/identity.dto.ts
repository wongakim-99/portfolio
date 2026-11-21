import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsString, Length, MaxLength } from 'class-validator';
import { lowerEmail, oneLine, trim } from '../../../shared/http/transforms.js';
import { ROLES, type Role } from '../domain/role.js';

// 새 비밀번호 길이. 페이지의 minLength 와 안내 문구(apps/web/src/features/auth, change-password)도 같은 값을 씀
const PASSWORD_MIN = 10;
const PASSWORD_MAX = 128;

export class RegisterDto {
  @Transform(lowerEmail)
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
  @Transform(lowerEmail)
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
  @Transform(lowerEmail)
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

export class RoleDto {
  @Transform(lowerEmail)
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
